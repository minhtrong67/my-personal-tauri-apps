// Media import: metadata, thumbnails, waveforms. Files stay on disk — played straight from the
// local media server (desktop) or from blob URLs (browser) and never copied into memory.
import { state, getMedia, emit, ASPECTS } from './store.js';
import { uid, baseName } from './util.js';
import { inTauri, serveFile, MEDIA_EXTS } from './io.js';
import { queueProxy, cancelProxies } from './proxy.js';

const extOf = (name) => String(name).split('.').pop().toLowerCase();

export function kindOfName(name, mime = '') {
  const t = (mime || '').split('/')[0];
  if (['video', 'audio', 'image'].includes(t)) return t;
  const ext = extOf(name);
  return Object.keys(MEDIA_EXTS).find((k) => MEDIA_EXTS[k].includes(ext)) || null;
}
export const kindOf = (file) => kindOfName(file.name, file.type);

const once = (el, ev, ms = 8000) =>
  new Promise((res, rej) => {
    const to = setTimeout(() => { el.removeEventListener(ev, ok); rej(new Error('timeout')); }, ms);
    const ok = () => { clearTimeout(to); res(); };
    el.addEventListener(ev, ok, { once: true });
  });

function loadEl(tag, url) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    el.crossOrigin = 'anonymous';
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    const to = setTimeout(() => reject(new Error('timeout')), 20000);
    el.onloadedmetadata = () => { clearTimeout(to); resolve(el); };
    el.onerror = () => { clearTimeout(to); reject(new Error('unsupported')); };
    el.src = url;
  });
}

function thumbFrom(src, w, h, th = 120) {
  const tw = Math.max(2, Math.round((th * w) / h));
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  c.getContext('2d').drawImage(src, 0, 0, tw, th);
  return c.toDataURL('image/jpeg', 0.7);
}

async function waveform(getBuffer, size, duration) {
  if (size > 120e6 || !duration) return null;
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ab = await new Ctx(1, 1, 44100).decodeAudioData(await getBuffer());
    const data = ab.getChannelData(0);
    const bins = Math.min(4000, Math.max(50, Math.ceil(duration * 30)));
    const c = document.createElement('canvas');
    c.width = bins; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.9)';
    const step = Math.floor(data.length / bins) || 1;
    for (let i = 0; i < bins; i++) {
      let peak = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 8) peak = Math.max(peak, Math.abs(data[j]));
      const hh = Math.max(1, peak * 44);
      g.fillRect(i, 24 - hh / 2, 1, hh);
    }
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Nearest preset aspect ratio for a given width/height. */
export function nearestAspect(w, h) {
  const r = w / h;
  let best = '16:9', bd = Infinity;
  for (const [k, [a, b]] of Object.entries(ASPECTS)) {
    const d = Math.abs(Math.log(r / (a / b)));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/** Reads metadata, thumbnail and waveform for `m` (m.url must be set). Throws when unsupported. */
async function probe(m) {
  const { url, type: kind } = m;
  if (kind === 'video') {
    const v = await loadEl('video', url);
    m.duration = v.duration; m.w = v.videoWidth; m.h = v.videoHeight;
    if (!isFinite(m.duration) || !m.w) throw new Error('unsupported');
    try {
      v.currentTime = Math.min(0.1, m.duration / 2);
      await once(v, 'seeked');
      m.thumb = thumbFrom(v, m.w, m.h);
    } catch { /* thumbnail is optional */ }
    v.removeAttribute('src'); v.load();
  } else if (kind === 'image') {
    const img = await loadImage(url);
    m.w = img.naturalWidth; m.h = img.naturalHeight; m.el = img;
    m.thumb = thumbFrom(img, m.w, m.h);
  } else {
    const a = await loadEl('audio', url);
    m.duration = a.duration;
    if (!isFinite(m.duration)) throw new Error('unsupported');
    a.removeAttribute('src'); a.load();
    m.wave = await waveform(async () => (await fetch(url)).arrayBuffer(), m.size || 0, m.duration);
  }
}

async function loadImage(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  return img;
}

/** Adds `m` to the library, or re-links a matching offline entry of an opened project. */
function register(m) {
  const off = state.media.find((o) => o.offline && o.name === m.name && (!o.size || !m.size || o.size === m.size));
  if (off) {
    Object.assign(off, m, { id: off.id, offline: false });
    emit('media');
    emit('change');
    return off;
  }
  state.media.push(m);
  emit('media');
  return m;
}

const blank = (o) => ({ id: uid(), size: 0, url: null, file: null, path: null, duration: 0, w: 0, h: 0, thumb: null, wave: null, el: null, offline: false, ...o });

/** Browser: imports File objects (blob URLs). Returns { added, failed }. */
export async function importFiles(files) {
  const added = [];
  const failed = [];
  for (const file of files) {
    const kind = kindOf(file);
    if (!kind) { failed.push(file.name); continue; }
    const url = URL.createObjectURL(file);
    try {
      const m = blank({ name: file.name, type: kind, size: file.size, url, file });
      await probe(m);
      const r = register(m);
      queueProxy(r);
      added.push(r);
    } catch {
      URL.revokeObjectURL(url);
      failed.push(file.name);
    }
  }
  return { added, failed };
}

/** Desktop: imports files by path. Media is served from disk, so nothing is loaded into memory. */
export async function importPaths(paths) {
  const added = [];
  const failed = [];
  for (const path of paths) {
    const name = baseName(path);
    const kind = kindOfName(name);
    if (!kind) { failed.push(name); continue; }
    try {
      const { url, size } = await serveFile(path);
      const m = blank({ name, type: kind, size, url, path });
      await probe(m);
      const r = register(m);
      queueProxy(r);
      added.push(r);
    } catch {
      failed.push(name);
    }
  }
  return { added, failed };
}

/** Points an existing (offline or not) media entry at a new file (desktop). */
export async function relinkPath(id, path) {
  const m = getMedia(id);
  if (!m) return false;
  const { url, size } = await serveFile(path);
  const fresh = blank({ name: baseName(path), type: m.type, size, url, path });
  await probe(fresh);
  Object.assign(m, { ...fresh, id: m.id, offline: false, proxyUrl: null });
  queueProxy(m);
  emit('media');
  emit('change');
  return true;
}

/** Desktop: after opening a project, re-attach every media file that still exists on disk. */
export async function restoreMedia() {
  if (!inTauri) return;
  await Promise.all(state.media.map(async (m) => {
    if (!m.path || m.url) return;
    try {
      const { url, size } = await serveFile(m.path);
      m.url = url;
      if (!m.size) m.size = size;
      if (m.type === 'image') m.el = await loadImage(url);
      m.offline = false;
      queueProxy(m);
    } catch {
      m.url = null; m.offline = true;
    }
  }));
  emit('media');
  emit('change');
}

export function removeMedia(id) {
  const i = state.media.findIndex((m) => m.id === id);
  if (i < 0) return;
  const m = state.media[i];
  if (m.url && m.url.startsWith('blob:')) URL.revokeObjectURL(m.url);
  state.media.splice(i, 1);
  emit('media');
}

export function releaseAllMedia() {
  cancelProxies();
  for (const m of state.media) if (m.url && m.url.startsWith('blob:')) URL.revokeObjectURL(m.url);
}

export const offlineMedia = () => state.media.filter((m) => m.offline);
export { getMedia };

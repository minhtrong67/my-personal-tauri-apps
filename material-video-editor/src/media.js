// Media import: metadata, thumbnails, waveforms. Files stay on disk (blob URLs), never copied into memory.
import { state, getMedia, emit, ASPECTS } from './store.js';
import { uid } from './util.js';

const EXT = {
  video: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'ogv', '3gp'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'],
};

export function kindOf(file) {
  const t = (file.type || '').split('/')[0];
  if (['video', 'audio', 'image'].includes(t)) return t;
  const ext = file.name.split('.').pop().toLowerCase();
  return Object.keys(EXT).find((k) => EXT[k].includes(ext)) || null;
}

const once = (el, ev, ms = 8000) =>
  new Promise((res, rej) => {
    const to = setTimeout(() => { el.removeEventListener(ev, ok); rej(new Error('timeout')); }, ms);
    const ok = () => { clearTimeout(to); res(); };
    el.addEventListener(ev, ok, { once: true });
  });

function loadEl(tag, url) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
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

async function waveform(file, duration) {
  if (file.size > 120e6 || !duration) return null;
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ab = await new Ctx(1, 1, 44100).decodeAudioData(await file.arrayBuffer());
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

/** Imports files. Returns { added: Media[], failed: string[] }. Re-links offline media that matches by name+size. */
export async function importFiles(files) {
  const added = [];
  const failed = [];
  for (const file of files) {
    const kind = kindOf(file);
    if (!kind) { failed.push(file.name); continue; }
    const url = URL.createObjectURL(file);
    try {
      const m = {
        id: uid(), name: file.name, type: kind, size: file.size, url, file, duration: 0, w: 0, h: 0, thumb: null, wave: null, el: null, offline: false,
      };
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
        const img = new Image();
        img.src = url;
        await img.decode();
        m.w = img.naturalWidth; m.h = img.naturalHeight; m.el = img;
        m.thumb = thumbFrom(img, m.w, m.h);
      } else {
        const a = await loadEl('audio', url);
        m.duration = a.duration;
        if (!isFinite(m.duration)) throw new Error('unsupported');
        a.removeAttribute('src'); a.load();
        m.wave = await waveform(file, m.duration);
      }
      // re-link an offline media entry (opened project) with the same file
      const off = state.media.find((o) => o.offline && o.name === file.name && (!o.size || o.size === file.size));
      if (off) {
        Object.assign(off, m, { id: off.id, offline: false });
        emit('media');
        emit('change');
        added.push(off);
      } else {
        state.media.push(m);
        added.push(m);
        emit('media');
      }
    } catch {
      URL.revokeObjectURL(url);
      failed.push(file.name);
    }
  }
  return { added, failed };
}

export function removeMedia(id) {
  const i = state.media.findIndex((m) => m.id === id);
  if (i < 0) return;
  const m = state.media[i];
  if (m.url) URL.revokeObjectURL(m.url);
  state.media.splice(i, 1);
  emit('media');
}

export function releaseAllMedia() {
  for (const m of state.media) if (m.url) URL.revokeObjectURL(m.url);
}

export const offlineMedia = () => state.media.filter((m) => m.offline);
export { getMedia };

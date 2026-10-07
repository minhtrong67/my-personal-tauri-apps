// Playback clock, media element sync, audio graph, canvas rendering and real-time export.
import { state, emit, on, layout, totalDuration, getMedia, allMediaClips, dims } from './store.js';
import { clamp } from './util.js';

const pool = new Map(); // clipId -> { el, node, gain, url }
let ac = null, master = null, monitor = null, exportDest = null;
let cv = null, ctx = null, ov = null, octx = null;
let raf = 0, last = 0, exporting = null;
let dirty = true;
/** Ask for one more preview repaint (the loop is idle while paused and nothing changes). */
export const invalidate = () => { dirty = true; };
for (const ev of ['change', 'select', 'seek', 'reset', 'lang', 'media', 'inspect', 'history']) on(ev, invalidate);
let previewVol = 1;
const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

/* ------------------------------------------------------------------ */
/*  Audio graph                                                       */
/* ------------------------------------------------------------------ */
function ensureAudio() {
  if (ac) return ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  ac = new Ctx();
  master = ac.createGain();
  monitor = ac.createGain();
  monitor.gain.value = previewVol;
  master.connect(monitor);
  monitor.connect(ac.destination);
  return ac;
}

export function setPreviewVolume(v) {
  previewVol = v;
  if (monitor) monitor.gain.value = exporting ? 0 : v;
}

function entryFor(clip) {
  const m = getMedia(clip.mediaId);
  if (!m || !m.url || clip.kind === 'image') return null;
  const src = m.type === 'video' && m.proxyUrl ? m.proxyUrl : m.url;
  let e = pool.get(clip.id);
  if (e && e.url !== src && !state.playing) { destroyEntry(clip.id); e = null; }
  if (e) return e;
  const mk = (tag, url) => {
    const el = document.createElement(tag);
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.playsInline = true;
    el.src = url;
    for (const ev of ['seeked', 'loadeddata', 'canplay']) el.addEventListener(ev, invalidate);
    return el;
  };
  const el = mk(m.type === 'audio' ? 'audio' : 'video', src);
  // with a lightweight proxy the picture comes from the proxy and the sound from the original file
  let aud = null;
  if (src !== m.url) {
    el.muted = true; aud = mk('audio', m.url);
    // a broken proxy must never break playback: fall back to the original file
    el.addEventListener('error', () => { if (m.proxyUrl === src) { m.proxyUrl = null; destroyEntry(clip.id); invalidate(); } });
  }
  let node = null, gain = null;
  try {
    ensureAudio();
    node = ac.createMediaElementSource(aud || el);
    gain = ac.createGain();
    node.connect(gain);
    gain.connect(master);
  } catch { /* falls back to element volume */ }
  e = { el, aud, node, gain, url: src };
  pool.set(clip.id, e);
  return e;
}

function destroyEntry(id) {
  const e = pool.get(id);
  if (!e) return;
  for (const x of [e.el, e.aud]) if (x) { try { x.pause(); x.removeAttribute('src'); x.load(); } catch { /* ignore */ } }
  try { e.node && e.node.disconnect(); e.gain && e.gain.disconnect(); } catch { /* ignore */ }
  pool.delete(id);
}

/** Keeps the separate audio element (proxy mode) aligned with the picture element. */
function mirrorAudio(e, playing, target, rate) {
  const a = e.aud;
  if (!a) return;
  if (a.playbackRate !== rate) a.playbackRate = rate;
  if (playing) {
    if (Math.abs(a.currentTime - target) > 0.3 && !a.seeking) a.currentTime = target;
    if (a.paused && a.readyState >= 1) a.play().catch(() => {});
  } else {
    if (!a.paused) a.pause();
    if (Math.abs(a.currentTime - target) > 0.05 && !a.seeking) a.currentTime = target;
  }
}

export function resetEngine() {
  for (const id of [...pool.keys()]) destroyEntry(id);
  invalidate();
}

export function fadeFactor(c, lt) {
  let f = 1;
  if (c.fadeIn > 0 && lt < c.fadeIn) f *= lt / c.fadeIn;
  const rem = c.dur - lt;
  if (c.fadeOut > 0 && rem < c.fadeOut) f *= Math.max(0, rem / c.fadeOut);
  return clamp(f, 0, 1);
}

function setGain(e, v) {
  if (e.gain) e.gain.gain.value = v;
  else (e.aud || e.el).volume = clamp(v, 0, 1);
}

const POOL_MAX = 4; // elements kept warm (decoders are expensive for 4K files)

/** True while an active video is still buffering/seeking, so the clock should wait for it. */
function activeStalled(t) {
  for (const c of state.main.concat(state.overlay)) {
    if (c.kind !== 'video' || t < c.start || t >= c.start + c.dur) continue;
    const e = pool.get(c.id);
    if (e && !e.el.error && !e.el.ended && (e.el.seeking || e.el.readyState < 3)) return true;
  }
  return false;
}
const anySeeking = () => { for (const e of pool.values()) if (e.el.seeking || (e.aud && e.aud.seeking)) return true; return false; };
let holdSince = 0, holdIgnoreUntil = 0;

/** Keeps every <video>/<audio> element aligned with the timeline clock. */
function syncMedia(t, playing) {
  for (const c of allMediaClips()) {
    if (c.kind === 'image') continue;
    const end = c.start + c.dur;
    const active = t >= c.start && t < end;
    const near = t < c.start && c.start - t < 1.5;
    let e = pool.get(c.id);
    if (!active && !near) {
      if (e) {
        if (pool.size > POOL_MAX && (t > end + 4 || c.start - t > 6)) destroyEntry(c.id);
        else { if (!e.el.paused) e.el.pause(); if (e.aud && !e.aud.paused) e.aud.pause(); setGain(e, 0); }
      }
      continue;
    }
    e = entryFor(c);
    if (!e) continue;
    const el = e.el;
    const m = getMedia(c.mediaId);
    const maxT = Math.max(0, (m.duration || 0) - 0.02);
    if (!active) {
      if (Math.abs(el.currentTime - c.in) > 0.1 && !el.seeking) el.currentTime = Math.min(c.in, maxT);
      if (!el.paused) el.pause();
      if (e.aud && !e.aud.paused) e.aud.pause();
      setGain(e, 0);
      continue;
    }
    const target = Math.min(c.in + (t - c.start) * c.speed, maxT);
    const rate = clamp(c.speed, 0.0625, 16);
    if (el.playbackRate !== rate) el.playbackRate = rate;
    if (playing) {
      if (Math.abs(el.currentTime - target) > 0.35 && !el.seeking) el.currentTime = target;
      if (el.paused && el.readyState >= 1) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.02 && !el.seeking) el.currentTime = target;
    }
    mirrorAudio(e, playing, target, rate);
    setGain(e, c.muted ? 0 : clamp(c.volume, 0, 4) * fadeFactor(c, t - c.start));
  }
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                         */
/* ------------------------------------------------------------------ */
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

function filterString(f) {
  if (!supportsFilter) return 'none';
  const parts = [];
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.gray) parts.push(`grayscale(${f.gray}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.length ? parts.join(' ') : 'none';
}

let resolver = null;
/** Export hook: lets the fast exporter supply decoded frames for video clips. */
export const setFrameResolver = (fn) => { resolver = fn; };

function sourceOf(c) {
  const m = getMedia(c.mediaId);
  if (!m) return null;
  if (!m.url) return { offline: true, m };
  if (resolver && c.kind !== 'image') return resolver(c, m);
  if (c.kind === 'image') return m.el ? { src: m.el, w: m.w, h: m.h, m } : null;
  const e = pool.get(c.id);
  if (!e) return null;
  const el = e.el;
  const ready = el.readyState >= 2 && !el.seeking && el.videoWidth > 0;
  if (ready) {
    // while paused, keep a small snapshot of the settled frame to show during the next seek (no black flashes)
    if (!state.playing && e.snapAt !== el.currentTime) {
      const k = Math.min(1, 960 / el.videoWidth);
      const sw = Math.max(2, Math.round(el.videoWidth * k)), sh = Math.max(2, Math.round(el.videoHeight * k));
      if (!e.snap) e.snap = document.createElement('canvas');
      if (e.snap.width !== sw) { e.snap.width = sw; e.snap.height = sh; }
      try { e.snap.getContext('2d').drawImage(el, 0, 0, sw, sh); e.snapAt = el.currentTime; e.dim = { w: el.videoWidth, h: el.videoHeight }; } catch { /* ignore */ }
    }
    return { src: el, w: el.videoWidth, h: el.videoHeight, m };
  }
  if (e.snap && e.dim) return { src: e.snap, w: e.dim.w, h: e.dim.h, m };
  return el.readyState >= 1 && el.videoWidth ? { src: el, w: el.videoWidth, h: el.videoHeight, m } : null;
}

function drawMedia(g, W, H, c, t, o = {}) {
  const s = sourceOf(c);
  if (!s) return;
  const lt = t - c.start;
  const alpha = clamp((o.alpha ?? 1) * c.opacity * (c.kind === 'audio' ? 0 : fadeFactor(c, lt)), 0, 1);
  if (alpha <= 0) return;
  g.save();
  if (o.pre) o.pre(g);
  g.globalAlpha *= alpha;
  if (s.offline) {
    g.fillStyle = '#2b2930';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#cac4d0';
    g.font = `${Math.round(H / 22)}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.m.name, W / 2, H / 2);
    g.restore();
    return;
  }
  const iw = s.w, ih = s.h;
  if (!iw || !ih) { g.restore(); return; }
  const cover = Math.max(W / iw, H / ih);
  const s0 = c.fit === 'cover' ? cover : Math.min(W / iw, H / ih);
  const sc = s0 * c.scale;
  if (c.fit === 'blur' && o.track !== 'overlay') {
    g.save();
    if (supportsFilter) g.filter = 'blur(28px) brightness(.65)';
    const bs = cover * 1.15;
    g.drawImage(s.src, W / 2 - (iw * bs) / 2, H / 2 - (ih * bs) / 2, iw * bs, ih * bs);
    g.restore();
  }
  const cx = W / 2 + c.x * W, cy = H / 2 + c.y * H;
  g.translate(cx, cy);
  g.rotate((c.rot * Math.PI) / 180);
  g.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  const fs = filterString(c.filters);
  if (fs !== 'none') g.filter = fs;
  try { g.drawImage(s.src, (-iw * sc) / 2, (-ih * sc) / 2, iw * sc, ih * sc); } catch { /* frame not ready */ }
  g.filter = 'none';
  const vg = c.filters.vignette;
  if (vg > 0) {
    const gr = g.createRadialGradient(0, 0, Math.min(iw, ih) * sc * 0.2, 0, 0, Math.max(iw, ih) * sc * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${vg})`);
    g.fillStyle = gr;
    g.fillRect((-iw * sc) / 2, (-ih * sc) / 2, iw * sc, ih * sc);
  }
  g.restore();
  if (o.hits) o.hits.push({ track: o.track, id: c.id, cx, cy, w: iw * sc, h: ih * sc, rot: c.rot });
}

function wrapLines(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawText(g, W, H, c, t, hits) {
  const lt = t - c.start, rem = c.dur - lt;
  const ai = Math.max(0.05, Math.min(0.45, c.dur / 2));
  let alpha = c.opacity ?? 1, dy = 0, sc = 1, reveal = 1;
  switch (c.anim) {
    case 'fade': alpha *= Math.min(lt / ai, 1) * Math.min(rem / ai, 1); break;
    case 'pop': sc = easeOutBack(Math.min(lt / ai, 1)); alpha *= Math.min(rem / ai, 1); break;
    case 'slideup': { const p = easeOutCubic(Math.min(lt / ai, 1)); dy = (1 - p) * 0.08 * H; alpha *= p * Math.min(rem / ai, 1); break; }
    case 'typewriter': reveal = Math.min(lt / (c.dur * 0.6), 1); break;
    default: break;
  }
  if (alpha <= 0) return;
  const fs = (c.size * H) / 1080;
  g.save();
  g.font = `${c.italic ? 'italic ' : ''}${c.bold ? '700 ' : '400 '}${fs}px ${c.font}, system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const lines = wrapLines(g, c.text, W * 0.9);
  const lh = fs * 1.2;
  const bw = Math.max(...lines.map((l) => g.measureText(l).width), 1);
  const bh = lines.length * lh;
  const pad = c.bg ? fs * 0.3 : 0;
  const cx = c.x * W, cy = c.y * H + dy;
  g.translate(cx, cy);
  g.rotate(((c.rot || 0) * Math.PI) / 180);
  g.scale(sc, sc);
  g.globalAlpha *= clamp(alpha, 0, 1);
  if (c.bg) { g.fillStyle = hexA(c.bg, c.bgOpacity); rr(g, -bw / 2 - pad, -bh / 2 - pad, bw + 2 * pad, bh + 2 * pad, fs * 0.25); g.fill(); }
  if (c.shadow) { g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = fs * 0.12; g.shadowOffsetY = fs * 0.04; }
  g.textAlign = c.align === 'left' ? 'left' : c.align === 'right' ? 'right' : 'center';
  const tx = c.align === 'left' ? -bw / 2 : c.align === 'right' ? bw / 2 : 0;
  let left = Math.ceil(lines.join('').length * reveal);
  lines.forEach((line, i) => {
    const part = reveal < 1 ? line.slice(0, Math.max(0, left)) : line;
    left -= line.length;
    if (!part) return;
    const y = -bh / 2 + lh * (i + 0.5);
    if (c.strokeW > 0) { g.lineWidth = (c.strokeW * H) / 540; g.strokeStyle = c.stroke; g.lineJoin = 'round'; g.strokeText(part, tx, y); }
    g.fillStyle = c.color;
    g.fillText(part, tx, y);
  });
  g.restore();
  if (hits) hits.push({ track: 'text', id: c.id, cx, cy, w: (bw + 2 * pad) * sc, h: (bh + 2 * pad) * sc, rot: c.rot || 0 });
}

function transitionPre(type, p, W, H) {
  const e = easeOutCubic(p);
  switch (type) {
    case 'fade': return { b: p, pre: null };
    case 'slide': return { b: 1, pre: (g) => g.translate((1 - e) * W, 0) };
    case 'slideup': return { b: 1, pre: (g) => g.translate(0, (1 - e) * H) };
    case 'wipe': return { b: 1, pre: (g) => { g.beginPath(); g.rect(0, 0, W * p, H); g.clip(); } };
    case 'zoom': return { b: p, pre: (g) => { g.translate(W / 2, H / 2); g.scale(1.35 - 0.35 * e, 1.35 - 0.35 * e); g.translate(-W / 2, -H / 2); } };
    case 'dip': return { a: clamp(1 - p * 2, 0, 1), b: clamp(p * 2 - 1, 0, 1), pre: null };
    default: return { b: 1, pre: null };
  }
}

/** Draws the whole composition at time t. `hits` (optional) receives pickable boxes. */
export function drawFrame(g, W, H, t, hits) {
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.save();
  g.globalAlpha = 1;
  g.fillStyle = state.bg;
  g.fillRect(0, 0, W, H);
  g.restore();

  const active = state.main.filter((c) => t >= c.start && t < c.start + c.dur);
  if (active.length >= 2 && active[1].overlap > 0) {
    const [A, B] = active;
    const p = clamp((t - B.start) / B.overlap, 0, 1);
    const tr = transitionPre(B.trans.type, p, W, H);
    drawMedia(g, W, H, A, t, { alpha: tr.a ?? 1, hits, track: 'main' });
    drawMedia(g, W, H, B, t, { alpha: tr.b ?? 1, pre: tr.pre, hits, track: 'main' });
  } else if (active.length) {
    drawMedia(g, W, H, active[active.length - 1], t, { hits, track: 'main' });
  }
  for (const c of state.overlay) if (t >= c.start && t < c.start + c.dur) drawMedia(g, W, H, c, t, { hits, track: 'overlay' });
  for (const c of state.text) if (t >= c.start && t < c.start + c.dur) drawText(g, W, H, c, t, hits);
}

/* ---------------- preview canvases & selection overlay ---------------- */
export let hits = [];

export function attach(canvas, overlay) {
  cv = canvas; ctx = cv.getContext('2d');
  ov = overlay; octx = ov.getContext('2d');
}

export function resizePreview(cssW, cssH, cap = 1600) {
  const dpr = Math.max(Math.min(window.devicePixelRatio || 1, 2), 1.5); // never render the preview below 1.5× (keeps it crisp)
  let w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
  const long = Math.max(w, h);
  if (long > cap) { w = Math.round((w * cap) / long); h = Math.round((h * cap) / long); }
  let resized = false;
  for (const c of [cv, ov]) { c.style.width = cssW + 'px'; c.style.height = cssH + 'px'; if (c.width !== w) { c.width = w; resized = true; } if (c.height !== h) { c.height = h; resized = true; } }
  if (resized) renderPreview();
}

function drawSelection() {
  octx.clearRect(0, 0, ov.width, ov.height);
  if (!state.sel || exporting) return;
  const hb = hits.find((x) => x.id === state.sel.id);
  if (!hb) return;
  const col = getComputedStyle(document.documentElement).getPropertyValue('--md-primary').trim() || '#6750a4';
  octx.save();
  octx.translate(hb.cx, hb.cy);
  octx.rotate((hb.rot * Math.PI) / 180);
  octx.strokeStyle = col; octx.lineWidth = 2 * (ov.width / 900 + 0.4); octx.setLineDash([8, 6]);
  octx.strokeRect(-hb.w / 2, -hb.h / 2, hb.w, hb.h);
  octx.setLineDash([]);
  octx.fillStyle = '#fff';
  const r = 7 * (ov.width / 900 + 0.5);
  octx.beginPath(); octx.arc(hb.w / 2, hb.h / 2, r, 0, Math.PI * 2); octx.fill(); octx.stroke();
  octx.restore();
}

export function renderPreview() {
  if (!ctx) return;
  hits = [];
  drawFrame(ctx, cv.width, cv.height, state.t, hits);
  hits.reverse(); // topmost first
  drawSelection();
}

/* ------------------------------------------------------------------ */
/*  Transport                                                         */
/* ------------------------------------------------------------------ */
export function play() {
  if (state.playing) return;
  if (state.t >= totalDuration() - 0.01) state.t = 0;
  ensureAudio().resume().catch(() => {});
  state.playing = true;
  last = performance.now();
  emit('play');
}

export function pause() {
  if (!state.playing) return;
  state.playing = false;
  emit('pause');
}

export const toggle = () => (state.playing ? pause() : play());

export function seek(t) {
  state.t = clamp(t, 0, Math.max(totalDuration(), 0));
  emit('seek');
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  let hold = false;
  if (state.playing) {
    // wait (briefly) for a video that is still seeking/buffering instead of letting the picture freeze
    if (now > holdIgnoreUntil && activeStalled(state.t)) {
      if (!holdSince) holdSince = now;
      if (now - holdSince > 2500) { holdIgnoreUntil = now + 5000; holdSince = 0; } else hold = true;
    } else holdSince = 0;
    const dt = hold ? 0 : Math.min((now - last) / 1000, 0.25);
    last = now;
    state.t += dt;
    const d = totalDuration();
    if (state.t >= d) { state.t = d; state.playing = false; emit('pause'); emit('end'); }
  }
  syncMedia(state.t, state.playing && !hold);
  const busy = state.playing || dirty || anySeeking();
  if (!exporting && busy) { dirty = false; renderPreview(); }
  if (exporting) exporting.frame();
  if (busy || exporting) emit('time');
}

export function start() { if (!raf) raf = requestAnimationFrame(tick); }

/* ------------------------------------------------------------------ */
/*  Export (real-time capture of the canvas + audio graph)            */
/* ------------------------------------------------------------------ */
const MIMES = {
  mp4: ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'],
  webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
};

export function supportedMime(kind) {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIMES[kind].find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

async function waitReady(t) {
  const until = performance.now() + 4000;
  for (;;) {
    syncMedia(t, false);
    const pending = allMediaClips().some((c) => {
      if (c.kind === 'image' || t < c.start || t >= c.start + c.dur) return false;
      const e = pool.get(c.id);
      return e && (e.el.seeking || e.el.readyState < 2);
    });
    if (!pending || performance.now() > until) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Records the timeline in real time.
 * @param {{width:number,height:number,fps:number,bitrate:number,mime:string,onProgress:(p:number)=>void,signal?:AbortSignal}} o
 * @returns {Promise<Blob>}
 */
export async function exportVideo(o) {
  if (exporting) throw new Error('Export already running');
  const duration = totalDuration();
  if (duration <= 0) throw new Error('empty');
  pause();
  seek(0);
  ensureAudio();
  await ac.resume().catch(() => {});
  await waitReady(0);

  const off = document.createElement('canvas');
  off.width = o.width; off.height = o.height;
  const og = off.getContext('2d');
  exportDest = ac.createMediaStreamDestination();
  master.connect(exportDest);
  monitor.gain.value = 0;

  const stream = off.captureStream(o.fps);
  exportDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const rec = new MediaRecorder(stream, { mimeType: o.mime, videoBitsPerSecond: o.bitrate, audioBitsPerSecond: 192000 });
  const chunks = [];
  let sinkChain = Promise.resolve();
  rec.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    if (o.onData) { const b = e.data; sinkChain = sinkChain.then(async () => o.onData(new Uint8Array(await b.arrayBuffer()))); } else chunks.push(e.data);
  };

  let finish;
  const done = new Promise((res) => { finish = res; });
  let cancelled = false;
  const endAt = duration + 0.25;

  const cleanup = () => {
    try { master.disconnect(exportDest); } catch { /* ignore */ }
    exportDest = null;
    monitor.gain.value = previewVol;
    exporting = null;
    pause();
    seek(0);
  };

  rec.onstop = () => { cleanup(); finish(); };
  exporting = {
    frame() {
      drawFrame(og, off.width, off.height, Math.min(state.t, duration), null);
      o.onProgress(clamp(state.t / duration, 0, 1));
      if (o.signal && o.signal.aborted && !cancelled) { cancelled = true; rec.stop(); }
    },
  };
  rec.start(500);
  state.t = 0;
  play();
  // stop shortly after the timeline end
  await new Promise((res) => {
    const iv = setInterval(() => {
      if (cancelled || (!state.playing && state.t >= duration)) {
        clearInterval(iv);
        setTimeout(res, Math.max(0, (endAt - duration) * 1000));
      }
    }, 100);
  });
  if (rec.state !== 'inactive') rec.stop();
  await done;
  await sinkChain;
  if (cancelled) throw new DOMException('Export cancelled', 'AbortError');
  if (o.onData) return null;
  return new Blob(chunks, { type: o.mime.split(';')[0] });
}

export const isExporting = () => !!exporting;
export { layout, dims };

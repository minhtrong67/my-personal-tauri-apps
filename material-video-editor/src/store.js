// Project model, selection, layout and undo/redo.
import { uid, clamp } from './util.js';

const L = {};
export const on = (e, f) => { (L[e] ||= []).push(f); };
export const emit = (e, ...a) => { (L[e] || []).forEach((f) => f(...a)); };

export const ASPECTS = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:3': [4, 3], '3:4': [3, 4], '21:9': [21, 9] };
export const TRACKS = ['text', 'overlay', 'main', 'audio'];
export const FILTER_PRESETS = {
  none: {},
  vivid: { saturate: 140, contrast: 110 },
  bw: { gray: 100, contrast: 110 },
  warm: { sepia: 30, saturate: 120, hue: -10, brightness: 105 },
  cool: { hue: 15, saturate: 90, brightness: 105, contrast: 105 },
  vintage: { sepia: 50, contrast: 90, brightness: 110, saturate: 80, vignette: 0.35 },
  fade: { contrast: 85, brightness: 112, saturate: 80 },
  dramatic: { contrast: 130, saturate: 120, brightness: 90, vignette: 0.4 },
};
export const TRANSITIONS = ['none', 'fade', 'slide', 'slideup', 'wipe', 'zoom', 'dip'];

export const defaultFilters = () => ({ brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, gray: 0, sepia: 0, vignette: 0, preset: 'none' });

export const state = {
  name: '', aspect: '16:9', fps: 30, bg: '#000000',
  media: [], main: [], overlay: [], text: [], audio: [],
  sel: null, t: 0, playing: false, pps: 80, snap: true, dirty: false, projectPath: null,
};

export const getMedia = (id) => state.media.find((m) => m.id === id);
export const findClip = (track, id) => state[track].find((c) => c.id === id);
export const selClip = () => (state.sel ? findClip(state.sel.track, state.sel.id) : null);
export const clipEnd = (c) => c.start + c.dur;
export const allMediaClips = () => [...state.main, ...state.overlay, ...state.audio];
export const isEmpty = () => !state.main.length && !state.overlay.length && !state.text.length && !state.audio.length;

export function layout() {
  let pos = 0;
  let prev = null;
  for (const c of state.main) {
    let ov = 0;
    if (prev && c.trans && c.trans.type !== 'none') ov = Math.min(c.trans.dur, prev.dur * 0.5, c.dur * 0.5);
    c.start = Math.max(0, pos - ov);
    c.overlap = ov;
    pos = c.start + c.dur;
    prev = c;
  }
}

export function totalDuration() {
  let d = 0;
  for (const tr of TRACKS) for (const c of state[tr]) d = Math.max(d, c.start + c.dur);
  return d;
}

/** [width, height] for a short side (even numbers). */
export function dims(shortSide, aspect = state.aspect) {
  const [a, b] = ASPECTS[aspect] || ASPECTS['16:9'];
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return a >= b ? [even((shortSide * a) / b), even(shortSide)] : [even(shortSide), even((shortSide * b) / a)];
}

/* ---------------- history ---------------- */
const hist = { stack: [], idx: -1 };
const snap = () => JSON.stringify({ main: state.main, overlay: state.overlay, text: state.text, audio: state.audio, aspect: state.aspect, fps: state.fps, bg: state.bg });

export function markDirty(v = true) {
  if (state.dirty !== v) { state.dirty = v; emit('dirty'); }
}

export function commit() {
  const s = snap();
  if (hist.stack[hist.idx] === s) return false;
  hist.stack.length = hist.idx + 1;
  hist.stack.push(s);
  if (hist.stack.length > 120) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  markDirty(true);
  emit('history');
  return true;
}

export function resetHistory() {
  hist.stack = [snap()];
  hist.idx = 0;
  emit('history');
}

export const canUndo = () => hist.idx > 0;
export const canRedo = () => hist.idx < hist.stack.length - 1;

function restore(s) {
  Object.assign(state, JSON.parse(s));
  if (state.sel && !findClip(state.sel.track, state.sel.id)) state.sel = null;
  layout();
  markDirty(true);
  emit('change');
  emit('history');
  emit('select');
}
export function undo() { if (canUndo()) restore(hist.stack[--hist.idx]); }
export function redo() { if (canRedo()) restore(hist.stack[++hist.idx]); }

/* ---------------- selection ---------------- */
export function select(track, id) {
  const next = track && id ? { track, id } : null;
  if (JSON.stringify(next) === JSON.stringify(state.sel)) return;
  state.sel = next;
  emit('select');
}

/* ---------------- factories ---------------- */
export function makeClip(media, track, start = 0) {
  const img = media.type === 'image';
  const c = {
    id: uid(), mediaId: media.id, kind: media.type, start, in: 0,
    dur: img ? (track === 'overlay' ? 4 : 5) : media.duration,
    speed: 1, volume: 1, muted: false, opacity: 1, fit: 'contain', scale: 1, x: 0, y: 0, rot: 0,
    flipH: false, flipV: false, fadeIn: 0, fadeOut: 0, filters: defaultFilters(), trans: { type: 'none', dur: 0.6 },
  };
  if (track === 'overlay') c.scale = 0.5;
  return c;
}

export const TEXT_PRESETS = {
  basic: { text: 'Text', size: 72, bold: true },
  title: { text: 'Title', size: 120, bold: true, strokeW: 0, anim: 'pop', y: 0.45 },
  subtitle: { text: 'Subtitle', size: 54, bold: false, y: 0.58 },
  caption: { text: 'Caption', size: 46, bold: true, bg: '#000000', bgOpacity: 0.6, shadow: false, y: 0.85 },
  outline: { text: 'Outline', size: 96, bold: true, strokeW: 4, stroke: '#000000', shadow: false },
  neon: { text: 'NEON', size: 110, bold: true, color: '#ff4fd8', strokeW: 0, shadow: true, anim: 'fade' },
  typewriter: { text: 'Typing…', size: 64, bold: false, font: 'Courier New', anim: 'typewriter' },
  yellow: { text: 'Highlight', size: 70, bold: true, color: '#111111', bg: '#ffd600', bgOpacity: 1, shadow: false },
};

export function makeText(preset = 'basic', start = 0) {
  return {
    id: uid(), start, dur: 3, text: 'Text', font: 'system-ui', size: 72, color: '#ffffff', bold: true, italic: false,
    align: 'center', bg: '', bgOpacity: 0.6, stroke: '#000000', strokeW: 0, shadow: true, x: 0.5, y: 0.5, rot: 0,
    anim: 'none', opacity: 1, ...(TEXT_PRESETS[preset] || {}),
  };
}

/* ---------------- mutations ---------------- */
export function insertMain(clip, index = state.main.length) {
  state.main.splice(clamp(index, 0, state.main.length), 0, clip);
  layout();
  select('main', clip.id);
  commit();
  emit('change');
}

export function addClip(track, clip) {
  if (track === 'main') return insertMain(clip);
  state[track].push(clip);
  select(track, clip.id);
  commit();
  emit('change');
}

export function removeClip(track, id) {
  const i = state[track].findIndex((c) => c.id === id);
  if (i < 0) return;
  state[track].splice(i, 1);
  if (state.sel && state.sel.id === id) state.sel = null;
  layout();
  commit();
  emit('change');
  emit('select');
}

export function deleteSelected() {
  if (state.sel) removeClip(state.sel.track, state.sel.id);
}

export function duplicateSelected() {
  const c = selClip();
  if (!c) return;
  const { track } = state.sel;
  const copy = JSON.parse(JSON.stringify(c));
  copy.id = uid();
  if (track === 'main') {
    const i = state.main.indexOf(c);
    if (copy.trans) copy.trans = { type: 'none', dur: copy.trans.dur };
    state.main.splice(i + 1, 0, copy);
  } else {
    copy.start = c.start + c.dur;
    state[track].push(copy);
  }
  layout();
  select(track, copy.id);
  commit();
  emit('change');
}

/** Splits the selected clip (or the clip under the playhead) at time t. */
export function splitAt(t = state.t) {
  const inside = (c) => t > c.start + 0.05 && t < c.start + c.dur - 0.05;
  let track = null;
  let clip = null;
  const s = selClip();
  if (s && inside(s)) { track = state.sel.track; clip = s; }
  else {
    for (const tr of ['main', 'overlay', 'text', 'audio']) {
      const c = state[tr].find(inside);
      if (c) { track = tr; clip = c; break; }
    }
  }
  if (!clip) return false;
  const cut = t - clip.start;
  const right = JSON.parse(JSON.stringify(clip));
  right.id = uid();
  if (track !== 'text') right.in = clip.in + cut * (clip.speed || 1);
  right.dur = clip.dur - cut;
  clip.dur = cut;
  if (track === 'main') right.trans = { type: 'none', dur: right.trans ? right.trans.dur : 0.6 };
  if ('fadeOut' in clip) { clip.fadeOut = 0; right.fadeIn = 0; }
  if (track === 'text') { right.start = t; }
  else right.start = t;
  const arr = state[track];
  arr.splice(arr.indexOf(clip) + 1, 0, right);
  layout();
  select(track, right.id);
  commit();
  emit('change');
  return true;
}

/* ---------------- project (de)serialisation ---------------- */
export function toProject() {
  return {
    app: 'material-video-editor', version: 1, name: state.name, aspect: state.aspect, fps: state.fps, bg: state.bg,
    media: state.media.map(({ id, name, type, duration, w, h, size }) => ({ id, name, type, duration, w, h, size })),
    main: state.main, overlay: state.overlay, text: state.text, audio: state.audio,
  };
}

export function resetProject() {
  Object.assign(state, { name: '', aspect: '16:9', fps: 30, bg: '#000000', media: [], main: [], overlay: [], text: [], audio: [], sel: null, t: 0, playing: false, projectPath: null });
  layout();
  resetHistory();
  markDirty(false);
  emit('reset');
  emit('change');
  emit('select');
}

export function loadProject(p) {
  if (!p || p.app !== 'material-video-editor') throw new Error('Not a Material Video Editor project');
  resetProject();
  Object.assign(state, {
    name: p.name || '', aspect: ASPECTS[p.aspect] ? p.aspect : '16:9', fps: p.fps || 30, bg: p.bg || '#000000',
    main: p.main || [], overlay: p.overlay || [], text: p.text || [], audio: p.audio || [],
    media: (p.media || []).map((m) => ({ ...m, url: null, offline: true, thumb: null, wave: null })),
  });
  layout();
  resetHistory();
  markDirty(false);
  emit('reset');
  emit('change');
  emit('select');
}

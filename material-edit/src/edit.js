// Higher-level editing operations: clipboard, trim to playhead, mute, edit-point jumps and
// "match video length to audio" (loops short videos, stretches images, trims long ones).
import { state, emit, layout, commit, select, selClip, totalDuration, deleteSelected, makeClip, getMedia } from './store.js';
import { uid } from './util.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const EPS = 0.04;

/* ---------------- clipboard ---------------- */
let board = null;
export const hasClipboard = () => !!board;

export function copySelected() {
  const c = selClip();
  if (!c) return false;
  board = { track: state.sel.track, clip: clone(c) };
  emit('clipboard');
  return true;
}

export function cutSelected() {
  if (!copySelected()) return false;
  deleteSelected();
  return true;
}

export function pasteAtPlayhead() {
  if (!board) return false;
  const { track } = board;
  const c = clone(board.clip);
  c.id = uid();
  if (track === 'main') {
    // after the clip under the playhead (or at the end)
    let idx = state.main.findIndex((x) => state.t >= x.start && state.t < x.start + x.dur);
    idx = idx < 0 ? state.main.length : idx + 1;
    c.trans = { type: 'none', dur: c.trans ? c.trans.dur : 0.6 };
    state.main.splice(idx, 0, c);
  } else {
    c.start = Math.max(0, state.t);
    state[track].push(c);
  }
  layout();
  select(track, c.id);
  commit();
  emit('change');
  return true;
}

/* ---------------- trimming & deleting ---------------- */
function target() {
  const s = selClip();
  if (s) return { track: state.sel.track, clip: s };
  for (const tr of ['main', 'overlay', 'text', 'audio']) {
    const c = state[tr].find((x) => state.t > x.start && state.t < x.start + x.dur);
    if (c) return { track: tr, clip: c };
  }
  return null;
}

/** Cuts everything before (`left`) or after (`right`) the playhead off the selected clip. */
export function trimToPlayhead(side) {
  const tg = target();
  if (!tg) return false;
  const { track, clip } = tg;
  const t = state.t;
  const cut = t - clip.start;
  if (cut <= EPS || cut >= clip.dur - EPS) return false;
  if (side === 'left') {
    if (clip.kind && clip.kind !== 'image') clip.in += cut * (clip.speed || 1);
    clip.dur -= cut;
    if (track !== 'main') clip.start = t;
    if ('fadeIn' in clip) clip.fadeIn = 0;
  } else {
    clip.dur = cut;
    if ('fadeOut' in clip) clip.fadeOut = 0;
  }
  layout();
  select(track, clip.id);
  commit();
  emit('change');
  return true;
}

/** Deletes the selection and closes the gap on its track. */
export function rippleDelete() {
  const c = selClip();
  if (!c) return false;
  const { track } = state.sel;
  if (track !== 'main') {
    const end = c.start + c.dur;
    for (const o of state[track]) if (o !== c && o.start >= end - EPS) o.start = Math.max(0, o.start - c.dur);
  }
  deleteSelected();
  return true;
}

export function toggleMute() {
  const c = selClip();
  if (!c || !('muted' in c)) return false;
  c.muted = !c.muted;
  commit();
  emit('change');
  emit('inspect');
  return true;
}

export function resetTransform() {
  const c = selClip();
  if (!c) return false;
  if (state.sel.track === 'text') Object.assign(c, { x: 0.5, y: 0.5, rot: 0 });
  else Object.assign(c, { scale: state.sel.track === 'overlay' ? 0.5 : 1, x: 0, y: 0, rot: 0, flipH: false, flipV: false });
  commit();
  emit('change');
  emit('inspect');
  return true;
}

/* ---------------- navigation ---------------- */
export function editPoints() {
  const pts = new Set([0, totalDuration()]);
  for (const tr of ['main', 'overlay', 'text', 'audio']) for (const c of state[tr]) { pts.add(+c.start.toFixed(3)); pts.add(+(c.start + c.dur).toFixed(3)); }
  return [...pts].sort((a, b) => a - b);
}
export function nextEdit(dir) {
  const pts = editPoints();
  if (dir > 0) return pts.find((p) => p > state.t + EPS) ?? totalDuration();
  return [...pts].reverse().find((p) => p < state.t - EPS) ?? 0;
}

/* ---------------- match video length to audio ---------------- */
export function pickAudio() {
  if (state.sel && state.sel.track === 'audio') return state.audio.find((c) => c.id === state.sel.id) || null;
  let best = null;
  for (const c of state.audio) if (!best || c.start + c.dur > best.start + best.dur) best = c;
  return best;
}

const mainEnd = () => state.main.reduce((m, c) => Math.max(m, c.start + c.dur), 0);
const noTrans = (c) => { c.trans = { type: 'none', dur: c.trans ? c.trans.dur : 0.6 }; return c; };

/**
 * Makes ONE main-track clip last until the end of `audio`.
 * Images are stretched, longer videos are trimmed, shorter videos are repeated (duplicated) as often as needed.
 */
export function fitClipToAudio(clip, audio = pickAudio()) {
  if (!audio || !clip || !state.main.includes(clip)) return { ok: false, reason: 'noAudio' };
  layout();
  const L = audio.start + audio.dur - clip.start;
  if (L < 0.1) return { ok: false, reason: 'tooShort' };
  let copies = 0;
  if (clip.kind === 'image' || clip.dur >= L) {
    clip.dur = L;
  } else {
    let remaining = L - clip.dur;
    let at = state.main.indexOf(clip) + 1;
    while (remaining > 0.01 && copies < 5000) {
      const n = noTrans(clone(clip));
      n.id = uid();
      n.dur = Math.min(clip.dur, remaining);
      state.main.splice(at++, 0, n);
      remaining -= n.dur;
      copies++;
    }
  }
  layout();
  commit();
  emit('change');
  emit('inspect');
  return { ok: true, copies };
}

/**
 * Makes the whole main track exactly as long as `audio`: loops the sequence when it is shorter,
 * spreads photos evenly when there is nothing but images, trims when it is longer.
 */
export function matchMainToAudio(audio = pickAudio()) {
  if (!audio) return { ok: false, reason: 'noAudio' };
  if (!state.main.length) return { ok: false, reason: 'noMain' };
  layout();
  const T = audio.start + audio.dur;
  const end = mainEnd();
  let copies = 0;
  if (state.main.every((c) => c.kind === 'image')) {
    const per = Math.max(0.5, T / state.main.length);
    state.main.forEach((c) => { c.dur = per; });
    layout();
    const last = state.main[state.main.length - 1];
    last.dur = Math.max(0.1, last.dur + (T - mainEnd()));
  } else if (end < T - 0.01) {
    const pattern = state.main.map(clone);
    let i = 0;
    while (mainEnd() < T - 0.01 && copies < 5000) {
      const n = clone(pattern[i % pattern.length]);
      n.id = uid();
      if (i % pattern.length === 0) noTrans(n);
      state.main.push(n);
      layout();
      copies++;
      i++;
    }
    const last = state.main[state.main.length - 1];
    last.dur = Math.max(0.1, T - last.start);
  } else if (end > T + 0.01) {
    state.main = state.main.filter((c, i) => i === 0 || c.start < T - 0.05);
    const last = state.main[state.main.length - 1];
    last.dur = Math.max(0.1, Math.min(last.dur, T - last.start));
  }
  layout();
  commit();
  emit('change');
  emit('inspect');
  return { ok: true, copies };
}

/** Shortens the audio clip so it ends together with the video. */
export function trimAudioToVideo(audio = pickAudio()) {
  if (!audio) return { ok: false, reason: 'noAudio' };
  layout();
  const end = mainEnd();
  if (end <= 0) return { ok: false, reason: 'noMain' };
  const d = end - audio.start;
  if (d < 0.1 || d >= audio.dur - 0.01) return { ok: false, reason: 'nothing' };
  audio.dur = d;
  commit();
  emit('change');
  emit('inspect');
  return { ok: true };
}

export { makeClip, getMedia };

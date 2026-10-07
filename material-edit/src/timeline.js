// Timeline UI: ruler, four tracks, clip drag / trim / reorder, snapping, zoom, playhead.
import { state, on, emit, getMedia, totalDuration, layout, commit, select, selectMany, isSelected, selectedItems, findClip, makeClip, insertMain, addClip } from './store.js';
import { seek } from './engine.js';
import { nearestAspect } from './media.js';
import { $, h, clamp, fmtTime, icon } from './util.js';
import { t } from './i18n.js';

const LABEL_W = 76;
const ROWS = [
  { track: 'text', h: 34, ico: 'text' },
  { track: 'overlay', h: 44, ico: 'layers' },
  { track: 'main', h: 62, ico: 'video' },
  { track: 'audio', h: 44, ico: 'music' },
];

const scroll = $('#tl-scroll');
const content = $('#tl-content');
let playhead = null;

export const timeAtClientX = (x) => (x - content.getBoundingClientRect().left - LABEL_W) / state.pps;

export function resolveTrack(m, track) {
  if (m.type === 'audio') return 'audio';
  return track === 'overlay' ? 'overlay' : 'main';
}

export function markDropRow(track) {
  content.querySelectorAll('.tl-row.drop-target').forEach((r) => r.classList.remove('drop-target'));
  if (track) { const r = content.querySelector(`.tl-row[data-track="${track}"]`); if (r) r.classList.add('drop-target'); }
}

const timeFromEvent = (e) => (e.clientX - content.getBoundingClientRect().left - LABEL_W) / state.pps;

export function build() {
  const pps = state.pps;
  const dur = totalDuration();
  const W = Math.max(dur * pps + 80, scroll.clientWidth - LABEL_W - 4);
  content.style.width = W + LABEL_W + 'px';
  content.replaceChildren();

  const ruler = h('div', { class: 'tl-ruler', dataset: { role: 'ruler' } });
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  const step = steps.find((s) => s * pps >= 80) || 3600;
  const sub = step / 5;
  for (let i = 0; i * sub <= W / pps; i++) {
    const s = Math.round(i * sub * 1000) / 1000;
    const major = Math.abs(s / step - Math.round(s / step)) < 1e-6;
    ruler.append(h('i', { class: 'tick' + (major ? ' major' : ''), style: { left: LABEL_W + s * pps + 'px' } }));
    if (major) ruler.append(h('span', { class: 'tick-label', style: { left: LABEL_W + s * pps + 4 + 'px' }, text: fmtTime(s, false) }));
  }
  content.append(ruler);

  for (const r of ROWS) {
    // lanes: overlapping clips on text / overlay / audio rows are stacked instead of drawn on top of each other
    const lanes = new Map();
    let laneCount = 1;
    if (r.track !== 'main') {
      const ends = [];
      for (const c of [...state[r.track]].sort((a, b) => a.start - b.start)) {
        let l = ends.findIndex((e) => e <= c.start + 0.001);
        if (l < 0) { l = ends.length; ends.push(0); }
        ends[l] = c.start + c.dur;
        lanes.set(c.id, l);
      }
      laneCount = Math.max(1, ends.length);
    }
    const row = h('div', { class: 'tl-row ' + r.track, dataset: { track: r.track }, style: { height: r.h * laneCount + (laneCount > 1 ? 2 * (laneCount - 1) : 0) + 'px' } },
      h('div', { class: 'tl-label' }, icon(r.ico)));
    if (r.track === 'main' && !state.main.length) row.append(h('div', { class: 'tl-hint', text: t('timeline.hint') }));
    for (const c of state[r.track]) {
      const el = clipEl(r.track, c);
      const l = lanes.get(c.id) || 0;
      if (laneCount > 1) { el.style.top = l * (r.h + 2) + 3 + 'px'; el.style.bottom = 'auto'; el.style.height = r.h - 6 + 'px'; }
      row.append(el);
    }
    content.append(row);
  }
  playhead = h('div', { class: 'playhead' }, h('i'));
  content.append(playhead);
  updatePlayhead(false);
}

function clipEl(track, c) {
  const pps = state.pps;
  const m = c.mediaId ? getMedia(c.mediaId) : null;
  const sel = isSelected(c.id);
  const el = h('div', {
    class: `clip ${track}${sel ? ' sel' : ''}${m && m.offline ? ' offline' : ''}`,
    dataset: { id: c.id, track },
    style: { left: LABEL_W + c.start * pps + 'px', width: Math.max(8, c.dur * pps) + 'px' },
  });
  if (m && m.thumb && track !== 'audio') {
    el.style.backgroundImage = `url(${m.thumb})`;
    el.style.backgroundRepeat = 'repeat-x';
    el.style.backgroundSize = 'auto 100%';
  } else if (m && m.wave && track === 'audio') {
    el.style.backgroundImage = `url(${m.wave})`;
    el.style.backgroundSize = `${(m.duration / c.speed) * pps}px 100%`;
    el.style.backgroundPosition = `${-(c.in / c.speed) * pps}px 0`;
    el.style.backgroundRepeat = 'no-repeat';
  }
  const label = track === 'text' ? c.text.replace(/\s+/g, ' ') : m ? m.name : '';
  el.append(
    h('i', { class: 'handle hl' }),
    h('span', { class: 'clip-label', text: label }),
    h('span', { class: 'clip-dur', text: c.dur.toFixed(1) + 's' }),
    h('i', { class: 'handle hr' }),
  );
  if (track === 'main' && c.overlap > 0) {
    el.append(h('span', { class: 'trans-badge', style: { width: Math.max(10, c.overlap * pps) + 'px' }, title: c.trans.type }, icon('swap')));
  }
  if (c.speed && c.speed !== 1) el.append(h('span', { class: 'speed-badge', text: c.speed + '×' }));
  return el;
}

export function updatePlayhead(follow) {
  if (!playhead) return;
  const x = LABEL_W + state.t * state.pps;
  playhead.style.transform = `translateX(${x}px)`;
  if (follow) {
    const l = scroll.scrollLeft, w = scroll.clientWidth;
    if (x > l + w - 60) scroll.scrollLeft = x - w + 160;
    else if (x < l + LABEL_W) scroll.scrollLeft = Math.max(0, x - LABEL_W - 40);
  }
}

/* ---------------- snapping ---------------- */
function snapPoints(skip) {
  const pts = [0, state.t];
  for (const tr of ['text', 'overlay', 'main', 'audio']) {
    for (const c of state[tr]) if (c !== skip) pts.push(c.start, c.start + c.dur);
  }
  return pts;
}
function snapVal(v, pts) {
  if (!state.snap) return v;
  const lim = 8 / state.pps;
  let best = v, bd = lim;
  for (const p of pts) { const d = Math.abs(p - v); if (d < bd) { bd = d; best = p; } }
  return best;
}

/* ---------------- pointer interaction ---------------- */
content.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const ce = e.target.closest('.clip');
  if (ce) {
    const { track, id } = ce.dataset;
    const c = findClip(track, id);
    if (!c) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) { select(track, id, { toggle: true }); return; }
    const group = state.multi.length > 1 && isSelected(id);
    if (!group) select(track, id);
    const mode = e.target.classList.contains('hl') ? 'trimL' : e.target.classList.contains('hr') ? 'trimR' : 'move';
    if (group) { if (mode === 'move') startGroupDrag(e, c); return; }
    startDrag(e, track, c, mode);
    return;
  }
  if (e.target.closest('.tl-ruler') || e.target.closest('.tl-label')) { select(null, null); startScrub(e); return; }
  startMarquee(e);
});

/** Rubber-band selection on empty timeline space; a plain click still moves the playhead. */
function startMarquee(e) {
  const additive = e.ctrlKey || e.metaKey || e.shiftKey;
  const base = additive ? state.multi.slice() : [];
  const box = content.getBoundingClientRect();
  const x0 = e.clientX, y0 = e.clientY;
  let rect = null, moved = false;
  const edge = scroll.getBoundingClientRect();
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moved = true;
    if (!rect) { rect = h('div', { class: 'marquee' }); content.append(rect); }
    const l = Math.min(x0, ev.clientX), r = Math.max(x0, ev.clientX), tp = Math.min(y0, ev.clientY), bt = Math.max(y0, ev.clientY);
    Object.assign(rect.style, { left: l - box.left + 'px', top: tp - box.top + 'px', width: r - l + 'px', height: bt - tp + 'px' });
    const hit = [...content.querySelectorAll('.clip')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.left < r && b.right > l && b.top < bt && b.bottom > tp;
    }).map((el) => ({ track: el.dataset.track, id: el.dataset.id }));
    const merged = [...base];
    for (const m of hit) if (!merged.some((x) => x.id === m.id)) merged.push(m);
    selectMany(merged);
    // auto-scroll near the edges
    if (ev.clientX > edge.right - 24) scroll.scrollLeft += 18; else if (ev.clientX < edge.left + LABEL_W + 16) scroll.scrollLeft -= 18;
  };
  const onUp = (ev) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (rect) rect.remove();
    if (!moved) { if (!additive) select(null, null); seek(clamp(timeFromEvent(ev), 0, 36000)); }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** Moves every selected clip together (not available for ripple-ordered main-track clips). */
function startGroupDrag(e, lead) {
  const items = selectedItems().filter((i) => i.track !== 'main');
  if (!items.length || items.length !== selectedItems().length) return;
  const startX = e.clientX;
  const orig = items.map((i) => i.clip.start);
  const minStart = Math.min(...orig);
  const pts = snapPoints(null).filter((p) => !items.some((i) => Math.abs(i.clip.start - p) < 1e-6 || Math.abs(i.clip.start + i.clip.dur - p) < 1e-6));
  let moved = false;
  const li = Math.max(0, items.findIndex((i) => i.clip === lead));
  const onMove = (ev) => {
    if (!moved && Math.abs(ev.clientX - startX) < 3) return;
    moved = true;
    let dt = Math.max(-minStart, (ev.clientX - startX) / state.pps);
    const snapped = snapVal(orig[li] + dt, pts);
    if (state.snap && Math.abs(snapped - (orig[li] + dt)) < 8 / state.pps) dt = Math.max(-minStart, snapped - orig[li]);
    items.forEach((i, k) => { i.clip.start = Math.max(0, orig[k] + dt); });
    layout();
    emit('change', 'live');
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) { commit(); emit('inspect'); }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function startScrub(e) {
  const go = (ev) => seek(clamp(timeFromEvent(ev), 0, 36000));
  go(e);
  const up = () => { window.removeEventListener('pointermove', go); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', go);
  window.addEventListener('pointerup', up);
}

function startDrag(e, track, c, mode) {
  const startX = e.clientX;
  const orig = { start: c.start, in: c.in, dur: c.dur };
  const grab = timeFromEvent(e) - c.start;
  const pts = snapPoints(c);
  const m = c.mediaId ? getMedia(c.mediaId) : null;
  const maxSrc = m && c.kind !== 'image' ? m.duration : Infinity;
  const speed = c.speed || 1;
  let moved = false;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    const dt = dx / state.pps;
    if (mode === 'move') {
      if (track === 'main') reorderMain(c, timeFromEvent(ev) - grab + c.dur / 2);
      else {
        let ns = Math.max(0, orig.start + dt);
        const a = snapVal(ns, pts), b = snapVal(ns + c.dur, pts) - c.dur;
        ns = Math.abs(a - ns) <= Math.abs(b - ns) ? a : b;
        c.start = Math.max(0, ns);
      }
    } else if (mode === 'trimL') {
      let d = dt;
      if (track !== 'main') d = snapVal(orig.start + d, pts) - orig.start;
      const minD = Math.max(track === 'main' ? -3600 : -orig.start, c.kind !== 'image' && c.kind ? -orig.in / speed : -3600);
      d = clamp(d, minD, orig.dur - 0.1);
      c.dur = orig.dur - d;
      if (c.kind && c.kind !== 'image') c.in = orig.in + d * speed;
      if (track !== 'main') c.start = orig.start + d;
    } else {
      let nd = orig.dur + dt;
      nd = snapVal(orig.start + nd, pts) - orig.start;
      if (track === 'main') nd = orig.dur + dt;
      c.dur = clamp(nd, 0.1, Math.min(3600, (maxSrc - orig.in) / speed));
    }
    layout();
    emit('change', 'live');
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) { commit(); emit('inspect'); }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function reorderMain(c, center) {
  const others = state.main.filter((x) => x !== c);
  let pos = 0, idx = 0;
  for (const o of others) {
    if (pos + o.dur / 2 < center) idx++;
    pos += o.dur;
  }
  const cur = state.main.indexOf(c);
  if (idx !== cur) {
    state.main.splice(cur, 1);
    state.main.splice(idx, 0, c);
  }
}

/* ---------------- adding media ---------------- */
export function placeMedia(m, track, at) {
  if (!m || m.offline) return null;
  if (m.type === 'audio') track = 'audio';
  else if (track !== 'main' && track !== 'overlay') track = 'main';
  const c = makeClip(m, track, 0);
  if (track === 'main') {
    if (!state.main.length && m.w && m.h) state.aspect = nearestAspect(m.w, m.h);
    let idx = state.main.length;
    if (at != null) {
      idx = 0;
      let pos = 0;
      for (const o of state.main) { if (pos + o.dur / 2 < at) idx++; pos += o.dur; }
    }
    insertMain(c, idx);
  } else {
    c.start = Math.max(0, at ?? state.t);
    addClip(track, c);
  }
  return c;
}

/* ---------------- zoom ---------------- */
const zoomInput = $('#tl-zoom');
const MIN_PPS = 0.4, MAX_PPS = 400;
const ppsFromSlider = (v) => MIN_PPS * Math.pow(MAX_PPS / MIN_PPS, v / 100);
const sliderFromPps = (p) => (Math.log(p / MIN_PPS) / Math.log(MAX_PPS / MIN_PPS)) * 100;

export function setPps(p, anchorX) {
  const old = state.pps;
  p = clamp(p, MIN_PPS, MAX_PPS);
  if (p === old) return;
  const ax = anchorX ?? scroll.clientWidth / 2;
  const timeAt = (scroll.scrollLeft + ax - LABEL_W) / old;
  state.pps = p;
  zoomInput.value = sliderFromPps(p);
  build();
  scroll.scrollLeft = Math.max(0, timeAt * p + LABEL_W - ax);
}

zoomInput.addEventListener('input', () => setPps(ppsFromSlider(+zoomInput.value)));
$('#tl-zin').addEventListener('click', () => setPps(state.pps * 1.35));
$('#tl-zout').addEventListener('click', () => setPps(state.pps / 1.35));
/** Zooms so that the whole project fits the visible timeline. */
export function fitTimeline() {
  const d = Math.max(totalDuration(), 2);
  const target = clamp((scroll.clientWidth - LABEL_W - 90) / d, MIN_PPS, MAX_PPS);
  if (Math.abs(target - state.pps) < 1e-6) build(); else setPps(target);
  scroll.scrollLeft = 0;
}
$('#tl-fit').addEventListener('click', fitTimeline);
scroll.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setPps(state.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - scroll.getBoundingClientRect().left);
  }
}, { passive: false });

/* ---------------- wiring ---------------- */
on('change', () => build());
on('select', () => {
  // cheap: just toggle the selected class instead of rebuilding the whole timeline
  content.querySelectorAll('.clip').forEach((el) => el.classList.toggle('sel', isSelected(el.dataset.id)));
});
on('reset', () => { scroll.scrollLeft = 0; build(); });
on('seek', () => updatePlayhead(!state.playing));
on('time', () => updatePlayhead(state.playing));
on('lang', () => build());
window.addEventListener('resize', () => build());
zoomInput.value = sliderFromPps(state.pps);
build();

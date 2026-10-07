// Timeline UI: ruler, four tracks, clip drag / trim / reorder, snapping, zoom, playhead.
import { state, on, emit, getMedia, totalDuration, layout, commit, select, findClip, makeClip, insertMain, addClip } from './store.js';
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
  const W = Math.max((dur + 6) * pps, scroll.clientWidth - LABEL_W - 4);
  content.style.width = W + LABEL_W + 'px';
  content.replaceChildren();

  const ruler = h('div', { class: 'tl-ruler', dataset: { role: 'ruler' } });
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s * pps >= 80) || 600;
  const sub = step / 5;
  for (let i = 0; i * sub <= W / pps; i++) {
    const s = Math.round(i * sub * 1000) / 1000;
    const major = Math.abs(s / step - Math.round(s / step)) < 1e-6;
    ruler.append(h('i', { class: 'tick' + (major ? ' major' : ''), style: { left: LABEL_W + s * pps + 'px' } }));
    if (major) ruler.append(h('span', { class: 'tick-label', style: { left: LABEL_W + s * pps + 4 + 'px' }, text: fmtTime(s, false) }));
  }
  content.append(ruler);

  for (const r of ROWS) {
    const row = h('div', { class: 'tl-row ' + r.track, dataset: { track: r.track }, style: { height: r.h + 'px' } },
      h('div', { class: 'tl-label' }, icon(r.ico)));
    if (r.track === 'main' && !state.main.length) row.append(h('div', { class: 'tl-hint', text: t('timeline.hint') }));
    for (const c of state[r.track]) row.append(clipEl(r.track, c));
    content.append(row);
  }
  playhead = h('div', { class: 'playhead' }, h('i'));
  content.append(playhead);
  updatePlayhead(false);
}

function clipEl(track, c) {
  const pps = state.pps;
  const m = c.mediaId ? getMedia(c.mediaId) : null;
  const sel = state.sel && state.sel.id === c.id;
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
    select(track, id);
    const mode = e.target.classList.contains('hl') ? 'trimL' : e.target.classList.contains('hr') ? 'trimR' : 'move';
    startDrag(e, track, c, mode);
    return;
  }
  select(null, null);
  startScrub(e);
});

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
  if (!m || m.offline) return false;
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
  return true;
}

/* ---------------- zoom ---------------- */
const zoomInput = $('#tl-zoom');
const ppsFromSlider = (v) => 10 * Math.pow(40, v / 100);
const sliderFromPps = (p) => (Math.log(p / 10) / Math.log(40)) * 100;

export function setPps(p, anchorX) {
  const old = state.pps;
  p = clamp(p, 10, 400);
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
$('#tl-fit').addEventListener('click', () => {
  const d = Math.max(totalDuration(), 2);
  setPps((scroll.clientWidth - LABEL_W - 60) / d);
  scroll.scrollLeft = 0;
});
scroll.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setPps(state.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - scroll.getBoundingClientRect().left);
  }
}, { passive: false });

/* ---------------- wiring ---------------- */
on('change', () => build());
on('select', () => build());
on('reset', () => { scroll.scrollLeft = 0; build(); });
on('seek', () => updatePlayhead(!state.playing));
on('time', () => updatePlayhead(state.playing));
on('lang', () => build());
window.addEventListener('resize', () => build());
zoomInput.value = sliderFromPps(state.pps);
build();

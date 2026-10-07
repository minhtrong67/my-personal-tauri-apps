// Right-hand inspector: project settings, media clip, text clip, audio clip.
import { state, on, emit, selClip, layout, commit, ASPECTS, FILTER_PRESETS, TRANSITIONS, defaultFilters, totalDuration, getMedia } from './store.js';
import { $, h, clamp, icon } from './util.js';
import { t } from './i18n.js';

const root = $('#inspector');
let tab = 'basic';
let lastKey = '';

const live = () => { layout(); emit('change', 'live'); };
const done = () => { commit(); };
const fmtPct = (v) => v + '%';

/* ---------------- control builders ---------------- */
function field(label, ...ctrl) {
  return h('div', { class: 'f-row' }, h('label', { text: label }), h('div', { class: 'f-ctl' }, ...ctrl));
}

function slider({ label, get, set, min, max, step = 1, fmt = (v) => v, def }) {
  const val = h('span', { class: 'val', text: fmt(get()) });
  const inp = h('input', { type: 'range', min, max, step, value: get() });
  inp.addEventListener('input', () => { const v = +inp.value; set(v); val.textContent = fmt(v); live(); });
  inp.addEventListener('change', done);
  if (def !== undefined) inp.addEventListener('dblclick', () => { set(def); inp.value = def; val.textContent = fmt(def); live(); done(); });
  return h('div', { class: 'f-row slider' }, h('label', { text: label }, val), inp);
}

function select({ label, get, set, options }) {
  const sel = h('select', { class: 'select block' }, options.map(([v, l]) => h('option', { value: v, text: l })));
  sel.value = get();
  sel.addEventListener('change', () => { set(sel.value); live(); done(); emit('inspect'); });
  return field(label, sel);
}

function color({ label, get, set }) {
  const inp = h('input', { type: 'color', value: get() || '#ffffff' });
  inp.addEventListener('input', () => { set(inp.value); live(); });
  inp.addEventListener('change', done);
  return field(label, inp);
}

function toggle({ label, get, set }) {
  const inp = h('input', { type: 'checkbox' });
  inp.checked = !!get();
  inp.addEventListener('change', () => { set(inp.checked); live(); done(); emit('inspect'); });
  return h('label', { class: 'switch-row' }, h('span', { text: label }), h('span', { class: 'switch' }, inp, h('i')));
}

function segmented({ get, set, options }) {
  const wrap = h('div', { class: 'segmented small' });
  for (const [v, l] of options) {
    const b = h('button', { class: get() === v ? 'on' : '', text: l, onclick() { set(v); live(); done(); emit('inspect'); } });
    wrap.append(b);
  }
  return wrap;
}

function numberField({ label, get, set, min = 0, max = 3600, step = 0.1 }) {
  const inp = h('input', { type: 'number', class: 'field num', min, max, step, value: (+get()).toFixed(2) });
  inp.addEventListener('change', () => { set(clamp(+inp.value || 0, min, max)); live(); done(); emit('inspect'); });
  return field(label, inp);
}

function heading(text) { return h('h4', { text }); }

/* ---------------- sections ---------------- */
function projectPanel() {
  const p = h('div', { class: 'insp' });
  p.append(h('h3', { text: t('insp.project') }));
  p.append(heading(t('insp.aspect')));
  const grid = h('div', { class: 'chips' });
  for (const k of Object.keys(ASPECTS)) {
    grid.append(h('button', { class: 'chip-btn' + (state.aspect === k ? ' on' : ''), text: k, onclick() { state.aspect = k; commit(); emit('change'); emit('inspect'); } }));
  }
  p.append(grid);
  p.append(select({
    label: t('insp.fps'), get: () => String(state.fps), set: (v) => { state.fps = +v; },
    options: [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']],
  }));
  p.append(color({ label: t('insp.background'), get: () => state.bg, set: (v) => { state.bg = v; } }));
  p.append(h('div', { class: 'insp-info' },
    icon('info'),
    h('span', { text: t('insp.summary', { d: totalDuration().toFixed(1), n: state.main.length + state.overlay.length + state.audio.length + state.text.length }) })));
  p.append(h('p', { class: 'hint', text: t('insp.hintSelect') }));
  return p;
}

function timingBlock(c, track) {
  const frag = [];
  if (track !== 'main') frag.push(numberField({ label: t('insp.start'), get: () => c.start, set: (v) => { c.start = v; }, max: 36000 }));
  frag.push(numberField({
    label: t('insp.duration'), get: () => c.dur, min: 0.1,
    set: (v) => {
      const m = c.mediaId ? getMedia(c.mediaId) : null;
      const maxD = m && c.kind !== 'image' ? (m.duration - c.in) / (c.speed || 1) : 3600;
      c.dur = clamp(v, 0.1, maxD);
    },
  }));
  return frag;
}

function fadesBlock(c) {
  return [
    slider({ label: t('insp.fadeIn'), get: () => c.fadeIn, set: (v) => { c.fadeIn = v; }, min: 0, max: Math.min(5, c.dur), step: 0.1, fmt: (v) => v.toFixed(1) + 's', def: 0 }),
    slider({ label: t('insp.fadeOut'), get: () => c.fadeOut, set: (v) => { c.fadeOut = v; }, min: 0, max: Math.min(5, c.dur), step: 0.1, fmt: (v) => v.toFixed(1) + 's', def: 0 }),
  ];
}

function audioBlock(c) {
  const out = [
    slider({ label: t('insp.volume'), get: () => Math.round(c.volume * 100), set: (v) => { c.volume = v / 100; }, min: 0, max: 200, fmt: fmtPct, def: 100 }),
    toggle({ label: t('insp.mute'), get: () => c.muted, set: (v) => { c.muted = v; } }),
  ];
  return out;
}

function speedBlock(c) {
  const wrap = h('div', {});
  wrap.append(slider({
    label: t('insp.speed'), get: () => c.speed, min: 0.25, max: 4, step: 0.05, fmt: (v) => v.toFixed(2) + '×', def: 1,
    set: (v) => { const span = c.dur * c.speed; c.speed = v; c.dur = Math.max(0.1, span / v); },
  }));
  const chips = h('div', { class: 'chips' });
  for (const s of [0.5, 1, 1.5, 2, 3]) {
    chips.append(h('button', { class: 'chip-btn' + (c.speed === s ? ' on' : ''), text: s + '×', onclick() { const span = c.dur * c.speed; c.speed = s; c.dur = Math.max(0.1, span / s); live(); done(); emit('inspect'); } }));
  }
  wrap.append(chips);
  return wrap;
}

function mediaPanel(c, track) {
  const p = h('div', { class: 'insp' });
  const m = getMedia(c.mediaId);
  p.append(h('h3', { text: (track === 'overlay' ? t('insp.overlay') : t('insp.clip')) + (m ? ' · ' + m.name : '') }));
  const tabs = h('div', { class: 'segmented small' });
  for (const [k, l] of [['basic', t('insp.basic')], ['filters', t('insp.filters')]]) {
    tabs.append(h('button', { class: tab === k ? 'on' : '', text: l, onclick() { tab = k; render(true); } }));
  }
  p.append(tabs);

  if (tab === 'filters') {
    p.append(heading(t('insp.presets')));
    const grid = h('div', { class: 'chips' });
    for (const k of Object.keys(FILTER_PRESETS)) {
      grid.append(h('button', {
        class: 'chip-btn' + (c.filters.preset === k ? ' on' : ''), text: t('filter.' + k),
        onclick() { c.filters = { ...defaultFilters(), ...FILTER_PRESETS[k], preset: k }; live(); done(); emit('inspect'); },
      }));
    }
    p.append(grid);
    const F = c.filters;
    const sl = (key, label, min, max, def, fmt = fmtPct, step = 1) =>
      slider({ label, get: () => F[key], set: (v) => { F[key] = v; F.preset = 'custom'; }, min, max, step, fmt, def });
    p.append(
      sl('brightness', t('insp.brightness'), 0, 200, 100),
      sl('contrast', t('insp.contrast'), 0, 200, 100),
      sl('saturate', t('insp.saturation'), 0, 300, 100),
      sl('hue', t('insp.hue'), -180, 180, 0, (v) => v + '°'),
      sl('blur', t('insp.blur'), 0, 20, 0, (v) => v + 'px'),
      sl('gray', t('insp.gray'), 0, 100, 0),
      sl('sepia', t('insp.sepia'), 0, 100, 0),
      sl('vignette', t('insp.vignette'), 0, 1, 0, (v) => Math.round(v * 100) + '%', 0.05),
      h('button', { class: 'btn tonal sm wide', text: t('insp.reset'), onclick() { c.filters = defaultFilters(); live(); done(); emit('inspect'); } }),
    );
    return p;
  }

  p.append(...timingBlock(c, track));
  if (c.kind === 'video' || c.kind === 'audio') p.append(speedBlock(c));
  p.append(heading(t('insp.transform')));
  p.append(slider({ label: t('insp.opacity'), get: () => Math.round(c.opacity * 100), set: (v) => { c.opacity = v / 100; }, min: 0, max: 100, fmt: fmtPct, def: 100 }));
  p.append(h('div', { class: 'f-row' }, h('label', { text: t('insp.fit') }),
    segmented({
      get: () => c.fit, set: (v) => { c.fit = v; },
      options: [['contain', t('fit.contain')], ['cover', t('fit.cover')], ...(track === 'main' ? [['blur', t('fit.blur')]] : [])],
    })));
  p.append(
    slider({ label: t('insp.scale'), get: () => Math.round(c.scale * 100), set: (v) => { c.scale = v / 100; }, min: 10, max: 400, fmt: fmtPct, def: track === 'overlay' ? 50 : 100 }),
    slider({ label: t('insp.rotation'), get: () => c.rot, set: (v) => { c.rot = v; }, min: -180, max: 180, fmt: (v) => v + '°', def: 0 }),
    slider({ label: t('insp.posX'), get: () => Math.round(c.x * 100), set: (v) => { c.x = v / 100; }, min: -100, max: 100, fmt: fmtPct, def: 0 }),
    slider({ label: t('insp.posY'), get: () => Math.round(c.y * 100), set: (v) => { c.y = v / 100; }, min: -100, max: 100, fmt: fmtPct, def: 0 }),
  );
  const flips = h('div', { class: 'btn-row' },
    h('button', { class: 'chip-btn' + (c.flipH ? ' on' : ''), onclick() { c.flipH = !c.flipH; live(); done(); emit('inspect'); } }, icon('swap'), t('insp.flipH')),
    h('button', { class: 'chip-btn' + (c.flipV ? ' on' : ''), onclick() { c.flipV = !c.flipV; live(); done(); emit('inspect'); } }, icon('rotate'), t('insp.flipV')),
  );
  p.append(flips);
  p.append(...fadesBlock(c));
  if (c.kind === 'video') { p.append(heading(t('insp.audio'))); p.append(...audioBlock(c)); }
  if (track === 'main') {
    const idx = state.main.indexOf(c);
    p.append(heading(t('insp.transition')));
    if (idx === 0) p.append(h('p', { class: 'hint', text: t('insp.transFirst') }));
    else {
      p.append(select({
        label: t('insp.type'), get: () => c.trans.type, set: (v) => { c.trans.type = v; },
        options: TRANSITIONS.map((k) => [k, t('trans.' + k)]),
      }));
      if (c.trans.type !== 'none') {
        p.append(slider({ label: t('insp.transDur'), get: () => c.trans.dur, set: (v) => { c.trans.dur = v; }, min: 0.2, max: 2, step: 0.1, fmt: (v) => v.toFixed(1) + 's', def: 0.6 }));
      }
    }
  }
  return p;
}

const FONTS = ['system-ui', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Segoe UI'];

function textPanel(c) {
  const p = h('div', { class: 'insp' });
  p.append(h('h3', { text: t('insp.textClip') }));
  const ta = h('textarea', { class: 'field area', rows: 3, spellcheck: 'false' });
  ta.value = c.text;
  ta.addEventListener('input', () => { c.text = ta.value || ' '; live(); });
  ta.addEventListener('change', done);
  p.append(ta);
  p.append(...timingBlock(c, 'text'));
  p.append(select({ label: t('insp.font'), get: () => c.font, set: (v) => { c.font = v; }, options: FONTS.map((f) => [f, f === 'system-ui' ? 'System UI' : f]) }));
  p.append(slider({ label: t('insp.size'), get: () => c.size, set: (v) => { c.size = v; }, min: 12, max: 300, fmt: (v) => v + 'px', def: 72 }));
  p.append(color({ label: t('insp.color'), get: () => c.color, set: (v) => { c.color = v; } }));
  const styleRow = h('div', { class: 'btn-row' },
    h('button', { class: 'chip-btn' + (c.bold ? ' on' : ''), html: '<b>B</b>', onclick() { c.bold = !c.bold; live(); done(); emit('inspect'); } }),
    h('button', { class: 'chip-btn' + (c.italic ? ' on' : ''), html: '<i>I</i>', onclick() { c.italic = !c.italic; live(); done(); emit('inspect'); } }),
  );
  p.append(h('div', { class: 'f-row' }, h('label', { text: t('insp.style') }), styleRow));
  p.append(h('div', { class: 'f-row' }, h('label', { text: t('insp.align') }),
    segmented({ get: () => c.align, set: (v) => { c.align = v; }, options: [['left', '⇤'], ['center', '↔'], ['right', '⇥']] })));
  p.append(select({ label: t('insp.anim'), get: () => c.anim, set: (v) => { c.anim = v; }, options: ['none', 'fade', 'pop', 'slideup', 'typewriter'].map((k) => [k, t('anim.' + k)]) }));
  p.append(heading(t('insp.appearance')));
  p.append(toggle({ label: t('insp.bgBox'), get: () => !!c.bg, set: (v) => { c.bg = v ? (c.bg || '#000000') : ''; } }));
  if (c.bg) {
    p.append(color({ label: t('insp.bgColor'), get: () => c.bg, set: (v) => { c.bg = v; } }));
    p.append(slider({ label: t('insp.bgOpacity'), get: () => Math.round(c.bgOpacity * 100), set: (v) => { c.bgOpacity = v / 100; }, min: 0, max: 100, fmt: fmtPct, def: 60 }));
  }
  p.append(slider({ label: t('insp.outline'), get: () => c.strokeW, set: (v) => { c.strokeW = v; }, min: 0, max: 12, fmt: (v) => v + 'px', def: 0 }));
  if (c.strokeW > 0) p.append(color({ label: t('insp.outlineColor'), get: () => c.stroke, set: (v) => { c.stroke = v; } }));
  p.append(toggle({ label: t('insp.shadow'), get: () => c.shadow, set: (v) => { c.shadow = v; } }));
  p.append(
    slider({ label: t('insp.opacity'), get: () => Math.round(c.opacity * 100), set: (v) => { c.opacity = v / 100; }, min: 0, max: 100, fmt: fmtPct, def: 100 }),
    slider({ label: t('insp.rotation'), get: () => c.rot, set: (v) => { c.rot = v; }, min: -180, max: 180, fmt: (v) => v + '°', def: 0 }),
    slider({ label: t('insp.posX'), get: () => Math.round(c.x * 100), set: (v) => { c.x = v / 100; }, min: 0, max: 100, fmt: fmtPct, def: 50 }),
    slider({ label: t('insp.posY'), get: () => Math.round(c.y * 100), set: (v) => { c.y = v / 100; }, min: 0, max: 100, fmt: fmtPct, def: 50 }),
  );
  return p;
}

function audioPanel(c) {
  const p = h('div', { class: 'insp' });
  const m = getMedia(c.mediaId);
  p.append(h('h3', { text: t('insp.audioClip') + (m ? ' · ' + m.name : '') }));
  p.append(...timingBlock(c, 'audio'));
  p.append(speedBlock(c));
  p.append(...audioBlock(c));
  p.append(...fadesBlock(c));
  return p;
}

/* ---------------- render ---------------- */
export function render(force = false) {
  const c = selClip();
  const sel = state.sel;
  const key = sel ? sel.track + ':' + sel.id : 'none';
  if (key !== lastKey) { tab = 'basic'; lastKey = key; }
  const top = root.scrollTop;
  root.replaceChildren();
  let panel;
  if (!c) panel = projectPanel();
  else if (sel.track === 'text') panel = textPanel(c);
  else if (sel.track === 'audio') panel = audioPanel(c);
  else panel = mediaPanel(c, sel.track);
  root.append(panel);
  root.scrollTop = force ? top : 0;
}

on('select', () => render());
on('inspect', () => render(true));
on('history', () => { if (!document.activeElement || !root.contains(document.activeElement)) render(true); });
on('reset', () => render());
on('lang', () => render());
render();

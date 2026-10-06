// Left panel: media library, text presets, filter presets and transitions.
import { state, on, emit, selClip, commit, layout, addClip, makeText, TEXT_PRESETS, FILTER_PRESETS, TRANSITIONS, defaultFilters, getMedia } from './store.js';
import { removeMedia, offlineMedia } from './media.js';
import { placeMedia } from './timeline.js';
import { $, $$, h, icon, fmtTime } from './util.js';
import { t } from './i18n.js';

const body = $('#left-body');
let tab = 'media';
let handlers = { importFiles: () => {}, toast: () => {} };
export const setPanelHandlers = (o) => Object.assign(handlers, o);

$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});

function mediaTab() {
  const wrap = h('div', { class: 'panel' });
  wrap.append(h('button', { class: 'btn tonal wide', onclick: () => handlers.importFiles() }, icon('plus'), t('media.import')));
  const off = offlineMedia();
  if (off.length) wrap.append(h('div', { class: 'banner' }, icon('link'), h('span', { text: t('media.offline', { n: off.length }) })));
  if (!state.media.length) {
    wrap.append(h('div', { class: 'drop-hint' }, icon('film'), h('p', { text: t('media.empty') })));
    return wrap;
  }
  const grid = h('div', { class: 'media-grid' });
  for (const m of state.media) {
    const card = h('div', {
      class: 'media-card' + (m.offline ? ' offline' : ''), draggable: m.offline ? null : 'true', title: m.name,
      ondragstart(e) { e.dataTransfer.setData('application/x-mve-media', m.id); e.dataTransfer.effectAllowed = 'copy'; },
      ondblclick() { if (m.offline) handlers.importFiles(); else placeMedia(m, 'main'); },
    });
    const thumb = h('div', { class: 'thumb' });
    if (m.thumb) thumb.style.backgroundImage = `url(${m.thumb})`;
    else thumb.append(icon(m.type === 'audio' ? 'music' : 'image'));
    if (m.type === 'audio' && m.wave) { thumb.style.backgroundImage = `url(${m.wave})`; thumb.style.backgroundSize = '100% 70%'; thumb.style.backgroundRepeat = 'no-repeat'; thumb.style.backgroundPosition = 'center'; }
    if (m.type !== 'image') thumb.append(h('span', { class: 'dur', text: fmtTime(m.duration, false) }));
    thumb.append(h('span', { class: 'kind' }, icon(m.type === 'video' ? 'video' : m.type === 'audio' ? 'music' : 'image')));
    const actions = h('div', { class: 'card-actions' },
      m.offline ? null : h('button', { class: 'icon-btn sm', title: t('media.add'), onclick(e) { e.stopPropagation(); placeMedia(m, 'main'); } }, icon('plus')),
      m.type !== 'audio' && !m.offline ? h('button', { class: 'icon-btn sm', title: t('media.addOverlay'), onclick(e) { e.stopPropagation(); placeMedia(m, 'overlay'); } }, icon('layers')) : null,
      h('button', { class: 'icon-btn sm', title: t('btn.remove'), onclick(e) { e.stopPropagation(); removeMediaAndClips(m.id); } }, icon('trash')),
    );
    card.append(thumb, h('div', { class: 'name', text: m.name }), actions);
    grid.append(card);
  }
  wrap.append(grid);
  wrap.append(h('p', { class: 'hint', text: t('media.tip') }));
  return wrap;
}

function removeMediaAndClips(id) {
  for (const tr of ['main', 'overlay', 'audio']) state[tr] = state[tr].filter((c) => c.mediaId !== id);
  if (state.sel && !state[state.sel.track].some((c) => c.id === state.sel.id)) state.sel = null;
  removeMedia(id);
  layout();
  commit();
  emit('change');
  emit('select');
}

function textTab() {
  const wrap = h('div', { class: 'panel' });
  wrap.append(h('button', { class: 'btn tonal wide', onclick: () => addText('basic') }, icon('plus'), t('text.add')));
  const grid = h('div', { class: 'preset-grid' });
  for (const k of Object.keys(TEXT_PRESETS)) {
    const p = TEXT_PRESETS[k];
    const sample = h('span', { class: 'sample', text: p.text });
    sample.style.color = p.color || '#fff';
    sample.style.fontWeight = p.bold === false ? 400 : 700;
    sample.style.fontFamily = p.font || 'system-ui';
    if (p.bg) { sample.style.background = p.bg; sample.style.padding = '2px 8px'; sample.style.borderRadius = '4px'; }
    if (p.strokeW) sample.style.webkitTextStroke = '1px #000';
    if (p.shadow !== false) sample.style.textShadow = '0 1px 3px rgba(0,0,0,.7)';
    grid.append(h('button', { class: 'preset', onclick: () => addText(k) }, sample, h('small', { text: t('textpreset.' + k) })));
  }
  wrap.append(grid);
  return wrap;
}

function addText(kind) {
  const c = makeText(kind, state.t);
  c.text = t('textpreset.' + kind + '.sample') === 'textpreset.' + kind + '.sample' ? c.text : t('textpreset.' + kind + '.sample');
  addClip('text', c);
}

function targetMedia() {
  const c = selClip();
  return c && c.filters ? c : null;
}

function effectsTab() {
  const wrap = h('div', { class: 'panel' });
  wrap.append(h('p', { class: 'hint', text: targetMedia() ? t('effects.apply') : t('effects.select') }));
  const grid = h('div', { class: 'preset-grid' });
  const first = state.media.find((m) => m.thumb);
  for (const k of Object.keys(FILTER_PRESETS)) {
    const f = { ...defaultFilters(), ...FILTER_PRESETS[k] };
    const css = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg) grayscale(${f.gray}%) sepia(${f.sepia}%)`;
    const sw = h('div', { class: 'fx-thumb' });
    sw.style.backgroundImage = first ? `url(${first.thumb})` : 'linear-gradient(135deg,#f59e0b,#ec4899 50%,#3b82f6)';
    sw.style.filter = css;
    const cur = targetMedia();
    grid.append(h('button', {
      class: 'preset' + (cur && cur.filters.preset === k ? ' on' : ''),
      onclick() {
        const c = targetMedia();
        if (!c) { handlers.toast(t('effects.select')); return; }
        c.filters = { ...defaultFilters(), ...FILTER_PRESETS[k], preset: k };
        commit(); emit('change'); emit('inspect'); render();
      },
    }, sw, h('small', { text: t('filter.' + k) })));
  }
  wrap.append(grid);
  return wrap;
}

function transitionsTab() {
  const wrap = h('div', { class: 'panel' });
  const c = selClip();
  const ok = state.sel && state.sel.track === 'main' && state.main.indexOf(c) > 0;
  wrap.append(h('p', { class: 'hint', text: ok ? t('trans.apply') : t('trans.select') }));
  const grid = h('div', { class: 'preset-grid' });
  for (const k of TRANSITIONS) {
    grid.append(h('button', {
      class: 'preset' + (ok && c.trans.type === k ? ' on' : ''),
      onclick() {
        const cur = selClip();
        if (!(state.sel && state.sel.track === 'main' && state.main.indexOf(cur) > 0)) { handlers.toast(t('trans.select')); return; }
        cur.trans.type = k;
        layout(); commit(); emit('change'); emit('inspect'); render();
      },
    }, h('div', { class: 'tr-thumb ' + k }, h('i'), h('i')), h('small', { text: t('trans.' + k) })));
  }
  wrap.append(grid);
  wrap.append(h('button', {
    class: 'btn tonal wide', text: t('trans.applyAll'),
    onclick() {
      const type = ok ? c.trans.type : 'fade';
      state.main.forEach((x, i) => { if (i > 0) x.trans.type = type === 'none' ? 'fade' : type; });
      layout(); commit(); emit('change'); emit('inspect');
    },
  }));
  return wrap;
}

export function render() {
  $$('#rail button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const top = body.scrollTop;
  body.replaceChildren(({ media: mediaTab, text: textTab, effects: effectsTab, transitions: transitionsTab })[tab]());
  body.scrollTop = top;
}

on('media', render);
on('reset', render);
on('lang', render);
on('select', () => { if (tab === 'effects' || tab === 'transitions') render(); });
on('history', () => { if (tab === 'effects' || tab === 'transitions') render(); });
render();
export { getMedia };

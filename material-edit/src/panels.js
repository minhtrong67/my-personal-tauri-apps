// Left panel: media library, text presets, filter presets and transitions.
import { state, on, emit, selClip, selectedItems, commit, layout, addClip, makeText, TEXT_PRESETS, FILTER_PRESETS, TRANSITIONS, defaultFilters, getMedia } from './store.js';
import { removeMedia, offlineMedia } from './media.js';
import { placeMedia, timeAtClientX, resolveTrack, markDropRow } from './timeline.js';
import { showMenu } from './contextmenu.js';
import { $, $$, h, icon, fmtTime } from './util.js';
import { t } from './i18n.js';

const body = $('#left-body');
let tab = 'media';
/** Media-library multi selection (ids). */
const msel = new Set();
export let zone = 'timeline';
const selectedMedia = () => state.media.filter((m) => msel.has(m.id));

let handlers = { importFiles: () => {}, toast: () => {}, locate: () => {} };
export const setPanelHandlers = (o) => Object.assign(handlers, o);

$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});


function placeAll(list, track, at) {
  // videos / photos chain one after another; audio clips chain on their own row, all starting at the same point
  let pos = at, apos = at;
  for (const m of list) {
    const isAudio = m.type === 'audio';
    const c = placeMedia(m, track, (isAudio ? apos : pos) ?? undefined);
    if (!c || !c.dur) continue;
    if (isAudio) { if (apos != null) apos += c.dur; else apos = c.start + c.dur; }
    else if (pos != null) pos += c.dur;
  }
}
/** The + button / double-click add the whole selection when the card belongs to a multi-selection. */
function addFromCard(m, track) {
  const group = msel.has(m.id) && msel.size > 1 ? selectedMedia().filter((x) => !x.offline && (track === 'main' || x.type !== 'audio')) : [m];
  if (group.length > 1) placeAll(group, track); else placeMedia(m, track);
}

export function mediaMenu(m) {
  if (!msel.has(m.id)) { msel.clear(); msel.add(m.id); markSel(); }
  const list = selectedMedia();
  const many = list.length > 1;
  const usable = list.filter((x) => !x.offline);
  const overlayable = usable.filter((x) => x.type !== 'audio');
  return [
    { label: many ? t('media.addN', { n: usable.length }) : t('media.add'), icon: 'plus', run: () => placeAll(usable, 'main'), disabled: !usable.length },
    overlayable.length ? { label: many ? t('media.addOverlayN', { n: overlayable.length }) : t('media.addOverlay'), icon: 'layers', run: () => placeAll(overlayable, 'overlay') } : null,
    '-',
    { label: t('ctx.selectAllMedia'), icon: 'layers', kbd: 'Ctrl+A', run: selectAllMedia },
    many ? { label: t('ctx.deselect'), icon: 'close', run: () => { msel.clear(); markSel(); } } : null,
    '-',
    !many ? { label: t('media.locate'), icon: 'link', run: () => handlers.locate(m) } : null,
    { label: many ? t('media.removeN', { n: list.length }) : t('btn.remove'), icon: 'trash', danger: true, run: () => list.forEach((x) => removeMediaAndClips(x.id)) },
  ];
}

function markSel() {
  body.querySelectorAll('.media-card').forEach((el) => el.classList.toggle('sel', msel.has(el.dataset.mediaId)));
}
export function selectAllMedia() { state.media.forEach((m) => msel.add(m.id)); markSel(); }
export function clearMediaSel() { msel.clear(); markSel(); }
/** Deletes the selected library items (returns false when nothing is selected there). */
export function deleteSelectedMedia() {
  const list = selectedMedia();
  if (zone !== 'media' || !list.length) return false;
  list.forEach((x) => removeMediaAndClips(x.id));
  msel.clear();
  return true;
}
export const mediaSelectedCount = () => selectedMedia().length;

/** Rubber-band selection over the media grid. */
body.addEventListener('pointerdown', (e) => {
  zone = 'media';
  if (e.button !== 0 || e.target.closest('.media-card, button, .btn, input, select, .preset')) return;
  if (tab !== 'media' || !body.querySelector('.media-grid')) return;
  const additive = e.ctrlKey || e.metaKey || e.shiftKey;
  const base = additive ? new Set(msel) : new Set();
  const box = body.getBoundingClientRect();
  const x0 = e.clientX, y0 = e.clientY;
  let rect = null, moved = false;
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moved = true;
    if (!rect) { rect = h('div', { class: 'marquee fixed' }); document.body.append(rect); }
    const l = Math.min(x0, ev.clientX), r = Math.max(x0, ev.clientX), tp = Math.min(y0, ev.clientY), bt = Math.max(y0, ev.clientY);
    Object.assign(rect.style, { left: l + 'px', top: tp + 'px', width: r - l + 'px', height: bt - tp + 'px' });
    msel.clear(); base.forEach((id) => msel.add(id));
    body.querySelectorAll('.media-card').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.left < r && b.right > l && b.top < bt && b.bottom > tp && b.top < box.bottom && b.bottom > box.top) msel.add(el.dataset.mediaId);
    });
    markSel();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
    if (rect) rect.remove();
    if (!moved && !additive) { msel.clear(); markSel(); }
  };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
});
document.addEventListener('pointerdown', (e) => { if (!body.contains(e.target) && e.target.closest) { if (e.target.closest('#timeline, #tl-scroll')) zone = 'timeline'; else if (e.target.closest('#stage, #inspector')) zone = 'timeline'; } }, true);

/** Pointer-based drag from the library onto the timeline / preview (works with native file drops enabled). */
function startMediaDrag(e, m, card) {
  const sx = e.clientX, sy = e.clientY;
  let ghost = null, target = null, dragging = false;
  const stage = $('#stage');
  const hover = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const row = el && el.closest && el.closest('.tl-row');
    markDropRow(null);
    stage.classList.remove('drop-target');
    if (row) { const tr = resolveTrack(m, row.dataset.track); markDropRow(tr); return { track: tr, time: Math.max(0, timeAtClientX(x)) }; }
    if (el && el.closest && el.closest('#stage')) { stage.classList.add('drop-target'); return { track: resolveTrack(m, 'main'), time: null }; }
    return null;
  };
  const move = (ev) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      dragging = true;
      ghost = h('div', { class: 'drag-ghost' }, h('div', { class: 'thumb', style: m.thumb ? { backgroundImage: `url(${m.thumb})` } : {} }, m.thumb ? null : icon(m.type === 'audio' ? 'music' : 'image')), h('div', { class: 'name', text: m.name }));
      document.body.append(ghost);
      card.classList.add('dragging');
    }
    ghost.style.left = ev.clientX + 'px';
    ghost.style.top = ev.clientY + 'px';
    target = hover(ev.clientX, ev.clientY);
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!dragging) return;
    card.classList.remove('dragging');
    if (ghost) ghost.remove();
    markDropRow(null);
    stage.classList.remove('drop-target');
    if (ev.type !== 'pointercancel' && target) {
      const group = msel.has(m.id) && msel.size > 1 ? selectedMedia().filter((x) => !x.offline) : [m];
      if (group.length > 1) placeAll(group, target.track, target.time ?? undefined); else placeMedia(m, target.track, target.time ?? undefined);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

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
      class: 'media-card' + (m.offline ? ' offline' : '') + (msel.has(m.id) ? ' sel' : ''), title: m.name, dataset: { mediaId: m.id },
      onpointerdown(e) {
        if (e.button !== 0 || e.target.closest('.card-actions')) return;
        zone = 'media';
        if (e.ctrlKey || e.metaKey || e.shiftKey) { if (msel.has(m.id)) msel.delete(m.id); else msel.add(m.id); markSel(); return; }
        if (!msel.has(m.id)) { msel.clear(); msel.add(m.id); markSel(); }
        if (!m.offline) startMediaDrag(e, m, card);
      },
      ondblclick() { if (m.offline) handlers.locate(m); else addFromCard(m, 'main'); },
      oncontextmenu(e) { e.preventDefault(); showMenu(e.clientX, e.clientY, mediaMenu(m)); },
    });
    const thumb = h('div', { class: 'thumb' });
    if (m.thumb) thumb.style.backgroundImage = `url(${m.thumb})`;
    else thumb.append(icon(m.type === 'audio' ? 'music' : 'image'));
    if (m.type === 'audio' && m.wave) { thumb.style.backgroundImage = `url(${m.wave})`; thumb.style.backgroundSize = '100% 70%'; thumb.style.backgroundRepeat = 'no-repeat'; thumb.style.backgroundPosition = 'center'; }
    if (m.type !== 'image') thumb.append(h('span', { class: 'dur', text: fmtTime(m.duration, false) }));
    thumb.append(h('span', { class: 'kind' }, icon(m.type === 'video' ? 'video' : m.type === 'audio' ? 'music' : 'image')));
    if (m.proxyP != null) thumb.append(h('span', { class: 'proxy-chip', text: t('media.optimizing', { p: Math.round(m.proxyP * 100) }) }));
    const actions = h('div', { class: 'card-actions' },
      m.offline ? null : h('button', { class: 'icon-btn sm', title: t('media.add'), onclick(e) { e.stopPropagation(); addFromCard(m, 'main'); } }, icon('plus')),
      m.type !== 'audio' && !m.offline ? h('button', { class: 'icon-btn sm', title: t('media.addOverlay'), onclick(e) { e.stopPropagation(); addFromCard(m, 'overlay'); } }, icon('layers')) : null,
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

/** Every selected clip that can take a filter (a marquee/multi selection applies to all of them). */
function targetClips() {
  return selectedItems().map((s) => s.clip).filter((c) => c && c.filters);
}
function targetMedia() { return targetClips()[0] || null; }

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
    const tgt = targetClips();
    grid.append(h('button', {
      class: 'preset' + (tgt.length && tgt.every((c) => c.filters.preset === k) ? ' on' : ''),
      onclick() {
        const list = targetClips();
        if (!list.length) { handlers.toast(t('effects.select')); return; }
        for (const c of list) c.filters = { ...defaultFilters(), ...FILTER_PRESETS[k], preset: k };
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
  const picks = () => selectedItems().filter((s) => s.track === 'main' && state.main.indexOf(s.clip) > 0).map((s) => s.clip);
  const ok = picks().length > 0;
  const first = picks()[0];
  wrap.append(h('p', { class: 'hint', text: ok ? t('trans.apply') : t('trans.select') }));
  const grid = h('div', { class: 'preset-grid' });
  for (const k of TRANSITIONS) {
    grid.append(h('button', {
      class: 'preset' + (ok && first.trans.type === k ? ' on' : ''),
      onclick() {
        const list = picks();
        if (!list.length) { handlers.toast(t('trans.select')); return; }
        for (const cur of list) cur.trans.type = k;
        layout(); commit(); emit('change'); emit('inspect'); render();
      },
    }, h('div', { class: 'tr-thumb ' + k }, h('i'), h('i')), h('small', { text: t('trans.' + k) })));
  }
  wrap.append(grid);
  wrap.append(h('button', {
    class: 'btn tonal wide', text: t('trans.applyAll'),
    onclick() {
      const type = ok ? first.trans.type : 'fade';
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

/** Live progress chip while a preview proxy is being prepared (no full re-render). */
on('proxy', (m) => {
  const card = body.querySelector(`.media-card[data-media-id="${m.id}"]`);
  if (!card) return;
  const thumb = card.querySelector('.thumb');
  let chip = thumb && thumb.querySelector('.proxy-chip');
  if (m.proxyP == null) { if (chip) chip.remove(); return; }
  if (!chip && thumb) { chip = h('span', { class: 'proxy-chip' }); thumb.append(chip); }
  if (chip) chip.textContent = t('media.optimizing', { p: Math.round(m.proxyP * 100) });
});

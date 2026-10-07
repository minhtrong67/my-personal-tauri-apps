// Context menus for the timeline, the preview and clips.
import { state, select, selClip, selectedItems, splitAt, duplicateSelected, deleteSelected, findClip, getMedia } from './store.js';
import * as E from './edit.js';
import { showMenu } from './contextmenu.js';
import { seek, toggle } from './engine.js';
import { timeAtClientX } from './timeline.js';
import { $ } from './util.js';
import { t } from './i18n.js';

let api = { toast() {}, fullscreen() {}, fit() {}, addText() {}, snap() {} };
export const setMenuApi = (o) => Object.assign(api, o);

const inside = (c) => state.t > c.start + 0.05 && state.t < c.start + c.dur - 0.05;

function report(r, doneKey) {
  if (r.ok) api.toast(t(doneKey, { n: r.copies || 0 }));
  else api.toast(t('match.' + r.reason));
}

const selectItems = (track, c) => [
  { label: t('ctx.selectTrack'), icon: 'layers', kbd: 'Ctrl+A', run: () => E.selectTrackClips(track) },
  { label: t('ctx.selectAfter'), icon: 'layers', run: () => E.selectAround(track, c, 1) },
  { label: t('ctx.selectBefore'), icon: 'layers', run: () => E.selectAround(track, c, -1) },
  c.mediaId ? { label: t('ctx.selectSame'), icon: 'layers', run: () => E.selectSameMedia(c) } : null,
  { label: t('ctx.selectAll'), icon: 'layers', run: E.selectAllClips },
  selectedItems().length > 1 ? { label: t('ctx.invertSel'), icon: 'swap', run: () => E.invertTrackSelection(track) } : null,
];

export function clipMenu(track, c) {
  const hasAudio = !!E.pickAudio();
  const multi = selectedItems().length > 1;
  const items = [
    { label: t('ctx.split'), icon: 'split', kbd: 'S', run: () => { if (!splitAt()) api.toast(t('toast.splitNone')); }, disabled: !inside(c) },
    { label: t('ctx.trimLeft'), icon: 'cut', kbd: 'Q', run: () => E.trimToPlayhead('left'), disabled: !inside(c) },
    { label: t('ctx.trimRight'), icon: 'cut', kbd: 'W', run: () => E.trimToPlayhead('right'), disabled: !inside(c) },
    '-',
    { label: t('ctx.copy'), icon: 'copy', kbd: 'Ctrl+C', run: () => E.copySelected() },
    { label: t('ctx.cut'), icon: 'cut', kbd: 'Ctrl+X', run: () => E.cutSelected() },
    { label: t('ctx.paste'), icon: 'paste', kbd: 'Ctrl+V', run: () => E.pasteAtPlayhead(), disabled: !E.hasClipboard() },
    { label: t('ctx.duplicate'), icon: 'copy', kbd: 'Ctrl+D', run: duplicateSelected },
  ];
  if ('muted' in c) items.push('-', { label: t(c.muted ? 'ctx.unmute' : 'ctx.mute'), icon: c.muted ? 'vol' : 'mute', kbd: 'M', run: E.toggleMute });

  if (track === 'main' && !multi) {
    items.push('-',
      { label: t('ctx.fitClip'), icon: 'repeat', run: () => report(E.fitClipToAudio(c), 'match.done'), disabled: !hasAudio },
      state.main.length > 1 ? { label: t('ctx.fitAll'), icon: 'repeat', run: () => report(E.matchMainToAudio(), 'match.done'), disabled: !hasAudio } : null);
  }
  if (track === 'audio' && !multi) {
    items.push('-',
      { label: t('ctx.matchVideo'), icon: 'repeat', run: () => report(E.matchMainToAudio(c), 'match.done'), disabled: !state.main.length },
      { label: t('ctx.trimAudio'), icon: 'cut', run: () => report(E.trimAudioToVideo(c), 'match.trimmed'), disabled: !state.main.length });
  }
  if (track !== 'audio') items.push('-', { label: t('ctx.resetTransform'), icon: 'rotate', run: E.resetTransform });
  items.push('-', { label: t('ctx.selectMenu'), icon: 'layers', sub: selectItems(track, c) });
  items.push('-', { label: t('ctx.fit'), icon: 'fit', kbd: 'Shift+Z', run: api.fit });
  items.push('-',
    { label: t('ctx.rippleDelete'), icon: 'trash', kbd: 'Shift+Del', run: E.rippleDelete, danger: true },
    { label: t('ctx.delete'), icon: 'trash', kbd: 'Del', run: deleteSelected, danger: true });
  return items;
}

export function emptyTimelineMenu(time) {
  return [
    { label: t('ctx.paste'), icon: 'paste', kbd: 'Ctrl+V', run: () => E.pasteAtPlayhead(), disabled: !E.hasClipboard() },
    { label: t('ctx.addText'), icon: 'text', kbd: 'T', run: () => api.addText(time) },
    '-',
    { label: t('ctx.selectAll'), icon: 'layers', kbd: 'Ctrl+A', run: E.selectAllClips },
    '-',
    { label: t('ctx.fit'), icon: 'fit', kbd: 'Shift+Z', run: api.fit },
    { label: t('ctx.snap'), icon: 'magnet', kbd: 'N', checked: state.snap, run: api.snap },
  ];
}

export function previewMenu() {
  const c = selClip();
  const items = [
    { label: t(state.playing ? 'ctx.pause' : 'ctx.play'), icon: state.playing ? 'pause' : 'play', kbd: 'Space', run: toggle },
    { label: t('ctx.fullscreen'), icon: 'fullscreen', kbd: 'F', run: api.fullscreen },
  ];
  if (c) {
    const tr = state.sel.track;
    items.push('-',
      { label: t('ctx.copy'), icon: 'copy', kbd: 'Ctrl+C', run: () => E.copySelected() },
      { label: t('ctx.duplicate'), icon: 'copy', kbd: 'Ctrl+D', run: duplicateSelected },
      { label: t('ctx.resetTransform'), icon: 'rotate', run: E.resetTransform },
      '-',
      { label: t('ctx.split'), icon: 'split', kbd: 'S', run: () => { if (!splitAt()) api.toast(t('toast.splitNone')); }, disabled: !inside(c) },
      { label: t('ctx.delete'), icon: 'trash', kbd: 'Del', danger: true, run: deleteSelected });
    void tr;
  } else {
    items.push('-', { label: t('ctx.paste'), icon: 'paste', kbd: 'Ctrl+V', run: () => E.pasteAtPlayhead(), disabled: !E.hasClipboard() });
  }
  return items;
}

/* timeline right-click */
$('#tl-content').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const ce = e.target.closest('.clip');
  if (ce) {
    const { track, id } = ce.dataset;
    const c = findClip(track, id);
    if (!c) return;
    if (!state.multi.some((m) => m.id === id)) select(track, id);
    showMenu(e.clientX, e.clientY, clipMenu(track, c));
    return;
  }
  if (e.target.closest('.tl-ruler')) return;
  const time = Math.max(0, timeAtClientX(e.clientX));
  if (!(e.ctrlKey || e.shiftKey)) select(null, null);
  seek(time);
  showMenu(e.clientX, e.clientY, emptyTimelineMenu(time));
});

export { getMedia };

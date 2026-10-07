// Material Edit — application wiring.
import { applyTheme, watchSystemTheme, SWATCHES } from './theme.js';
import { setLanguage, applyI18n, t } from './i18n.js';
import { settings, saveSettings, DEFAULTS } from './settings.js';
import {
  state, on, emit, undo, redo, canUndo, canRedo, splitAt, deleteSelected, duplicateSelected, select, commit, layout,
  totalDuration, toProject, loadProject, resetProject, dims, markDirty, isEmpty, findClip, addClip, makeText,
} from './store.js';
import * as engine from './engine.js';
import * as E from './edit.js';
import { importFiles, importPaths, relinkPath, restoreMedia, kindOf, kindOfName, releaseAllMedia, removeMedia } from './media.js';
import { placeMedia, build as buildTimeline } from './timeline.js';
import { setPanelHandlers } from './panels.js';
import './inspector.js';
import { applyLayout, resetLayout } from './layout.js';
import { showMenu, closeMenu } from './contextmenu.js';
import { setMenuApi, previewMenu } from './menus.js';
import { initShortcuts, renderShortcutsDialog } from './shortcuts.js';
import { initHome, showHome, hideHome, isHomeOpen, renderHome, refreshHome } from './home.js';
import {
  inTauri, pickSavePath, pickOpenPath, pickMediaPaths, readText, writeText, currentWindow, onFileDrop,
  libRead, libWrite, setWindowFullscreen, isWindowFullscreen,
} from './io.js';
import { openExport, setExportToast } from './exporter.js';
import { $, $$, fmtTime, baseName, stripExt, clamp, uid, h } from './util.js';

/* ------------------------------------------------------------------ */
/*  Motion helpers                                                    */
/* ------------------------------------------------------------------ */
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const nativeDialogClose = HTMLDialogElement.prototype.close;
HTMLDialogElement.prototype.close = function (rv) {
  if (!this.open || reduceMotion) return nativeDialogClose.call(this, rv);
  if (this.classList.contains('closing')) return undefined;
  this.classList.add('closing');
  setTimeout(() => {
    this.classList.remove('closing');
    if (this.open) nativeDialogClose.call(this, rv);
  }, 170);
  return undefined;
};

document.addEventListener('pointerdown', (e) => {
  if (reduceMotion || e.button !== 0) return;
  const host = e.target.closest('.icon-btn, .btn, .chip-btn, .menu-item, .segmented button, .rail button, .preset');
  if (!host || host.disabled) return;
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.appendChild(dot);
  dot.addEventListener('animationend', () => dot.remove(), { once: true });
});

/* ------------------------------------------------------------------ */
/*  Toast, confirm, prompt                                            */
/* ------------------------------------------------------------------ */
let toastTimer;
export function toast(msg, ms = 3400) {
  const s = $('#snackbar');
  s.textContent = msg;
  s.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => s.classList.remove('show'), ms);
}
setExportToast(toast);

function askConfirm({ title, msg, yes, no, cancel = true }) {
  return new Promise((resolve) => {
    const dlg = $('#dlg-confirm');
    $('#cf-title').textContent = title;
    $('#cf-msg').textContent = msg;
    const bYes = $('#cf-yes'), bNo = $('#cf-no'), bCancel = $('#cf-cancel');
    bYes.textContent = yes; bNo.textContent = no; bCancel.hidden = !cancel;
    const fin = (v) => { bYes.onclick = bNo.onclick = bCancel.onclick = dlg.oncancel = null; if (dlg.open) dlg.close(); resolve(v); };
    bYes.onclick = () => fin('yes');
    bNo.onclick = () => fin('no');
    bCancel.onclick = () => fin('cancel');
    dlg.oncancel = (e) => { e.preventDefault(); fin('cancel'); };
    dlg.showModal();
  });
}

function askPrompt({ title, value = '', ok }) {
  return new Promise((resolve) => {
    const dlg = $('#dlg-prompt');
    const input = $('#pr-input');
    $('#pr-title').textContent = title;
    $('#pr-ok').textContent = ok || t('btn.ok');
    input.value = value;
    const fin = (v) => { $('#pr-ok').onclick = $('#pr-cancel').onclick = dlg.oncancel = input.onkeydown = null; if (dlg.open) dlg.close(); resolve(v); };
    $('#pr-ok').onclick = () => fin(input.value);
    $('#pr-cancel').onclick = () => fin(null);
    dlg.oncancel = (e) => { e.preventDefault(); fin(null); };
    input.onkeydown = (e) => { if (e.key === 'Enter') fin(input.value); };
    dlg.showModal();
    input.focus();
    input.select();
  });
}

$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog.dialog').forEach((d) => d.addEventListener('mousedown', (e) => {
  if (e.target !== d || ['dlg-confirm', 'dlg-export', 'dlg-prompt'].includes(d.id)) return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));

/* ------------------------------------------------------------------ */
/*  Theme, language, settings dialog                                  */
/* ------------------------------------------------------------------ */
const THEME_ICON = { light: '#i-sun', dark: '#i-moon', system: '#i-auto' };
let themeFirst = true;
function refreshTheme() {
  const root = document.documentElement;
  if (!themeFirst && !reduceMotion) {
    root.classList.add('theming');
    clearTimeout(refreshTheme.t);
    refreshTheme.t = setTimeout(() => root.classList.remove('theming'), 450);
  }
  themeFirst = false;
  applyTheme(settings.theme, settings.seed);
  $('#theme-use').setAttribute('href', THEME_ICON[settings.theme]);
  $('#home-theme-use').setAttribute('href', THEME_ICON[settings.theme]);
  $$('#seg-theme button').forEach((b) => b.classList.toggle('on', b.dataset.mode === settings.theme));
  $$('#swatches .swatch').forEach((b) => b.classList.toggle('on', b.dataset.hex.toLowerCase() === settings.seed.toLowerCase()));
  $('#inp-seed').value = settings.seed.toLowerCase();
  $('#seed-hex').textContent = settings.seed.toUpperCase();
}
$('#swatches').innerHTML = SWATCHES.map((s) => `<button class="swatch" data-hex="${s.hex}" style="--c:${s.hex}" title="${s.name}" aria-label="${s.name}"><svg class="i"><use href="#i-check"/></svg></button>`).join('');
$('#swatches').addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (!b) return; settings.seed = b.dataset.hex; saveSettings(); refreshTheme(); });
$('#inp-seed').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); refreshTheme(); });
$('#seg-theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings.theme = b.dataset.mode; saveSettings(); refreshTheme(); });
const cycleTheme = () => { settings.theme = { light: 'dark', dark: 'system', system: 'light' }[settings.theme] || 'light'; saveSettings(); refreshTheme(); };
$('#btn-theme').addEventListener('click', cycleTheme);
$('#home-theme').addEventListener('click', cycleTheme);
watchSystemTheme(() => { if (settings.theme === 'system') refreshTheme(); });

function refreshLanguage() {
  setLanguage(settings.lang);
  applyI18n();
  $('#sel-lang').value = settings.lang;
  renderShortcutsDialog();
  updateChrome();
  renderHome();
  emit('lang');
}
$('#sel-lang').addEventListener('change', (e) => { settings.lang = e.target.value; saveSettings(); refreshLanguage(); });
const openSettings = () => $('#dlg-settings').showModal();
$('#btn-settings').addEventListener('click', openSettings);
$('#home-settings').addEventListener('click', openSettings);

$('#sel-start').value = settings.start;
$('#sel-start').addEventListener('change', (e) => { settings.start = e.target.value; saveSettings(); });
$('#btn-reset-layout').addEventListener('click', () => { resetLayout(); toast(t('settings.resetDone')); });
$('#btn-reset-export').addEventListener('click', () => { settings.export = { ...DEFAULTS.export }; saveSettings(); toast(t('settings.resetDone')); });

/* ------------------------------------------------------------------ */
/*  Title, save status, transport UI                                  */
/* ------------------------------------------------------------------ */
const nameInput = $('#proj-name');
const projName = () => nameInput.value.trim() || t('project.untitled');
nameInput.addEventListener('input', () => { state.name = nameInput.value; markDirty(true); scheduleAutosave(); updateChrome(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

const blankProject = () => isEmpty() && !state.media.length && !state.name;

function setSaveStatus(kind) {
  const el = $('#save-status');
  el.className = 'save-status' + (kind === 'dirty' ? ' busy' : kind === 'saved' ? ' ok' : '');
  if (kind === 'none') { el.replaceChildren(); return; }
  el.replaceChildren(h('svg', { class: 'i' }), h('span', { text: t(kind === 'dirty' ? 'save.pending' : 'save.saved') }));
  el.firstChild.innerHTML = `<use href="#i-${kind === 'dirty' ? 'save' : 'cloud-check'}"/>`;
}

function updateChrome() {
  const title = `${state.dirty ? '• ' : ''}${projName()} — Material Edit`;
  document.title = title;
  $('#dirty-dot').hidden = true;
  const w = currentWindow();
  if (w) { try { w.setTitle(title).catch(() => {}); } catch { /* ignore */ } }
  $('#btn-undo').disabled = !canUndo();
  $('#btn-redo').disabled = !canRedo();
  $('#empty-hint').hidden = !isEmpty();
  $('#time-tot').textContent = fmtTime(totalDuration());
  $('#tl-snap').classList.toggle('active', state.snap);
  if (nameInput.value !== state.name && document.activeElement !== nameInput) nameInput.value = state.name;
  setSaveStatus(blankProject() ? 'none' : state.dirty ? 'dirty' : 'saved');
}

/* ---- project library: autosave ---- */
let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { if (state.dirty) saveToLibrary(true); }, 1500);
}

/** Small JPEG of the preview for the project card. Keeps the previous cover when the frame is black. */
function makeCover() {
  try {
    if (!cv.width) return state.cover || null;
    const w = 360, hh = Math.max(2, Math.round((w * cv.height) / cv.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(cv, 0, 0, w, hh);
    const px = g.getImageData(0, 0, w, hh).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 64) sum += px[i] + px[i + 1] + px[i + 2];
    const blank = sum / (px.length / 64) < 6;
    if (blank && state.cover) return state.cover;
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return state.cover || null; }
}

let saving = null;
export async function saveToLibrary(silent = false) {
  if (blankProject()) return true;
  if (saving) await saving.catch(() => {});
  clearTimeout(autosaveTimer);
  const job = (async () => {
    const cover = engine.isExporting() ? state.cover : makeCover();
    state.cover = cover;
    await libWrite(state.id, JSON.stringify(toProject({ cover })));
  })();
  saving = job;
  try {
    await job;
    markDirty(false);
    updateChrome();
    if (!silent) toast(t('toast.savedLib'));
    return true;
  } catch (err) {
    toast(t('toast.error', { msg: err.message || err }), 6000);
    return false;
  } finally { saving = null; }
}

on('dirty', updateChrome);
on('history', () => { updateChrome(); scheduleAutosave(); });
on('change', (kind) => { updateChrome(); if (kind !== 'live') { fitStage(); if (state.dirty) scheduleAutosave(); } });
on('reset', () => { nameInput.value = state.name; updateChrome(); fitStage(); });
const seekEl = $('#tp-seek');
let seekDrag = false;
const syncTime = () => {
  $('#time-cur').textContent = fmtTime(state.t);
  const d = totalDuration();
  if (!seekDrag) seekEl.value = d > 0 ? Math.round((state.t / d) * 1000) : 0;
};
on('time', syncTime);
on('seek', syncTime);
on('play', () => $('#play-use').setAttribute('href', '#i-pause'));
on('pause', () => $('#play-use').setAttribute('href', '#i-play'));
seekEl.addEventListener('pointerdown', () => { seekDrag = true; });
seekEl.addEventListener('input', () => engine.seek((+seekEl.value / 1000) * totalDuration()));
window.addEventListener('pointerup', () => { seekDrag = false; });

$('#tp-play').addEventListener('click', engine.toggle);
$('#tp-first').addEventListener('click', () => engine.seek(0));
$('#tp-last').addEventListener('click', () => engine.seek(totalDuration()));
$('#tp-back').addEventListener('click', () => engine.seek(state.t - 1 / state.fps));
$('#tp-fwd').addEventListener('click', () => engine.seek(state.t + 1 / state.fps));
const vol = $('#tp-vol');
vol.value = settings.vol;
engine.setPreviewVolume(settings.vol);
const syncMuteIcon = () => $('#mute-use').setAttribute('href', settings.vol === 0 ? '#i-mute' : '#i-vol');
syncMuteIcon();
vol.addEventListener('input', () => { settings.vol = +vol.value; engine.setPreviewVolume(settings.vol); syncMuteIcon(); saveSettings(); });
$('#tp-mute').addEventListener('click', () => { vol.value = settings.vol > 0 ? 0 : 1; vol.dispatchEvent(new Event('input')); });

$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#tl-split').addEventListener('click', () => { if (!splitAt()) toast(t('toast.splitNone')); });
$('#tl-dup').addEventListener('click', duplicateSelected);
$('#tl-del').addEventListener('click', deleteSelected);
const toggleSnap = () => { state.snap = !state.snap; updateChrome(); };
$('#tl-snap').addEventListener('click', toggleSnap);

/* ------------------------------------------------------------------ */
/*  Preview stage: sizing, full screen, direct manipulation           */
/* ------------------------------------------------------------------ */
const cv = $('#cv'), ov = $('#cv-ov'), stage = $('#stage'), wrap = $('#canvas-wrap'), center = $('#center');
engine.attach(cv, ov);
let fsOn = false;

function fitStage() {
  const [aw, ah] = dims(1000);
  const pad = fsOn ? 0 : 20;
  const bw = stage.clientWidth - pad * 2, bh = stage.clientHeight - pad * 2;
  if (bw < 40 || bh < 40) return;
  const s = Math.min(bw / aw, bh / ah);
  const w = Math.floor(aw * s), hh = Math.floor(ah * s);
  wrap.style.width = w + 'px'; wrap.style.height = hh + 'px';
  engine.resizePreview(w, hh, fsOn ? 2560 : 1600);
}
new ResizeObserver(fitStage).observe(stage);

/* ---- full-screen preview ---- */
let fsWasWindowFs = false;
let idleTimer;
function wake() {
  center.classList.remove('idle');
  clearTimeout(idleTimer);
  if (fsOn) idleTimer = setTimeout(() => center.classList.add('idle'), 2600);
}
function fsUi(on) {
  fsOn = on;
  center.classList.toggle('fs', on);
  document.body.classList.toggle('is-fs', on);
  $('#full-use').setAttribute('href', on ? '#i-shrink' : '#i-fullscreen');
  $('#tp-full').title = t(on ? 'tip.exitFullscreen' : 'tip.fullscreen');
  wake();
  fitStage();
  requestAnimationFrame(fitStage);
}
async function setFullscreen(on) {
  if (on === fsOn || (on && (isHomeOpen() || engine.isExporting()))) return;
  if (on) {
    fsWasWindowFs = await isWindowFullscreen();
    fsUi(true);
    if (!fsWasWindowFs) await setWindowFullscreen(true);
  } else {
    fsUi(false);
    if (!fsWasWindowFs) await setWindowFullscreen(false);
  }
}
const toggleFullscreen = () => setFullscreen(!fsOn);
$('#tp-full').addEventListener('click', toggleFullscreen);
center.addEventListener('pointermove', () => { if (fsOn) wake(); });
center.addEventListener('pointerdown', () => { if (fsOn) wake(); });
document.addEventListener('fullscreenchange', () => { if (!inTauri && fsOn && !document.fullscreenElement) fsUi(false); });

function canvasPoint(e) {
  const r = ov.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * ov.width) / r.width, y: ((e.clientY - r.top) * ov.height) / r.height };
}
function insideHit(hb, p) {
  const a = (-hb.rot * Math.PI) / 180;
  const dx = p.x - hb.cx, dy = p.y - hb.cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= hb.w / 2 && Math.abs(ly) <= hb.h / 2;
}
function onHandle(hb, p) {
  const a = (hb.rot * Math.PI) / 180;
  const hx = hb.cx + (hb.w / 2) * Math.cos(a) - (hb.h / 2) * Math.sin(a);
  const hy = hb.cy + (hb.w / 2) * Math.sin(a) + (hb.h / 2) * Math.cos(a);
  return Math.hypot(p.x - hx, p.y - hy) < 16 * (ov.width / 900 + 0.5);
}

ov.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const p0 = canvasPoint(e);
  const selHit = state.sel ? engine.hits.find((x) => x.id === state.sel.id) : null;
  let mode = null, clip = null, track = null;
  if (selHit && onHandle(selHit, p0)) { mode = 'scale'; clip = findClip(state.sel.track, state.sel.id); track = state.sel.track; }
  else {
    const hit = engine.hits.find((x) => insideHit(x, p0));
    if (!hit) { select(null, null); return; }
    select(hit.track, hit.id);
    clip = findClip(hit.track, hit.id); track = hit.track; mode = 'move';
  }
  if (!clip) return;
  ov.setPointerCapture(e.pointerId);
  const start = { x: clip.x, y: clip.y, scale: clip.scale, size: clip.size };
  const sh = engine.hits.find((x) => x.id === clip.id);
  const d0 = sh ? Math.hypot(p0.x - sh.cx, p0.y - sh.cy) : 1;
  let moved = false;
  const move = (ev) => {
    const p = canvasPoint(ev);
    moved = true;
    if (mode === 'move') {
      const dx = (p.x - p0.x) / ov.width, dy = (p.y - p0.y) / ov.height;
      let nx = start.x + dx, ny = start.y + dy;
      const cx = track === 'text' ? 0.5 : 0;
      if (Math.abs(nx - cx) < 0.012) nx = cx;
      if (Math.abs(ny - cx) < 0.012) ny = cx;
      clip.x = nx; clip.y = ny;
    } else if (sh) {
      const ratio = Math.max(0.05, Math.hypot(p.x - sh.cx, p.y - sh.cy) / Math.max(d0, 1));
      if (track === 'text') clip.size = clamp(Math.round(start.size * ratio), 8, 600);
      else clip.scale = clamp(start.scale * ratio, 0.05, 8);
    }
    emit('change', 'live');
  };
  const up = () => {
    ov.removeEventListener('pointermove', move);
    ov.removeEventListener('pointerup', up);
    if (moved) { commit(); emit('inspect'); }
  };
  ov.addEventListener('pointermove', move);
  ov.addEventListener('pointerup', up);
});
ov.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const p = canvasPoint(e);
  const selHit = state.sel ? engine.hits.find((x) => x.id === state.sel.id) : null;
  ov.style.cursor = selHit && onHandle(selHit, p) ? 'nwse-resize' : engine.hits.some((x) => insideHit(x, p)) ? 'move' : 'default';
});
ov.addEventListener('dblclick', (e) => {
  const p = canvasPoint(e);
  if (!engine.hits.some((x) => insideHit(x, p))) toggleFullscreen();
});
// right-click on the preview (also while in full screen, where the overlay canvas is hidden)
stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!fsOn) {
    const p = canvasPoint(e);
    const hit = engine.hits.find((x) => insideHit(x, p));
    if (hit) select(hit.track, hit.id);
  }
  showMenu(e.clientX, e.clientY, previewMenu());
});
stage.addEventListener('dblclick', (e) => { if (fsOn && e.target.closest('#stage')) toggleFullscreen(); });

/* ------------------------------------------------------------------ */
/*  Import (native picker / drag & drop)                              */
/* ------------------------------------------------------------------ */
async function afterImport({ added, failed }, addToTimeline) {
  if (failed.length) toast(t('toast.importFailed', { names: failed.slice(0, 3).join(', ') }), 6000);
  else toast(t('toast.imported', { n: added.length }));
  if (addToTimeline && added.length === 1 && !added[0].offline) placeMedia(added[0], 'main');
  emit('change');
}
async function doImport(files, addToTimeline = false) {
  if (!files.length) return;
  toast(t('toast.importing', { n: files.length }), 8000);
  afterImport(await importFiles(files), addToTimeline);
}
async function doImportPaths(paths, addToTimeline = false) {
  if (!paths.length) return;
  toast(t('toast.importing', { n: paths.length }), 8000);
  afterImport(await importPaths(paths), addToTimeline);
}
async function importPicker() {
  if (isHomeOpen()) await newProject();
  if (inTauri) {
    try { const paths = await pickMediaPaths(); if (paths.length) doImportPaths(paths); } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
  } else $('#file-import').click();
}
async function locateMedia(m) {
  if (!inTauri) { $('#file-import').click(); toast(t('media.locateHint', { name: m.name }), 6000); return; }
  try {
    const [p] = await pickMediaPaths(true);
    if (p) { await relinkPath(m.id, p); toast(t('media.relinked', { name: m.name })); }
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}
setPanelHandlers({ toast, importFiles: importPicker, locate: locateMedia });
$('#file-import').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; doImport(f); });

const dropOverlay = $('#drop-overlay');
const showDrop = (v) => { dropOverlay.hidden = !v; };
const isProjectName = (n) => /\.(medit|mvep)$/i.test(n);

// browser drag & drop
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files') && !isHomeOpen()) { dragDepth++; showDrop(true); } });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showDrop(false); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  dragDepth = 0; showDrop(false);
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const all = [...e.dataTransfer.files];
  const proj = all.find((f) => isProjectName(f.name));
  if (proj) { openProjectFile(proj); return; }
  if (isHomeOpen()) return;
  doImport(all.filter((f) => kindOf(f)));
});
// native drops (desktop)
onFileDrop({
  over: () => { if (!isHomeOpen()) showDrop(true); },
  leave: () => showDrop(false),
  drop: (paths) => {
    const proj = paths.find(isProjectName);
    if (proj) { openProjectPath(proj); return; }
    if (isHomeOpen()) return;
    doImportPaths(paths.filter((p) => kindOfName(baseName(p))));
  },
});

/* ------------------------------------------------------------------ */
/*  Projects: library, files                                          */
/* ------------------------------------------------------------------ */
const projFilters = () => [{ name: 'Material Edit', extensions: ['medit', 'mvep'] }];

function freshProject() {
  engine.pause();
  engine.resetEngine();
  releaseAllMedia();
  resetProject();
  state.cover = null;
  nameInput.value = '';
}

async function newProject() {
  await saveToLibrary(true);
  if (fsOn) await setFullscreen(false);
  freshProject();
  hideHome();
  updateChrome();
  fitStage();
}

async function afterLoad() {
  nameInput.value = state.name;
  engine.seek(0);
  updateChrome();
  await restoreMedia();
  const off = state.media.filter((m) => m.offline).length;
  if (off) toast(t('toast.openedOffline', { n: off }), 7000);
  updateChrome();
  fitStage();
}

async function openFromLibrary(id) {
  try {
    const data = JSON.parse(await libRead(id));
    freshProject();
    loadProject(data);
    state.cover = data.cover || null;
    hideHome();
    await afterLoad();
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}

/** Adds a project file from disk to the library (as a new project) and opens it. */
async function importProjectData(text, fallbackName) {
  const data = JSON.parse(text);
  if (!data || !['material-edit', 'material-video-editor'].includes(data.app)) throw new Error(t('toast.notProject'));
  data.id = uid();
  if (!data.name) data.name = fallbackName;
  data.updated = Date.now();
  await libWrite(data.id, JSON.stringify(data));
  await openFromLibrary(data.id);
}
async function openProjectPath(path) {
  try { await saveToLibrary(true); await importProjectData(await readText(path), stripExt(baseName(path))); } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}
async function openProjectFile(file) {
  try { await saveToLibrary(true); await importProjectData(await file.text(), stripExt(file.name)); } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}
async function openFilePicker() {
  if (inTauri) {
    try { const p = await pickOpenPath(projFilters()); if (p) await openProjectPath(p); } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
  } else { const inp = $('#file-project'); inp.value = ''; inp.click(); }
}
$('#file-project').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openProjectFile(f); });

/** Writes a standalone copy of the project to a file the user chooses. */
async function saveCopy() {
  try {
    const path = await pickSavePath(`${projName()}.medit`, projFilters());
    if (!path) return false;
    const full = /\.(medit|mvep)$/i.test(path) ? path : path + '.medit';
    await writeText(full, JSON.stringify(toProject({ cover: state.cover })));
    toast(t('toast.copySaved', { name: baseName(full) }));
    return true;
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); return false; }
}

async function goHome() {
  if (isHomeOpen()) return;
  if (engine.isExporting()) { toast(t('export.busy')); return; }
  if (fsOn) await setFullscreen(false);
  engine.pause();
  await saveToLibrary(true);
  closeMenu();
  await showHome();
}

async function exitApp() {
  if (engine.isExporting()) {
    const r = await askConfirm({ title: t('export.quitTitle'), msg: t('export.quitMsg'), yes: t('export.quitYes'), no: t('btn.cancel'), cancel: false });
    if (r !== 'yes') return;
  }
  await saveToLibrary(true);
  const w = currentWindow();
  if (w) await w.destroy(); else window.close();
}

initHome({
  open: openFromLibrary, create: newProject, openFile: openFilePicker,
  prompt: askPrompt, confirm: askConfirm, toast,
});
$('#btn-home').addEventListener('click', goHome);

/* ---- file menu ---- */
const fileMenu = $('#file-menu');
const toggleMenu = (show = fileMenu.hidden) => { fileMenu.hidden = !show; };
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
document.addEventListener('mousedown', (e) => { if (!fileMenu.hidden && !fileMenu.contains(e.target) && !e.target.closest('#btn-menu')) toggleMenu(false); });
const openShortcuts = () => { renderShortcutsDialog(); const d = $('#dlg-shortcuts'); if (!d.open) d.showModal(); else d.close(); };
fileMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-act]');
  if (!item) return;
  toggleMenu(false);
  ({
    new: newProject, home: goHome, open: openFilePicker, save: () => saveToLibrary(false), saveas: saveCopy,
    import: importPicker, export: openExport, shortcuts: openShortcuts, exit: exitApp,
  })[item.dataset.act]();
});
$('#btn-export').addEventListener('click', openExport);
$('#btn-shortcuts').addEventListener('click', openShortcuts);
$('#home-shortcuts').addEventListener('click', openShortcuts);

/* ------------------------------------------------------------------ */
/*  Commands & shortcuts                                              */
/* ------------------------------------------------------------------ */
const addTextAt = (time) => {
  const c = makeText('basic', time ?? state.t);
  c.text = t('textpreset.basic.sample');
  addClip('text', c);
};
const msg = (r, key) => { if (r.ok) toast(t(key, { n: r.copies || 0 })); else toast(t('match.' + r.reason)); };
setMenuApi({
  toast, fullscreen: toggleFullscreen, fit: () => $('#tl-fit').click(), addText: addTextAt, snap: toggleSnap,
});

const COMMANDS = {
  play: engine.toggle,
  stepBack: () => engine.seek(state.t - 1 / state.fps),
  stepFwd: () => engine.seek(state.t + 1 / state.fps),
  back1s: () => engine.seek(state.t - 1),
  fwd1s: () => engine.seek(state.t + 1),
  prevEdit: () => engine.seek(E.nextEdit(-1)),
  nextEdit: () => engine.seek(E.nextEdit(1)),
  toStart: () => engine.seek(0),
  toEnd: () => engine.seek(totalDuration()),
  fullscreen: toggleFullscreen,
  escape: () => { if (fsOn) setFullscreen(false); else if (!fileMenu.hidden) toggleMenu(false); },
  split: () => { if (!splitAt()) toast(t('toast.splitNone')); },
  trimLeft: () => { if (!E.trimToPlayhead('left')) toast(t('toast.splitNone')); },
  trimRight: () => { if (!E.trimToPlayhead('right')) toast(t('toast.splitNone')); },
  delete: deleteSelected,
  rippleDelete: E.rippleDelete,
  duplicate: duplicateSelected,
  copy: E.copySelected,
  cut: E.cutSelected,
  paste: E.pasteAtPlayhead,
  mute: E.toggleMute,
  addText: () => addTextAt(),
  undo, redo,
  snap: toggleSnap,
  zoomIn: () => $('#tl-zin').click(),
  zoomOut: () => $('#tl-zout').click(),
  fit: () => $('#tl-fit').click(),
  new: newProject, home: goHome, openFile: openFilePicker, save: () => saveToLibrary(false), saveAs: saveCopy,
  import: importPicker, export: openExport, shortcuts: openShortcuts, settings: openSettings,
};
initShortcuts(COMMANDS, { blocked: () => engine.isExporting(), onHome: isHomeOpen });
void msg;

/* ------------------------------------------------------------------ */
/*  Start-up                                                          */
/* ------------------------------------------------------------------ */
refreshLanguage();
refreshTheme();
applyLayout();
fitStage();
engine.start();
layout();
updateChrome();

async function boot() {
  const w = currentWindow();
  if (w) {
    if (settings.start === 'maximized') { try { await w.maximize(); } catch { /* ignore */ } }
    else if (settings.start === 'fullscreen') { try { await w.setFullscreen(true); } catch { /* ignore */ } }
    w.onCloseRequested(async (ev) => {
      ev.preventDefault();
      await exitApp();
    });
  }
  window.addEventListener('beforeunload', () => { if (state.dirty && !blankProject()) { try { libWrite(state.id, JSON.stringify(toProject({ cover: state.cover }))); } catch { /* ignore */ } } });
  window.addEventListener('blur', () => { if (state.dirty) saveToLibrary(true); });
  await showHome();
}
boot();

window.__mve = { state, engine, edit: E, placeMedia, doImport, removeMedia, buildTimeline, saveToLibrary, goHome, openFromLibrary, newProject, refreshHome, settings };

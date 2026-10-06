// Material Video Editor — application wiring.
import { applyTheme, watchSystemTheme, SWATCHES } from './theme.js';
import { setLanguage, applyI18n, t } from './i18n.js';
import {
  state, on, emit, undo, redo, canUndo, canRedo, splitAt, deleteSelected, duplicateSelected, select, commit, layout,
  totalDuration, toProject, loadProject, resetProject, dims, markDirty, isEmpty, findClip,
} from './store.js';
import * as engine from './engine.js';
import { importFiles, kindOf, releaseAllMedia, removeMedia } from './media.js';
import { placeMedia, build as buildTimeline } from './timeline.js';
import { setPanelHandlers } from './panels.js';
import './inspector.js';
import { inTauri, pickSavePath, pickOpenPath, readText, writeText, currentWindow } from './io.js';
import { openExport, setExportToast } from './exporter.js';
import { $, $$, fmtTime, baseName, stripExt, clamp } from './util.js';

const SETTINGS_KEY = 'mve.settings.v1';
const DRAFT_KEY = 'mve.draft.v1';
const DEFAULTS = { theme: 'system', seed: '#6750A4', lang: 'auto', vol: 1 };
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

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
/*  Toast & confirm                                                   */
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
setPanelHandlers({ toast, importFiles: () => $('#file-import').click() });

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

$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog.dialog').forEach((d) => d.addEventListener('mousedown', (e) => {
  if (e.target !== d || d.id === 'dlg-confirm' || d.id === 'dlg-export') return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));

/* ------------------------------------------------------------------ */
/*  Theme & language                                                  */
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
  $$('#seg-theme button').forEach((b) => b.classList.toggle('on', b.dataset.mode === settings.theme));
  $$('#swatches .swatch').forEach((b) => b.classList.toggle('on', b.dataset.hex.toLowerCase() === settings.seed.toLowerCase()));
  $('#inp-seed').value = settings.seed.toLowerCase();
  $('#seed-hex').textContent = settings.seed.toUpperCase();
}
$('#swatches').innerHTML = SWATCHES.map((s) => `<button class="swatch" data-hex="${s.hex}" style="--c:${s.hex}" title="${s.name}" aria-label="${s.name}"><svg class="i"><use href="#i-check"/></svg></button>`).join('');
$('#swatches').addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (!b) return; settings.seed = b.dataset.hex; saveSettings(); refreshTheme(); });
$('#inp-seed').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); refreshTheme(); });
$('#seg-theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings.theme = b.dataset.mode; saveSettings(); refreshTheme(); });
$('#btn-theme').addEventListener('click', () => { settings.theme = { light: 'dark', dark: 'system', system: 'light' }[settings.theme] || 'light'; saveSettings(); refreshTheme(); });
watchSystemTheme(() => { if (settings.theme === 'system') refreshTheme(); });

function refreshLanguage() {
  setLanguage(settings.lang);
  applyI18n();
  $('#sel-lang').value = settings.lang;
  updateChrome();
  emit('lang');
}
$('#sel-lang').addEventListener('change', (e) => { settings.lang = e.target.value; saveSettings(); refreshLanguage(); });
$('#btn-settings').addEventListener('click', () => $('#dlg-settings').showModal());

/* ------------------------------------------------------------------ */
/*  Title, dirty state, transport UI                                  */
/* ------------------------------------------------------------------ */
const nameInput = $('#proj-name');
const projName = () => nameInput.value.trim() || t('project.untitled');
nameInput.addEventListener('input', () => { state.name = nameInput.value; markDirty(true); updateChrome(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

function updateChrome() {
  const title = `${state.dirty ? '• ' : ''}${projName()} — Material Video Editor`;
  document.title = title;
  $('#dirty-dot').hidden = !state.dirty;
  const w = currentWindow();
  if (w) { try { w.setTitle(title).catch(() => {}); } catch { /* ignore */ } }
  $('#btn-undo').disabled = !canUndo();
  $('#btn-redo').disabled = !canRedo();
  $('#empty-hint').hidden = !isEmpty();
  $('#time-tot').textContent = fmtTime(totalDuration());
  $('#tl-snap').classList.toggle('active', state.snap);
  if (nameInput.value !== state.name && document.activeElement !== nameInput) nameInput.value = state.name;
}

let draftTimer;
function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(toProject())); } catch { /* ignore */ }
  }, 1500);
}
const clearDraft = () => { clearTimeout(draftTimer); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

on('dirty', updateChrome);
on('history', updateChrome);
on('change', (kind) => { updateChrome(); if (kind !== 'live') fitStage(); if (state.dirty) scheduleDraft(); });
on('reset', () => { nameInput.value = state.name; updateChrome(); fitStage(); });
on('time', () => { $('#time-cur').textContent = fmtTime(state.t); });
on('seek', () => { $('#time-cur').textContent = fmtTime(state.t); });
on('play', () => $('#play-use').setAttribute('href', '#i-pause'));
on('pause', () => $('#play-use').setAttribute('href', '#i-play'));

$('#tp-play').addEventListener('click', engine.toggle);
$('#tp-first').addEventListener('click', () => engine.seek(0));
$('#tp-last').addEventListener('click', () => engine.seek(totalDuration()));
$('#tp-back').addEventListener('click', () => engine.seek(state.t - 1 / state.fps));
$('#tp-fwd').addEventListener('click', () => engine.seek(state.t + 1 / state.fps));
const vol = $('#tp-vol');
vol.value = settings.vol;
engine.setPreviewVolume(settings.vol);
vol.addEventListener('input', () => { settings.vol = +vol.value; engine.setPreviewVolume(settings.vol); $('#mute-use').setAttribute('href', settings.vol === 0 ? '#i-mute' : '#i-vol'); saveSettings(); });
$('#tp-mute').addEventListener('click', () => { vol.value = settings.vol > 0 ? 0 : 1; vol.dispatchEvent(new Event('input')); });

$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#tl-split').addEventListener('click', () => { if (!splitAt()) toast(t('toast.splitNone')); });
$('#tl-dup').addEventListener('click', duplicateSelected);
$('#tl-del').addEventListener('click', deleteSelected);
$('#tl-snap').addEventListener('click', () => { state.snap = !state.snap; updateChrome(); });

/* ------------------------------------------------------------------ */
/*  Preview stage: sizing + direct manipulation                       */
/* ------------------------------------------------------------------ */
const cv = $('#cv'), ov = $('#cv-ov'), stage = $('#stage'), wrap = $('#canvas-wrap');
engine.attach(cv, ov);

function fitStage() {
  const [aw, ah] = dims(1000);
  const pad = 20;
  const bw = stage.clientWidth - pad * 2, bh = stage.clientHeight - pad * 2;
  if (bw < 40 || bh < 40) return;
  const s = Math.min(bw / aw, bh / ah);
  const w = Math.floor(aw * s), hh = Math.floor(ah * s);
  wrap.style.width = w + 'px'; wrap.style.height = hh + 'px';
  engine.resizePreview(w, hh);
}
new ResizeObserver(fitStage).observe(stage);

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

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */
async function doImport(files, addToTimeline = false) {
  if (!files.length) return;
  toast(t('toast.importing', { n: files.length }), 8000);
  const { added, failed } = await importFiles(files);
  if (failed.length) toast(t('toast.importFailed', { names: failed.slice(0, 3).join(', ') }), 6000);
  else toast(t('toast.imported', { n: added.length }));
  if (addToTimeline && added.length === 1 && !added[0].offline) placeMedia(added[0], 'main');
  emit('change');
}
$('#file-import').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; doImport(f); });

window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files].filter((f) => kindOf(f));
  const proj = [...e.dataTransfer.files].find((f) => /\.mvep$/i.test(f.name));
  if (proj) { openProjectFile(proj); return; }
  doImport(files);
});

/* ------------------------------------------------------------------ */
/*  Project files                                                     */
/* ------------------------------------------------------------------ */
const projFilters = () => [{ name: 'Material Video Editor', extensions: ['mvep'] }];

async function confirmDiscard() {
  if (!state.dirty) return true;
  const r = await askConfirm({ title: t('confirm.title'), msg: t('confirm.msg', { name: projName() }), yes: t('confirm.save'), no: t('confirm.discard') });
  if (r === 'cancel') return false;
  if (r === 'yes') return saveProject(false);
  return true;
}

function freshProject() {
  engine.pause();
  engine.resetEngine();
  releaseAllMedia();
  resetProject();
  nameInput.value = '';
}

async function newProject() {
  if (!(await confirmDiscard())) return;
  freshProject();
  clearDraft();
}

function afterLoad() {
  nameInput.value = state.name;
  engine.seek(0);
  clearDraft();
  updateChrome();
  const off = state.media.filter((m) => m.offline).length;
  toast(off ? t('toast.openedOffline', { n: off }) : t('toast.opened', { name: projName() }), off ? 7000 : 3000);
}

async function openProject() {
  if (!(await confirmDiscard())) return;
  try {
    if (inTauri) {
      const path = await pickOpenPath(projFilters());
      if (!path) return;
      freshProject();
      loadProject(JSON.parse(await readText(path)));
      state.projectPath = path;
      if (!state.name) state.name = stripExt(baseName(path));
      afterLoad();
    } else {
      const inp = $('#file-project');
      inp.value = '';
      inp.click();
    }
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}
async function openProjectFile(file) {
  if (!(await confirmDiscard())) return;
  try {
    const data = JSON.parse(await file.text());
    freshProject();
    loadProject(data);
    if (!state.name) state.name = stripExt(file.name);
    afterLoad();
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); }
}
$('#file-project').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openProjectFile(f); });

async function saveProject(forceAs) {
  try {
    let path = state.projectPath;
    if (!path || forceAs) {
      path = await pickSavePath(`${projName()}.mvep`, projFilters());
      if (!path) return false;
      if (!/\.mvep$/i.test(path)) path += '.mvep';
    }
    if (!state.name) { state.name = stripExt(baseName(path)); nameInput.value = state.name; }
    await writeText(path, JSON.stringify(toProject()));
    state.projectPath = path;
    markDirty(false);
    clearDraft();
    updateChrome();
    toast(t('toast.saved', { name: baseName(path) }));
    return true;
  } catch (err) { toast(t('toast.error', { msg: err.message || err }), 6000); return false; }
}

async function exitApp() {
  if (!(await confirmDiscard())) return;
  const w = currentWindow();
  if (w) await w.destroy(); else window.close();
}

/* File menu */
const fileMenu = $('#file-menu');
const toggleMenu = (show = fileMenu.hidden) => { fileMenu.hidden = !show; };
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
document.addEventListener('mousedown', (e) => { if (!fileMenu.hidden && !fileMenu.contains(e.target) && !e.target.closest('#btn-menu')) toggleMenu(false); });
fileMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-act]');
  if (!item) return;
  toggleMenu(false);
  ({
    new: newProject, open: openProject, save: () => saveProject(false), saveas: () => saveProject(true),
    import: () => $('#file-import').click(), export: openExport, exit: exitApp,
  })[item.dataset.act]();
});
$('#btn-export').addEventListener('click', openExport);

/* ------------------------------------------------------------------ */
/*  Keyboard                                                          */
/* ------------------------------------------------------------------ */
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'color'].includes(e.target.type)) || tag === 'select';
  if (e.key === 'Escape') { toggleMenu(false); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (mod) {
    const k = e.key.toLowerCase();
    const map = {
      n: newProject, o: openProject, s: () => saveProject(e.shiftKey), e: openExport, i: () => $('#file-import').click(),
      d: duplicateSelected, z: e.shiftKey ? redo : undo, y: redo,
    };
    if (map[k] && !(typing && ['z', 'y', 'd'].includes(k))) { e.preventDefault(); map[k](); }
    return;
  }
  if (typing || engine.isExporting()) return;
  switch (e.key) {
    case ' ': e.preventDefault(); engine.toggle(); break;
    case 's': case 'S': e.preventDefault(); if (!splitAt()) toast(t('toast.splitNone')); break;
    case 'Delete': case 'Backspace': e.preventDefault(); deleteSelected(); break;
    case 'ArrowLeft': e.preventDefault(); engine.seek(state.t - (e.shiftKey ? 1 : 1 / state.fps)); break;
    case 'ArrowRight': e.preventDefault(); engine.seek(state.t + (e.shiftKey ? 1 : 1 / state.fps)); break;
    case 'Home': e.preventDefault(); engine.seek(0); break;
    case 'End': e.preventDefault(); engine.seek(totalDuration()); break;
    default: break;
  }
});

/* ------------------------------------------------------------------ */
/*  Start-up                                                          */
/* ------------------------------------------------------------------ */
refreshLanguage();
refreshTheme();
fitStage();
engine.start();
layout();
updateChrome();

async function boot() {
  const w = currentWindow();
  if (w) {
    w.onCloseRequested(async (ev) => {
      if (state.dirty) { ev.preventDefault(); if (await confirmDiscard()) await w.destroy(); }
    });
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && (d.main?.length || d.text?.length || d.overlay?.length || d.audio?.length)) {
        const r = await askConfirm({ title: t('draft.title'), msg: t('draft.msg'), yes: t('draft.restore'), no: t('draft.discard'), cancel: false });
        if (r === 'yes') { loadProject(d); markDirty(true); afterLoad(); }
        else clearDraft();
      } else clearDraft();
    }
  } catch { clearDraft(); }
}
boot();

window.__mve = { state, engine, placeMedia, doImport, removeMedia, buildTimeline };

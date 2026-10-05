// Material Docx — main application logic.
import { applyTheme, watchSystemTheme, SWATCHES } from './theme.js';
import { setLanguage, applyI18n, t, lang } from './i18n.js';
import { exportDocx, importDocx, PAGE_SIZES, MARGINS, bytesToB64 } from './docx.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const T = window.__TAURI__ || null;
const invoke = T ? T.core.invoke : null;

const editor = $('#editor');
const pagewrap = $('#pagewrap');
const workspace = $('#workspace');

/* ------------------------------------------------------------------ */
/*  State & settings                                                  */
/* ------------------------------------------------------------------ */
const SETTINGS_KEY = 'material-docx.settings.v1';
const DRAFT_KEY = 'material-docx.draft.v1';
const DEFAULTS = { theme: 'system', seed: '#6750A4', lang: 'auto', size: 'A4', orientation: 'portrait', margin: 'normal', zoom: 100, spell: true };

let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

const pageCfg = { size: settings.size, orientation: settings.orientation, margin: settings.margin };
const doc = { path: null, dirty: false };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const baseName = (p) => p.split(/[\\/]/).pop();
const stripExt = (n) => n.replace(/\.[^.]+$/, '');
const extOf = (p) => (p.includes('.') ? p.split('.').pop().toLowerCase() : '');

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

// Material ripple on pointer press.
document.addEventListener('pointerdown', (e) => {
  if (reduceMotion || e.button !== 0) return;
  const host = e.target.closest('.icon-btn, .btn, .chip, .menu-item, .segmented button, .zoom-val');
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
/*  Toast & dialogs                                                   */
/* ------------------------------------------------------------------ */
let toastTimer;
function toast(msg, ms = 3200) {
  const s = $('#snackbar');
  s.textContent = msg;
  s.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => s.classList.remove('show'), ms);
}

function askConfirm({ title, msg, yes, no, cancel = true }) {
  return new Promise((resolve) => {
    const dlg = $('#dlg-confirm');
    $('#cf-title').textContent = title;
    $('#cf-msg').textContent = msg;
    const bYes = $('#cf-yes'), bNo = $('#cf-no'), bCancel = $('#cf-cancel');
    bYes.textContent = yes;
    bNo.textContent = no;
    bCancel.hidden = !cancel;
    const done = (v) => {
      bYes.onclick = bNo.onclick = bCancel.onclick = dlg.oncancel = dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(v);
    };
    bYes.onclick = () => done('yes');
    bNo.onclick = () => done('no');
    bCancel.onclick = () => done('cancel');
    dlg.oncancel = (e) => { e.preventDefault(); done('cancel'); };
    dlg.showModal();
  });
}

$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
// Click on the backdrop (outside the dialog box) closes it.
$$('dialog.dialog').forEach((d) => d.addEventListener('mousedown', (e) => {
  if (e.target !== d || d.id === 'dlg-confirm') return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));

/* ------------------------------------------------------------------ */
/*  Page layout, zoom                                                 */
/* ------------------------------------------------------------------ */
function applyPage() {
  const base = PAGE_SIZES[pageCfg.size] || PAGE_SIZES.A4;
  const land = pageCfg.orientation === 'landscape';
  const w = land ? base.h : base.w;
  const h = land ? base.w : base.h;
  const pad = (MARGINS[pageCfg.margin] || MARGINS.normal) / 15; // twips → px
  const root = document.documentElement.style;
  root.setProperty('--page-w', w + 'px');
  root.setProperty('--page-h', h + 'px');
  root.setProperty('--page-pad', pad + 'px');
  const inches = (MARGINS[pageCfg.margin] || MARGINS.normal) / 1440;
  $('#page-style').textContent = `@media print { @page { size: ${pageCfg.size === 'Letter' ? 'letter' : pageCfg.size} ${pageCfg.orientation}; margin: ${inches}in; } }`;
  updateStats();
}

function setZoom(z, persist = true) {
  z = Math.min(200, Math.max(50, Math.round(z / 5) * 5));
  pagewrap.style.zoom = z / 100;
  $('#zoom-range').value = z;
  $('#zoom-val').textContent = z + '%';
  settings.zoom = z;
  if (persist) saveSettings();
}

/* ------------------------------------------------------------------ */
/*  Selection helpers                                                 */
/* ------------------------------------------------------------------ */
let savedRange = null;
function selInEditor() {
  const s = getSelection();
  return s.rangeCount && editor.contains(s.anchorNode);
}
function restore() {
  editor.focus({ preventScroll: true });
  if (savedRange) {
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(savedRange);
  }
}
const anchorEl = () => {
  const s = getSelection();
  let n = s.anchorNode;
  if (!n || !editor.contains(n)) return null;
  return n.nodeType === 3 ? n.parentElement : n;
};

function ensureContent() {
  if (!editor.innerHTML.trim() || editor.innerHTML === '<br>') editor.innerHTML = '<p><br></p>';
}

/* ------------------------------------------------------------------ */
/*  Dirty state, title, draft                                         */
/* ------------------------------------------------------------------ */
const nameInput = $('#doc-name');
const docName = () => nameInput.value.trim() || t('doc.untitled');

function updateTitle() {
  const title = `${doc.dirty ? '• ' : ''}${docName()} — Material Docx`;
  document.title = title;
  $('#dirty-dot').hidden = !doc.dirty;
  if (T) { try { T.window.getCurrentWindow().setTitle(title).catch(() => {}); } catch { /* ignore */ } }
}

let draftTimer;
function markDirty() {
  if (!doc.dirty) { doc.dirty = true; updateTitle(); }
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 1500);
}
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: nameInput.value, html: editor.innerHTML, cfg: pageCfg, path: doc.path }));
  } catch { /* quota exceeded — ignore */ }
}
const clearDraft = () => { clearTimeout(draftTimer); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

/* ------------------------------------------------------------------ */
/*  Statistics                                                        */
/* ------------------------------------------------------------------ */
let statsTimer;
function updateStats() {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(() => {
    const text = editor.innerText.replace(/ /g, ' ');
    const words = (text.trim().match(/\S+/g) || []).length;
    const chars = text.replace(/\n/g, '').length;
    const ph = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-h')) || 1123;
    const pages = Math.max(1, Math.ceil((editor.offsetHeight - 2) / ph));
    $('#st-words').textContent = t('status.words', { n: words.toLocaleString(lang()) });
    $('#st-chars').textContent = t('status.chars', { n: chars.toLocaleString(lang()) });
    $('#st-pages').textContent = t('status.pages', { n: pages });
  }, 120);
}

/* ------------------------------------------------------------------ */
/*  Sanitizing (paste / HTML import)                                  */
/* ------------------------------------------------------------------ */
const ALLOWED = new Set('P DIV SPAN BR B STRONG I EM U S STRIKE DEL SUB SUP A UL OL LI H1 H2 H3 H4 H5 H6 BLOCKQUOTE TABLE THEAD TBODY TFOOT TR TD TH IMG HR PRE CODE FONT MARK'.split(' '));
const DROP = new Set('SCRIPT STYLE IFRAME OBJECT EMBED LINK META NOSCRIPT TEMPLATE SVG FORM INPUT BUTTON SELECT TEXTAREA HEAD TITLE CANVAS AUDIO VIDEO'.split(' '));
const STYLE_OK = ['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color', 'background-color', 'font-size', 'font-family', 'text-align', 'line-height', 'margin-left', 'vertical-align', 'text-indent'];
const SAFE_URL = /^(https?:|mailto:|tel:|#)/i;

function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const out = document.createElement('div');
  const walk = (src, dst) => {
    for (const n of src.childNodes) {
      if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) { walk(n, dst); continue; }
      const el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = n.getAttribute('href') || '';
        if (SAFE_URL.test(href)) el.setAttribute('href', href);
      } else if (tag === 'IMG') {
        const src_ = n.getAttribute('src') || '';
        if (/^data:image\/(png|jpe?g|gif|webp|bmp)/i.test(src_) || /^https?:/i.test(src_)) el.setAttribute('src', src_);
        else continue;
        for (const a of ['width', 'height', 'alt']) if (n.hasAttribute(a)) el.setAttribute(a, n.getAttribute(a));
      } else if (tag === 'TD' || tag === 'TH') {
        for (const a of ['colspan', 'rowspan']) if (n.hasAttribute(a)) el.setAttribute(a, n.getAttribute(a));
      } else if (tag === 'FONT') {
        for (const a of ['color', 'face']) if (n.hasAttribute(a)) el.setAttribute(a, n.getAttribute(a));
      }
      if (n.style) {
        for (const p of STYLE_OK) {
          const v = n.style.getPropertyValue(p);
          if (v && !/url\(|expression|javascript:/i.test(v)) el.style.setProperty(p, v);
        }
        if (tag === 'IMG') for (const p of ['width', 'height']) { const v = n.style.getPropertyValue(p); if (v) el.style.setProperty(p, v); }
      }
      walk(n, el);
      dst.appendChild(el);
    }
  };
  walk(parsed.body, out);
  return out.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Formatting commands                                               */
/* ------------------------------------------------------------------ */
function exec(cmd, val) {
  restore();
  document.execCommand('styleWithCSS', false, true);
  const ok = document.execCommand(cmd, false, val);
  afterChange();
  return ok;
}
function afterChange() {
  ensureContent();
  markDirty();
  updateToolbar();
  updateStats();
}

// Toolbar buttons keep the editor selection: prevent focus theft.
$('#toolbar').addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault();
});
$$('#toolbar [data-cmd]').forEach((b) => b.addEventListener('click', () => exec(b.dataset.cmd)));

/* Paragraph style */
$('#sel-style').addEventListener('change', (e) => {
  exec('formatBlock', `<${e.target.value}>`);
});

/* Fonts */
const FONTS = [
  ['System UI', 'system-ui'], ['Arial', 'Arial'], ['Calibri', 'Calibri'], ['Cambria', 'Cambria'],
  ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'], ['Verdana', 'Verdana'],
  ['Tahoma', 'Tahoma'], ['Trebuchet MS', 'Trebuchet MS'], ['Courier New', 'Courier New'], ['Consolas', 'Consolas'],
];
const selFont = $('#sel-font');
selFont.innerHTML = '<option value="" hidden></option>' + FONTS.map(([l, v]) => `<option value="${esc(v)}" style="font-family:'${esc(v)}'">${esc(l)}</option>`).join('');
selFont.addEventListener('change', () => { if (selFont.value) exec('fontName', selFont.value); });

/* Font size */
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
let pendingSize = null;
function fixSizes(pt) {
  editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach((el) => {
    if (el.tagName === 'FONT') {
      const sp = document.createElement('span');
      sp.style.fontSize = pt + 'pt';
      while (el.firstChild) sp.appendChild(el.firstChild);
      el.replaceWith(sp);
    } else el.style.fontSize = pt + 'pt';
  });
}
function setFontSize(pt) {
  pt = Math.min(400, Math.max(1, pt));
  restore();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontSize', false, '7');
  fixSizes(pt);
  if (getSelection().isCollapsed) pendingSize = pt;
  $('#inp-size').value = String(pt);
  afterChange();
}
const curSize = () => parseFloat($('#inp-size').value) || 11;
$('#size-inc').addEventListener('click', () => setFontSize(SIZES.find((s) => s > curSize()) || curSize() + 4));
$('#size-dec').addEventListener('click', () => setFontSize([...SIZES].reverse().find((s) => s < curSize()) || Math.max(1, curSize() - 1)));
$('#inp-size').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); const v = parseFloat(e.target.value.replace(',', '.')); if (v > 0) setFontSize(v); }
});
$('#inp-size').addEventListener('change', (e) => { const v = parseFloat(e.target.value.replace(',', '.')); if (v > 0) setFontSize(v); });

/* Colors */
const inpColor = $('#inp-color'), inpHl = $('#inp-hl');
$('#bar-color').style.setProperty('--c', inpColor.value);
$('#bar-hl').style.setProperty('--c', inpHl.value);
inpColor.addEventListener('change', () => { $('#bar-color').style.setProperty('--c', inpColor.value); exec('foreColor', inpColor.value); });
inpHl.addEventListener('change', () => {
  $('#bar-hl').style.setProperty('--c', inpHl.value);
  restore();
  document.execCommand('styleWithCSS', false, true);
  if (!document.execCommand('hiliteColor', false, inpHl.value)) document.execCommand('backColor', false, inpHl.value);
  afterChange();
});

/* Line spacing */
function selectedBlocks() {
  const s = getSelection();
  if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  return $$('p, h1, h2, h3, h4, h5, h6, li, blockquote', editor).filter((el) => r.intersectsNode(el));
}
$('#sel-lh').addEventListener('change', (e) => {
  restore();
  for (const b of selectedBlocks()) {
    if (e.target.value) b.style.lineHeight = e.target.value;
    else b.style.removeProperty('line-height');
  }
  afterChange();
});

/* Clear formatting, hr */
$('#btn-clear').addEventListener('click', () => {
  restore();
  document.execCommand('removeFormat');
  for (const b of selectedBlocks()) { b.style.removeProperty('line-height'); b.style.removeProperty('text-align'); }
  afterChange();
});
$('#btn-hr').addEventListener('click', () => exec('insertHTML', '<hr><p><br></p>'));

/* Toolbar state */
function updateToolbar() {
  if (!selInEditor()) return;
  for (const b of $$('#toolbar [data-cmd]')) {
    let on = false;
    try { on = document.queryCommandState(b.dataset.cmd); } catch { /* ignore */ }
    b.classList.toggle('active', !!on && !['undo', 'redo', 'indent', 'outdent'].includes(b.dataset.cmd));
  }
  let block = '';
  try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch { /* ignore */ }
  const sel = $('#sel-style');
  sel.value = ['h1', 'h2', 'h3', 'blockquote'].includes(block) ? block : 'p';

  const el = anchorEl();
  if (el) {
    const cs = getComputedStyle(el);
    if (document.activeElement !== $('#inp-size')) $('#inp-size').value = String(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    const match = FONTS.find(([l, v]) => v.toLowerCase() === fam || l.toLowerCase() === fam);
    selFont.value = match ? match[1] : (fam === '-apple-system' || fam === 'segoe ui' || fam === 'roboto' ? 'system-ui' : '');
    const blk = el.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    const lh = blk && blk.style.lineHeight;
    const lhSel = $('#sel-lh');
    lhSel.value = [...lhSel.options].some((o) => o.value === lh) ? lh : '';
  }
}

/* ------------------------------------------------------------------ */
/*  Links, images, tables                                             */
/* ------------------------------------------------------------------ */
function openLinkDialog() {
  restore();
  const s = getSelection();
  const a = anchorEl() && anchorEl().closest('a');
  $('#link-text').value = a ? a.textContent : s.toString();
  $('#link-url').value = a ? a.getAttribute('href') || '' : '';
  $('#link-remove').hidden = !a;
  $('#dlg-link').dataset.hadAnchor = a ? '1' : '';
  $('#dlg-link').showModal();
  $('#link-url').focus();
}
$('#btn-link').addEventListener('click', openLinkDialog);
$('#link-ok').addEventListener('click', () => {
  let url = $('#link-url').value.trim();
  const text = $('#link-text').value;
  if (!url) { toast(t('toast.emptyUrl')); return; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('#')) url = 'https://' + url;
  $('#dlg-link').close();
  restore();
  const a = anchorEl() && anchorEl().closest('a');
  if (a) {
    a.setAttribute('href', url);
    if (text && text !== a.textContent) a.textContent = text;
    afterChange();
  } else if (getSelection().isCollapsed || (text && text !== getSelection().toString())) {
    exec('insertHTML', `<a href="${esc(url)}">${esc(text || url)}</a>`);
  } else exec('createLink', url);
});
$('#link-remove').addEventListener('click', () => {
  $('#dlg-link').close();
  const a = anchorEl() && anchorEl().closest('a');
  if (a) { restore(); exec('unlink'); }
});

/* Images */
async function prepareImage(dataUrl) {
  // Downscale very large bitmaps so documents stay light.
  if (!/^data:image\/(jpe?g|png|webp)/i.test(dataUrl)) return dataUrl;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const MAX = 1800;
    if (img.naturalWidth <= MAX) return dataUrl;
    const c = document.createElement('canvas');
    c.width = MAX;
    c.height = Math.round((img.naturalHeight * MAX) / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return /png/i.test(dataUrl) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
  } catch { return dataUrl; }
}
async function insertImageFromDataUrl(url) {
  const src = await prepareImage(url);
  exec('insertImage', src);
}
const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
$('#btn-image').addEventListener('click', () => { restore(); $('#file-image').click(); });
$('#file-image').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) insertImageFromDataUrl(await readAsDataUrl(f));
});

/* Tables */
$('#btn-table').addEventListener('click', () => { restore(); $('#dlg-table').showModal(); });
$('#tbl-ok').addEventListener('click', () => {
  const rows = Math.min(50, Math.max(1, parseInt($('#tbl-rows').value, 10) || 3));
  const cols = Math.min(12, Math.max(1, parseInt($('#tbl-cols').value, 10) || 3));
  $('#dlg-table').close();
  const row = '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>';
  exec('insertHTML', `<table><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`);
});

let selImg = null;
function clearImgSel() { if (selImg) { selImg.classList.remove('sel'); selImg = null; } }
function updateContext() {
  const el = anchorEl();
  const cell = el && el.closest('td, th');
  $('#ctx-table').hidden = !cell;
  $('#ctx-image').hidden = !selImg;
  $('#context-bar').hidden = !cell && !selImg;
}
editor.addEventListener('click', (e) => {
  clearImgSel();
  if (e.target.tagName === 'IMG') { selImg = e.target; selImg.classList.add('sel'); }
  pendingSize = null;
  updateContext();
});
$$('[data-tbl]').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
$$('[data-tbl]').forEach((b) => b.addEventListener('click', () => {
  const el = anchorEl();
  const cell = el && el.closest('td, th');
  if (!cell) return;
  const tr = cell.parentElement, table = cell.closest('table');
  const idx = cell.cellIndex;
  switch (b.dataset.tbl) {
    case 'row-add': {
      const nr = document.createElement('tr');
      nr.innerHTML = '<td><br></td>'.repeat(tr.cells.length);
      tr.after(nr);
      break;
    }
    case 'col-add':
      for (const r of table.rows) { const c = document.createElement('td'); c.innerHTML = '<br>'; if (r.cells[idx]) r.cells[idx].after(c); else r.appendChild(c); }
      break;
    case 'row-del': tr.remove(); if (!table.rows.length) table.remove(); break;
    case 'col-del':
      for (const r of table.rows) if (r.cells[idx]) r.cells[idx].remove();
      if (![...table.rows].some((r) => r.cells.length)) table.remove();
      break;
    case 'del': table.remove(); break;
    default: break;
  }
  afterChange();
  updateContext();
}));
$$('[data-img]').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
$$('[data-img]').forEach((b) => b.addEventListener('click', () => {
  if (!selImg) return;
  const w = selImg.getBoundingClientRect().width / (parseFloat(pagewrap.style.zoom) || 1);
  switch (b.dataset.img) {
    case 'smaller': selImg.style.width = Math.max(24, Math.round(w * 0.8)) + 'px'; selImg.removeAttribute('width'); selImg.style.height = 'auto'; selImg.removeAttribute('height'); break;
    case 'larger': selImg.style.width = Math.round(w * 1.25) + 'px'; selImg.removeAttribute('width'); selImg.style.height = 'auto'; selImg.removeAttribute('height'); break;
    case 'fit': selImg.style.width = '100%'; selImg.style.height = 'auto'; selImg.removeAttribute('width'); selImg.removeAttribute('height'); break;
    case 'del': selImg.remove(); clearImgSel(); break;
    default: break;
  }
  afterChange();
  updateContext();
}));

/* ------------------------------------------------------------------ */
/*  Find & replace                                                    */
/* ------------------------------------------------------------------ */
const findbar = $('#findbar');
function toggleFind(show = findbar.hidden) {
  findbar.hidden = !show;
  if (show) {
    const sel = getSelection().toString();
    if (sel && !sel.includes('\n') && sel.length < 80) $('#find-q').value = sel;
    $('#find-q').focus();
    $('#find-q').select();
    updateFindCount();
  } else editor.focus();
}
function updateFindCount() {
  const q = $('#find-q').value;
  const out = $('#find-count');
  if (!q) { out.textContent = ''; return 0; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('#find-case').checked ? 'g' : 'gi');
  const n = (editor.innerText.match(re) || []).length;
  out.textContent = n ? t('find.count', { n }) : t('find.none');
  return n;
}
function findNext(back = false) {
  const q = $('#find-q').value;
  if (!q) return false;
  const ok = window.find(q, $('#find-case').checked, back, true, false, false, false);
  if (!ok) toast(t('find.none'), 1800);
  return ok;
}
$('#find-q').addEventListener('input', updateFindCount);
$('#find-case').addEventListener('change', updateFindCount);
$('#find-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey); } });
$('#find-next').addEventListener('click', () => findNext(false));
$('#find-prev').addEventListener('click', () => findNext(true));
$('#find-close').addEventListener('click', () => toggleFind(false));
$('#find-replace').addEventListener('click', () => {
  const q = $('#find-q').value;
  if (!q) return;
  const selText = savedRange ? savedRange.toString() : '';
  const same = $('#find-case').checked ? selText === q : selText.toLowerCase() === q.toLowerCase();
  if (same) { restore(); document.execCommand('insertText', false, $('#find-r').value); afterChange(); }
  findNext(false);
});
$('#find-replace-all').addEventListener('click', () => {
  const q = $('#find-q').value;
  if (!q) return;
  const repl = $('#find-r').value;
  editor.focus();
  const s = getSelection();
  s.removeAllRanges();
  const r = document.createRange();
  r.setStart(editor, 0);
  r.collapse(true);
  s.addRange(r);
  let n = 0;
  while (n < 10000 && window.find(q, $('#find-case').checked, false, false, false, false, false)) {
    if (!selInEditor()) break;
    document.execCommand('insertText', false, repl);
    n++;
  }
  if (n) afterChange();
  toast(t('toast.replaced', { n }));
  updateFindCount();
});
$('#btn-find').addEventListener('click', () => toggleFind(findbar.hidden));

/* ------------------------------------------------------------------ */
/*  File I/O                                                          */
/* ------------------------------------------------------------------ */
const filters = {
  open: () => [{ name: t('filter.docs'), extensions: ['docx', 'html', 'htm', 'txt', 'md'] }],
  save: () => [
    { name: t('filter.docx'), extensions: ['docx'] },
    { name: t('filter.html'), extensions: ['html'] },
    { name: t('filter.txt'), extensions: ['txt'] },
  ],
};

async function pickOpen() {
  if (T) {
    const path = await T.dialog.open({ multiple: false, directory: false, title: t('dlg.open'), filters: filters.open() });
    if (!path) return null;
    return { path: String(path), bytes: b64ToBytes(await invoke('read_file_b64', { path: String(path) })) };
  }
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.docx,.html,.htm,.txt,.md';
    inp.onchange = async () => {
      const f = inp.files[0];
      resolve(f ? { path: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null);
    };
    inp.click();
  });
}

async function writeBytes(path, bytes) {
  if (T) { await invoke('write_file_b64', { path, data: bytesToB64(bytes) }); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes]));
  a.download = baseName(path);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function setContent(html) {
  clearImgSel();
  editor.innerHTML = html || '<p><br></p>';
  ensureContent();
  editor.scrollTop = 0;
  workspace.scrollTop = 0;
  updateContext();
  updateStats();
}

async function loadBytes(path, bytes) {
  const ext = extOf(path);
  const dec = new TextDecoder();
  if (ext === 'docx') {
    const { html, page } = await importDocx(bytes);
    setContent(sanitizeHtml(html));
    Object.assign(pageCfg, { size: settings.size, orientation: settings.orientation, margin: settings.margin }, page);
  } else if (ext === 'html' || ext === 'htm') {
    setContent(sanitizeHtml(dec.decode(bytes)) || '<p><br></p>');
  } else if (['txt', 'md', 'markdown', 'log', 'csv'].includes(ext)) {
    const lines = dec.decode(bytes).replace(/^﻿/, '').split(/\r?\n/);
    setContent(lines.map((l) => (l ? `<p>${esc(l)}</p>` : '<p><br></p>')).join(''));
  } else {
    toast(t('toast.unsupported'));
    return false;
  }
  applyPage();
  doc.path = path;
  nameInput.value = stripExt(baseName(path));
  doc.dirty = false;
  clearDraft();
  updateTitle();
  toast(t('toast.opened', { name: baseName(path) }));
  return true;
}

async function confirmDiscard() {
  if (!doc.dirty) return true;
  const r = await askConfirm({
    title: t('confirm.title'),
    msg: t('confirm.msg', { name: docName() }),
    yes: t('confirm.save'),
    no: t('confirm.discard'),
  });
  if (r === 'cancel') return false;
  if (r === 'yes') return saveDoc(false);
  clearDraft();
  return true;
}

async function newDoc() {
  if (!(await confirmDiscard())) return;
  setContent('<p><br></p>');
  Object.assign(pageCfg, { size: settings.size, orientation: settings.orientation, margin: settings.margin });
  applyPage();
  doc.path = null;
  nameInput.value = '';
  doc.dirty = false;
  clearDraft();
  updateTitle();
  editor.focus();
}

async function openDoc(pathArg) {
  if (!(await confirmDiscard())) return;
  try {
    let res;
    if (pathArg) res = { path: pathArg, bytes: b64ToBytes(await invoke('read_file_b64', { path: pathArg })) };
    else res = await pickOpen();
    if (res) await loadBytes(res.path, res.bytes);
  } catch (err) {
    toast(t('toast.error', { msg: err && err.message ? err.message : String(err) }), 6000);
  }
}

async function saveDoc(forceAs = false) {
  try {
    let path = doc.path;
    if (!path || forceAs) {
      const def = (stripExt(docName()) || 'Document') + '.docx';
      path = T ? await T.dialog.save({ defaultPath: def, title: t('dlg.save'), filters: filters.save() }) : def;
      if (!path) return false;
      path = String(path);
      if (!extOf(path)) path += '.docx';
    }
    const ext = extOf(path);
    let bytes;
    if (ext === 'docx') bytes = await exportDocx(editor, { ...pageCfg, title: nameInput.value.trim() });
    else if (ext === 'html' || ext === 'htm') {
      const html = `<!doctype html>\n<html lang="${lang()}"><head><meta charset="utf-8"><title>${esc(docName())}</title></head>\n<body>${editor.innerHTML}</body></html>`;
      bytes = new TextEncoder().encode(html);
    } else bytes = new TextEncoder().encode(editor.innerText.replace(/ /g, ' '));
    await writeBytes(path, bytes);
    doc.path = path;
    nameInput.value = stripExt(baseName(path));
    doc.dirty = false;
    clearDraft();
    updateTitle();
    toast(t('toast.saved', { name: baseName(path) }));
    return true;
  } catch (err) {
    toast(t('toast.error', { msg: err && err.message ? err.message : String(err) }), 6000);
    return false;
  }
}

function printDoc() {
  toast(t('toast.printHint'), 4000);
  setTimeout(() => window.print(), 250);
}

async function exitApp() {
  if (!(await confirmDiscard())) return;
  if (T) await T.window.getCurrentWindow().destroy();
  else window.close();
}

/* File menu */
const fileMenu = $('#file-menu');
const toggleMenu = (show = fileMenu.hidden) => { fileMenu.hidden = !show; };
$('#btn-file').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
document.addEventListener('mousedown', (e) => { if (!fileMenu.hidden && !fileMenu.contains(e.target) && !e.target.closest('#btn-file')) toggleMenu(false); });
fileMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-act]');
  if (!item) return;
  toggleMenu(false);
  ({ new: newDoc, open: () => openDoc(), save: () => saveDoc(false), saveas: () => saveDoc(true), print: printDoc, exit: exitApp })[item.dataset.act]();
});

/* ------------------------------------------------------------------ */
/*  Editor events                                                     */
/* ------------------------------------------------------------------ */
editor.addEventListener('input', () => {
  if (pendingSize != null) fixSizes(pendingSize);
  ensureContent();
  markDirty();
  updateStats();
});
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const inList = anchorEl() && anchorEl().closest('li');
    if (inList) document.execCommand(e.shiftKey ? 'outdent' : 'indent');
    else if (!e.shiftKey) document.execCommand('insertText', false, '  ');
    afterChange();
  } else if (e.key.startsWith('Arrow')) pendingSize = null;
});
editor.addEventListener('paste', async (e) => {
  const cd = e.clipboardData;
  if (!cd) return;
  const file = [...cd.files].find((f) => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); insertImageFromDataUrl(await readAsDataUrl(file)); return; }
  const html = cd.getData('text/html');
  if (html) {
    e.preventDefault();
    document.execCommand('insertHTML', false, sanitizeHtml(html));
    afterChange();
  }
});
editor.addEventListener('drop', (e) => {
  // Files are handled by the Tauri drag-drop event; block the browser default navigation.
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) e.preventDefault();
});
editor.addEventListener('dblclick', (e) => { if (e.target.closest('a')) openLinkDialog(); });

document.addEventListener('selectionchange', () => {
  if (selInEditor()) {
    savedRange = getSelection().getRangeAt(0).cloneRange();
    updateToolbar();
    updateContext();
  }
});

/* Keyboard shortcuts */
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (!findbar.hidden) toggleFind(false);
    toggleMenu(false);
    return;
  }
  if (!mod) return;
  const k = e.key.toLowerCase();
  const map = {
    n: () => newDoc(), o: () => openDoc(), s: () => saveDoc(e.shiftKey), p: printDoc,
    f: () => toggleFind(true), h: () => toggleFind(true), k: openLinkDialog,
    '=': () => setZoom(settings.zoom + 10), '+': () => setZoom(settings.zoom + 10),
    '-': () => setZoom(settings.zoom - 10), '0': () => setZoom(100),
  };
  if (map[k]) { e.preventDefault(); map[k](); }
});

/* Zoom controls */
$('#zoom-range').addEventListener('input', (e) => setZoom(+e.target.value));
$('#zoom-in').addEventListener('click', () => setZoom(settings.zoom + 10));
$('#zoom-out').addEventListener('click', () => setZoom(settings.zoom - 10));
$('#zoom-val').addEventListener('click', () => setZoom(100));
workspace.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(settings.zoom + (e.deltaY < 0 ? 10 : -10)); }
}, { passive: false });

/* Document name */
nameInput.addEventListener('input', updateTitle);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });

/* ------------------------------------------------------------------ */
/*  Settings dialog & theme                                           */
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
$('#swatches').addEventListener('click', (e) => {
  const b = e.target.closest('.swatch');
  if (!b) return;
  settings.seed = b.dataset.hex;
  saveSettings();
  refreshTheme();
});
$('#inp-seed').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); refreshTheme(); });
$('#seg-theme').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.theme = b.dataset.mode;
  saveSettings();
  refreshTheme();
});
$('#btn-theme').addEventListener('click', () => {
  settings.theme = { light: 'dark', dark: 'system', system: 'light' }[settings.theme] || 'light';
  saveSettings();
  refreshTheme();
});
watchSystemTheme(() => { if (settings.theme === 'system') refreshTheme(); });

function refreshLanguage() {
  setLanguage(settings.lang);
  applyI18n();
  editor.lang = lang();
  updateTitle();
  updateStats();
  updateFindCount();
  $('#sel-lang').value = settings.lang;
}
$('#sel-lang').addEventListener('change', (e) => { settings.lang = e.target.value; saveSettings(); refreshLanguage(); });

function bindPageSetting(id, key) {
  $(id).addEventListener('change', (e) => {
    settings[key] = pageCfg[key] = e.target.value;
    saveSettings();
    applyPage();
    markDirty();
  });
}
bindPageSetting('#sel-psize', 'size');
bindPageSetting('#sel-orient', 'orientation');
bindPageSetting('#sel-margin', 'margin');
$('#chk-spell').addEventListener('change', (e) => { settings.spell = e.target.checked; editor.spellcheck = e.target.checked; saveSettings(); });

$('#btn-settings').addEventListener('click', () => {
  $('#sel-psize').value = pageCfg.size;
  $('#sel-orient').value = pageCfg.orientation;
  $('#sel-margin').value = pageCfg.margin;
  $('#chk-spell').checked = settings.spell;
  $('#dlg-settings').showModal();
});

/* ------------------------------------------------------------------ */
/*  Start-up                                                          */
/* ------------------------------------------------------------------ */
document.execCommand('defaultParagraphSeparator', false, 'p');
refreshLanguage();
refreshTheme();
applyPage();
setZoom(settings.zoom, false);
editor.spellcheck = settings.spell;
ensureContent();
updateTitle();
updateStats();

async function boot() {
  if (T) {
    const win = T.window.getCurrentWindow();
    win.onCloseRequested(async (ev) => {
      if (doc.dirty) {
        ev.preventDefault();
        if (await confirmDiscard()) await win.destroy();
      }
    });
    try {
      await T.webview.getCurrentWebview().onDragDropEvent(async (ev) => {
        if (ev.payload.type !== 'drop' || !ev.payload.paths.length) return;
        const p = ev.payload.paths[0];
        if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(p)) {
          const bytes = b64ToBytes(await invoke('read_file_b64', { path: p }));
          const mime = { png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[extOf(p)] || 'image/jpeg';
          insertImageFromDataUrl(`data:${mime};base64,${bytesToB64(bytes)}`);
        } else openDoc(p);
      });
    } catch { /* drag & drop is optional */ }

    try {
      const initial = await invoke('initial_file');
      if (initial) { await openDoc(initial); return; }
    } catch { /* ignore */ }
  }
  // Offer to restore an unsaved draft from a previous session.
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const r = await askConfirm({ title: t('draft.title'), msg: t('draft.msg'), yes: t('draft.restore'), no: t('draft.discard'), cancel: false });
      if (r === 'yes') {
        setContent(sanitizeHtml(d.html));
        nameInput.value = d.name || '';
        Object.assign(pageCfg, d.cfg || {});
        applyPage();
        doc.path = d.path || null;
        doc.dirty = true;
        updateTitle();
      } else clearDraft();
    }
  } catch { clearDraft(); }
}
boot();

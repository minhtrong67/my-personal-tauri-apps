/* Material File - application logic
 * Author: minhtrong67 (with the support of Claude, an AI assistant by Anthropic)
 */
(() => {
  'use strict';

  const { t } = I18n;
  const TAURI = window.__TAURI__ || {};
  const invoke = TAURI.core && TAURI.core.invoke;
  const convertFileSrc = TAURI.core && TAURI.core.convertFileSrc;
  const win = TAURI.window && TAURI.window.getCurrentWindow ? TAURI.window.getCurrentWindow() : null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isWin = /Win/i.test(navigator.platform);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ settings */
  const SETTINGS_KEY = 'material-file.settings';
  const DEFAULTS = { theme: 'system', seed: '#6750A4', lang: null, view: 'details', sortKey: 'name', sortDir: 'asc', showHidden: false, confirmDelete: true };
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } }
  const settings = Object.assign({}, DEFAULTS, readJson(SETTINGS_KEY) || {});
  if (!settings.lang) settings.lang = I18n.detect();
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

  /* --------------------------------------------------------------------- state */
  const state = {
    path: null,            // current folder; '' = This PC; null = not loaded yet
    entries: [],           // raw entries of the current folder (or search results)
    view: [],              // filtered + sorted entries that are rendered
    selected: new Set(),
    anchor: -1,
    focus: -1,
    back: [],
    fwd: [],
    clip: null,            // { paths: string[], cut: boolean }
    search: null,          // { query } while showing deep-search results
    filter: '',
    drives: [],
    places: [],
    token: 0,
    drag: null,
    renaming: false
  };

  /* ------------------------------------------------------------------- helpers */
  const sepOf = (p) => (p.includes('\\') || /^[A-Za-z]:/.test(p) ? '\\' : '/');
  const joinPath = (dir, name) => { const s = sepOf(dir); return dir.endsWith(s) ? dir + name : dir + s + name; };
  const baseName = (p) => p.split(/[\\/]/).filter(Boolean).pop() || p;
  const samePath = (a, b) => (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);

  function parentOf(p) {
    if (!p) return null;
    const trimmed = p.length > 3 ? p.replace(/[\\/]+$/, '') : p;
    if (/^[A-Za-z]:[\\/]?$/.test(trimmed) || trimmed === '/') return '';
    const i = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
    if (i < 0) return '';
    if (i === 0) return '/';
    const parent = trimmed.slice(0, i);
    return /^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent;
  }

  function crumbsOf(p) {
    if (!p) return [];
    const m = p.match(/^([A-Za-z]:)[\\/]?(.*)$/);
    const out = [];
    if (m) {
      let acc = m[1] + '\\';
      const drive = state.drives.find((d) => samePath(d.path, acc));
      const letter = m[1];
      out.push({ label: drive && drive.name ? `${drive.name} (${letter})` : letter, path: acc });
      m[2].split(/[\\/]/).filter(Boolean).forEach((part) => { acc = joinPath(acc, part); out.push({ label: part, path: acc }); });
    } else {
      out.push({ label: '/', path: '/' });
      let acc = '';
      p.split('/').filter(Boolean).forEach((part) => { acc += '/' + part; out.push({ label: part, path: acc }); });
    }
    return out;
  }

  function fmtSize(n, precise) {
    if (n < 1024) return n + ' B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    if (i === 1 && !precise) return Math.ceil(v).toLocaleString() + ' KB';
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + units[i];
  }
  const locale = () => (I18n.getLang() === 'vi' ? 'vi-VN' : 'en-US');
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString(locale(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

  const CATS = {
    image: 'png jpg jpeg gif webp bmp svg ico avif tif tiff heic',
    video: 'mp4 mkv avi mov wmv webm flv m4v mpg mpeg',
    audio: 'mp3 wav flac aac ogg m4a wma opus',
    archive: 'zip rar 7z tar gz bz2 xz iso cab',
    doc: 'doc docx pdf odt rtf',
    sheet: 'xls xlsx csv ods tsv',
    slide: 'ppt pptx odp',
    code: 'js ts jsx tsx html htm css json xml py rs go java c cpp h hpp cs php rb sh bat cmd ps1 yml yaml toml md ini sql vue lua kt swift',
    exe: 'exe msi apk dll com',
    text: 'txt log'
  };
  const EXT2CAT = {};
  Object.keys(CATS).forEach((c) => CATS[c].split(' ').forEach((e) => { EXT2CAT[e] = c; }));
  const THUMB_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico']);
  const GLYPH = { image: 'g-image', video: 'g-video', audio: 'g-audio', archive: 'g-archive', doc: 'g-doc', sheet: 'g-sheet', slide: 'g-slide', code: 'g-code', exe: 'g-exe', text: 'g-doc' };

  const extOf = (name) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
  const catOf = (e) => (e.isDir ? 'folder' : EXT2CAT[extOf(e.name)] || 'file');

  function iconSvg(e) {
    const cat = catOf(e);
    if (cat === 'folder') return '<svg class="fi c-folder"><use href="#f-folder"/></svg>';
    return `<svg class="fi c-${cat}"><use href="#f-file"/>${GLYPH[cat] ? `<use href="#${GLYPH[cat]}"/>` : ''}</svg>`;
  }

  function typeLabel(e) {
    if (e.isDir) return t('type.folder');
    const ext = extOf(e.name);
    if (!ext) return t('type.plain');
    const cat = EXT2CAT[ext];
    return cat ? t('type.cat', { ext: ext.toUpperCase(), cat: t('cat.' + cat) }) : t('type.file', { ext: ext.toUpperCase() });
  }

  function errText(err) {
    const s = String(err);
    if (s.includes('exists')) return t('err.exists');
    if (s.includes('invalid-name')) return t('err.invalidName');
    if (s.includes('into-itself')) return t('err.intoItself');
    return s || t('err.generic');
  }

  /* --------------------------------------------------------------------- toast */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#snackbar');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ------------------------------------------------------------------- dialogs */
  function closeDlg(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (reduceMotion()) { d.close(); return; }
    let finished = false;
    const finish = () => { if (finished) return; finished = true; d.classList.remove('closing'); if (d.open) d.close(); };
    d.classList.add('closing');
    d.addEventListener('animationend', (e) => { if (e.target === d && e.animationName === 'dlg-out') finish(); });
    setTimeout(finish, 320);
  }

  function confirmDialog({ title, message, confirmLabel }) {
    return new Promise((resolve) => {
      const d = $('#dlg-generic');
      $('#dlg-title').textContent = title;
      $('#dlg-message').textContent = message;
      const box = $('#dlg-actions');
      box.innerHTML = '';
      let result = false;
      const mk = (label, cls, value) => {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = label;
        b.addEventListener('click', () => { result = value; closeDlg(d); });
        box.appendChild(b);
      };
      const gap = document.createElement('span');
      gap.className = 'grow';
      box.appendChild(gap);
      mk(t('common.cancel'), 'btn-text', false);
      mk(confirmLabel, 'btn-filled', true);
      d.onclose = () => resolve(result);
      d.showModal();
    });
  }

  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('cancel', (e) => { e.preventDefault(); closeDlg(d); });
    d.addEventListener('close', () => { if (!state.renaming) $('#list').focus({ preventScroll: true }); });
  });
  ['dlg-settings', 'dlg-about', 'dlg-props'].forEach((id) => {
    const d = $('#' + id);
    let downOutside = false;
    const outside = (e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    d.addEventListener('mousedown', (e) => { downOutside = e.target === d && outside(e); });
    d.addEventListener('click', (e) => { if (downOutside && e.target === d && outside(e)) closeDlg(d); downOutside = false; });
  });

  /* --------------------------------------------------------------------- menus */
  const pop = $('#menu-pop');
  let menuOpen = false;
  function closeMenu() { pop.hidden = true; menuOpen = false; }

  function showMenu(items, x, y) {
    pop.innerHTML = '';
    items.forEach((item) => {
      if (item.sep) { const hr = document.createElement('div'); hr.className = 'menu-sep'; pop.appendChild(hr); return; }
      const b = document.createElement('button');
      b.className = 'menu-item';
      b.setAttribute('role', 'menuitem');
      if (item.disabled) b.disabled = true;
      const glyph = item.check ? '<svg class="icon chk"><use href="#i-check"/></svg>' : item.icon ? `<svg class="icon chk ic"><use href="#${item.icon}"/></svg>` : '';
      b.innerHTML = `${glyph}<span></span><kbd></kbd>`;
      b.querySelector('span').textContent = item.label;
      b.querySelector('kbd').textContent = item.kbd || '';
      b.addEventListener('click', () => { closeMenu(); item.run(); });
      pop.appendChild(b);
    });
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    pop.hidden = false;
    menuOpen = true;
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  }
  function menuBelow(btn, items) {
    const r = btn.getBoundingClientRect();
    showMenu(items, r.left, r.bottom + 4);
  }
  pop.addEventListener('mousedown', (e) => e.preventDefault());
  document.addEventListener('mousedown', (e) => { if (menuOpen && !e.target.closest('#menu-pop')) closeMenu(); }, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  /* ------------------------------------------------------------------ loading */
  let loadingCount = 0;
  function setLoading(on) {
    loadingCount = Math.max(0, loadingCount + (on ? 1 : -1));
    $('#progress').hidden = loadingCount === 0;
  }

  async function loadDrives() {
    try { state.drives = await invoke('get_drives'); } catch { state.drives = []; }
  }

  async function navigate(path, { push = true, silent = false, select = null } = {}) {
    if (!invoke) return false;
    const token = ++state.token;
    if (!silent) setLoading(true);
    try {
      let entries = [];
      if (path === '') await loadDrives();
      else entries = await invoke('list_dir', { path });
      if (token !== state.token) return false;
      const changed = state.path !== path;
      if (push && state.path !== null && changed) { state.back.push(state.path); state.fwd = []; }
      state.path = path;
      state.entries = entries;
      state.search = null;
      if (changed) {
        state.selected.clear();
        state.anchor = state.focus = -1;
        state.filter = '';
        $('#search-input').value = '';
      }
      afterLoad(select);
      return true;
    } catch (err) {
      if (token === state.token) toast(t('err.path') + ': ' + errText(err));
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function afterLoad(select) {
    render();
    if (select && select.length) selectPaths(select);
    renderCrumbs();
    renderSidebar();
    updateChrome();
  }

  const refresh = (select) => navigate(state.path, { push: false, silent: true, select });

  function setTitle() {
    const name = state.path ? baseName(state.path) : t('place.thispc');
    const title = name + ' - Material File';
    document.title = title;
    if (win && win.setTitle) Promise.resolve(win.setTitle(title)).catch(() => {});
  }

  /* ----------------------------------------------------------------- rendering */
  const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  function cmp(a, b) {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let r = 0;
    switch (settings.sortKey) {
      case 'modified': r = (a.modified || 0) - (b.modified || 0); break;
      case 'type': r = coll.compare(typeLabel(a), typeLabel(b)); break;
      case 'size': r = a.size - b.size; break;
      default: r = 0;
    }
    if (r === 0) r = coll.compare(a.name, b.name);
    return settings.sortDir === 'asc' ? r : -r;
  }

  function computeView() {
    let list = state.entries;
    if (!settings.showHidden) list = list.filter((e) => !e.hidden);
    if (state.filter) { const q = state.filter.toLowerCase(); list = list.filter((e) => e.name.toLowerCase().includes(q)); }
    state.view = list.slice().sort(cmp);
  }

  function rowHtml(e, i, cutSet) {
    const cls = (cutSet.has(e.path) ? ' cut' : '') + (e.hidden ? ' hidden-item' : '');
    return `<div class="row${cls}" role="option" data-i="${i}" draggable="true"><div class="c-name">${iconSvg(e)}<span class="nm">${esc(e.name)}</span></div>` +
      `<div>${fmtDate(e.modified)}</div><div>${esc(typeLabel(e))}</div><div class="c-size">${e.isDir ? '' : fmtSize(e.size)}</div></div>`;
  }

  function tileHtml(e, i, cutSet) {
    const cls = (cutSet.has(e.path) ? ' cut' : '') + (e.hidden ? ' hidden-item' : '');
    const thumb = !e.isDir && convertFileSrc && THUMB_EXT.has(extOf(e.name)) && e.size < 8 * 1024 * 1024
      ? `<img loading="lazy" decoding="async" alt="" src="${esc(convertFileSrc(e.path))}">`
      : iconSvg(e);
    return `<div class="tile${cls}" role="option" data-i="${i}" draggable="true"><div class="thumb">${thumb}</div><span class="nm">${esc(e.name)}</span></div>`;
  }

  function render() {
    const content = $('#content');
    const list = $('#list');
    const atPc = state.path === '';
    const grid = settings.view === 'grid' && !atPc;
    content.classList.toggle('grid-view', grid || atPc);
    $('#list-head').hidden = grid || atPc;
    $('#empty').hidden = true;

    if (atPc) {
      state.view = [];
      list.className = 'list';
      list.innerHTML = `<div class="drives-title">${esc(t('sidebar.drives'))}</div><div class="drives">` + state.drives.map((d) => {
        const used = d.total ? Math.round(((d.total - d.free) / d.total) * 100) : 0;
        const letter = d.path.replace(/[\\/]+$/, '');
        const name = `${d.name || t('drive.local')} (${letter})`;
        return `<button class="drive" data-path="${esc(d.path)}"><svg class="icon"><use href="#i-drive"/></svg><div class="meta">` +
          `<div class="dn">${esc(name)}</div><div class="bar"><i class="${used >= 90 ? 'full' : ''}" style="width:${used}%"></i></div>` +
          `<div class="ds">${esc(t('drive.free', { free: fmtSize(d.free, true), total: fmtSize(d.total, true) }))}</div></div></button>`;
      }).join('') + '</div>';
      updateStatus();
      return;
    }

    computeView();
    list.className = 'list' + (grid ? ' grid' : '');
    const cutSet = new Set(state.clip && state.clip.cut ? state.clip.paths : []);
    list.innerHTML = state.view.map((e, i) => (grid ? tileHtml(e, i, cutSet) : rowHtml(e, i, cutSet))).join('');

    document.querySelectorAll('#list-head button').forEach((b) => {
      const on = b.dataset.sort === settings.sortKey;
      b.classList.toggle('sorted', on);
      b.classList.toggle('desc', on && settings.sortDir === 'desc');
    });

    if (!state.view.length) {
      $('#empty-text').textContent = state.filter || state.search ? t('empty.search') : t('empty.folder');
      $('#empty').hidden = false;
    }
    // drop selection entries that are no longer visible
    const visible = new Set(state.view.map((e) => e.path));
    state.selected.forEach((p) => { if (!visible.has(p)) state.selected.delete(p); });
    refreshSelectionUi();
    updateStatus();
  }

  function refreshSelectionUi() {
    const kids = $('#list').children;
    const cutSet = new Set(state.clip && state.clip.cut ? state.clip.paths : []);
    for (const el of kids) {
      if (!el.dataset.i) continue;
      const i = +el.dataset.i;
      const e = state.view[i];
      if (!e) continue;
      el.classList.toggle('sel', state.selected.has(e.path));
      el.classList.toggle('focus', i === state.focus);
      el.classList.toggle('cut', cutSet.has(e.path));
      el.setAttribute('aria-selected', state.selected.has(e.path) ? 'true' : 'false');
    }
    updateCommands();
    updateStatus();
  }

  function renderCrumbs() {
    const parts = [{ label: t('place.thispc'), path: '' }].concat(crumbsOf(state.path || ''));
    $('#crumbs').innerHTML = parts.map((p, i) =>
      (i ? '<svg class="icon crumb-sep"><use href="#i-chevron"/></svg>' : '') +
      `<button class="crumb" data-path="${esc(p.path)}"${p.path ? ' data-drop="1"' : ''}><span>${esc(p.label)}</span></button>`).join('');
  }

  const PLACE_ICON = { home: 'i-home', desktop: 'i-desktop', documents: 'i-documents', downloads: 'i-downloads', pictures: 'i-pictures', music: 'i-music', videos: 'i-videos' };
  function renderSidebar() {
    const item = (path, icon, label, drop) =>
      `<button class="side-item${state.path !== null && samePath(path, state.path) ? ' active' : ''}" data-path="${esc(path)}"${drop ? ' data-drop="1"' : ''}>` +
      `<svg class="icon"><use href="#${icon}"/></svg><span>${esc(label)}</span></button>`;
    let html = `<div class="side-title">${esc(t('sidebar.quick'))}</div>`;
    html += state.places.map((p) => item(p.path, PLACE_ICON[p.id] || 'i-documents', t('place.' + p.id), true)).join('');
    html += `<div class="side-title"></div>` + item('', 'i-pc', t('place.thispc'), false);
    html += state.drives.map((d) => {
      const letter = d.path.replace(/[\\/]+$/, '');
      return item(d.path, 'i-drive', `${d.name || t('drive.local')} (${letter})`, true);
    }).join('');
    $('#sidebar').innerHTML = html;
  }

  function updateChrome() {
    $('#btn-back').disabled = state.back.length === 0;
    $('#btn-forward').disabled = state.fwd.length === 0;
    $('#btn-up').disabled = state.path === null || state.path === '';
    const folder = state.path ? baseName(state.path) : t('place.thispc');
    $('#search-input').placeholder = state.path === '' ? t('search.placeholder') : t('search.in', { folder });
    $('#search-input').disabled = state.path === '';
    $('#search-clear').hidden = !$('#search-input').value;
    document.querySelectorAll('#st-details, #st-grid').forEach((b) => b.classList.remove('active'));
    $(settings.view === 'grid' ? '#st-grid' : '#st-details').classList.add('active');
    $('#view-use').setAttribute('href', settings.view === 'grid' ? '#i-grid' : '#i-list');
    setTitle();
    updateCommands();
    updateStatus();
  }

  function selectedEntries() {
    return state.view.filter((e) => state.selected.has(e.path));
  }

  function updateCommands() {
    const n = state.selected.size;
    const atPc = state.path === '' || state.path === null;
    $('#cmd-cut').disabled = n === 0;
    $('#cmd-copy').disabled = n === 0;
    $('#cmd-rename').disabled = n !== 1;
    $('#cmd-delete').disabled = n === 0;
    $('#cmd-paste').disabled = !state.clip || atPc;
    $('#cmd-new').disabled = atPc;
    $('#cmd-sort').disabled = atPc;
    $('#cmd-props').disabled = state.path === null;
  }

  function updateStatus() {
    const atPc = state.path === '';
    const n = atPc ? state.drives.length : state.view.length;
    $('#st-items').textContent = state.search ? t('status.results', { n: n.toLocaleString() }) : n === 1 ? t('status.item') : t('status.items', { n: n.toLocaleString() });
    const sel = selectedEntries();
    if (sel.length) {
      const bytes = sel.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0);
      const files = sel.some((e) => !e.isDir);
      $('#st-sel').textContent = t('status.selected', { n: sel.length.toLocaleString() }) + (files ? '  ·  ' + fmtSize(bytes) : '');
    } else {
      $('#st-sel').textContent = '';
    }
  }

  /* ----------------------------------------------------------------- selection */
  function selectIndex(i, { ctrl = false, shift = false } = {}) {
    const e = state.view[i];
    if (!e) return;
    if (shift && state.anchor >= 0) {
      const [a, b] = [Math.min(state.anchor, i), Math.max(state.anchor, i)];
      if (!ctrl) state.selected.clear();
      for (let k = a; k <= b; k++) state.selected.add(state.view[k].path);
    } else if (ctrl) {
      if (state.selected.has(e.path)) state.selected.delete(e.path); else state.selected.add(e.path);
      state.anchor = i;
    } else {
      state.selected = new Set([e.path]);
      state.anchor = i;
    }
    state.focus = i;
    refreshSelectionUi();
  }

  function selectPaths(paths) {
    const set = new Set(paths);
    state.selected = new Set();
    let first = -1;
    state.view.forEach((e, i) => { if (set.has(e.path)) { state.selected.add(e.path); if (first < 0) first = i; } });
    state.anchor = state.focus = first;
    refreshSelectionUi();
    scrollToIndex(first);
  }

  function scrollToIndex(i) {
    if (i < 0) return;
    const el = $(`#list [data-i="${i}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function clearSelection() {
    state.selected.clear();
    state.anchor = state.focus = -1;
    refreshSelectionUi();
  }

  function selectAll() {
    state.view.forEach((e) => state.selected.add(e.path));
    if (state.focus < 0 && state.view.length) state.focus = 0;
    refreshSelectionUi();
  }

  function gridColumns() {
    const kids = [...$('#list').children];
    if (!kids.length) return 1;
    const top = kids[0].offsetTop;
    let c = 0;
    for (const k of kids) { if (k.offsetTop !== top) break; c++; }
    return Math.max(1, c);
  }

  function moveFocus(delta, shift) {
    const n = state.view.length;
    if (!n) return;
    const i = state.focus < 0 ? (delta > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, state.focus + delta));
    selectIndex(i, { shift });
    scrollToIndex(i);
  }

  let typeBuf = '';
  let typeTimer = 0;
  function typeAhead(ch) {
    typeBuf += ch.toLowerCase();
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => { typeBuf = ''; }, 700);
    const i = state.view.findIndex((e) => e.name.toLowerCase().startsWith(typeBuf));
    if (i >= 0) { selectIndex(i); scrollToIndex(i); }
  }

  /* ------------------------------------------------------------------- actions */
  async function openEntry(e) {
    if (!e) return;
    if (e.isDir) { await navigate(e.path); return; }
    try { await invoke('open_item', { path: e.path }); } catch (err) { toast(errText(err)); }
  }

  function openSelection() {
    const sel = selectedEntries();
    if (sel.length === 1) openEntry(sel[0]);
    else sel.filter((e) => !e.isDir).forEach(openEntry);
  }

  function copyToClipboard(cut) {
    const paths = [...state.selected];
    if (!paths.length) return;
    state.clip = { paths, cut };
    refreshSelectionUi();
  }

  async function runPaste(sources, dest, mv) {
    setLoading(true);
    try {
      const created = await invoke('paste_items', { sources, dest, mv });
      if (mv && state.clip && state.clip.cut) state.clip = null;
      if (dest === state.path) await refresh(created); else await refresh();
      toast(t('msg.pasted', { n: created.length }));
    } catch (err) {
      toast(errText(err));
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function pasteClipboard() {
    if (!state.clip || !state.path) return;
    await runPaste(state.clip.paths, state.path, state.clip.cut);
  }

  async function deleteSelection(permanent) {
    const sel = selectedEntries();
    if (!sel.length) return;
    if (permanent || settings.confirmDelete) {
      const one = sel.length === 1;
      const ok = await confirmDialog({
        title: t('confirm.title'),
        message: permanent ? (one ? t('confirm.permOne', { name: sel[0].name }) : t('confirm.permMany', { n: sel.length })) : (one ? t('confirm.one', { name: sel[0].name }) : t('confirm.many', { n: sel.length })),
        confirmLabel: t('cmd.delete')
      });
      if (!ok) return;
    }
    setLoading(true);
    try {
      await invoke('delete_items', { paths: sel.map((e) => e.path), permanent });
      clearSelection();
      await refresh();
      toast(t('msg.deleted'));
    } catch (err) {
      toast(errText(err));
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function newItem(isDir) {
    if (!state.path) return;
    try {
      const p = await invoke('create_item', { dir: state.path, name: t(isDir ? 'name.newFolder' : 'name.newText'), isDir });
      state.filter = '';
      $('#search-input').value = '';
      await refresh([p]);
      beginRename(p);
    } catch (err) {
      toast(errText(err));
    }
  }

  function beginRename(path) {
    const i = state.view.findIndex((e) => e.path === path);
    const el = i >= 0 ? $(`#list [data-i="${i}"]`) : null;
    if (!el) return;
    const e = state.view[i];
    el.scrollIntoView({ block: 'nearest' });
    const nm = el.querySelector('.nm');
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = e.name;
    input.spellcheck = false;
    nm.replaceWith(input);
    el.draggable = false;
    state.renaming = true;
    input.focus();
    const dot = !e.isDir && e.name.lastIndexOf('.') > 0 ? e.name.lastIndexOf('.') : e.name.length;
    input.setSelectionRange(0, dot);
    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      state.renaming = false;
      const val = input.value.trim();
      if (commit && val && val !== e.name) {
        try {
          const np = await invoke('rename_item', { path: e.path, newName: val });
          await refresh([np]);
        } catch (err) {
          toast(errText(err));
          render();
        }
      } else {
        render();
      }
      $('#list').focus({ preventScroll: true });
    };
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    ['click', 'dblclick', 'mousedown'].forEach((n) => input.addEventListener(n, (ev) => ev.stopPropagation()));
  }

  function renameSelection() {
    const sel = selectedEntries();
    if (sel.length === 1) beginRename(sel[0].path);
  }

  async function showProperties() {
    const sel = selectedEntries();
    const targets = sel.length ? sel.map((e) => e.path) : state.path ? [state.path] : [];
    if (!targets.length) return;
    let props;
    try { props = await Promise.all(targets.map((p) => invoke('item_properties', { path: p }))); } catch (err) { toast(errText(err)); return; }
    const row = (k, v) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`;
    let html = '';
    const sum = (f) => props.reduce((s, p) => s + p[f], 0);
    const bytes = sum('size');
    const sizeText = `${fmtSize(bytes, true)} (${bytes.toLocaleString()} bytes)`;
    if (props.length === 1) {
      const p = props[0];
      const parent = parentOf(p.path);
      html += `<div class="props-head">${iconSvg({ isDir: p.isDir, name: p.name })}<b>${esc(p.name)}</b></div>`;
      html += row(t('props.type'), typeLabel({ isDir: p.isDir, name: p.name }));
      html += row(t('props.location'), parent === '' || parent === null ? t('place.thispc') : parent);
      html += row(t('props.size'), sizeText);
      if (p.isDir) html += row(t('props.contains'), t('props.containsVal', { files: p.files.toLocaleString(), folders: p.folders.toLocaleString() }));
      html += row(t('props.created'), fmtDate(p.created)) + row(t('props.modified'), fmtDate(p.modified)) + row(t('props.accessed'), fmtDate(p.accessed));
      const attrs = [p.readonly ? t('props.readonly') : '', p.hidden ? t('props.hidden') : ''].filter(Boolean).join(', ');
      if (attrs) html += row(t('props.attributes'), attrs);
    } else {
      html += `<div class="props-head"><b>${esc(t('props.items', { n: props.length }))}</b></div>`;
      html += row(t('props.size'), sizeText);
      html += row(t('props.contains'), t('props.containsVal', { files: sum('files').toLocaleString(), folders: sum('folders').toLocaleString() }));
    }
    $('#props-body').innerHTML = html;
    $('#dlg-props').showModal();
  }

  /* --------------------------------------------------------------- menus content */
  function newMenuItems() {
    return [
      { label: t('new.folder'), icon: 'i-folder-plus', kbd: 'Ctrl+Shift+N', run: () => newItem(true) },
      { label: t('new.text'), icon: 'i-file-plus', run: () => newItem(false) }
    ];
  }
  function sortMenuItems() {
    const keys = ['name', 'modified', 'type', 'size'];
    return keys.map((k) => ({ label: t('sort.' + k), check: settings.sortKey === k, run: () => setSort(k, settings.sortDir) }))
      .concat([{ sep: true },
        { label: t('sort.asc'), check: settings.sortDir === 'asc', run: () => setSort(settings.sortKey, 'asc') },
        { label: t('sort.desc'), check: settings.sortDir === 'desc', run: () => setSort(settings.sortKey, 'desc') }]);
  }
  function viewMenuItems() {
    return [
      { label: t('view.details'), icon: 'i-list', check: settings.view === 'details', kbd: 'Ctrl+1', run: () => setView('details') },
      { label: t('view.grid'), icon: 'i-grid', check: settings.view === 'grid', kbd: 'Ctrl+2', run: () => setView('grid') },
      { sep: true },
      { label: t('view.hidden'), check: settings.showHidden, run: () => setShowHidden(!settings.showHidden) }
    ];
  }
  function itemMenuItems() {
    const sel = selectedEntries();
    const items = [{ label: t('cmd.open'), icon: 'i-open', kbd: 'Enter', run: openSelection }];
    if (state.search && sel.length === 1) {
      items.push({ label: t('cmd.openLocation'), icon: 'i-folder-plus', run: () => navigate(parentOf(sel[0].path) || '', { select: [sel[0].path] }) });
    }
    items.push({ sep: true },
      { label: t('cmd.cut'), icon: 'i-cut', kbd: 'Ctrl+X', run: () => copyToClipboard(true) },
      { label: t('cmd.copy'), icon: 'i-copy', kbd: 'Ctrl+C', run: () => copyToClipboard(false) },
      { label: t('cmd.rename'), icon: 'i-rename', kbd: 'F2', disabled: sel.length !== 1, run: renameSelection },
      { label: t('cmd.delete'), icon: 'i-trash', kbd: 'Del', run: () => deleteSelection(false) },
      { sep: true },
      { label: t('cmd.properties'), icon: 'i-info', run: showProperties });
    return items;
  }
  function backgroundMenuItems() {
    const atPc = state.path === '';
    return [
      { label: t('new.folder'), icon: 'i-folder-plus', disabled: atPc, run: () => newItem(true) },
      { label: t('new.text'), icon: 'i-file-plus', disabled: atPc, run: () => newItem(false) },
      { sep: true },
      { label: t('cmd.paste'), icon: 'i-paste', kbd: 'Ctrl+V', disabled: !state.clip || atPc, run: pasteClipboard },
      { label: t('cmd.selectAll'), icon: 'i-select', kbd: 'Ctrl+A', disabled: atPc, run: selectAll },
      { sep: true },
      { label: t('nav.refresh'), icon: 'i-refresh', kbd: 'F5', run: () => refresh() },
      { label: t('cmd.properties'), icon: 'i-info', run: showProperties }
    ];
  }

  function setSort(key, dir) { settings.sortKey = key; settings.sortDir = dir; saveSettings(); render(); }
  function setView(v) { settings.view = v; saveSettings(); render(); updateChrome(); syncSettingsUi(); }
  function setShowHidden(on) { settings.showHidden = on; saveSettings(); render(); syncSettingsUi(); }

  /* --------------------------------------------------------------- search + path */
  async function deepSearch() {
    const q = $('#search-input').value.trim();
    if (!q || !state.path) return;
    setLoading(true);
    try {
      const res = await invoke('search_dir', { root: state.path, query: q, limit: 1000 });
      state.entries = res;
      state.search = { query: q };
      state.filter = '';
      state.selected.clear();
      state.anchor = state.focus = -1;
      render();
      updateChrome();
    } catch (err) {
      toast(errText(err));
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    const input = $('#search-input');
    const had = state.search || state.filter || input.value;
    input.value = '';
    state.filter = '';
    $('#search-clear').hidden = true;
    if (state.search) refresh(); else render();
    return !!had;
  }

  let searchTimer = 0;
  $('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    $('#search-clear').hidden = !e.target.value;
    searchTimer = setTimeout(() => { state.filter = e.target.value.trim(); render(); }, 90);
  });
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimer); deepSearch(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); clearSearch(); $('#list').focus(); }
  });
  $('#search-clear').addEventListener('click', () => { clearSearch(); $('#list').focus(); });

  const addressInput = $('#address-input');
  function beginAddressEdit() {
    addressInput.hidden = false;
    addressInput.value = state.path || '';
    addressInput.focus();
    addressInput.select();
  }
  function endAddressEdit() { addressInput.hidden = true; }
  $('#address').addEventListener('click', (e) => {
    if (e.target.closest('.crumb') || !addressInput.hidden) return;
    beginAddressEdit();
  });
  addressInput.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { endAddressEdit(); $('#list').focus(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const v = addressInput.value.trim().replace(/^"|"$/g, '');
      endAddressEdit();
      if (v.toLowerCase() === 'this pc' || v === '') await navigate('');
      else await navigate(v);
      $('#list').focus();
    }
  });
  addressInput.addEventListener('blur', endAddressEdit);

  /* --------------------------------------------------------------- list events */
  const listEl = $('#list');

  listEl.addEventListener('click', (e) => {
    const drive = e.target.closest('.drive');
    if (drive) { navigate(drive.dataset.path); return; }
    const el = e.target.closest('[data-i]');
    if (!el) { if (!e.ctrlKey && !e.metaKey) clearSelection(); return; }
    selectIndex(+el.dataset.i, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
  });
  listEl.addEventListener('dblclick', (e) => {
    const el = e.target.closest('[data-i]');
    if (el) openEntry(state.view[+el.dataset.i]);
  });
  $('#content').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.path === null) return;
    listEl.focus({ preventScroll: true });
    const el = e.target.closest('[data-i]');
    if (el) {
      const i = +el.dataset.i;
      if (!state.selected.has(state.view[i].path)) selectIndex(i);
      showMenu(itemMenuItems(), e.clientX, e.clientY);
    } else {
      showMenu(backgroundMenuItems(), e.clientX, e.clientY);
    }
  });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('#content, input')) e.preventDefault(); });

  // image thumbnails that fail to load fall back to the file icon
  listEl.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const host = img.closest('[data-i]');
    const entry = host && state.view[+host.dataset.i];
    if (entry) { const tpl = document.createElement('template'); tpl.innerHTML = iconSvg(entry); img.replaceWith(tpl.content.firstChild); }
  }, true);

  document.querySelectorAll('#list-head [data-sort]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    setSort(k, settings.sortKey === k && settings.sortDir === 'asc' ? 'desc' : 'asc');
  }));

  /* drag & drop (move; hold Ctrl to copy) */
  function dropPathOf(el) {
    if (!el) return null;
    if (el.matches('.row, .tile')) { const e = state.view[+el.dataset.i]; return e && e.isDir ? e.path : null; }
    return el.dataset.drop ? el.dataset.path : null;
  }
  function clearDropMarks() { document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop')); }

  listEl.addEventListener('dragstart', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el || state.renaming) { e.preventDefault(); return; }
    const i = +el.dataset.i;
    if (!state.selected.has(state.view[i].path)) selectIndex(i);
    state.drag = [...state.selected];
    e.dataTransfer.setData('text/plain', state.drag.join('\n'));
    e.dataTransfer.effectAllowed = 'copyMove';
  });
  document.addEventListener('dragend', () => { state.drag = null; clearDropMarks(); });
  document.addEventListener('dragover', (e) => {
    if (!state.drag) return;
    const el = e.target.closest('.row, .tile, .side-item, .crumb');
    const target = dropPathOf(el);
    clearDropMarks();
    if (target && !state.drag.some((p) => samePath(p, target))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      el.classList.add('drop');
    }
  });
  document.addEventListener('drop', async (e) => {
    if (!state.drag) return;
    const el = e.target.closest('.row, .tile, .side-item, .crumb');
    const target = dropPathOf(el);
    const sources = state.drag;
    state.drag = null;
    clearDropMarks();
    if (!target || sources.some((p) => samePath(p, target))) return;
    e.preventDefault();
    await runPaste(sources, target, !e.ctrlKey);
  });

  /* sidebar + breadcrumbs */
  $('#sidebar').addEventListener('click', (e) => {
    const b = e.target.closest('.side-item');
    if (b) navigate(b.dataset.path);
  });
  $('#crumbs').addEventListener('click', (e) => {
    const b = e.target.closest('.crumb');
    if (b) navigate(b.dataset.path);
  });

  /* nav buttons + command bar */
  async function goBack() {
    if (!state.back.length) return;
    const target = state.back.pop();
    const from = state.path;
    if (await navigate(target, { push: false })) state.fwd.push(from); else state.back.push(target);
    updateChrome();
  }
  async function goForward() {
    if (!state.fwd.length) return;
    const target = state.fwd.pop();
    const from = state.path;
    if (await navigate(target, { push: false })) state.back.push(from); else state.fwd.push(target);
    updateChrome();
  }
  function goUp() {
    const p = parentOf(state.path);
    if (p !== null && state.path !== '') navigate(p, { select: [state.path] });
  }
  $('#btn-back').addEventListener('click', goBack);
  $('#btn-forward').addEventListener('click', goForward);
  $('#btn-up').addEventListener('click', goUp);
  $('#btn-refresh').addEventListener('click', () => refresh());
  $('#cmd-new').addEventListener('click', (e) => menuBelow(e.currentTarget, newMenuItems()));
  $('#cmd-sort').addEventListener('click', (e) => menuBelow(e.currentTarget, sortMenuItems()));
  $('#cmd-view').addEventListener('click', (e) => menuBelow(e.currentTarget, viewMenuItems()));
  $('#cmd-cut').addEventListener('click', () => copyToClipboard(true));
  $('#cmd-copy').addEventListener('click', () => copyToClipboard(false));
  $('#cmd-paste').addEventListener('click', pasteClipboard);
  $('#cmd-rename').addEventListener('click', renameSelection);
  $('#cmd-delete').addEventListener('click', () => deleteSelection(false));
  $('#cmd-props').addEventListener('click', showProperties);
  $('#st-details').addEventListener('click', () => setView('details'));
  $('#st-grid').addEventListener('click', () => setView('grid'));

  /* ----------------------------------------------------------------- keyboard */
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const inField = !!e.target.closest('input, textarea');

    if (e.key === 'Escape') {
      if (menuOpen) { closeMenu(); return; }
      if (!inField) { if (!clearSearch()) clearSelection(); }
      return;
    }
    // shortcuts that also work while a text field has focus
    if ((mod && k === 'l') || (e.altKey && k === 'd') || e.key === 'F4') { e.preventDefault(); beginAddressEdit(); return; }
    if ((mod && k === 'f') || (e.key === 'F3')) { e.preventDefault(); const s = $('#search-input'); if (!s.disabled) { s.focus(); s.select(); } return; }
    if (e.key === 'F5' || (mod && k === 'r')) { e.preventDefault(); refresh(); return; }
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); return; }
    if (inField) return;

    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); return; }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); goUp(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); goBack(); return; }

    if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && k === 'c') { e.preventDefault(); copyToClipboard(false); return; }
    if (mod && k === 'x') { e.preventDefault(); copyToClipboard(true); return; }
    if (mod && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (mod && e.shiftKey && k === 'n') { e.preventDefault(); newItem(true); return; }
    if (mod && k === '1') { e.preventDefault(); setView('details'); return; }
    if (mod && k === '2') { e.preventDefault(); setView('grid'); return; }
    if (e.key === 'F2') { e.preventDefault(); renameSelection(); return; }
    if (e.key === 'Delete') { e.preventDefault(); deleteSelection(e.shiftKey); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (e.altKey) showProperties(); else openSelection(); return; }

    const grid = settings.view === 'grid';
    const nav = {
      ArrowDown: grid ? gridColumns() : 1, ArrowUp: grid ? -gridColumns() : -1,
      ArrowRight: grid ? 1 : 0, ArrowLeft: grid ? -1 : 0
    };
    if (nav[e.key]) { e.preventDefault(); moveFocus(nav[e.key], e.shiftKey); return; }
    if (e.key === 'Home') { e.preventDefault(); if (state.view.length) { selectIndex(0, { shift: e.shiftKey }); scrollToIndex(0); } return; }
    if (e.key === 'End') { e.preventDefault(); const n = state.view.length - 1; if (n >= 0) { selectIndex(n, { shift: e.shiftKey }); scrollToIndex(n); } return; }
    if (!mod && !e.altKey && e.key.length === 1 && e.key !== ' ') typeAhead(e.key);
  });

  // keep the listing fresh when returning to the window
  let lastFocusRefresh = 0;
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastFocusRefresh < 1500 || state.renaming || state.search || state.path === null || document.querySelector('dialog[open]')) return;
    lastFocusRefresh = now;
    refresh();
  });

  /* ----------------------------------------------------------------- settings */
  function renderSwatches() {
    const box = $('#swatches');
    box.innerHTML = '';
    Theme.PRESETS.forEach((hex) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (hex.toLowerCase() === settings.seed.toLowerCase() ? ' selected' : '');
      b.style.background = hex;
      b.title = hex;
      b.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
      b.addEventListener('click', () => { settings.seed = hex; saveSettings(); applyTheme(); syncSettingsUi(); });
      box.appendChild(b);
    });
  }

  function syncSettingsUi() {
    document.querySelectorAll('#seg-theme input').forEach((i) => { i.checked = i.value === settings.theme; });
    document.querySelectorAll('#seg-lang input').forEach((i) => { i.checked = i.value === settings.lang; });
    document.querySelectorAll('#seg-view input').forEach((i) => { i.checked = i.value === settings.view; });
    $('#seed-input').value = /^#[0-9a-f]{6}$/i.test(settings.seed) ? settings.seed.toLowerCase() : '#6750a4';
    $('#set-hidden').checked = settings.showHidden;
    $('#set-confirm').checked = settings.confirmDelete;
    renderSwatches();
  }

  function applyTheme() {
    Theme.apply(settings, win);
    $('#theme-use').setAttribute('href', { light: '#i-sun', dark: '#i-moon', system: '#i-system' }[settings.theme]);
  }

  function applyLanguage() {
    I18n.setLang(settings.lang);
    I18n.apply();
    closeMenu();
    if (state.path !== null) { render(); renderCrumbs(); renderSidebar(); updateChrome(); }
  }

  document.querySelectorAll('#seg-theme input').forEach((i) => i.addEventListener('change', () => { settings.theme = i.value; saveSettings(); applyTheme(); }));
  document.querySelectorAll('#seg-lang input').forEach((i) => i.addEventListener('change', () => { settings.lang = i.value; saveSettings(); applyLanguage(); }));
  document.querySelectorAll('#seg-view input').forEach((i) => i.addEventListener('change', () => setView(i.value)));
  $('#seed-input').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); applyTheme(); renderSwatches(); });
  $('#set-hidden').addEventListener('change', (e) => setShowHidden(e.target.checked));
  $('#set-confirm').addEventListener('change', (e) => { settings.confirmDelete = e.target.checked; saveSettings(); });
  $('#btn-reset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS, { lang: I18n.detect() });
    saveSettings(); applyTheme(); applyLanguage(); syncSettingsUi();
  });

  const openSettings = () => { syncSettingsUi(); $('#dlg-settings').showModal(); };
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => closeDlg($('#dlg-settings')));
  $('#btn-about').addEventListener('click', () => $('#dlg-about').showModal());
  $('#about-close').addEventListener('click', () => closeDlg($('#dlg-about')));
  $('#props-close').addEventListener('click', () => closeDlg($('#dlg-props')));
  $('#btn-theme').addEventListener('click', () => {
    const order = ['light', 'dark', 'system'];
    settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
    saveSettings(); applyTheme(); syncSettingsUi();
    toast(t('toolbar.theme') + ': ' + t('settings.' + settings.theme));
  });
  Theme.onSystemChange(() => { if (settings.theme === 'system') applyTheme(); });

  /* ------------------------------------------------------------ ripple (Material) */
  const RIPPLE_HOSTS = '.btn-text, .btn-tonal, .btn-filled, .icon-btn, .cmd-btn, .side-item, .crumb, .menu-item, .segmented span, .status-btn';
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || reduceMotion()) return;
    const host = e.target.closest(RIPPLE_HOSTS);
    if (!host || host.disabled) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('i'); // <i> so descendant "span" rules never match
    dot.className = 'ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = e.clientX - r.left - size / 2 + 'px';
    dot.style.top = e.clientY - r.top - size / 2 + 'px';
    host.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }, true);

  /* --------------------------------------------------------------------- init */
  async function init() {
    I18n.setLang(settings.lang);
    I18n.apply();
    applyTheme();
    syncSettingsUi();
    updateChrome();

    // reveal the (initially hidden) window after the first paint
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('booting');
      if (win && win.show) Promise.resolve(win.show()).catch(() => {});
    }));

    if (!invoke) return;
    const [places, drives, start] = await Promise.all([
      invoke('get_places').catch(() => []),
      invoke('get_drives').catch(() => []),
      invoke('startup_path').catch(() => null)
    ]);
    state.places = places;
    state.drives = drives;
    const home = places.find((p) => p.id === 'home');
    const ok = await navigate(start || (home ? home.path : ''), { push: false });
    if (!ok) await navigate('', { push: false });
    listEl.focus({ preventScroll: true });
  }

  init();
})();

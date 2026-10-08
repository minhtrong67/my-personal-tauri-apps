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
  const DEFAULTS = {
    theme: 'system', seed: '#6750A4', lang: null, view: 'details', sortKey: 'name', sortDir: 'asc',
    showHidden: false, showExt: true, confirmDelete: true, showNav: true, showDetails: false,
    startFullscreen: false, pinned: [], groupBy: 'none', showChecks: false,
    cols: ['modified', 'type', 'size'], colW: { modified: 170, created: 170, type: 160, size: 100 },
    recent: [], frequent: {}
  };
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } }
  const settings = Object.assign({}, DEFAULTS, readJson(SETTINGS_KEY) || {});
  if (!settings.lang) settings.lang = I18n.detect();
  settings.colW = Object.assign({ modified: 170, created: 170, type: 160, size: 100 }, settings.colW || {});
  settings.cols = Array.isArray(settings.cols) ? settings.cols.slice() : ['modified', 'type', 'size'];
  if (!Array.isArray(settings.recent)) settings.recent = [];
  if (!settings.frequent || typeof settings.frequent !== 'object') settings.frequent = {};
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
    renaming: false,
    undo: [],
    kind: 'all',          // type filter
    groupAt: new Map(),   // view index -> group header info
    tools: { winrar: false, sevenzip: false, code: false, terminal: false }
  };
  const tabs = [{ path: null, back: state.back, fwd: state.fwd }];
  let activeTab = 0;
  const isGridView = () => settings.view !== 'details';
  const HOME = '@home';                                   // virtual "Home" page
  const isVirtual = (p = state.path) => p === '' || p === HOME; // Home page or This PC
  const pk = (p) => (isWin ? p.toLowerCase() : p);
  const tree = { open: new Set(), cache: new Map() };     // sidebar folder tree

  /* ------------------------------------------------------------------- helpers */
  const sepOf = (p) => (p.includes('\\') || /^[A-Za-z]:/.test(p) ? '\\' : '/');
  const joinPath = (dir, name) => { const s = sepOf(dir); return dir.endsWith(s) ? dir + name : dir + s + name; };
  const baseName = (p) => p.split(/[\\/]/).filter(Boolean).pop() || p;
  const samePath = (a, b) => (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);

  function parentOf(p) {
    if (!p || p === HOME) return null;
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

  const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'cab']);
  const extOf = (name) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
  const isArchive = (e) => !e.isDir && ARCHIVE_EXT.has(extOf(e.name));
  const stripExt = (name) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(0, i) : name; };
  const shownName = (e) => (e.isDir || settings.showExt ? e.name : stripExt(e.name));
  const driveLabel = (d) => `${d.name || t('drive.local')} (${d.path.replace(/[\\/]+$/, '')})`;
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
    if (s.includes('no-extractor')) return t('err.noExtractor');
    if (s.includes('no-winrar')) return t('err.noWinrar');
    if (s.includes('not-found')) return t('err.notFound');
    if (s.includes('compress-failed')) return t('err.compress');
    return s || t('err.generic');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(t('msg.copied'));
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

  function choiceDialog({ title, message, buttons }) {
    return new Promise((resolve) => {
      const d = $('#dlg-generic');
      $('#dlg-title').textContent = title;
      $('#dlg-message').textContent = message;
      const box = $('#dlg-actions');
      box.innerHTML = '';
      let result = 'cancel';
      const gap = document.createElement('span');
      gap.className = 'grow';
      box.appendChild(gap);
      buttons.forEach((b) => {
        const el = document.createElement('button');
        el.className = b.cls;
        el.textContent = b.label;
        el.addEventListener('click', () => { result = b.id; closeDlg(d); });
        box.appendChild(el);
      });
      d.onclose = () => resolve(result);
      d.showModal();
    });
  }

  function promptDialog({ title, label, value }) {
    return new Promise((resolve) => {
      const d = $('#dlg-prompt');
      const input = $('#prm-input');
      $('#prm-title').textContent = title;
      $('#prm-label').textContent = label;
      input.value = value || '';
      let result = null;
      const done = (v) => { result = v; closeDlg(d); };
      $('#prm-ok').onclick = () => done(input.value.trim());
      $('#prm-cancel').onclick = () => done(null);
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim()); } };
      d.onclose = () => resolve(result);
      d.showModal();
      input.focus();
      input.select();
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
  const subPop = $('#menu-sub');
  let menuOpen = false;
  function closeMenu() { pop.hidden = true; subPop.hidden = true; menuOpen = false; }

  function fillMenu(el, items, root) {
    el.innerHTML = '';
    items.forEach((item) => {
      if (item.sep) { const hr = document.createElement('div'); hr.className = 'menu-sep'; el.appendChild(hr); return; }
      const b = document.createElement('button');
      b.className = 'menu-item';
      b.setAttribute('role', 'menuitem');
      if (item.disabled) b.disabled = true;
      const glyph = item.check ? '<svg class="icon chk"><use href="#i-check"/></svg>' : item.icon ? `<svg class="icon chk ic"><use href="#${item.icon}"/></svg>` : '';
      b.innerHTML = `${glyph}<span></span><kbd></kbd>${item.items ? '<svg class="icon sub-ind"><use href="#i-chevron"/></svg>' : ''}`;
      b.querySelector('span').textContent = item.label;
      b.querySelector('kbd').textContent = item.kbd || '';
      if (item.items) {
        const open = () => openSub(b, item.items);
        b.addEventListener('mouseenter', open);
        b.addEventListener('click', open);
      } else {
        if (root) b.addEventListener('mouseenter', () => { subPop.hidden = true; el.querySelectorAll('.menu-item.open').forEach((n) => n.classList.remove('open')); });
        b.addEventListener('click', () => { closeMenu(); item.run(); });
      }
      el.appendChild(b);
    });
  }

  function openSub(btn, items) {
    pop.querySelectorAll('.menu-item.open').forEach((n) => n.classList.remove('open'));
    btn.classList.add('open');
    fillMenu(subPop, items, false);
    subPop.hidden = false;
    const r = btn.getBoundingClientRect();
    const s = subPop.getBoundingClientRect();
    let x = r.right - 4;
    if (x + s.width > innerWidth - 8) x = Math.max(8, r.left - s.width + 4);
    const y = Math.max(8, Math.min(r.top - 8, innerHeight - s.height - 8));
    subPop.style.left = x + 'px';
    subPop.style.top = y + 'px';
  }

  function showMenu(items, x, y) {
    fillMenu(pop, items, true);
    subPop.hidden = true;
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
  [pop, subPop].forEach((p) => p.addEventListener('mousedown', (e) => e.preventDefault()));
  document.addEventListener('mousedown', (e) => { if (menuOpen && !e.target.closest('#menu-pop, #menu-sub')) closeMenu(); }, true);
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

  function bumpFrequent(path) {
    if (parentOf(path) === '') return; // skip drive roots
    settings.frequent[path] = (settings.frequent[path] || 0) + 1;
    const keys = Object.keys(settings.frequent);
    if (keys.length > 60) {
      keys.sort((a, b) => settings.frequent[b] - settings.frequent[a]).slice(40).forEach((k) => delete settings.frequent[k]);
    }
    saveSettings();
  }

  async function navigate(path, { push = true, silent = false, select = null } = {}) {
    if (!invoke) return false;
    const token = ++state.token;
    if (!silent) setLoading(true);
    try {
      let entries = [];
      if (isVirtual(path)) await loadDrives();
      else entries = await invoke('list_dir', { path });
      if (token !== state.token) return false;
      const changed = state.path !== path;
      // mutate in place: the arrays are shared with the active tab
      if (push && state.path !== null && changed) { state.back.push(state.path); state.fwd.length = 0; }
      state.path = path;
      state.entries = entries;
      state.search = null;
      if (changed) {
        state.selected.clear();
        state.anchor = state.focus = -1;
        state.filter = '';
        state.kind = 'all';
        $('#search-input').value = '';
        if (!isVirtual(path)) bumpFrequent(path);
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

  /* ----------------------------------------------------------- sidebar folder tree */
  const dirsOf = (list) => list.filter((e) => e.isDir).map((e) => ({ name: e.name, path: e.path, hidden: e.hidden })).sort((a, b) => coll.compare(a.name, b.name));
  async function loadTreeChildren(path) {
    try { tree.cache.set(pk(path), dirsOf(await invoke('list_dir', { path }))); } catch { tree.cache.set(pk(path), []); }
  }
  async function toggleTree(path) {
    const k = pk(path);
    if (tree.open.has(k)) { tree.open.delete(k); renderSidebar(); return; }
    tree.open.add(k);
    renderSidebar();
    if (!tree.cache.has(k)) { await loadTreeChildren(path); renderSidebar(); }
  }
  async function revealInTree(path) {
    let changed = false;
    for (const a of crumbsOf(path).slice(0, -1)) {
      const k = pk(a.path);
      if (!tree.open.has(k)) { tree.open.add(k); changed = true; }
      if (!tree.cache.has(k)) { await loadTreeChildren(a.path); changed = true; }
    }
    if (changed && state.path === path) renderSidebar();
  }

  function afterLoad(select) {
    tabs[activeTab].path = state.path;
    if (!isVirtual()) tree.cache.set(pk(state.path), dirsOf(state.entries));
    render();
    if (select && select.length) selectPaths(select);
    renderCrumbs();
    renderSidebar();
    renderTabs();
    updateChrome();
    if (!isVirtual()) revealInTree(state.path);
  }

  const refresh = (select) => navigate(state.path, { push: false, silent: true, select });

  function setTitle() {
    const name = state.path === HOME ? t('place.home') : state.path ? baseName(state.path) : t('place.thispc');
    const title = name + ' - Material File';
    document.title = title;
    if (win && win.setTitle) Promise.resolve(win.setTitle(title)).catch(() => {});
  }

  /* ---------------------------------------------------------------------- tabs */
  const tabTitle = (p) => (p === HOME ? t('place.home') : p === null || p === '' ? t('place.thispc') : baseName(p));
  function renderTabs() {
    const box = $('#ftabs');
    box.classList.toggle('single', tabs.length === 1);
    box.innerHTML = tabs.map((tb, i) =>
      `<div class="ftab${i === activeTab ? ' active' : ''}${tb.isNew ? ' enter' : ''}" data-i="${i}" role="tab" title="${esc(tb.path || t('place.thispc'))}">` +
      `<svg class="fi c-folder"><use href="#f-folder"/></svg><span class="tt">${esc(tabTitle(tb.path))}</span>` +
      `<button class="ftab-x" data-close="${i}" tabindex="-1" title="${esc(t('tab.close'))}"><svg class="icon"><use href="#i-close"/></svg></button></div>`).join('');
    tabs.forEach((tb) => { tb.isNew = false; });
    const act = box.querySelector('.ftab.active');
    if (act) act.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  async function loadTab(i) {
    activeTab = i;
    const tb = tabs[i];
    state.back = tb.back;
    state.fwd = tb.fwd;
    state.path = null; // forces a clean load (selection, filter)
    renderTabs();
    const ok = await navigate(tb.path === null ? '' : tb.path, { push: false });
    if (!ok) await navigate('', { push: false });
  }

  async function newTab(path) {
    const start = path === undefined || path === null ? state.path || '' : path;
    tabs.push({ path: start, back: [], fwd: [], isNew: true });
    await loadTab(tabs.length - 1);
  }

  async function closeTab(i) {
    if (tabs.length === 1) return;
    tabs.splice(i, 1);
    const next = i < activeTab ? activeTab - 1 : Math.min(activeTab, tabs.length - 1);
    if (i === activeTab || next !== activeTab) await loadTab(next); else renderTabs();
  }

  async function switchTab(i) {
    if (i !== activeTab && tabs[i]) await loadTab(i);
  }

  /* ----------------------------------------------------------------- rendering */
  const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const COL_ORDER = ['modified', 'created', 'type', 'size'];
  const visibleCols = () => COL_ORDER.filter((c) => settings.cols.includes(c));
  const colLabel = (c) => (c === 'type' && state.search ? t('col.location') : t('col.' + c));
  function applyCols() {
    $('#content').style.setProperty('--cols', ['minmax(220px, 1fr)'].concat(visibleCols().map((c) => settings.colW[c] + 'px')).join(' '));
  }

  function cmp(a, b) {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let r = 0;
    switch (settings.sortKey) {
      case 'modified': r = (a.modified || 0) - (b.modified || 0); break;
      case 'created': r = (a.created || 0) - (b.created || 0); break;
      case 'type': r = coll.compare(typeLabel(a), typeLabel(b)); break;
      case 'size': r = a.size - b.size; break;
      default: r = 0;
    }
    if (r === 0) r = coll.compare(a.name, b.name);
    return settings.sortDir === 'asc' ? r : -r;
  }

  const KIND_CATS = { docs: ['doc', 'sheet', 'slide', 'text'], images: ['image'], video: ['video'], audio: ['audio'], archives: ['archive'], code: ['code', 'exe'] };
  function kindMatch(e) {
    const k = state.kind;
    if (k === 'all') return true;
    if (k === 'folders') return e.isDir;
    return e.isDir || KIND_CATS[k].includes(catOf(e)); // folders stay visible so you can keep navigating
  }

  function groupOf(e) {
    switch (settings.groupBy) {
      case 'name': {
        const c = (e.name[0] || '#').toUpperCase();
        const l = /\p{L}/u.test(c) ? c : '#';
        return { key: (l === '#' ? '0' : '1') + l, label: l };
      }
      case 'type': {
        const l = typeLabel(e);
        return { key: (e.isDir ? '0' : '1') + l.toLowerCase(), label: l };
      }
      case 'modified': {
        const day = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
        const diff = e.modified ? Math.round((day(Date.now()) - day(e.modified)) / 86400000) : 99999;
        const b = diff <= 0 ? 0 : diff === 1 ? 1 : diff < 7 ? 2 : diff < 30 ? 3 : diff < 365 ? 4 : 5;
        return { key: String(b), label: t(['grp.today', 'grp.yesterday', 'grp.week', 'grp.month', 'grp.year', 'grp.old'][b]) };
      }
      case 'size': {
        const s = e.size;
        const b = e.isDir ? 0 : s === 0 ? 1 : s < 16384 ? 2 : s < 1048576 ? 3 : s < 134217728 ? 4 : s < 1073741824 ? 5 : s < 4294967296 ? 6 : 7;
        return { key: String(b), label: t(['grp.unspecified', 'grp.empty', 'grp.tiny', 'grp.small', 'grp.medium', 'grp.large', 'grp.huge', 'grp.gigantic'][b]) };
      }
      default: return { key: '', label: '' };
    }
  }

  function computeView() {
    let list = state.entries;
    if (!settings.showHidden) list = list.filter((e) => !e.hidden);
    if (state.filter) { const q = state.filter.toLowerCase(); list = list.filter((e) => e.name.toLowerCase().includes(q)); }
    if (state.kind !== 'all') list = list.filter(kindMatch);
    list = list.slice().sort(cmp);
    state.groupAt = new Map();
    if (settings.groupBy !== 'none') {
      const keyed = list.map((e) => ({ e, g: groupOf(e) }));
      keyed.sort((a, b) => {
        const r = a.g.key < b.g.key ? -1 : a.g.key > b.g.key ? 1 : 0;
        return settings.sortDir === 'desc' ? -r : r;
      });
      list = keyed.map((k) => k.e);
      let prev = null;
      let cur = null;
      keyed.forEach((k, i) => {
        if (k.g.key !== prev) { prev = k.g.key; cur = { label: k.g.label, count: 0, start: i }; state.groupAt.set(i, cur); }
        cur.count++;
      });
    }
    state.view = list;
  }

  const tipOf = (e) => [e.name, typeLabel(e), e.isDir ? '' : fmtSize(e.size, true), fmtDate(e.modified)].filter(Boolean).join('\n');
  const checkHtml = () => (settings.showChecks ? '<span class="rk" data-chk="1"><svg class="icon"><use href="#i-check"/></svg></span>' : '');

  function cellHtml(e, c) {
    if (c === 'modified') return `<div>${fmtDate(e.modified)}</div>`;
    if (c === 'created') return `<div>${fmtDate(e.created)}</div>`;
    if (c === 'size') return `<div class="c-size">${e.isDir ? '' : fmtSize(e.size)}</div>`;
    return state.search ? `<div title="${esc(parentOf(e.path) || '')}">${esc(parentOf(e.path) || '')}</div>` : `<div>${esc(typeLabel(e))}</div>`;
  }

  function rowHtml(e, i, cutSet) {
    const cls = (cutSet.has(e.path) ? ' cut' : '') + (e.hidden ? ' hidden-item' : '');
    return `<div class="row${cls}" role="option" data-i="${i}" draggable="true" title="${esc(tipOf(e))}"><div class="c-name">${checkHtml()}${iconSvg(e)}<span class="nm">${esc(shownName(e))}</span></div>` +
      visibleCols().map((c) => cellHtml(e, c)).join('') + '</div>';
  }

  function tileHtml(e, i, cutSet) {
    const cls = (cutSet.has(e.path) ? ' cut' : '') + (e.hidden ? ' hidden-item' : '');
    const thumb = !e.isDir && convertFileSrc && THUMB_EXT.has(extOf(e.name)) && e.size < 8 * 1024 * 1024
      ? `<img loading="lazy" decoding="async" alt="" src="${esc(convertFileSrc(e.path))}">`
      : iconSvg(e);
    return `<div class="tile${cls}" role="option" data-i="${i}" draggable="true" title="${esc(tipOf(e))}">${checkHtml()}<div class="thumb">${thumb}</div><span class="nm">${esc(shownName(e))}</span></div>`;
  }

  function headerHtml() {
    const h = (id) => {
      const sorted = settings.sortKey === id ? ' sorted' + (settings.sortDir === 'desc' ? ' desc' : '') : '';
      return `<div class="hc${id === 'size' ? ' right' : ''}${sorted}" data-sort="${id}"><span>${esc(id === 'name' ? t('col.name') : colLabel(id))}</span>` +
        `<svg class="icon sort-ind"><use href="#i-chevron-up"/></svg>${id === 'name' ? '' : `<i class="rz" data-col="${id}"></i>`}</div>`;
    };
    return '<div class="list-head" id="list-head">' + h('name') + visibleCols().map(h).join('') + '</div>';
  }

  function renderThisPc(list) {
    list.className = 'list';
    list.innerHTML = `<div class="drives-title">${esc(t('sidebar.drives'))}</div><div class="drives">` + state.drives.map((d) => {
      const used = d.total ? Math.round(((d.total - d.free) / d.total) * 100) : 0;
      return `<button class="drive" data-path="${esc(d.path)}" title="${esc(d.path)}"><svg class="icon"><use href="#i-drive"/></svg><div class="meta">` +
        `<div class="dn">${esc(driveLabel(d))}</div><div class="bar"><i class="${used >= 90 ? 'full' : ''}" style="width:${used}%"></i></div>` +
        `<div class="ds">${esc(t('drive.free', { free: fmtSize(d.free, true), total: fmtSize(d.total, true) }))}</div></div></button>`;
    }).join('') + '</div>';
  }

  function renderHome(list) {
    list.className = 'list home';
    const card = (path, icon, label, sub, isFolder) =>
      `<button class="home-card" data-path="${esc(path)}" title="${esc(path)}">` +
      (isFolder ? '<svg class="fi c-folder"><use href="#f-folder"/></svg>' : `<svg class="icon"><use href="#${icon}"/></svg>`) +
      `<div class="meta"><div class="hn">${esc(label)}</div><div class="hs">${esc(sub)}</div></div></button>`;
    const parentLabel = (p) => parentOf(p) || t('place.thispc');
    let html = `<h3>${esc(t('home.quick'))}</h3><div class="home-grid">`;
    html += state.places.map((p) => card(p.path, PLACE_ICON[p.id] || 'i-folder', p.id === 'home' ? baseName(p.path) : t('place.' + p.id), p.path, false)).join('');
    html += settings.pinned.map((p) => card(p, 'i-pin', baseName(p), parentLabel(p), false)).join('');
    html += '</div>';

    const shown = new Set(state.places.map((p) => pk(p.path)).concat(settings.pinned.map(pk)));
    const frequent = Object.keys(settings.frequent).filter((p) => !shown.has(pk(p)))
      .sort((a, b) => settings.frequent[b] - settings.frequent[a]).slice(0, 8);
    if (frequent.length) {
      html += `<h3>${esc(t('home.frequent'))}</h3><div class="home-grid">` + frequent.map((p) => card(p, 'i-folder', baseName(p), parentLabel(p), true)).join('') + '</div>';
    }

    html += `<h3>${esc(t('home.recent'))}${settings.recent.length ? ` <button class="btn-text" data-act="clear-recent">${esc(t('home.clear'))}</button>` : ''}</h3>`;
    if (settings.recent.length) {
      html += '<div class="recent-list">' + settings.recent.map((r) => {
        const e = { name: baseName(r.path), isDir: false };
        return `<button class="recent-row" data-open="${esc(r.path)}" title="${esc(r.path)}"><div class="rn">${iconSvg(e)}<span>${esc(e.name)}</span></div>` +
          `<div class="rl">${esc(parentOf(r.path) || '')}</div><div class="rd">${esc(fmtDate(r.t))}</div></button>`;
      }).join('') + '</div>';
    } else {
      html += `<div class="home-empty">${esc(t('home.noRecent'))}</div>`;
    }

    html += `<h3>${esc(t('sidebar.drives'))}</h3><div class="drives">` + state.drives.map((d) => {
      const used = d.total ? Math.round(((d.total - d.free) / d.total) * 100) : 0;
      return `<button class="drive" data-path="${esc(d.path)}" title="${esc(d.path)}"><svg class="icon"><use href="#i-drive"/></svg><div class="meta">` +
        `<div class="dn">${esc(driveLabel(d))}</div><div class="bar"><i class="${used >= 90 ? 'full' : ''}" style="width:${used}%"></i></div>` +
        `<div class="ds">${esc(t('drive.free', { free: fmtSize(d.free, true), total: fmtSize(d.total, true) }))}</div></div></button>`;
    }).join('') + '</div>';
    list.innerHTML = html;
  }

  function render() {
    const content = $('#content');
    const list = $('#list');
    const virt = isVirtual();
    const grid = isGridView() && !virt;
    content.classList.toggle('grid-view', grid || virt);
    $('#empty').hidden = true;
    applyCols();

    if (virt) {
      state.view = [];
      state.groupAt = new Map();
      if (state.path === HOME) renderHome(list); else renderThisPc(list);
      updateStatus();
      renderDetails();
      return;
    }

    computeView();
    list.className = 'list' + (grid ? ' grid' + (settings.view === 'small' ? ' size-sm' : settings.view === 'large' ? ' size-lg' : '') : '');
    const cutSet = new Set(state.clip && state.clip.cut ? state.clip.paths : []);
    let html = grid ? '' : headerHtml();
    state.view.forEach((e, i) => {
      const g = state.groupAt.get(i);
      if (g) html += `<div class="grp" data-g="${g.start}" data-n="${g.count}"><span>${esc(g.label)}</span><span class="n">${g.count}</span></div>`;
      html += grid ? tileHtml(e, i, cutSet) : rowHtml(e, i, cutSet);
    });
    list.innerHTML = html;

    if (!state.view.length) {
      $('#empty-text').textContent = state.filter || state.search || state.kind !== 'all' ? t('empty.search') : t('empty.folder');
      $('#empty').hidden = false;
    }
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
    renderDetails();
  }

  function renderCrumbs() {
    const parts = state.path === HOME
      ? [{ label: t('place.home'), path: HOME }]
      : [{ label: t('place.thispc'), path: '' }].concat(crumbsOf(state.path || ''));
    $('#crumbs').innerHTML = parts.map((p, i) =>
      (i ? `<button class="crumb-arrow" data-arrow="${esc(parts[i - 1].path)}" tabindex="-1"><svg class="icon"><use href="#i-chevron"/></svg></button>` : '') +
      `<button class="crumb" data-path="${esc(p.path)}" title="${esc(p.path === HOME ? p.label : p.path || p.label)}"${p.path && p.path !== HOME ? ' data-drop="1"' : ''}><span>${esc(p.label)}</span></button>`).join('');
    const c = $('#crumbs');
    c.scrollLeft = c.scrollWidth; // keep the deepest folders visible
    c.classList.toggle('overflow', c.scrollWidth > c.clientWidth + 1);
  }

  const PLACE_ICON = { home: 'i-user', desktop: 'i-desktop', documents: 'i-documents', downloads: 'i-downloads', pictures: 'i-pictures', music: 'i-music', videos: 'i-videos' };

  function treeNode(path, icon, label, depth, opts = {}) {
    const k = pk(path);
    const kids = tree.cache.get(k);
    const expandable = !opts.flat && !(kids && kids.length === 0);
    const open = expandable && tree.open.has(k);
    const active = state.path !== null && samePath(path, state.path) ? ' active' : '';
    let html = `<div class="side-item${active}" data-path="${esc(path)}" title="${esc(path === HOME ? label : path || label)}" style="--d:${depth}"${opts.flat ? '' : ' data-drop="1"'}${opts.pinned ? ' data-pinned="1"' : ''}>` +
      (expandable ? `<span class="tree-toggle${open ? ' open' : ''}" data-toggle="${esc(path)}"><svg class="icon"><use href="#i-chevron"/></svg></span>` : '<span class="tree-spacer"></span>') +
      `<svg class="icon"><use href="#${icon}"/></svg><span class="lbl">${esc(label)}</span></div>`;
    if (open && kids) {
      html += kids.filter((c) => settings.showHidden || !c.hidden).map((c) => treeNode(c.path, 'i-folder', c.name, depth + 1)).join('');
    }
    return html;
  }

  function renderSidebar() {
    const side = $('#sidebar');
    side.hidden = !settings.showNav;
    const top = side.scrollTop;
    let html = treeNode(HOME, 'i-home', t('place.home'), 0, { flat: true });
    html += `<div class="side-title">${esc(t('sidebar.quick'))}</div>`;
    html += state.places.map((p) => treeNode(p.path, PLACE_ICON[p.id] || 'i-folder', p.id === 'home' ? baseName(p.path) : t('place.' + p.id), 0)).join('');
    html += settings.pinned.map((p) => treeNode(p, 'i-pin', baseName(p), 0, { pinned: true })).join('');
    html += '<div class="side-title"></div>' + treeNode('', 'i-pc', t('place.thispc'), 0, { flat: true });
    html += state.drives.map((d) => treeNode(d.path, 'i-drive', driveLabel(d), 1)).join('');
    html += `<div class="side-title"></div><div class="side-item" data-action="recycle" style="--d:0"><span class="tree-spacer"></span><svg class="icon"><use href="#i-trash"/></svg><span class="lbl">${esc(t('place.recycle'))}</span></div>`;
    side.innerHTML = html;
    side.scrollTop = top;
  }

  function updateChrome() {
    $('#btn-back').disabled = state.back.length === 0;
    $('#btn-forward').disabled = state.fwd.length === 0;
    $('#btn-up').disabled = state.path === null || isVirtual();
    $('#addr-copy').disabled = !state.path || isVirtual();
    $('#cmd-filter').classList.toggle('on', state.kind !== 'all');
    const folder = state.path ? baseName(state.path) : t('place.thispc');
    $('#search-input').placeholder = isVirtual() ? t('search.placeholder') : t('search.in', { folder });
    $('#search-input').disabled = isVirtual();
    $('#search-clear').hidden = !$('#search-input').value;
    $('#st-details').classList.toggle('active', !isGridView());
    $('#st-grid').classList.toggle('active', isGridView());
    $('#st-pane').classList.toggle('active', settings.showDetails);
    $('#view-use').setAttribute('href', isGridView() ? '#i-grid' : '#i-list');
    $('#details').hidden = !settings.showDetails;
    $('#sidebar').hidden = !settings.showNav;
    setTitle();
    updateCommands();
    updateStatus();
  }

  function selectedEntries() {
    return state.view.filter((e) => state.selected.has(e.path));
  }

  function updateCommands() {
    const sel = selectedEntries();
    const n = state.selected.size;
    const atPc = isVirtual() || state.path === null;
    $('#cmd-filter').disabled = atPc;
    $('#cmd-cut').disabled = n === 0;
    $('#cmd-copy').disabled = n === 0;
    $('#cmd-rename').disabled = n !== 1;
    $('#cmd-delete').disabled = n === 0;
    $('#cmd-paste').disabled = !state.clip || atPc;
    $('#cmd-undo').disabled = state.undo.length === 0;
    $('#cmd-new').disabled = atPc;
    $('#cmd-sort').disabled = atPc;
    $('#cmd-more').disabled = atPc;
    $('#cmd-props').disabled = state.path === null;
    $('#cmd-extract').hidden = !(sel.length === 1 && isArchive(sel[0]));
  }

  function updateStatus() {
    if (state.path === HOME) { $('#st-items').textContent = ''; $('#st-sel').textContent = ''; return; }
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

  /* -------------------------------------------------------------- details pane */
  let detailsToken = 0;
  function renderDetails() {
    const pane = $('#details');
    pane.hidden = !settings.showDetails;
    if (!settings.showDetails) return;
    const token = ++detailsToken;
    const sel = selectedEntries();
    const row = (k, v) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`;
    if (state.path === null || isVirtual() || sel.length === 0) {
      pane.innerHTML = `<div class="dp-empty"><svg class="fi c-folder"><use href="#f-folder"/></svg><div>${esc(t('details.empty'))}</div>` +
        (state.path && !isVirtual() ? `<div class="small">${esc(state.view.length === 1 ? t('status.item') : t('status.items', { n: state.view.length.toLocaleString() }))}</div>` : '') + '</div>';
      return;
    }
    if (sel.length > 1) {
      const bytes = sel.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0);
      pane.innerHTML = `<div class="dp-hero"><svg class="fi c-folder"><use href="#f-folder"/></svg></div><p class="dp-name">${esc(t('details.items', { n: sel.length.toLocaleString() }))}</p>` +
        `<div class="dp-grid">${row(t('props.size'), fmtSize(bytes, true))}</div>`;
      return;
    }
    const e = sel[0];
    const img = !e.isDir && convertFileSrc && THUMB_EXT.has(extOf(e.name)) && e.size < 40 * 1024 * 1024;
    pane.innerHTML = `<div class="dp-hero">${img ? `<img alt="" src="${esc(convertFileSrc(e.path))}">` : iconSvg(e)}</div>` +
      `<p class="dp-name">${esc(e.name)}</p><div class="dp-grid">` +
      row(t('props.type'), typeLabel(e)) + (e.isDir ? '' : row(t('props.size'), fmtSize(e.size, true))) +
      row(t('props.modified'), fmtDate(e.modified)) + row(t('props.created'), fmtDate(e.created)) +
      row(t('props.location'), parentOf(e.path) || t('place.thispc')) + '</div>';
    const cat = catOf(e);
    if (!e.isDir && (cat === 'text' || cat === 'code' || cat === 'file') && e.size < 4 * 1024 * 1024) {
      invoke('preview_text', { path: e.path }).then((txt) => {
        if (token !== detailsToken || !txt) return;
        const pre = document.createElement('pre');
        pre.className = 'dp-preview';
        pre.textContent = txt;
        pane.appendChild(pre);
      }).catch(() => {});
    }
  }
  $('#details').addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const sel = selectedEntries();
    if (sel.length === 1) { const tpl = document.createElement('template'); tpl.innerHTML = iconSvg(sel[0]); img.replaceWith(tpl.content.firstChild); }
  }, true);

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
    const kids = [...$('#list').children].filter((k) => k.dataset.i !== undefined);
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
  function addRecent(path) {
    settings.recent = [{ path, t: Date.now() }].concat(settings.recent.filter((r) => !samePath(r.path, path))).slice(0, 20);
    saveSettings();
    if (state.path === HOME) render();
  }

  async function openRecent(path) {
    try {
      await invoke('open_item', { path });
      addRecent(path);
    } catch (err) {
      settings.recent = settings.recent.filter((r) => !samePath(r.path, path));
      saveSettings();
      if (state.path === HOME) render();
      toast(errText(err));
    }
  }

  async function openEntry(e) {
    if (!e) return;
    if (e.isDir) { await navigate(e.path); return; }
    try { await invoke('open_item', { path: e.path }); addRecent(e.path); } catch (err) { toast(errText(err)); }
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
    let policy = 'rename';
    try {
      const conflicts = await invoke('check_conflicts', { sources, dest });
      if (conflicts.length) {
        const shown = conflicts.slice(0, 3).join(', ') + (conflicts.length > 3 ? ', …' : '');
        const choice = await choiceDialog({
          title: t('conflict.title'),
          message: t('conflict.msg', { n: conflicts.length, names: shown }),
          buttons: [
            { id: 'cancel', label: t('common.cancel'), cls: 'btn-text' },
            { id: 'skip', label: t('conflict.skip'), cls: 'btn-text' },
            { id: 'rename', label: t('conflict.both'), cls: 'btn-tonal' },
            { id: 'replace', label: t('conflict.replace'), cls: 'btn-filled' }
          ]
        });
        if (choice === 'cancel') return;
        policy = choice;
      }
    } catch { /* fall back to keeping both */ }
    setLoading(true);
    try {
      const created = await invoke('paste_items', { sources, dest, mv, policy });
      pushUndo(mv
        ? { type: 'move', pairs: sources.map((s, i) => ({ from: s, to: created[i] })).filter((p) => p.to && p.to !== p.from) }
        : { type: 'copy', paths: created });
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

  const NEW_NAMES = { folder: 'name.newFolder', text: 'name.newText', markdown: 'name.newMarkdown', json: 'name.newJson', html: 'name.newHtml', csv: 'name.newCsv' };
  async function newItem(kind) {
    if (!state.path || isVirtual()) return;
    if (kind === true) kind = 'folder';
    if (kind === false || !NEW_NAMES[kind]) kind = 'text';
    try {
      const p = await invoke('create_item', { dir: state.path, name: t(NEW_NAMES[kind]), isDir: kind === 'folder' });
      pushUndo({ type: 'create', paths: [p] });
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
          pushUndo({ type: 'rename', from: e.path, to: np });
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

  async function renameSelection() {
    const sel = selectedEntries();
    if (sel.length === 1) { beginRename(sel[0].path); return; }
    if (sel.length < 2) return;
    const base = await promptDialog({ title: t('rename.title', { n: sel.length }), label: t('rename.label'), value: '' });
    if (!base) return;
    setLoading(true);
    const pairs = [];
    try {
      for (let i = 0; i < sel.length; i++) {
        const e = sel[i];
        const dot = e.name.lastIndexOf('.');
        const ext = !e.isDir && dot > 0 ? e.name.slice(dot) : '';
        const to = await invoke('rename_item', { path: e.path, newName: `${base} (${i + 1})${ext}` });
        pairs.push({ from: e.path, to });
      }
    } catch (err) {
      toast(errText(err));
    } finally {
      if (pairs.length) pushUndo({ type: 'rename-many', pairs });
      setLoading(false);
      await refresh(pairs.map((p) => p.to));
    }
  }

  /* ---------------------------------------------------------------- properties */
  let propsToken = 0;
  const propRow = (k, v, copy) => `<div class="k">${esc(k)}</div>` + (copy
    ? `<div class="v with-copy"><span>${esc(v)}</span><button class="icon-btn small" data-copy="${esc(v)}" title="${esc(t('props.copy'))}"><svg class="icon"><use href="#i-copy-path"/></svg></button></div>`
    : `<div class="v">${esc(v)}</div>`);

  function drawProps(props) {
    const pending = props.some((p) => p.pending);
    const calc = t('props.calculating');
    const sum = (f) => props.reduce((s, p) => s + (p[f] || 0), 0);
    const bytes = sum('size');
    const sizeText = pending ? calc : `${fmtSize(bytes, true)} (${bytes.toLocaleString()} bytes)`;
    let html = '';
    if (props.length === 1) {
      const p = props[0];
      const parent = parentOf(p.path);
      html += `<div class="props-head">${iconSvg({ isDir: p.isDir, name: p.name })}<b>${esc(p.name)}</b></div>`;
      html += propRow(t('props.type'), typeLabel({ isDir: p.isDir, name: p.name }));
      html += propRow(t('props.location'), parent === '' || parent === null ? t('place.thispc') : parent, !!parent);
      html += propRow(t('props.path'), p.path, true);
      html += propRow(t('props.size'), sizeText);
      if (p.isDir) html += propRow(t('props.contains'), pending ? calc : t('props.containsVal', { files: (p.files || 0).toLocaleString(), folders: (p.folders || 0).toLocaleString() }));
      html += propRow(t('props.created'), fmtDate(p.created)) + propRow(t('props.modified'), fmtDate(p.modified));
      if (p.accessed) html += propRow(t('props.accessed'), fmtDate(p.accessed));
      const attrs = [p.readonly ? t('props.readonly') : '', p.hidden ? t('props.hidden') : ''].filter(Boolean).join(', ');
      if (attrs) html += propRow(t('props.attributes'), attrs);
    } else {
      html += `<div class="props-head"><b>${esc(t('props.items', { n: props.length }))}</b></div>`;
      html += propRow(t('props.size'), sizeText);
      html += propRow(t('props.contains'), pending ? calc : t('props.containsVal', { files: sum('files').toLocaleString(), folders: sum('folders').toLocaleString() }));
    }
    $('#props-body').innerHTML = html;
  }

  function showDriveProperties(d) {
    propsToken++;
    const used = d.total - d.free;
    const pct = d.total ? Math.round((used / d.total) * 100) : 0;
    $('#props-body').innerHTML =
      `<div class="props-head"><svg class="icon" style="width:36px;height:36px;color:var(--primary)"><use href="#i-drive"/></svg><b>${esc(driveLabel(d))}</b></div>` +
      propRow(t('props.path'), d.path, true) + propRow(t('props.fs'), d.fs || '—') +
      propRow(t('props.used'), `${fmtSize(used, true)} (${used.toLocaleString()} bytes)`) +
      propRow(t('props.freeSpace'), `${fmtSize(d.free, true)} (${d.free.toLocaleString()} bytes)`) +
      propRow(t('props.capacity'), `${fmtSize(d.total, true)} (${d.total.toLocaleString()} bytes)`) +
      `<div class="bar"><i style="width:${pct}%"></i></div>`;
    $('#dlg-props').showModal();
  }

  async function showProperties() {
    const sel = selectedEntries();
    let targets;
    if (sel.length) {
      targets = sel.map((e) => ({ path: e.path, name: e.name, isDir: e.isDir, size: e.size, created: e.created, modified: e.modified, hidden: e.hidden, readonly: e.readonly, pending: e.isDir }));
    } else if (state.path && !isVirtual()) {
      targets = [{ path: state.path, name: baseName(state.path), isDir: true, size: 0, pending: true }];
    } else {
      return;
    }
    if (targets.length === 1 && parentOf(targets[0].path) === '') {
      const drive = state.drives.find((x) => samePath(x.path, targets[0].path));
      if (drive) { showDriveProperties(drive); return; } // never walk a whole drive
    }
    const token = ++propsToken;
    drawProps(targets);
    $('#dlg-props').showModal();
    // folders: show the dialog right away, then fill in the (possibly slow) totals
    const full = await Promise.all(targets.map((x) => (x.pending ? invoke('item_properties', { path: x.path }).catch(() => null) : null)));
    if (token !== propsToken || !$('#dlg-props').open) return;
    drawProps(targets.map((x, i) => Object.assign({}, x, full[i] || {}, { pending: false })));
  }
  $('#props-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) copyText(b.dataset.copy);
  });

  /* ---------------------------------------------------- undo, tools, archives */
  function pushUndo(op) {
    state.undo.push(op);
    if (state.undo.length > 30) state.undo.shift();
    updateCommands();
  }

  async function undoLast() {
    const op = state.undo.pop();
    updateCommands();
    if (!op) { toast(t('msg.nothingUndo')); return; }
    setLoading(true);
    try {
      if (op.type === 'rename') await invoke('rename_item', { path: op.to, newName: baseName(op.from) });
      else if (op.type === 'rename-many') for (const p of op.pairs.slice().reverse()) await invoke('rename_item', { path: p.to, newName: baseName(p.from) });
      else if (op.type === 'move') for (const p of op.pairs) await invoke('paste_items', { sources: [p.to], dest: parentOf(p.from), mv: true, policy: 'rename' });
      else await invoke('delete_items', { paths: op.paths, permanent: false });
      toast(t('msg.undone'));
    } catch (err) {
      toast(errText(err));
    } finally {
      setLoading(false);
      await refresh();
    }
  }

  async function openWith(tool, path) {
    try { await invoke('open_with', { tool, path }); } catch (err) { toast(errText(err)); }
  }
  const revealItem = (path) => invoke('reveal_item', { path }).catch((err) => toast(errText(err)));
  const openRecycle = () => invoke('open_item', { path: 'shell:RecycleBinFolder' }).catch((err) => toast(errText(err)));

  async function extractArchive(entry, toFolder) {
    if (!entry) return;
    setLoading(true);
    try {
      const out = await invoke('extract_archive', { path: entry.path, dest: parentOf(entry.path) || state.path, toFolder });
      toast(t('msg.extracted'));
      await refresh(toFolder ? [out] : undefined);
    } catch (err) {
      toast(errText(err));
    } finally {
      setLoading(false);
    }
  }

  async function compressSelection(kind) {
    const sel = selectedEntries();
    if (!sel.length || !state.path) return;
    const name = sel.length === 1 ? (sel[0].isDir ? sel[0].name : stripExt(sel[0].name)) : baseName(state.path) || 'Archive';
    setLoading(true);
    try {
      const out = await invoke('compress_items', { paths: sel.map((e) => e.path), destDir: state.path, name, kind });
      pushUndo({ type: 'create', paths: [out] });
      toast(t('msg.compressed'));
      await refresh([out]);
    } catch (err) {
      toast(errText(err));
    } finally {
      setLoading(false);
    }
  }

  function copyPaths() {
    const sel = selectedEntries();
    const list = sel.length ? sel.map((e) => `"${e.path}"`) : state.path ? [`"${state.path}"`] : [];
    if (list.length) copyText(list.join('\n'));
  }

  const isPinned = (p) => settings.pinned.some((x) => samePath(x, p));
  function togglePin(p) {
    settings.pinned = isPinned(p) ? settings.pinned.filter((x) => !samePath(x, p)) : settings.pinned.concat(p);
    saveSettings();
    renderSidebar();
    if (state.path === HOME) render();
  }

  function selectGroup(start, n, additive) {
    if (!additive) state.selected.clear();
    for (let k = start; k < start + n && k < state.view.length; k++) state.selected.add(state.view[k].path);
    state.anchor = start;
    state.focus = start;
    refreshSelectionUi();
  }

  function selectNone() { clearSelection(); }
  function invertSelection() {
    const next = new Set();
    state.view.forEach((e) => { if (!state.selected.has(e.path)) next.add(e.path); });
    state.selected = next;
    refreshSelectionUi();
  }

  async function showSubfolderMenu(btn, path) {
    let items = [];
    try {
      if (path === '') {
        items = state.drives.map((d) => ({ label: driveLabel(d), icon: 'i-drive', run: () => navigate(d.path) }));
      } else {
        const list = await invoke('list_dir', { path });
        items = list.filter((e) => e.isDir && (settings.showHidden || !e.hidden))
          .sort((a, b) => coll.compare(a.name, b.name)).slice(0, 300)
          .map((e) => ({ label: e.name, icon: 'i-folder', run: () => navigate(e.path) }));
      }
    } catch { return; }
    if (items.length) menuBelow(btn, items);
  }

  /* --------------------------------------------------------------- menus content */
  function newMenuItems() {
    return [
      { label: t('new.folder'), icon: 'i-folder-plus', kbd: 'Ctrl+Shift+N', run: () => newItem('folder') },
      { label: t('new.text'), icon: 'i-file-plus', run: () => newItem('text') },
      { sep: true },
      { label: t('new.markdown'), icon: 'i-file-plus', run: () => newItem('markdown') },
      { label: t('new.json'), icon: 'i-file-plus', run: () => newItem('json') },
      { label: t('new.html'), icon: 'i-file-plus', run: () => newItem('html') },
      { label: t('new.csv'), icon: 'i-file-plus', run: () => newItem('csv') }
    ];
  }
  function groupMenuItems() {
    return ['none', 'name', 'type', 'modified', 'size'].map((g) => ({ label: t('group.' + g), check: settings.groupBy === g, run: () => setGroup(g) }));
  }
  function sortMenuItems() {
    return ['name', 'modified', 'created', 'type', 'size'].map((k) => ({ label: t('sort.' + k), check: settings.sortKey === k, run: () => setSort(k, settings.sortDir) }))
      .concat([{ sep: true },
        { label: t('sort.asc'), check: settings.sortDir === 'asc', run: () => setSort(settings.sortKey, 'asc') },
        { label: t('sort.desc'), check: settings.sortDir === 'desc', run: () => setSort(settings.sortKey, 'desc') },
        { sep: true },
        { label: t('cmd.groupBy'), icon: 'i-list', items: groupMenuItems() }]);
  }
  function columnMenuItems() {
    return COL_ORDER.map((c) => ({ label: t('col.' + c), check: settings.cols.includes(c), run: () => toggleCol(c) }));
  }
  function filterMenuItems() {
    return ['all', 'folders', 'docs', 'images', 'video', 'audio', 'archives', 'code'].map((k) => ({ label: t('filter.' + k), check: state.kind === k, run: () => setKind(k) }));
  }
  function viewMenuItems(withShow = true) {
    const items = [
      { label: t('view.details'), icon: 'i-list', check: settings.view === 'details', kbd: 'Ctrl+1', run: () => setView('details') },
      { label: t('view.large'), icon: 'i-grid', check: settings.view === 'large', run: () => setView('large') },
      { label: t('view.medium'), icon: 'i-grid', check: settings.view === 'grid', kbd: 'Ctrl+2', run: () => setView('grid') },
      { label: t('view.small'), icon: 'i-grid', check: settings.view === 'small', run: () => setView('small') }
    ];
    if (withShow) {
      items.push({ sep: true },
        { label: t('cmd.columns'), icon: 'i-list', items: columnMenuItems() },
        { label: t('cmd.show'), icon: 'i-select', items: [
          { label: t('view.nav'), check: settings.showNav, run: () => setFlag('showNav', !settings.showNav) },
          { label: t('view.detailsPane'), check: settings.showDetails, kbd: 'Alt+P', run: () => setFlag('showDetails', !settings.showDetails) },
          { label: t('view.checks'), check: settings.showChecks, run: () => setFlag('showChecks', !settings.showChecks) },
          { label: t('view.ext'), check: settings.showExt, run: () => setFlag('showExt', !settings.showExt) },
          { label: t('view.hidden'), check: settings.showHidden, run: () => setFlag('showHidden', !settings.showHidden) }
        ] });
    }
    return items;
  }
  function moreMenuItems() {
    return [
      { label: t('cmd.selectAll'), icon: 'i-select', kbd: 'Ctrl+A', run: selectAll },
      { label: t('cmd.selectNone'), icon: 'i-select', run: selectNone },
      { label: t('cmd.invert'), icon: 'i-select', run: invertSelection },
      { sep: true },
      { label: t('view.fullscreen'), icon: 'i-fullscreen', kbd: 'F11', run: toggleFullscreen },
      { label: t('toolbar.settings'), icon: 'i-settings', kbd: 'Ctrl+,', run: () => openSettings() }
    ];
  }

  function toolItems(path, isDir) {
    const T = state.tools;
    const items = [];
    if (isDir) {
      items.push({ label: t('cmd.openTerminal'), icon: 'i-terminal', run: () => openWith('terminal', path) });
      if (T.code) items.push({ label: t('cmd.openCode'), icon: 'i-code', run: () => openWith('code', path) });
    }
    return items;
  }

  function itemMenuItems() {
    const sel = selectedEntries();
    const one = sel.length === 1 ? sel[0] : null;
    const T = state.tools;
    const items = [{ label: t('cmd.open'), icon: 'i-open', kbd: 'Enter', run: openSelection }];

    if (one && one.isDir) {
      items.push({ label: t('cmd.openNewTab'), icon: 'i-plus', run: () => newTab(one.path) });
      items.push(...toolItems(one.path, true));
    }
    if (one && !one.isDir) {
      const w = [];
      if (T.code) w.push({ label: 'Visual Studio Code', icon: 'i-code', run: () => openWith('code', one.path) });
      w.push({ label: t('cmd.openNotepad'), icon: 'i-documents', run: () => openWith('notepad', one.path) });
      if (T.winrar && isArchive(one)) w.push({ label: 'WinRAR', icon: 'i-archive', run: () => openWith('winrar', one.path) });
      items.push({ label: t('cmd.openWith'), icon: 'i-open', items: w });
    }
    if (one && state.search) {
      items.push({ label: t('cmd.openLocation'), icon: 'i-folder', run: () => navigate(parentOf(one.path) || '', { select: [one.path] }) });
    }
    if (one) items.push({ label: t('cmd.reveal'), icon: 'i-desktop', run: () => revealItem(one.path) });

    if (one && isArchive(one)) {
      items.push({ sep: true },
        { label: t('cmd.extractHere'), icon: 'i-archive', run: () => extractArchive(one, false) },
        { label: t('cmd.extractTo', { name: stripExt(one.name) }), icon: 'i-archive', run: () => extractArchive(one, true) });
    }
    if (state.path && !state.search) {
      const c = [{ label: t('cmd.zip'), icon: 'i-archive', run: () => compressSelection('zip') }];
      if (T.winrar) c.push({ label: t('cmd.rar'), icon: 'i-archive', run: () => compressSelection('rar') });
      items.push({ label: t('cmd.compress'), icon: 'i-archive', items: c });
    }
    if (one && one.isDir) {
      items.push({ label: isPinned(one.path) ? t('cmd.unpin') : t('cmd.pin'), icon: 'i-pin', run: () => togglePin(one.path) });
    }
    items.push({ sep: true },
      { label: t('cmd.cut'), icon: 'i-cut', kbd: 'Ctrl+X', run: () => copyToClipboard(true) },
      { label: t('cmd.copy'), icon: 'i-copy', kbd: 'Ctrl+C', run: () => copyToClipboard(false) },
      { label: t('cmd.copyPath'), icon: 'i-copy-path', kbd: 'Ctrl+Shift+C', run: copyPaths },
      { sep: true },
      { label: t('cmd.rename'), icon: 'i-rename', kbd: 'F2', disabled: !one, run: renameSelection },
      { label: t('cmd.delete'), icon: 'i-trash', kbd: 'Del', run: () => deleteSelection(false) },
      { sep: true },
      { label: t('cmd.properties'), icon: 'i-info', kbd: 'Alt+Enter', run: showProperties });
    return items;
  }

  function backgroundMenuItems() {
    if (isVirtual()) return [{ label: t('nav.refresh'), icon: 'i-refresh', kbd: 'F5', run: () => refresh() }];
    const items = [
      { label: t('cmd.view'), icon: 'i-grid', items: viewMenuItems(true) },
      { label: t('cmd.sortBy'), icon: 'i-sort', items: sortMenuItems() },
      { label: t('nav.refresh'), icon: 'i-refresh', kbd: 'F5', run: () => refresh() },
      { sep: true },
      { label: t('cmd.new'), icon: 'i-plus', items: newMenuItems() },
      { sep: true },
      { label: t('cmd.paste'), icon: 'i-paste', kbd: 'Ctrl+V', disabled: !state.clip, run: pasteClipboard },
      { label: t('cmd.undo'), icon: 'i-undo', kbd: 'Ctrl+Z', disabled: state.undo.length === 0, run: undoLast },
      { sep: true }
    ];
    items.push(...toolItems(state.path, true));
    items.push({ label: t('cmd.openNewTab'), icon: 'i-plus', run: () => newTab(state.path) },
      { label: isPinned(state.path) ? t('cmd.unpin') : t('cmd.pin'), icon: 'i-pin', run: () => togglePin(state.path) },
      { label: t('cmd.copyPathBtn'), icon: 'i-copy-path', run: () => copyText(state.path) },
      { sep: true },
      { label: t('cmd.selectAll'), icon: 'i-select', kbd: 'Ctrl+A', run: selectAll },
      { label: t('cmd.properties'), icon: 'i-info', run: showProperties });
    return items;
  }

  function sidebarMenuItems(btn) {
    const path = btn.dataset.path;
    if (!path || path === HOME) return [{ label: t('cmd.open'), icon: 'i-open', run: () => navigate(path || '') }];
    const items = [
      { label: t('cmd.open'), icon: 'i-open', run: () => navigate(path) },
      { label: t('cmd.openNewTab'), icon: 'i-plus', run: () => newTab(path) },
      ...toolItems(path, true),
      { sep: true },
      { label: isPinned(path) ? t('cmd.unpin') : t('cmd.pin'), icon: 'i-pin', run: () => togglePin(path) },
      { label: t('cmd.copyPathBtn'), icon: 'i-copy-path', run: () => copyText(path) }
    ];
    const drive = state.drives.find((x) => samePath(x.path, path));
    if (drive) items.push({ sep: true }, { label: t('cmd.properties'), icon: 'i-info', run: () => showDriveProperties(drive) });
    return items;
  }

  function setGroup(g) { settings.groupBy = g; saveSettings(); render(); }
  function setKind(k) { state.kind = k; render(); updateChrome(); }
  function toggleCol(c) {
    settings.cols = settings.cols.includes(c) ? settings.cols.filter((x) => x !== c) : settings.cols.concat(c);
    saveSettings();
    render();
  }
  function setSort(key, dir) { settings.sortKey = key; settings.sortDir = dir; saveSettings(); render(); }
  function setView(v) { settings.view = v; saveSettings(); render(); updateChrome(); syncSettingsUi(); }
  function setFlag(key, on) {
    settings[key] = on;
    saveSettings();
    render();
    renderSidebar();
    updateChrome();
    syncSettingsUi();
  }
  const setShowHidden = (on) => setFlag('showHidden', on);
  async function toggleFullscreen() {
    if (!win || !win.isFullscreen) return;
    try { await win.setFullscreen(!(await win.isFullscreen())); } catch {}
  }

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
    addressInput.value = isVirtual() ? '' : state.path || '';
    addressInput.focus();
    addressInput.select();
  }
  function endAddressEdit() { addressInput.hidden = true; }
  $('#address').addEventListener('click', (e) => {
    if (e.target.closest('.crumb, .crumb-arrow, .addr-copy') || !addressInput.hidden) return;
    beginAddressEdit();
  });
  addressInput.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { endAddressEdit(); $('#list').focus(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const v = addressInput.value.trim().replace(/^"|"$/g, '');
      endAddressEdit();
      if (v === '') await navigate(HOME);
      else if (v.toLowerCase() === 'this pc' || v.toLowerCase() === 'máy tính này') await navigate('');
      else await navigate(v);
      $('#list').focus();
    }
  });
  addressInput.addEventListener('blur', endAddressEdit);

  /* --------------------------------------------------------------- list events */
  const listEl = $('#list');
  let justMarquee = false;

  listEl.addEventListener('click', (e) => {
    if (e.target.closest('.rz')) return;
    const hc = e.target.closest('.hc');
    if (hc) { const k = hc.dataset.sort; setSort(k, settings.sortKey === k && settings.sortDir === 'asc' ? 'desc' : 'asc'); return; }
    const drive = e.target.closest('.drive');
    if (drive) { navigate(drive.dataset.path); return; }
    const card = e.target.closest('.home-card');
    if (card) { navigate(card.dataset.path); return; }
    const rec = e.target.closest('.recent-row');
    if (rec) { openRecent(rec.dataset.open); return; }
    if (e.target.closest('[data-act="clear-recent"]')) { settings.recent = []; saveSettings(); render(); return; }
    const grp = e.target.closest('.grp');
    if (grp) { selectGroup(+grp.dataset.g, +grp.dataset.n, e.ctrlKey || e.metaKey); return; }
    const chk = e.target.closest('.rk');
    if (chk) { const host = chk.closest('[data-i]'); if (host) selectIndex(+host.dataset.i, { ctrl: true }); return; }
    const el = e.target.closest('[data-i]');
    if (justMarquee) { justMarquee = false; return; }
    if (!el) { if (!e.ctrlKey && !e.metaKey) clearSelection(); return; }
    selectIndex(+el.dataset.i, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
  });
  listEl.addEventListener('dblclick', (e) => {
    const el = e.target.closest('[data-i]');
    if (el) openEntry(state.view[+el.dataset.i]);
  });
  listEl.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    const el = e.target.closest('[data-i]');
    const en = el && state.view[+el.dataset.i];
    if (en && en.isDir) { e.preventDefault(); newTab(en.path); }
  });
  listEl.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

  /* rubber-band selection */
  let mq = null;
  listEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isVirtual() || state.renaming || !state.view.length) return;
    if (e.target.closest('[data-i], .drive, .rename-input, .list-head, .grp, .home-card, .recent-row, .home h3')) return;
    const rect = listEl.getBoundingClientRect();
    if (e.clientX > rect.right - 16 || e.clientY > rect.bottom - 16) return; // scrollbars
    listEl.focus({ preventScroll: true });
    mq = {
      x0: e.clientX - rect.left + listEl.scrollLeft, y0: e.clientY - rect.top + listEl.scrollTop,
      base: e.ctrlKey || e.metaKey ? new Set(state.selected) : new Set(), el: null, raf: 0
    };
  });
  document.addEventListener('mousemove', (e) => {
    if (!mq) return;
    const rect = listEl.getBoundingClientRect();
    const x1 = e.clientX - rect.left + listEl.scrollLeft;
    const y1 = e.clientY - rect.top + listEl.scrollTop;
    if (!mq.el) {
      if (Math.abs(x1 - mq.x0) + Math.abs(y1 - mq.y0) < 6) return;
      mq.el = document.createElement('div');
      mq.el.className = 'marquee';
      listEl.appendChild(mq.el);
    }
    const left = Math.min(mq.x0, x1), top = Math.min(mq.y0, y1);
    const w = Math.abs(x1 - mq.x0), h = Math.abs(y1 - mq.y0);
    Object.assign(mq.el.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
    if (mq.raf) return;
    mq.raf = requestAnimationFrame(() => {
      if (!mq) return;
      mq.raf = 0;
      const next = new Set(mq.base);
      for (const el of listEl.children) {
        if (!el.dataset.i) continue;
        const hit = el.offsetLeft < left + w && el.offsetLeft + el.offsetWidth > left && el.offsetTop < top + h && el.offsetTop + el.offsetHeight > top;
        if (hit) next.add(state.view[+el.dataset.i].path);
      }
      state.selected = next;
      state.focus = -1;
      refreshSelectionUi();
    });
  });
  document.addEventListener('mouseup', () => {
    if (!mq) return;
    if (mq.el) { mq.el.remove(); justMarquee = true; setTimeout(() => { justMarquee = false; }, 0); }
    mq = null;
  });

  $('#content').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.path === null) return;
    const card = e.target.closest('.drive, .home-card');
    if (card) { showMenu(sidebarMenuItems(card), e.clientX, e.clientY); return; }
    if (e.target.closest('.hc')) { showMenu(columnMenuItems(), e.clientX, e.clientY); return; }
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
  $('#sidebar').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const b = e.target.closest('.side-item[data-path]');
    if (b) showMenu(sidebarMenuItems(b), e.clientX, e.clientY);
  });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('#content, #sidebar, input')) e.preventDefault(); });

  // image thumbnails that fail to load fall back to the file icon
  listEl.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const host = img.closest('[data-i]');
    const entry = host && state.view[+host.dataset.i];
    if (entry) { const tpl = document.createElement('template'); tpl.innerHTML = iconSvg(entry); img.replaceWith(tpl.content.firstChild); }
  }, true);

  /* column resizing (drag the handle on the right edge of a header cell) */
  const COL_MIN = 70;
  listEl.addEventListener('pointerdown', (e) => {
    const rz = e.target.closest('.rz');
    if (!rz) return;
    e.preventDefault();
    e.stopPropagation();
    const col = rz.dataset.col;
    const startX = e.clientX;
    const start = settings.colW[col];
    rz.classList.add('drag');
    rz.setPointerCapture(e.pointerId);
    const move = (ev) => { settings.colW[col] = Math.max(COL_MIN, Math.min(600, Math.round(start + ev.clientX - startX))); applyCols(); };
    const up = () => {
      rz.classList.remove('drag');
      rz.removeEventListener('pointermove', move);
      rz.removeEventListener('pointerup', up);
      saveSettings();
    };
    rz.addEventListener('pointermove', move);
    rz.addEventListener('pointerup', up);
  });

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
    const tg = e.target.closest('.tree-toggle');
    if (tg) { e.stopPropagation(); toggleTree(tg.dataset.toggle); return; }
    const b = e.target.closest('.side-item');
    if (!b) return;
    if (b.dataset.action === 'recycle') openRecycle(); else navigate(b.dataset.path);
  });
  $('#sidebar').addEventListener('auxclick', (e) => {
    const b = e.target.closest('.side-item[data-path]');
    if (e.button === 1 && b && b.dataset.path) newTab(b.dataset.path);
  });
  $('#crumbs').addEventListener('click', (e) => {
    const arrow = e.target.closest('.crumb-arrow');
    if (arrow) { showSubfolderMenu(arrow, arrow.dataset.arrow); return; }
    const b = e.target.closest('.crumb');
    if (b) navigate(b.dataset.path);
  });
  $('#addr-copy').addEventListener('click', () => { if (state.path) copyText(state.path); });
  window.addEventListener('resize', () => { const c = $('#crumbs'); c.scrollLeft = c.scrollWidth; c.classList.toggle('overflow', c.scrollWidth > c.clientWidth + 1); });

  /* tabs */
  $('#btn-newtab').addEventListener('click', () => newTab());
  $('#ftabs').addEventListener('click', (e) => {
    const x = e.target.closest('.ftab-x');
    if (x) { e.stopPropagation(); closeTab(+x.dataset.close); return; }
    const tab = e.target.closest('.ftab');
    if (tab) switchTab(+tab.dataset.i);
  });
  $('#ftabs').addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;
    const tab = e.target.closest('.ftab');
    if (tab) { e.preventDefault(); closeTab(+tab.dataset.i); }
  });

  /* nav buttons + command bar */
  async function jumpHistory(kind, idx) {
    const from = state.path;
    const snapBack = state.back.slice();
    const snapFwd = state.fwd.slice();
    let target;
    if (kind === 'back') {
      target = state.back[idx];
      const nearer = state.back.slice(idx + 1).reverse();
      state.back.length = idx;
      state.fwd.push(from, ...nearer);
    } else {
      target = state.fwd[idx];
      const nearer = state.fwd.slice(idx + 1).reverse();
      state.fwd.length = idx;
      state.back.push(from, ...nearer);
    }
    if (!(await navigate(target, { push: false }))) {
      state.back.length = 0; state.back.push(...snapBack);
      state.fwd.length = 0; state.fwd.push(...snapFwd);
    }
    updateChrome();
  }
  const historyItems = (kind) => (kind === 'back' ? state.back : state.fwd)
    .map((p, i) => ({ label: p === HOME || p === '' ? tabTitle(p) : p, icon: 'i-folder', run: () => jumpHistory(kind, i) })).reverse().slice(0, 15);
  $('#btn-back').addEventListener('contextmenu', (e) => { e.preventDefault(); const items = historyItems('back'); if (items.length) menuBelow(e.currentTarget, items); });
  $('#btn-forward').addEventListener('contextmenu', (e) => { e.preventDefault(); const items = historyItems('fwd'); if (items.length) menuBelow(e.currentTarget, items); });

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
  $('#cmd-filter').addEventListener('click', (e) => menuBelow(e.currentTarget, filterMenuItems()));
  $('#cmd-more').addEventListener('click', (e) => menuBelow(e.currentTarget, moreMenuItems()));
  $('#cmd-undo').addEventListener('click', undoLast);
  $('#cmd-extract').addEventListener('click', () => { const s = selectedEntries(); if (s.length === 1) extractArchive(s[0], true); });
  $('#st-pane').addEventListener('click', () => setFlag('showDetails', !settings.showDetails));
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
    if (mod && k === 'c') { e.preventDefault(); if (e.shiftKey) copyPaths(); else copyToClipboard(false); return; }
    if (mod && k === 'z') { e.preventDefault(); undoLast(); return; }
    if (mod && k === 't') { e.preventDefault(); newTab(); return; }
    if (mod && k === 'w') { e.preventDefault(); closeTab(activeTab); return; }
    if (mod && e.key === 'Tab') { e.preventDefault(); switchTab((activeTab + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length); return; }
    if (e.altKey && k === 'p') { e.preventDefault(); setFlag('showDetails', !settings.showDetails); return; }
    if (mod && k === 'x') { e.preventDefault(); copyToClipboard(true); return; }
    if (mod && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (mod && e.shiftKey && k === 'n') { e.preventDefault(); newItem(true); return; }
    if (mod && k === '1') { e.preventDefault(); setView('details'); return; }
    if (mod && k === '2') { e.preventDefault(); setView('grid'); return; }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === 'F2') { e.preventDefault(); renameSelection(); return; }
    if (e.key === 'Delete') { e.preventDefault(); deleteSelection(e.shiftKey); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (e.altKey) showProperties(); else openSelection(); return; }

    const grid = isGridView();
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
    document.querySelectorAll('#seg-view input').forEach((i) => { i.checked = isGridView() ? i.value === 'grid' : i.value === 'details'; });
    $('#seed-input').value = /^#[0-9a-f]{6}$/i.test(settings.seed) ? settings.seed.toLowerCase() : '#6750a4';
    $('#set-hidden').checked = settings.showHidden;
    $('#set-ext').checked = settings.showExt;
    $('#set-fullscreen').checked = settings.startFullscreen;
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
    renderTabs();
    if (state.path !== null) { render(); renderCrumbs(); renderSidebar(); updateChrome(); }
  }

  document.querySelectorAll('#seg-theme input').forEach((i) => i.addEventListener('change', () => { settings.theme = i.value; saveSettings(); applyTheme(); }));
  document.querySelectorAll('#seg-lang input').forEach((i) => i.addEventListener('change', () => { settings.lang = i.value; saveSettings(); applyLanguage(); }));
  document.querySelectorAll('#seg-view input').forEach((i) => i.addEventListener('change', () => setView(i.value)));
  $('#seed-input').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); applyTheme(); renderSwatches(); });
  $('#set-hidden').addEventListener('change', (e) => setShowHidden(e.target.checked));
  $('#set-ext').addEventListener('change', (e) => setFlag('showExt', e.target.checked));
  $('#set-fullscreen').addEventListener('change', (e) => { settings.startFullscreen = e.target.checked; saveSettings(); if (win && win.setFullscreen) Promise.resolve(win.setFullscreen(e.target.checked)).catch(() => {}); });
  $('#set-confirm').addEventListener('change', (e) => { settings.confirmDelete = e.target.checked; saveSettings(); });
  $('#btn-reset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS, {
      lang: I18n.detect(), pinned: settings.pinned, recent: settings.recent, frequent: settings.frequent,
      cols: ['modified', 'type', 'size'], colW: { modified: 170, created: 170, type: 160, size: 100 }
    });
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
  const RIPPLE_HOSTS = '.btn-text, .btn-tonal, .btn-filled, .icon-btn, .cmd-btn, .side-item, .crumb, .crumb-arrow, .menu-item, .segmented span, .status-btn';
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
    renderTabs();
    updateChrome();

    // "always start in full screen" option (window size/position are restored by the Rust plugin)
    if (settings.startFullscreen && win && win.setFullscreen) {
      try { await win.setFullscreen(true); } catch {}
    }

    // reveal the (initially hidden) window after the first paint
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('booting');
      if (win && win.show) Promise.resolve(win.show()).catch(() => {});
    }));

    if (!invoke) return;
    const [places, drives, start, tools] = await Promise.all([
      invoke('get_places').catch(() => []),
      invoke('get_drives').catch(() => []),
      invoke('startup_path').catch(() => null),
      invoke('tools_available').catch(() => state.tools)
    ]);
    state.places = places;
    state.drives = drives;
    state.tools = tools;
    const ok = await navigate(start || HOME, { push: false });
    if (!ok) await navigate('', { push: false });
    listEl.focus({ preventScroll: true });
  }

  init();
})();

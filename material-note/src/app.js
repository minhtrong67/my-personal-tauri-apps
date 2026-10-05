/* Material Note - application logic
 * Author: minhtrong67 (with the support of Claude, an AI assistant by Anthropic)
 */
(() => {
  'use strict';

  const { t } = I18n;
  const TAURI = window.__TAURI__ || {};
  const invoke = TAURI.core && TAURI.core.invoke;
  const dialogApi = TAURI.dialog || null;
  const win = TAURI.window && TAURI.window.getCurrentWindow ? TAURI.window.getCurrentWindow() : null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const isWin = /Win/i.test(navigator.platform);
  const DEFAULT_EOL = isWin ? 'crlf' : 'lf';

  /* ------------------------------------------------------------------ settings */
  const SETTINGS_KEY = 'material-note.settings';
  const SESSION_KEY = 'material-note.session';
  const DEFAULTS = {
    theme: 'system', seed: '#6750A4', lang: null, font: 'system', fontSize: 16,
    wrap: true, tabLayout: 'horizontal', statusBar: true, spellcheck: false, restore: true, zoom: 100
  };
  const FONTS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "Cascadia Mono", "SF Mono", Consolas, "Liberation Mono", monospace',
    serif: 'ui-serif, Georgia, "Times New Roman", serif'
  };

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }
  const settings = Object.assign({}, DEFAULTS, readJson(SETTINGS_KEY) || {});
  if (!settings.lang) settings.lang = I18n.detect();
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

  /* --------------------------------------------------------------------- state */
  const tabs = [];
  let activeId = null;
  let seq = 0;
  let untitledSeq = 0;

  const active = () => tabs.find((x) => x.id === activeId) || null;
  const byId = (id) => tabs.find((x) => x.id === id) || null;
  const baseName = (p) => p.split(/[\\/]/).pop();
  const samePath = (a, b) => (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);
  const isDirty = (tab) => tab.ta.value !== tab.saved || tab.forced;
  const tabName = (tab) => (tab.path ? baseName(tab.path) : t('untitled') + (tab.untitled > 1 ? ' ' + tab.untitled : ''));

  /* --------------------------------------------------------------------- toast */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#snackbar');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ------------------------------------------------------------------- dialogs */
  // Close a <dialog> with an exit animation (falls back to an instant close)
  function closeDlg(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { d.close(); return; }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      d.classList.remove('closing');
      if (d.open) d.close();
    };
    d.classList.add('closing');
    d.addEventListener('animationend', (e) => { if (e.target === d && e.animationName === 'dlg-out') finish(); });
    setTimeout(finish, 320);
  }

  // Release focus/menus and let the pointer settle before a native file dialog opens
  const revealCursor = () => (invoke ? Promise.resolve(invoke('reveal_cursor')).catch(() => {}) : Promise.resolve());

  async function withNativeDialog(open) {
    closeMenu();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    await new Promise((r) => setTimeout(r, 120));
    await revealCursor();
    try {
      return await open();
    } finally {
      await revealCursor();
      const cur = active();
      if (cur) cur.ta.focus();
    }
  }

  function showDialog({ title, message, actions }) {
    return new Promise((resolve) => {
      const d = $('#dlg-generic');
      $('#dlg-title').textContent = title;
      $('#dlg-message').textContent = message;
      const box = $('#dlg-actions');
      box.innerHTML = '';
      let result = 'cancel';
      actions.forEach((a) => {
        const b = document.createElement('button');
        b.className = a.cls;
        b.textContent = a.label;
        b.addEventListener('click', () => { result = a.id; closeDlg(d); });
        box.appendChild(b);
        if (a.id === 'discard') { const gap = document.createElement('span'); gap.className = 'grow'; box.appendChild(gap); }
      });
      d.onclose = () => resolve(result);
      d.showModal();
    });
  }

  function askSave(tab) {
    return showDialog({
      title: t('unsaved.title'),
      message: t('unsaved.msg', { name: tabName(tab) }),
      actions: [
        { id: 'discard', label: t('common.dontSave'), cls: 'btn-text' },
        { id: 'cancel', label: t('common.cancel'), cls: 'btn-text' },
        { id: 'save', label: t('common.save'), cls: 'btn-filled' }
      ]
    });
  }

  /* --------------------------------------------------------------------- tabs */
  function applyEditorAttrs(ta) {
    ta.wrap = settings.wrap ? 'soft' : 'off';
    ta.spellcheck = !!settings.spellcheck;
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocorrect', 'off');
  }

  function createTab({ path = null, content = '', eol = DEFAULT_EOL } = {}) {
    const ta = document.createElement('textarea');
    ta.className = 'editor';
    ta.hidden = true;
    ta.value = content;
    applyEditorAttrs(ta);
    const tab = { id: ++seq, path, eol, ta, saved: content, forced: false, shownDirty: false, isNew: true, untitled: path ? 0 : ++untitledSeq };
    ta.addEventListener('input', () => onEdit(tab));
    ta.addEventListener('scroll', () => { if (tab.id === activeId) syncHighlightScroll(); });
    ['keyup', 'click', 'select', 'focus'].forEach((ev) => ta.addEventListener(ev, updateStatus));
    $('#editors').appendChild(ta);
    tabs.push(tab);
    return tab;
  }

  function removeTabSilently(tab) {
    tab.ta.remove();
    tabs.splice(tabs.indexOf(tab), 1);
  }

  function activate(id) {
    const tab = byId(id);
    if (!tab) return;
    activeId = id;
    tabs.forEach((x) => { x.ta.hidden = x !== tab; });
    renderTabs();
    updateTitle();
    updateStatus();
    tab.ta.focus();
    if (!$('#findbar').hidden) updateCount();
    persistSession();
  }

  function renderTabs() {
    const strip = $('#tabs');
    strip.innerHTML = '';
    tabs.forEach((tab) => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeId ? ' active' : '') + (tab.isNew ? ' enter' : '');
      tab.isNew = false;
      el.setAttribute('role', 'tab');
      el.title = tab.path || tabName(tab);
      tab.shownDirty = isDirty(tab);
      el.innerHTML = '<span class="tab-name"></span>' + (tab.shownDirty ? '<span class="tab-dot"></span>' : '') +
        '<button class="tab-close" tabindex="-1"><svg class="icon"><use href="#i-close"/></svg></button>';
      el.querySelector('.tab-name').textContent = tabName(tab);
      el.querySelector('.tab-close').title = t('tab.close');
      el.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } });
      el.addEventListener('click', () => activate(tab.id));
      el.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
      strip.appendChild(el);
      if (tab.id === activeId) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    });
  }

  function newTab() {
    activate(createTab().id);
  }

  async function closeTab(id) {
    const tab = byId(id);
    if (!tab) return false;
    if (isDirty(tab)) {
      if (activeId !== id) activate(id);
      const r = await askSave(tab);
      if (r === 'cancel') return false;
      if (r === 'save' && !(await saveTab(tab))) return false;
    }
    const idx = tabs.indexOf(tab);
    const wasActive = activeId === id;
    removeTabSilently(tab);
    if (!tabs.length) newTab();
    else if (wasActive) activate(tabs[Math.min(idx, tabs.length - 1)].id);
    else renderTabs();
    persistSession();
    return true;
  }

  function cycleTab(step) {
    if (tabs.length < 2) return;
    const i = tabs.findIndex((x) => x.id === activeId);
    activate(tabs[(i + step + tabs.length) % tabs.length].id);
  }

  function onEdit(tab) {
    if (isDirty(tab) !== tab.shownDirty) { renderTabs(); updateTitle(); }
    updateStatus();
    if (!$('#findbar').hidden) queueCount();
  }

  function updateTitle() {
    const tab = active();
    if (!tab) return;
    const title = (isDirty(tab) ? '● ' : '') + tabName(tab) + ' - Material Note';
    document.title = title;
    if (win && win.setTitle) Promise.resolve(win.setTitle(title)).catch(() => {});
  }

  /* -------------------------------------------------------------- file actions */
  function filters() {
    return [
      { name: t('filter.text'), extensions: ['txt', 'md', 'log', 'json', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'ini', 'cfg', 'yaml', 'yml', 'toml', 'py', 'rs'] },
      { name: t('filter.all'), extensions: ['*'] }
    ];
  }

  async function openFiles() {
    if (!dialogApi) return;
    const sel = await withNativeDialog(() => dialogApi.open({ multiple: true, filters: filters() }));
    if (!sel) return;
    await openPaths(Array.isArray(sel) ? sel : [sel]);
  }

  async function openPaths(paths) {
    for (const p of paths) {
      const existing = tabs.find((x) => x.path && samePath(x.path, p));
      if (existing) { activate(existing.id); continue; }
      try {
        const data = await invoke('read_text_file', { path: p });
        const cur = active();
        const tab = createTab({ path: p, content: data.content, eol: data.eol });
        if (cur && !cur.path && !cur.ta.value && !isDirty(cur)) removeTabSilently(cur);
        activate(tab.id);
      } catch (e) {
        toast(t('err.open') + ': ' + e);
      }
    }
  }

  async function saveTab(tab, forceAs = false) {
    if (!tab || !invoke) return false;
    let path = tab.path;
    if (!path || forceAs) {
      const suggested = tab.path || (tabName(tab).replace(/[\\/:*?"<>|]/g, '') + '.txt');
      const sel = await withNativeDialog(() => dialogApi.save({ defaultPath: suggested, filters: filters() }));
      if (!sel) return false;
      path = sel;
    }
    try {
      await invoke('write_text_file', { path, content: tab.ta.value, eol: tab.eol });
    } catch (e) {
      toast(t('err.save') + ': ' + e);
      return false;
    }
    tab.path = path;
    tab.saved = tab.ta.value;
    tab.forced = false;
    renderTabs();
    updateTitle();
    persistSession();
    toast(t('msg.saved'));
    return true;
  }

  function printDoc() {
    const tab = active();
    if (!tab) return;
    $('#print-area').textContent = tab.ta.value;
    setTimeout(() => window.print(), 30);
  }
  window.addEventListener('afterprint', () => { $('#print-area').textContent = ''; });

  /* ------------------------------------------------------------------- session */
  function persistSession() {
    if (!settings.restore) return;
    const cur = active();
    const data = { paths: tabs.filter((x) => x.path).map((x) => x.path), active: cur && cur.path ? cur.path : null };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
  }

  async function restoreSession() {
    const s = readJson(SESSION_KEY);
    if (!settings.restore || !s || !Array.isArray(s.paths) || !invoke) return;
    // read all files in parallel, then create the tabs in their original order
    const loaded = await Promise.all(s.paths.map((p) =>
      invoke('read_text_file', { path: p }).then((data) => ({ p, data }), () => null)));
    loaded.forEach((r) => { if (r) createTab({ path: r.p, content: r.data.content, eol: r.data.eol }); });
    const target = tabs.find((x) => x.path && s.active && samePath(x.path, s.active)) || tabs[tabs.length - 1];
    if (target) activate(target.id);
  }

  /* ---------------------------------------------------------------- statusbar */
  let statusQueued = false;
  function updateStatus() {
    if (statusQueued) return;
    statusQueued = true;
    requestAnimationFrame(() => {
      statusQueued = false;
      const tab = active();
      if (!tab) return;
      const ta = tab.ta;
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const ln = (before.match(/\n/g) || []).length + 1;
      const col = pos - (before.lastIndexOf('\n') + 1) + 1;
      $('#st-pos').textContent = `${t('status.ln')} ${ln}, ${t('status.col')} ${col}`;
      const selLen = ta.selectionEnd - ta.selectionStart;
      $('#st-sel').textContent = selLen ? '(' + t('status.selected', { n: selLen.toLocaleString() }) + ')' : '';
      $('#st-chars').textContent = t('status.chars', { n: ta.value.length.toLocaleString() });
      $('#st-zoom').textContent = settings.zoom + '%';
      $('#st-eol').textContent = t(tab.eol === 'crlf' ? 'status.crlf' : 'status.lf');
    });
  }

  /* ------------------------------------------------------------- editor styles */
  function applyEditorStyle() {
    const root = document.documentElement;
    root.style.setProperty('--editor-font', FONTS[settings.font] || FONTS.system);
    root.style.setProperty('--editor-size', (settings.fontSize * settings.zoom / 100).toFixed(2) + 'px');
    tabs.forEach((x) => applyEditorAttrs(x.ta));
    $('#statusbar').hidden = !settings.statusBar;
    updateStatus();
    refreshHighlights();
  }

  function setZoom(z) {
    settings.zoom = Math.min(500, Math.max(25, z));
    saveSettings();
    applyEditorStyle();
  }

  /* ----------------------------------------------------------------- edit ops */
  function exec(cmd) {
    const tab = active();
    if (!tab) return;
    tab.ta.focus();
    document.execCommand(cmd);
  }

  async function pasteText() {
    const tab = active();
    if (!tab) return;
    tab.ta.focus();
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) document.execCommand('insertText', false, txt);
    } catch {
      toast(t('err.paste'));
    }
  }

  function insertTimeDate() {
    const tab = active();
    if (!tab) return;
    const loc = I18n.getLang() === 'vi' ? 'vi-VN' : 'en-US';
    const d = new Date();
    tab.ta.focus();
    document.execCommand('insertText', false, d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }) + ' ' + d.toLocaleDateString(loc));
  }

  let mirror = null;
  function scrollToIndex(tab, idx) {
    const ta = tab.ta;
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.style.cssText = 'position:absolute;visibility:hidden;top:0;left:-99999px;overflow-wrap:break-word;';
      document.body.appendChild(mirror);
    }
    const cs = getComputedStyle(ta);
    ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      .forEach((k) => { mirror.style[k] = cs[k]; });
    mirror.style.boxSizing = 'border-box';
    mirror.style.width = ta.clientWidth + 'px';
    mirror.style.whiteSpace = settings.wrap ? 'pre-wrap' : 'pre';
    mirror.textContent = ta.value.slice(0, idx);
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    const top = marker.offsetTop;
    const lh = parseFloat(cs.lineHeight) || 24;
    if (top < ta.scrollTop + lh || top > ta.scrollTop + ta.clientHeight - lh * 3) {
      ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
    }
  }

  function selectRange(tab, start, end) {
    const prev = document.activeElement;
    const keep = prev && (prev.id === 'find-input' || prev.id === 'replace-input') ? prev : null;
    tab.ta.focus({ preventScroll: true });
    tab.ta.setSelectionRange(start, end);
    scrollToIndex(tab, start);
    if (keep) keep.focus({ preventScroll: true });
    updateStatus();
    if (!$('#findbar').hidden) updateCount();
  }

  /* ------------------------------------------------------------- find/replace */
  const findInput = $('#find-input');
  const replaceInput = $('#replace-input');
  const hlInner = $('#hl-inner');

  // returns null (empty query), false (invalid pattern) or a global RegExp
  function buildRegex() {
    const q = findInput.value;
    if (!q) return null;
    const useRegex = $('#opt-regex').checked;
    const word = $('#opt-word').checked;
    let src = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word) src = '(?<![\\p{L}\\p{N}_])(?:' + src + ')(?![\\p{L}\\p{N}_])';
    const flags = 'g' + ($('#opt-case').checked ? '' : 'i') + (!useRegex || word ? 'u' : 'm');
    try { return new RegExp(src, flags); } catch { return false; }
  }

  let countTimer = 0;
  function queueCount() { clearTimeout(countTimer); countTimer = setTimeout(updateCount, 150); }

  function updateCountOnly() {
    const re = buildRegex();
    const el = $('#find-count');
    findInput.classList.toggle('invalid', re === false);
    const tab = active();
    if (re === null || !tab) { el.textContent = ''; return; }
    if (re === false) { el.textContent = t('find.invalid'); return; }
    let n = 0;
    let cur = 0;
    let m;
    const ta = tab.ta;
    const text = ta.value;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      n++;
      if (m.index === ta.selectionStart && m.index + m[0].length === ta.selectionEnd) cur = n;
      if (n >= 100000) break;
    }
    if (!n) el.textContent = t('find.none');
    else el.textContent = cur ? cur.toLocaleString() + ' / ' + n.toLocaleString() : t('find.count', { n: n.toLocaleString() });
  }

  // keep the highlight layer scrolled in step with the active textarea
  function syncHighlightScroll() {
    const tab = active();
    if (tab) hlInner.style.transform = 'translate(' + -tab.ta.scrollLeft + 'px, ' + -tab.ta.scrollTop + 'px)';
  }

  // paint every match (soft) and the current match (strong) behind the textarea
  function refreshHighlights() {
    hlInner.textContent = '';
    const tab = active();
    if (!tab || $('#findbar').hidden) return;
    const re = buildRegex();
    if (!re) return;
    const ta = tab.ta;
    const text = ta.value;
    if (text.length > 1500000) return; // keep huge files snappy
    const cs = getComputedStyle(ta);
    const st = hlInner.style;
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      .forEach((k) => { st[k] = cs[k]; });
    st.overflowWrap = 'break-word';
    if (settings.wrap) { st.whiteSpace = 'pre-wrap'; st.width = ta.clientWidth + 'px'; }
    else { st.whiteSpace = 'pre'; st.width = 'max-content'; }
    const frag = document.createDocumentFragment();
    let last = 0;
    let count = 0;
    let m;
    while (count < 5000 && (m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      frag.append(text.slice(last, m.index));
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      if (m.index === ta.selectionStart && m.index + m[0].length === ta.selectionEnd) mark.className = 'cur';
      frag.append(mark);
      last = m.index + m[0].length;
      count++;
    }
    frag.append(text.slice(last) + '\u200b');
    hlInner.appendChild(frag);
    syncHighlightScroll();
  }

  function updateCount() {
    updateCountOnly();
    refreshHighlights();
  }

  function showFind(withReplace) {
    const tab = active();
    $('#findbar').hidden = false;
    $('#replace-row').hidden = !withReplace;
    if (tab) {
      const sel = tab.ta.value.slice(tab.ta.selectionStart, tab.ta.selectionEnd);
      if (sel && !sel.includes('\n')) findInput.value = sel;
    }
    findInput.focus();
    findInput.select();
    updateCount();
  }

  function closeFind() {
    $('#findbar').hidden = true;
    refreshHighlights();
    const tab = active();
    if (tab) tab.ta.focus();
  }

  function findNext(backwards = false, fromSelectionStart = false) {
    const tab = active();
    const re = buildRegex();
    if (!tab || !re) return false;
    const ta = tab.ta;
    const text = ta.value;
    let found = null;
    if (!backwards) {
      re.lastIndex = fromSelectionStart ? ta.selectionStart : ta.selectionEnd;
      found = re.exec(text);
      if (!found) { re.lastIndex = 0; found = re.exec(text); }
    } else {
      let m;
      let last = null;
      let first = null;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (!first) first = m;
        if (m.index < ta.selectionStart) last = m; else break;
      }
      found = last || null;
      if (!found) { // wrap to the final match in the document
        re.lastIndex = 0;
        while ((m = re.exec(text))) { if (m[0].length === 0) { re.lastIndex++; continue; } found = m; }
      }
    }
    if (!found || found[0].length === 0) return false;
    selectRange(tab, found.index, found.index + found[0].length);
    return true;
  }

  function replaceOne() {
    const tab = active();
    const re = buildRegex();
    if (!tab || !re) return;
    const ta = tab.ta;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    re.lastIndex = s;
    const m = re.exec(ta.value);
    if (m && m.index === s && m[0].length === e - s && e > s) {
      const repl = $('#opt-regex').checked ? m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), replaceInput.value) : replaceInput.value;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(s, e);
      document.execCommand(repl === '' ? 'delete' : 'insertText', false, repl);
      findInput.focus({ preventScroll: true });
      updateCount();
    }
    findNext();
  }

  function replaceAll() {
    const tab = active();
    const re = buildRegex();
    if (!tab || !re) return;
    const text = tab.ta.value;
    let count = 0;
    const repl = $('#opt-regex').checked ? replaceInput.value : null;
    const out = text.replace(re, (...args) => {
      count++;
      if (repl === null) return replaceInput.value;
      // honour $1, $&, ... in regex mode by re-running a non-global replace on the match
      return args[0].replace(new RegExp(re.source, re.flags.replace('g', '')), repl);
    });
    if (!count) { toast(t('find.none')); return; }
    tab.ta.focus({ preventScroll: true });
    tab.ta.select();
    document.execCommand(out === '' ? 'delete' : 'insertText', false, out);
    findInput.focus({ preventScroll: true });
    updateCount();
    toast(t('find.replaced', { n: count.toLocaleString() }));
  }

  /* --------------------------------------------------------------- go to line */
  function openGoto() {
    const tab = active();
    if (!tab) return;
    const lines = tab.ta.value.split('\n').length;
    const input = $('#goto-input');
    input.max = lines;
    input.value = tab.ta.value.slice(0, tab.ta.selectionStart).split('\n').length;
    $('#goto-hint').textContent = t('goto.hint', { n: lines.toLocaleString() });
    $('#dlg-goto').showModal();
    input.select();
  }

  $('#goto-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const tab = active();
    if (!tab) return;
    const lines = tab.ta.value.split('\n');
    const n = Math.min(lines.length, Math.max(1, parseInt($('#goto-input').value, 10) || 1));
    let idx = 0;
    for (let i = 0; i < n - 1; i++) idx += lines[i].length + 1;
    closeDlg($('#dlg-goto'));
    selectRange(tab, idx, idx);
    tab.ta.focus();
  });
  $('#goto-cancel').addEventListener('click', () => closeDlg($('#dlg-goto')));

  /* -------------------------------------------------------------------- menus */
  const toggleWrap = () => { settings.wrap = !settings.wrap; saveSettings(); applyEditorStyle(); syncSettingsUi(); };
  const applyTabLayout = () => $('#workspace').classList.toggle('vertical', settings.tabLayout === 'vertical');
  const setTabLayout = (v) => { settings.tabLayout = v; saveSettings(); applyTabLayout(); syncSettingsUi(); renderTabs(); };
  const toggleStatus = () => { settings.statusBar = !settings.statusBar; saveSettings(); applyEditorStyle(); syncSettingsUi(); };
  async function toggleFullscreen() {
    if (!win || !win.isFullscreen) return;
    try { await win.setFullscreen(!(await win.isFullscreen())); } catch {}
  }

  const MENUS = {
    file: [
      { id: 'new', kbd: 'Ctrl+N', run: newTab },
      { id: 'open', kbd: 'Ctrl+O', run: openFiles },
      { sep: true },
      { id: 'save', kbd: 'Ctrl+S', run: () => saveTab(active()) },
      { id: 'saveAs', kbd: 'Ctrl+Shift+S', run: () => saveTab(active(), true) },
      { sep: true },
      { id: 'print', kbd: 'Ctrl+P', run: printDoc },
      { sep: true },
      { id: 'closeTab', kbd: 'Ctrl+W', run: () => closeTab(activeId) },
      { id: 'exit', kbd: 'Alt+F4', run: () => (win ? win.close() : window.close()) }
    ].map((i) => (i.id ? Object.assign(i, { key: 'file.' + i.id }) : i)),
    edit: [
      { id: 'undo', kbd: 'Ctrl+Z', run: () => exec('undo') },
      { id: 'redo', kbd: 'Ctrl+Y', run: () => exec('redo') },
      { sep: true },
      { id: 'cut', kbd: 'Ctrl+X', run: () => exec('cut') },
      { id: 'copy', kbd: 'Ctrl+C', run: () => exec('copy') },
      { id: 'paste', kbd: 'Ctrl+V', run: pasteText },
      { id: 'delete', kbd: 'Del', run: () => exec('forwardDelete') },
      { sep: true },
      { id: 'find', kbd: 'Ctrl+F', run: () => showFind(false) },
      { id: 'findNext', kbd: 'F3', run: () => findNext(false) },
      { id: 'findPrev', kbd: 'Shift+F3', run: () => findNext(true) },
      { id: 'replace', kbd: 'Ctrl+H', run: () => showFind(true) },
      { id: 'goto', kbd: 'Ctrl+G', run: openGoto },
      { sep: true },
      { id: 'selectAll', kbd: 'Ctrl+A', run: () => exec('selectAll') },
      { id: 'timeDate', kbd: 'F5', run: insertTimeDate }
    ].map((i) => (i.id ? Object.assign(i, { key: 'edit.' + i.id }) : i)),
    view: [
      { id: 'zoomIn', kbd: 'Ctrl++', run: () => setZoom(settings.zoom + 10) },
      { id: 'zoomOut', kbd: 'Ctrl+-', run: () => setZoom(settings.zoom - 10) },
      { id: 'zoomReset', kbd: 'Ctrl+0', run: () => setZoom(100) },
      { sep: true },
      { id: 'wrap', run: toggleWrap, check: () => settings.wrap },
      { id: 'statusBar', run: toggleStatus, check: () => settings.statusBar },
      { id: 'verticalTabs', run: () => setTabLayout(settings.tabLayout === 'vertical' ? 'horizontal' : 'vertical'), check: () => settings.tabLayout === 'vertical' },
      { sep: true },
      { id: 'fullscreen', kbd: 'F11', run: toggleFullscreen }
    ].map((i) => (i.id ? Object.assign(i, { key: 'view.' + i.id }) : i))
  };

  const pop = $('#menu-pop');
  let openMenuName = null;

  function closeMenu() {
    pop.hidden = true;
    openMenuName = null;
    document.querySelectorAll('#menubar .btn-text').forEach((b) => b.classList.remove('open'));
  }

  function openMenu(name, btn) {
    closeMenu();
    pop.innerHTML = '';
    MENUS[name].forEach((item) => {
      if (item.sep) {
        const hr = document.createElement('div');
        hr.className = 'menu-sep';
        pop.appendChild(hr);
        return;
      }
      const b = document.createElement('button');
      b.className = 'menu-item';
      b.setAttribute('role', 'menuitem');
      const checked = item.check && item.check();
      b.innerHTML = (checked ? '<svg class="icon chk"><use href="#i-check"/></svg>' : '') + '<span></span><kbd></kbd>';
      b.children[checked ? 1 : 0].textContent = t(item.key);
      b.querySelector('kbd').textContent = item.kbd || '';
      b.addEventListener('click', () => { closeMenu(); item.run(); });
      pop.appendChild(b);
    });
    const r = btn.getBoundingClientRect();
    pop.style.left = r.left + 'px';
    pop.style.top = r.bottom + 4 + 'px';
    pop.hidden = false;
    btn.classList.add('open');
    openMenuName = name;
  }

  // keep focus/selection inside the editor while using menus
  pop.addEventListener('mousedown', (e) => e.preventDefault());
  $('#menubar').addEventListener('mousedown', (e) => e.preventDefault());
  document.querySelectorAll('#menubar [data-menu]').forEach((btn) => {
    btn.addEventListener('click', () => (openMenuName === btn.dataset.menu ? closeMenu() : openMenu(btn.dataset.menu, btn)));
    btn.addEventListener('mouseenter', () => { if (openMenuName && openMenuName !== btn.dataset.menu) openMenu(btn.dataset.menu, btn); });
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#menu-pop, #menubar')) closeMenu(); });
  window.addEventListener('blur', closeMenu);

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
    document.querySelectorAll('#seg-tabs input').forEach((i) => { i.checked = i.value === settings.tabLayout; });
    $('#seed-input').value = /^#[0-9a-f]{6}$/i.test(settings.seed) ? settings.seed.toLowerCase() : '#6750a4';
    $('#set-font').value = settings.font;
    $('#set-size').value = settings.fontSize;
    $('#set-size-out').textContent = settings.fontSize + ' px';
    $('#set-wrap').checked = settings.wrap;
    $('#set-status').checked = settings.statusBar;
    $('#set-spell').checked = settings.spellcheck;
    $('#set-restore').checked = settings.restore;
    renderSwatches();
  }

  function applyTheme() {
    Theme.apply(settings, win);
    const icon = { light: '#i-sun', dark: '#i-moon', system: '#i-system' }[settings.theme];
    $('#theme-use').setAttribute('href', icon);
  }

  function applyLanguage() {
    I18n.setLang(settings.lang);
    I18n.apply();
    renderTabs();
    updateTitle();
    updateStatus();
    updateCount();
    closeMenu();
  }

  document.querySelectorAll('#seg-theme input').forEach((i) => i.addEventListener('change', () => {
    settings.theme = i.value; saveSettings(); applyTheme();
  }));
  document.querySelectorAll('#seg-lang input').forEach((i) => i.addEventListener('change', () => {
    settings.lang = i.value; saveSettings(); applyLanguage();
  }));
  document.querySelectorAll('#seg-tabs input').forEach((i) => i.addEventListener('change', () => setTabLayout(i.value)));
  $('#seed-input').addEventListener('input', (e) => { settings.seed = e.target.value; saveSettings(); applyTheme(); renderSwatches(); });
  $('#set-font').addEventListener('change', (e) => { settings.font = e.target.value; saveSettings(); applyEditorStyle(); });
  $('#set-size').addEventListener('input', (e) => {
    settings.fontSize = parseInt(e.target.value, 10);
    $('#set-size-out').textContent = settings.fontSize + ' px';
    saveSettings(); applyEditorStyle();
  });
  $('#set-wrap').addEventListener('change', (e) => { settings.wrap = e.target.checked; saveSettings(); applyEditorStyle(); });
  $('#set-status').addEventListener('change', (e) => { settings.statusBar = e.target.checked; saveSettings(); applyEditorStyle(); });
  $('#set-spell').addEventListener('change', (e) => { settings.spellcheck = e.target.checked; saveSettings(); applyEditorStyle(); });
  $('#set-restore').addEventListener('change', (e) => { settings.restore = e.target.checked; saveSettings(); persistSession(); });
  $('#btn-reset').addEventListener('click', () => {
    Object.assign(settings, DEFAULTS, { lang: I18n.detect() });
    saveSettings(); applyTheme(); applyLanguage(); applyEditorStyle(); applyTabLayout(); syncSettingsUi();
  });

  const openSettings = () => { syncSettingsUi(); $('#dlg-settings').showModal(); };
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => closeDlg($('#dlg-settings')));
  $('#btn-about').addEventListener('click', () => $('#dlg-about').showModal());
  $('#about-close').addEventListener('click', () => closeDlg($('#dlg-about')));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('cancel', (e) => { e.preventDefault(); closeDlg(d); }));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('close', () => { const tab = active(); if (tab && !d.id.includes('generic')) tab.ta.focus(); }));
  // close dialogs when the backdrop (outside the dialog box) is clicked
  ['dlg-settings', 'dlg-about', 'dlg-goto'].forEach((id) => {
    const d = $('#' + id);
    let downOutside = false;
    const outside = (e) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    d.addEventListener('mousedown', (e) => { downOutside = e.target === d && outside(e); });
    d.addEventListener('click', (e) => { if (downOutside && e.target === d && outside(e)) closeDlg(d); downOutside = false; });
  });
  $('#btn-theme').addEventListener('click', () => {
    const order = ['light', 'dark', 'system'];
    settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
    saveSettings(); applyTheme(); syncSettingsUi();
    toast(t('toolbar.theme') + ': ' + t('settings.' + settings.theme));
  });
  Theme.onSystemChange(() => { if (settings.theme === 'system') applyTheme(); });

  /* ------------------------------------------------------------- wire-up (UI) */
  $('#btn-newtab').addEventListener('click', newTab);
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(refreshHighlights)).observe($('#editors'));
  $('#btn-find').addEventListener('click', () => showFind(false));
  $('#find-next').addEventListener('click', () => findNext(false));
  $('#find-prev').addEventListener('click', () => findNext(true));
  $('#find-close').addEventListener('click', closeFind);
  $('#btn-replace').addEventListener('click', replaceOne);
  $('#btn-replace-all').addEventListener('click', replaceAll);
  ['opt-case', 'opt-word', 'opt-regex'].forEach((id) => $('#' + id).addEventListener('change', updateCount));
  findInput.addEventListener('input', () => { updateCount(); findNext(false, true); });
  findInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey); } });
  replaceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } });
  $('#st-eol').addEventListener('click', () => {
    const tab = active();
    if (!tab) return;
    tab.eol = tab.eol === 'crlf' ? 'lf' : 'crlf';
    tab.forced = true;
    renderTabs(); updateTitle(); updateStatus();
  });
  $('#tabs').addEventListener('dblclick', (e) => { if (e.target.id === 'tabs') newTab(); });

  $('#editors').addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(settings.zoom + (e.deltaY < 0 ? 10 : -10));
  }, { passive: false });

  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('textarea, input')) e.preventDefault(); });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'F5') { e.preventDefault(); insertTimeDate(); return; }
    if (e.key === 'F3') { e.preventDefault(); findNext(e.shiftKey); return; }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === 'Escape') {
      if (openMenuName) { closeMenu(); return; }
      if (!$('#findbar').hidden && !document.querySelector('dialog[open]')) { closeFind(); return; }
    }
    if (!mod) return;
    const map = {
      n: newTab, o: openFiles, w: () => closeTab(activeId), p: printDoc,
      s: () => saveTab(active(), e.shiftKey), f: () => showFind(false), h: () => showFind(true), g: openGoto,
      ',': openSettings, r: () => {}
    };
    if (map[k]) { e.preventDefault(); map[k](); return; }
    if (k === '=' || k === '+') { e.preventDefault(); setZoom(settings.zoom + 10); return; }
    if (k === '-') { e.preventDefault(); setZoom(settings.zoom - 10); return; }
    if (k === '0') { e.preventDefault(); setZoom(100); return; }
    if (e.key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); }
  });

  /* ------------------------------------------------------- ripple (Material) */
  const RIPPLE_HOSTS = '.btn-text, .btn-tonal, .btn-filled, .icon-btn:not(.tab-close), .menu-item, .segmented span, .chip span, .status-btn';
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = e.target.closest(RIPPLE_HOSTS);
    if (!host) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('i'); // <i>, so ".segmented span" / ".chip span" rules never match it
    dot.className = 'ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = e.clientX - r.left - size / 2 + 'px';
    dot.style.top = e.clientY - r.top - size / 2 + 'px';
    host.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }, true);

  /* ---------------------------------------------------------- window lifecycle */
  async function confirmAllClosed() {
    for (const tab of tabs.slice()) {
      if (!isDirty(tab)) continue;
      activate(tab.id);
      const r = await askSave(tab);
      if (r === 'cancel') return false;
      if (r === 'save' && !(await saveTab(tab))) return false;
    }
    return true;
  }

  if (win && win.onCloseRequested) {
    win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (await confirmAllClosed()) {
        persistSession();
        await win.destroy();
      }
    });
  }

  const webview = TAURI.webview && TAURI.webview.getCurrentWebview ? TAURI.webview.getCurrentWebview() : null;
  if (webview && webview.onDragDropEvent) {
    webview.onDragDropEvent((event) => {
      const p = event.payload;
      const zone = $('#dropzone');
      if (p.type === 'enter' || p.type === 'over') zone.classList.add('show');
      else zone.classList.remove('show');
      if (p.type === 'drop' && p.paths && p.paths.length) openPaths(p.paths);
    });
  }

  /* --------------------------------------------------------------------- init */
  async function init() {
    I18n.setLang(settings.lang);
    I18n.apply();
    applyTheme();
    applyTabLayout();
    syncSettingsUi();
    applyEditorStyle();

    // Render an editor right away; session restore happens in the background
    const first = createTab();
    activate(first.id);
    updateStatus();

    // Reveal the (initially hidden) window only after the first frame is painted
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('booting');
      if (win && win.show) Promise.resolve(win.show()).catch(() => {});
    }));

    if (invoke) {
      await restoreSession();
      try { await openPaths(await invoke('startup_files')); } catch {}
      const pristine = !first.path && !first.ta.value && !isDirty(first);
      if (pristine && tabs.length > 1 && tabs.includes(first)) {
        const wasActive = activeId === first.id;
        removeTabSilently(first);
        if (wasActive) activate(tabs[tabs.length - 1].id); else renderTabs();
      }
    }
    updateStatus();
  }

  init();
})();

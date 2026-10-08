// Application controller: wires the model, grid and all Material UI (toolbar, menus, tabs, dialogs, files).
import { Book, Sheet } from "./model.js";
import { Grid } from "./grid.js";
import { t, setLang, getLang, applyI18n } from "./i18n.js";
import { setTheme, applyColors, PRESETS, isDark, onSystemTheme } from "./theme.js";
import * as W from "./widgets.js";
import * as FS from "./tauri.js";
import { importXlsx, exportXlsx, importCSV, toCSV } from "./io.js";
import { NUM_PRESETS } from "./numfmt.js";
import { parseAddr, rangeText, colName, colIndex, MAX_ROWS, MAX_COLS, key } from "./refs.js";

const { $, el, icon } = W;
const SETTINGS_KEY = "materialxlsx.settings";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const S = Object.assign({ fullscreen: false, lang: (navigator.language || "en").toLowerCase().startsWith("vi") ? "vi" : "en", mode: "system", seed: "#1B6B3A", anim: !reduce, gridlines: true, recents: [] },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch { /* ignore */ } };

const book = new Book();
let grid, doc = { name: "", path: null }, tbEls = {}, zoomPct = 100, barEdit = false;
const sheet = () => book.sheet;
const sc = (k) => (navigator.platform.includes("Mac") ? k.replace("Ctrl", "⌘") : k);

// ───────────────────────── commands ─────────────────────────
const NF_KEYS = { General: "general", "0": "int", "0.00": "dec2", "#,##0": "thou", "#,##0.00": "thou2", usd: "usd", vnd: "vnd", eur: "eur", "0%": "pct", "0.00%": "pct2", sci: "sci", "yyyy-mm-dd": "dateiso", "dd/mm/yyyy": "datedmy", "mm/dd/yyyy": "datemdy", datetime: "datetime", "hh:mm:ss": "time", "@": "text" };
const FONTS = ["", "Arial", "Calibri", "Cambria", "Consolas", "Courier New", "Georgia", "Segoe UI", "Times New Roman", "Verdana"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
let isFull = false;

const CMD = {
  new: { ico: "newfile", key: "Ctrl+N", run: () => newDoc() },
  open: { ico: "folder", key: "Ctrl+O", run: () => openDialog() },
  save: { ico: "save", key: "Ctrl+S", run: () => save() },
  saveAs: { ico: "save", key: "Ctrl+Shift+S", run: () => saveAs() },
  exportCsv: { ico: "download", run: () => exportCsv() },
  importCsv: { ico: "upload", run: () => importCsvSheet() },
  print: { ico: "print", key: "Ctrl+P", run: () => printSheet() },
  undo: { ico: "undo", key: "Ctrl+Z", run: () => { if (!grid.editing) book.undo(); }, enabled: () => book.undoStack.length > 0 },
  redo: { ico: "redo", key: "Ctrl+Y", run: () => { if (!grid.editing) book.redo(); }, enabled: () => book.redoStack.length > 0 },
  cut: { ico: "cut", key: "Ctrl+X", run: async () => FS.clipboardWrite(grid.copy(true)) },
  copy: { ico: "copy", key: "Ctrl+C", run: async () => FS.clipboardWrite(grid.copy(false)) },
  paste: { ico: "paste", key: "Ctrl+V", run: async () => grid.pasteText(await FS.clipboardRead(), "all") },
  pasteValues: { run: async () => grid.pasteText(await FS.clipboardRead(), "values") },
  pasteFormats: { run: async () => grid.pasteText(await FS.clipboardRead(), "formats") },
  clearContents: { ico: "eraser", key: "Del", run: () => book.clear(sheet(), grid.range(), "contents") },
  clearFormats: { run: () => book.clear(sheet(), grid.range(), "formats") },
  clearAll: { run: () => book.clear(sheet(), grid.range(), "all") },
  selectAll: { ico: "select", key: "Ctrl+A", run: () => grid.selectAll() },
  find: { ico: "search", key: "Ctrl+F", run: () => openFind(false) },
  replace: { ico: "search", key: "Ctrl+H", run: () => openFind(true) },
  rowAbove: { ico: "rowins", run: () => grid.insertLines("row", false) },
  rowBelow: { ico: "rowins", run: () => grid.insertLines("row", true) },
  colLeft: { ico: "colins", run: () => grid.insertLines("col", false) },
  colRight: { ico: "colins", run: () => grid.insertLines("col", true) },
  delRow: { ico: "trash", run: () => grid.deleteLines("row") },
  delCol: { ico: "trash", run: () => grid.deleteLines("col") },
  newSheet: { ico: "sheet", run: () => { grid.saveView(); book.addSheet(); } },
  autosum: { ico: "sigma", key: "Alt+=", run: () => grid.autosum() },
  sortAsc: { ico: "sortasc", run: () => { if (!grid.sortSelection(true)) toast("toast.nosort"); } },
  sortDesc: { ico: "sortdesc", run: () => { if (!grid.sortSelection(false)) toast("toast.nosort"); } },
  filter: { ico: "filter", run: () => toggleFilter(), active: () => !!sheet().filter },
  freezeRow: { run: () => book.setFreeze(sheet(), 1, sheet().freeze.c) },
  freezeCol: { run: () => book.setFreeze(sheet(), sheet().freeze.r, 1) },
  freezeSel: { run: () => { const a = grid.active(); book.setFreeze(sheet(), a.r, a.c); } },
  unfreeze: { run: () => book.setFreeze(sheet(), 0, 0) },
  zoomIn: { ico: "zoomin", key: "Ctrl+=", run: () => stepZoom(1) },
  zoomOut: { ico: "zoomout", key: "Ctrl+-", run: () => stepZoom(-1) },
  zoomReset: { key: "Ctrl+0", run: () => setZoomPct(100) },
  fullscreen: { ico: "fullscreen", key: "F11", run: () => toggleFullscreen(), active: () => isFull },
  gridlines: { ico: "grid", run: () => { S.gridlines = !S.gridlines; saveSettings(); grid.showLines = S.gridlines; grid.themeChanged(); }, active: () => S.gridlines },
  shortcuts: { ico: "keyboard", key: "F1", run: () => shortcutsDialog() },
  about: { ico: "info", run: () => settingsDialog(true) },
  settings: { ico: "settings", key: "Ctrl+,", run: () => settingsDialog() },
  bold: { ico: "bold", key: "Ctrl+B", run: () => grid.toggleStyle("b"), active: () => !!grid.activeStyle().b },
  italic: { ico: "italic", key: "Ctrl+I", run: () => grid.toggleStyle("i"), active: () => !!grid.activeStyle().i },
  underline: { ico: "underline", key: "Ctrl+U", run: () => grid.toggleStyle("u"), active: () => !!grid.activeStyle().u },
  strike: { ico: "strike", run: () => grid.toggleStyle("st"), active: () => !!grid.activeStyle().st },
  wrap: { ico: "wrap", run: () => grid.toggleStyle("wr"), active: () => !!grid.activeStyle().wr },
  merge: { ico: "merge", run: () => grid.toggleMerge(), active: () => !!book.mergeAt(sheet(), grid.active().r, grid.active().c) },
  alignL: { ico: "alignl", run: () => grid.setStyle({ ha: grid.activeStyle().ha === "left" ? undefined : "left" }), active: () => grid.activeStyle().ha === "left" },
  alignC: { ico: "alignc", run: () => grid.setStyle({ ha: grid.activeStyle().ha === "center" ? undefined : "center" }), active: () => grid.activeStyle().ha === "center" },
  alignR: { ico: "alignr", run: () => grid.setStyle({ ha: grid.activeStyle().ha === "right" ? undefined : "right" }), active: () => grid.activeStyle().ha === "right" },
  vTop: { run: () => grid.setStyle({ va: "top" }), active: () => grid.activeStyle().va === "top" },
  vMid: { run: () => grid.setStyle({ va: "middle" }), active: () => !grid.activeStyle().va || grid.activeStyle().va === "middle" },
  vBot: { run: () => grid.setStyle({ va: "bottom" }), active: () => grid.activeStyle().va === "bottom" },
  decInc: { run: () => adjustDec(1) },
  decDec: { run: () => adjustDec(-1) },
};
for (const m of ["all", "outer", "top", "bottom", "left", "right", "none"]) CMD["bd." + m] = { run: () => book.applyBorder(sheet(), grid.range(), m) };
const label = (id) => t((id.startsWith("bd.") ? "" : "cmd.") + id);
const item = (id, extra = {}) => {
  const c = CMD[id];
  return { label: label(id), icon: c.ico, key: c.key ? sc(c.key) : undefined, run: () => c.run(), disabled: c.enabled ? !c.enabled() : false, checked: extra.check && c.active ? c.active() : undefined };
};
const toast = (k, p, action) => W.toast(t(k, p), action);

import("./numfmt.js").then(({ adjustDecimals }) => { window.__adj = adjustDecimals; });
function adjustDec(d) { const st = grid.activeStyle(); grid.setStyle({ nf: window.__adj(st.nf, d) }); }

// ───────────────────────── toolbar ─────────────────────────
const TB = [
  ["b", "undo"], ["b", "redo"], ["|"], ["sel", "font"], ["sel", "size"], ["|"],
  ["b", "bold", 1], ["b", "italic", 1], ["b", "underline", 1], ["b", "strike", 1],
  ["color", "textcolor", "textcolor"], ["color", "fill", "fill"], ["menu", "borders", "border"], ["|"],
  ["b", "merge", 1], ["b", "alignL", 1], ["b", "alignC", 1], ["b", "alignR", 1], ["menu", "valign", "valign"], ["b", "wrap", 1], ["|"],
  ["sel", "numfmt"], ["txt", "decDec", ".0\u2190"], ["txt", "decInc", ".00\u2192"], ["|"],
  ["menu", "cells", "cells"], ["menu", "clear", "eraser"], ["|"],
  ["b", "sortAsc"], ["b", "sortDesc"], ["b", "filter", 1], ["menu", "freeze", "freeze"], ["b", "autosum"],
];
function buildToolbar() {
  const bar = $("#toolbar"); bar.innerHTML = ""; tbEls = {};
  const tip = (id) => (id === "textcolor" || id === "fill" || id === "borders" || id === "valign" || id === "cells" || id === "clear" || id === "freeze" ? t("tb." + id) : label(id) + (CMD[id] && CMD[id].key ? ` (${sc(CMD[id].key)})` : ""));
  for (const [kind, id, x] of TB) {
    if (kind === "|") { bar.appendChild(el("span", "tsep")); continue; }
    let e;
    if (kind === "sel") {
      e = el("select", "sel"); e.title = t("tb." + id); e.setAttribute("aria-label", t("tb." + id));
      if (id === "font") FONTS.forEach((f) => { const o = el("option"); o.value = f; o.textContent = f || t("tb.fontdefault"); e.appendChild(o); });
      if (id === "font") e.style.width = "128px";
      if (id === "size") e.style.width = "62px";
      if (id === "size") SIZES.forEach((s) => { const o = el("option"); o.value = s; o.textContent = s; e.appendChild(o); });
      if (id === "numfmt") { NUM_PRESETS.forEach(([k]) => { const o = el("option"); o.value = k; o.textContent = t("nf." + NF_KEYS[k]); e.appendChild(o); }); const o = el("option"); o.value = "__custom"; o.textContent = t("nf.custom"); e.appendChild(o); e.style.width = "122px"; }
      e.addEventListener("change", () => onSelect(id, e));
    } else {
      e = el("button", "icon-btn" + (kind === "txt" ? " txt-btn" : "")); e.title = tip(id); e.setAttribute("aria-label", tip(id));
      if (kind === "txt") e.textContent = x;
      else if (kind === "color") e.innerHTML = icon(x) + '<span class="cbar"></span>';
      else e.innerHTML = icon(kind === "menu" ? x : CMD[id].ico);
      if (kind === "b" || kind === "txt") e.addEventListener("click", () => { CMD[id].run(); grid.scroll.focus({ preventScroll: true }); });
      else if (kind === "color") e.addEventListener("click", () => openColor(id, e));
      else if (kind === "menu") e.addEventListener("click", () => openToolMenu(id, e));
      if (x === 1) e.setAttribute("aria-pressed", "false");
    }
    tbEls[id] = e; bar.appendChild(e);
  }
  refreshToolbar();
}
function onSelect(id, e) {
  if (id === "font") grid.setStyle({ ff: e.value || undefined });
  else if (id === "size") grid.setStyle({ fs: +e.value === 11 ? undefined : +e.value });
  else if (id === "numfmt") {
    if (e.value === "__custom") { customFormat(); return; }
    const preset = NUM_PRESETS.find(([k]) => k === e.value);
    grid.setStyle({ nf: preset ? preset[1] : e.value });
  }
  grid.scroll.focus({ preventScroll: true });
}
function openColor(id, btn) {
  const isText = id === "textcolor", cur = isText ? grid.activeStyle().fc : grid.activeStyle().bg;
  const node = W.paletteNode({ current: cur, noneLabel: t(isText ? "tb.auto" : "tb.nofill"), customLabel: t("tb.custom"), onPick: (c) => { grid.setStyle(isText ? { fc: c || undefined } : { bg: c || undefined }); grid.scroll.focus({ preventScroll: true }); } });
  W.openMenu([{ node }], btn);
}
function openToolMenu(id, btn) {
  const m = { borders: () => ["bd.all", "bd.outer", "bd.top", "bd.bottom", "bd.left", "bd.right", "bd.none"].map((k) => ({ label: t("bd." + k.slice(3)), run: CMD[k].run })),
    valign: () => ["vTop", "vMid", "vBot"].map((k) => item(k, { check: true })),
    cells: () => [item("rowAbove"), item("rowBelow"), item("colLeft"), item("colRight"), { sep: true }, item("delRow"), item("delCol")],
    clear: () => [item("clearContents"), item("clearFormats"), item("clearAll")],
    freeze: () => [item("freezeRow"), item("freezeCol"), item("freezeSel"), { sep: true }, item("unfreeze")] }[id]();
  W.openMenu(m, btn);
}
function customFormat() {
  const inp = el("input", "field"); inp.style.width = "100%"; inp.value = grid.activeStyle().nf || "General"; inp.spellcheck = false;
  const hint = el("p"); hint.style.marginTop = "10px"; hint.style.fontSize = "13px"; hint.textContent = t("dlg.fmthint");
  const box = el("div"); box.append(inp, hint);
  W.dialog({ title: t("dlg.customfmt"), size: "sm", content: box, actions: [{ label: t("btn.cancel") }, { label: t("btn.apply"), primary: true, run: () => { grid.setStyle({ nf: inp.value.trim() || undefined }); } }] });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") document.querySelector(".dialog .btn.filled").click(); });
  setTimeout(() => { inp.focus(); inp.select(); }, 80);
}
function refreshToolbar() {
  const st = grid.activeStyle();
  for (const [id, e] of Object.entries(tbEls)) {
    const c = CMD[id];
    if (c && c.active && e.tagName === "BUTTON") { const on = !!c.active(); e.classList.toggle("on", on); e.setAttribute("aria-pressed", on); }
    if (id === "undo" || id === "redo") e.disabled = !c.enabled();
  }
  const set = (id, v) => { if (tbEls[id] && tbEls[id] !== document.activeElement) tbEls[id].value = v; };
  set("font", FONTS.includes(st.ff || "") ? st.ff || "" : "");
  set("size", String(st.fs || 11));
  const known = NUM_PRESETS.find(([, code]) => code === (st.nf || "General"));
  if (tbEls.numfmt && tbEls.numfmt !== document.activeElement) {
    const o = tbEls.numfmt.querySelector('option[value="__cur"]'); if (o) o.remove();
    if (known) tbEls.numfmt.value = known[0]; else { const op = el("option"); op.value = "__cur"; op.textContent = st.nf; tbEls.numfmt.appendChild(op); tbEls.numfmt.value = "__cur"; }
  }
  if (tbEls.textcolor) tbEls.textcolor.querySelector(".cbar").style.setProperty("--c", st.fc || "var(--md-on-surface)");
  if (tbEls.fill) tbEls.fill.querySelector(".cbar").style.setProperty("--c", st.bg || "transparent");
}

// ───────────────────────── menu bar & appbar ─────────────────────────
function buildMenus() {
  const nav = $("#menus"); nav.innerHTML = "";
  const defs = {
    file: () => [item("new"), item("open"), { sep: true }, item("save"), item("saveAs"), { sep: true }, item("exportCsv"), item("importCsv"), item("print"),
      ...(S.recents.length ? [{ sep: true }, { title: t("menu.recent") }, ...S.recents.slice(0, 6).map((r) => ({ label: r.name, icon: "folder", run: () => openRecent(r) }))] : [])],
    edit: () => [item("undo"), item("redo"), { sep: true }, item("cut"), item("copy"), item("paste"), item("pasteValues"), item("pasteFormats"), { sep: true }, item("clearContents"), item("clearFormats"), item("clearAll"), { sep: true }, item("selectAll"), item("find"), item("replace")],
    insert: () => [item("rowAbove"), item("rowBelow"), item("colLeft"), item("colRight"), { sep: true }, item("delRow"), item("delCol"), { sep: true }, item("newSheet"), item("autosum")],
    data: () => [item("sortAsc"), item("sortDesc"), item("filter", { check: true }), { sep: true }, item("freezeRow"), item("freezeCol"), item("freezeSel"), item("unfreeze")],
    view: () => [item("zoomIn"), item("zoomOut"), item("zoomReset"), { sep: true }, item("gridlines", { check: true }), item("fullscreen", { check: true })],
    help: () => [item("shortcuts"), item("settings"), item("about")],
  };
  for (const [k, fn] of Object.entries(defs)) {
    const b = el("button", "btn text"); b.textContent = t("menu." + k); b.id = "m-" + k;
    const open = () => W.openMenu(fn(), b);
    b.addEventListener("click", () => (b.getAttribute("aria-expanded") === "true" ? W.closeMenu() : open()));
    b.addEventListener("mouseenter", () => { if (W.menuIsOpen() && b.getAttribute("aria-expanded") !== "true") open(); });
    nav.appendChild(b);
  }
}
function initAppbar() {
  $("#btn-lang").addEventListener("click", () => changeLang(getLang() === "en" ? "vi" : "en"));
  $("#btn-theme").addEventListener("click", (e) => {
    const rc = e.currentTarget.getBoundingClientRect();
    const origin = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
    W.openMenu(["system", "light", "dark"].map((m) => ({ label: t("theme." + m), icon: m === "system" ? "system" : m === "light" ? "sun" : "moon", checked: S.mode === m, run: () => changeMode(m, origin) })), e.currentTarget, { right: true });
  });
  $("#btn-settings").addEventListener("click", () => CMD.settings.run());
  refreshAppbar();
}
function refreshAppbar() {
  $("#btn-lang").innerHTML = `${icon("globe")}<span>${S.lang.toUpperCase()}</span>`;
  $("#btn-lang").title = t("app.language");
  const mi = S.mode === "system" ? "system" : S.mode === "light" ? "sun" : "moon";
  $("#btn-theme").innerHTML = icon(mi); $("#btn-theme").title = t("app.theme"); $("#btn-settings").title = t("cmd.settings");
}
function changeLang(l) {
  S.lang = l; saveSettings(); setLang(l); book.lang = l; document.documentElement.lang = l;
  applyI18n(); buildMenus(); buildToolbar(); refreshAppbar(); renderTabs(); updateDoc(); updateStats(true); updateBarLabels(); grid.requestRender();
}
function applyAnim() { document.documentElement.dataset.anim = S.anim ? "on" : "off"; }
function changeMode(m, origin) {
  S.mode = m; saveSettings(); refreshAppbar();
  setTheme(S.seed, m, { origin, animate: S.anim, done: () => grid.themeChanged() });
}
function changeSeed(seed) { S.seed = seed.toUpperCase(); saveSettings(); applyColors(S.seed, S.mode); grid.themeChanged(); }

// ───────────────────────── sheet tabs ─────────────────────────
let prevSheetCount = 0;
function renderTabs() {
  const tabs = $("#tabs"), ind = $("#tab-ind");
  [...tabs.querySelectorAll(".tab")].forEach((e) => e.remove());
  book.sheets.forEach((s, i) => {
    const b = el("button", "tab" + (i === book.active ? " active" : "") + (book.sheets.length > prevSheetCount && prevSheetCount && i === book.active ? " new" : ""));
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", i === book.active);
    b.innerHTML = (s.tab ? `<span class="tdot" style="--tc:${s.tab}"></span>` : "") + '<span class="tn"></span>';
    b.querySelector(".tn").textContent = s.name; b.title = s.name;
    b.addEventListener("click", () => selectSheet(i));
    b.addEventListener("dblclick", () => renameTab(i, b));
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); selectSheet(i); tabMenu(i, { x: e.clientX, y: e.clientY }); });
    tabs.insertBefore(b, ind);
  });
  prevSheetCount = book.sheets.length;
  requestAnimationFrame(moveInd);
}
function moveInd() {
  const a = $("#tabs .tab.active"), ind = $("#tab-ind");
  if (!a) return;
  ind.style.left = a.offsetLeft + "px"; ind.style.width = a.offsetWidth + "px";
  a.scrollIntoView({ inline: "nearest", block: "nearest" });
}
function selectSheet(i) {
  if (i === book.active) return;
  if (grid.editing) grid.commitEdit(0, 0);
  grid.saveView();
  const s = grid.scroll; s.style.setProperty("--swap", i > book.active ? "18px" : "-18px"); s.classList.remove("swap"); void s.offsetWidth; s.classList.add("swap");
  setTimeout(() => s.classList.remove("swap"), 320);
  book.active = i; book.emit("sheet");
}
function renameTab(i, b) {
  const inp = el("input", "tab-input"); inp.value = book.sheets[i].name; b.replaceChildren(inp); inp.focus(); inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return; done = true;
    if (ok && inp.value.trim() !== book.sheets[i].name && !book.renameSheet(i, inp.value)) toast("toast.badname");
    renderTabs();
  };
  inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") finish(true); else if (e.key === "Escape") finish(false); });
  inp.addEventListener("blur", () => finish(true)); inp.addEventListener("mousedown", (e) => e.stopPropagation());
}
function tabMenu(i, pt) {
  const n = book.sheets.length;
  W.openMenu([
    { label: t("tab.rename"), run: () => renameTab(i, $$tab(i)) },
    { label: t("tab.duplicate"), icon: "copy", run: () => { grid.saveView(); book.duplicateSheet(i); } },
    { label: t("tab.color"), run: () => W.openMenu([{ node: W.paletteNode({ current: book.sheets[i].tab, noneLabel: t("tb.nofill"), customLabel: t("tb.custom"), onPick: (c) => book.setTabColor(i, c) }) }], pt) },
    { sep: true },
    { label: t("tab.left"), disabled: i === 0, run: () => book.moveSheet(i, -1) },
    { label: t("tab.right"), disabled: i === n - 1, run: () => book.moveSheet(i, 1) },
    { sep: true },
    { label: t("tab.delete"), icon: "trash", disabled: n < 2, run: () => confirmDelete(i) },
  ], pt);
}
const $$tab = (i) => $("#tabs").querySelectorAll(".tab")[i];
async function confirmDelete(i) {
  const r = await ask({ title: t("dlg.deltitle"), text: t("dlg.deltext", { name: book.sheets[i].name }), actions: [["cancel", t("btn.cancel")], ["ok", t("tab.delete"), true]] });
  if (r === "ok") { grid.saveView(); book.deleteSheet(i); }
}
function ask({ title, text, actions }) {
  return new Promise((res) => {
    W.dialog({ title, content: text, size: "sm", actions: actions.map(([v, label, primary]) => ({ label, primary, value: v })), onClose: (v) => res(v) });
  });
}

// ───────────────────────── formula bar, name box, stats ─────────────────────────
function updateNameBox() {
  const g = grid.range(), nb = $("#namebox");
  if (document.activeElement === nb) return;
  if (grid.isFullCols(g) && grid.isFullRows(g)) nb.value = "A1:XFD1048576";
  else if (grid.isFullCols(g)) nb.value = colName(g.c1) + ":" + colName(g.c2);
  else if (grid.isFullRows(g)) nb.value = g.r1 + 1 + ":" + (g.r2 + 1);
  else { const a = grid.active(); nb.value = g.r1 === g.r2 && g.c1 === g.c2 ? rangeText(a.r, a.c, a.r, a.c) : rangeText(g.r1, g.c1, g.r2, g.c2); }
}
function updateBar() {
  if (grid.editing || barEdit) return;
  const a = grid.active(); $("#finput").value = book.rawInput(sheet(), a.r, a.c);
}
function updateBarLabels() { $("#namebox").title = t("bar.namebox"); $("#namebox").setAttribute("aria-label", t("bar.namebox")); $("#finput").placeholder = t("bar.formula"); }
let statTimer = 0, lastStat = "";
function updateStats(force) {
  clearTimeout(statTimer);
  statTimer = setTimeout(() => {
    const g = grid.range(), box = $("#stats");
    let html = `<span>${t("stat.ready")}</span>`;
    if (g.r1 !== g.r2 || g.c1 !== g.c2) {
      const s = book.stats(sheet(), g), f = (v) => (v === null ? "" : Math.abs(v) >= 1e12 ? v.toExponential(3) : String(parseFloat(v.toFixed(6))));
      if (s.count) html = (s.nums ? `<span>${t("stat.sum")}: <b>${f(s.sum)}</b></span><span>${t("stat.avg")}: <b>${f(s.avg)}</b></span>` : "") + `<span>${t("stat.count")}: <b>${s.count}</b></span>` + (s.nums > 1 ? `<span>${t("stat.min")}: <b>${f(s.min)}</b></span><span>${t("stat.max")}: <b>${f(s.max)}</b></span>` : "");
    }
    if (html !== lastStat || force) { lastStat = html; box.innerHTML = html; box.classList.remove("upd"); void box.offsetWidth; box.classList.add("upd"); }
  }, 40);
}
function initBar() {
  const nb = $("#namebox"), fi = $("#finput");
  nb.addEventListener("focus", () => nb.select());
  nb.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { nb.blur(); updateNameBox(); grid.scroll.focus(); return; }
    if (e.key !== "Enter") return;
    const v = nb.value.trim().toUpperCase(); let rg = null;
    const mc = /^\$?([A-Z]{1,3}):\$?([A-Z]{1,3})$/.exec(v), mr = /^\$?(\d+):\$?(\d+)$/.exec(v);
    if (mc) rg = { r1: 0, c1: colIndex(mc[1]), r2: MAX_ROWS - 1, c2: colIndex(mc[2]) };
    else if (mr) rg = { r1: +mr[1] - 1, c1: 0, r2: +mr[2] - 1, c2: MAX_COLS - 1 };
    else { const [a, b] = v.split(":"), p1 = parseAddr(a), p2 = b ? parseAddr(b) : p1; if (p1 && p2) rg = { r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c }; }
    if (rg) { nb.blur(); grid.select(rg.r1, rg.c1, rg.r2, rg.c2); grid.scroll.focus(); }
    else { nb.classList.remove("shake"); void nb.offsetWidth; nb.classList.add("shake"); }
  });
  nb.addEventListener("blur", () => updateNameBox());
  fi.addEventListener("focus", () => { barEdit = true; });
  fi.addEventListener("blur", () => { barEdit = false; if (!grid.editing) updateBar(); });
  fi.addEventListener("input", () => { if (grid.editing) grid.setEditorText(fi.value); });
  fi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (grid.editing) { grid.editor.value = fi.value; grid.commitEdit(1, 0); } else grid.commitText(fi.value, 1, 0); barEdit = false; }
    else if (e.key === "Escape") { e.preventDefault(); if (grid.editing) grid.cancelEdit(); barEdit = false; updateBar(); grid.scroll.focus(); }
  });
}

// ───────────────────────── full screen ─────────────────────────
async function toggleFullscreen() { isFull = !(await FS.isFullscreen()); await FS.setFullscreen(isFull); }

// ───────────────────────── zoom ─────────────────────────
function setZoomPct(p) {
  zoomPct = Math.max(50, Math.min(200, Math.round(p / 10) * 10));
  grid.setZoom(zoomPct / 100); $("#z-range").value = zoomPct; $("#z-val").textContent = zoomPct + "%";
}
const stepZoom = (d) => setZoomPct(zoomPct + d * 10);

// ───────────────────────── files ─────────────────────────
const stem = (n) => n.replace(/\.[^.]+$/, "");
function updateDoc() {
  const name = doc.name || t("doc.untitled");
  const dn = $("#docname"); dn.innerHTML = ""; dn.append(document.createTextNode(name));
  if (book.dirty) dn.appendChild(el("span", "dot"));
  const title = `${book.dirty ? "• " : ""}${name} — Material Xlsx`;
  document.title = title; FS.setWindowTitle(title);
}
async function guardUnsaved() {
  if (!book.dirty) return true;
  const r = await ask({ title: t("dlg.unsaved"), text: t("dlg.unsavedtext", { name: doc.name || t("doc.untitled") }), actions: [["cancel", t("btn.cancel")], ["discard", t("btn.discard")], ["save", t("btn.save"), true]] });
  if (r === "save") return save();
  return r === "discard";
}
async function newDoc() {
  if (!(await guardUnsaved())) return;
  book.reset([new Sheet("Sheet1")], [{}]); doc = { name: "", path: null }; prevSheetCount = 0;
  grid.scroll.scrollTo(0, 0); renderTabs(); updateDoc(); grid.select(0, 0);
}
const textOf = (bytes) => new TextDecoder("utf-8").decode(bytes);
async function loadFile(f) {
  W.busy(true);
  try {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const res = ext === "xlsx" ? await importXlsx(f.bytes) : importCSV(textOf(f.bytes), stem(f.name), S.lang);
    book.reset(res.sheets, res.styles); doc = { name: f.name, path: f.path }; prevSheetCount = 0;
    grid.scroll.scrollTo(0, 0); renderTabs(); updateDoc(); grid.select(0, 0);
    addRecent(f); toast("toast.opened", { name: f.name });
  } catch (e) { console.error(e); toast("toast.openfail", { err: String(e && e.message || e) }); }
  finally { W.busy(false); }
}
async function openDialog() { if (!(await guardUnsaved())) return; const f = await FS.openFileDialog(); if (f) await loadFile(f); }
async function openRecent(r) {
  if (!(await guardUnsaved())) return;
  try { await loadFile(await FS.openPath(r.path)); } catch { S.recents = S.recents.filter((x) => x.path !== r.path); saveSettings(); buildMenus(); toast("toast.missing", { name: r.name }); }
}
async function openPathDirect(path) { if (!(await guardUnsaved())) return; try { await loadFile(await FS.openPath(path)); } catch (e) { toast("toast.openfail", { err: String(e) }); } }
function addRecent(f) {
  if (!f.path) return;
  S.recents = [{ path: f.path, name: f.name }, ...S.recents.filter((r) => r.path !== f.path)].slice(0, 8); saveSettings(); buildMenus();
}
async function save() {
  if (grid.editing) grid.commitEdit(0, 0);
  if (!doc.path && FS.isTauri) return saveAs();
  return writeXlsx(doc.path);
}
async function saveAs() { if (grid.editing) grid.commitEdit(0, 0); return writeXlsx(null); }
async function writeXlsx(path) {
  W.busy(true);
  try {
    const bytes = await exportXlsx(book);
    const base = doc.name ? stem(doc.name) : t("doc.untitled");
    const r = await FS.saveFileDialog(base + ".xlsx", bytes, FS.XLSX_FILTER, path);
    if (!r) return false;
    doc = { name: r.name, path: r.path }; book.dirty = false; updateDoc(); addRecent(r); toast("toast.saved", { name: r.name });
    return true;
  } catch (e) { console.error(e); toast("toast.savefail", { err: String(e && e.message || e) }); return false; }
  finally { W.busy(false); }
}
async function exportCsv() {
  try {
    const bytes = new TextEncoder().encode(toCSV(book, sheet()));
    const r = await FS.saveFileDialog(sheet().name + ".csv", bytes, FS.CSV_FILTER, null);
    if (r) toast("toast.exported", { name: r.name });
  } catch (e) { toast("toast.savefail", { err: String(e) }); }
}
async function importCsvSheet() {
  const f = await FS.openFileDialog(); if (!f) return;
  try {
    const res = importCSV(textOf(f.bytes), stem(f.name), S.lang);
    const imp = res.sheets[0];
    grid.saveView();
    book.tx(() => {
      const ns = new Sheet(book.uniqueName(imp.name));
      for (const [k, c] of imp.cells) ns.cells.set(k, c.s ? { ...c, s: book.intern(res.styles[c.s]) } : c);
      book.sheets.push(ns); book.active = book.sheets.length - 1;
    });
    toast("toast.imported", { name: f.name });
  } catch (e) { toast("toast.openfail", { err: String(e) }); }
}
function printSheet() {
  const sh = sheet(), b = book.bounds(sh);
  if (b.maxR < 0) { toast("toast.empty"); return; }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let html = "<table>";
  for (let r = 0; r <= b.maxR; r++) {
    if (sh.hidden.has(r)) continue;
    html += "<tr>";
    for (let c = 0; c <= b.maxC; c++) {
      const d = book.display(sh, r, c), st = d.st;
      const css = [st.b ? "font-weight:700" : "", st.i ? "font-style:italic" : "", st.fc ? `color:${st.fc}` : "", st.bg ? `background:${st.bg}` : "", `text-align:${st.ha || (typeof d.v === "number" ? "right" : "left")}`, `width:${(sh.colW[c] ?? sh.defW) * 0.75}pt`].filter(Boolean).join(";");
      html += `<td style="${css}">${esc(d.text)}</td>`;
    }
    html += "</tr>";
  }
  $("#print-root").innerHTML = html + "</table>";
  setTimeout(() => window.print(), 60);
}

// ───────────────────────── filter popover ─────────────────────────
function toggleFilter() {
  const sh = sheet();
  if (sh.filter) { book.setFilter(sh, null); return; }
  let g = grid.range();
  if (g.r1 === g.r2 && g.c1 === g.c2) g = grid.currentRegion(g.r1, g.c1);
  if (!g || g.r2 <= g.r1) { toast("toast.nofilter"); return; }
  book.setFilter(sh, g);
}
function filterPanel(col, rect) {
  const sh = sheet(), f = sh.filter; if (!f) return;
  const vals = new Map();
  for (let r = f.r1 + 1; r <= f.r2; r++) { const tx = book.display(sh, r, col).text; vals.set(tx, true); }
  const list = [...vals.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })).slice(0, 500);
  const excl = new Set(f.excl[col] || []);
  const box = el("div", "fpanel"), q = el("input", "search"), fv = el("div", "fvals"), row = el("div", "row");
  q.placeholder = t("flt.search"); box.append(q, fv, row);
  const allBox = el("label"); allBox.innerHTML = '<input type="checkbox"><span></span>'; allBox.lastChild.textContent = t("flt.all");
  const checks = [];
  const render = () => {
    fv.replaceChildren(allBox);
    const term = q.value.toLowerCase();
    list.filter((v) => !term || v.toLowerCase().includes(term)).forEach((v) => {
      const l = el("label"); l.innerHTML = '<input type="checkbox"><span></span>'; const cb = l.firstChild; cb.checked = !excl.has(v); l.lastChild.textContent = v === "" ? t("flt.blank") : v;
      cb.addEventListener("change", () => { if (cb.checked) excl.delete(v); else excl.add(v); sync(); }); fv.appendChild(l); checks.push(cb);
    });
    sync();
  };
  const sync = () => { allBox.firstChild.checked = excl.size === 0; };
  allBox.firstChild.addEventListener("change", (e) => { if (e.target.checked) excl.clear(); else list.forEach((v) => excl.add(v)); render(); });
  const cancel = el("button", "btn text primary"), ok = el("button", "btn filled"); cancel.textContent = t("btn.cancel"); ok.textContent = t("btn.apply"); row.append(cancel, ok);
  cancel.addEventListener("click", () => W.closeMenu());
  ok.addEventListener("click", () => { const all = { ...f.excl }; if (excl.size) all[col] = new Set(excl); else delete all[col]; W.closeMenu(); book.applyFilter(sh, all); });
  q.addEventListener("input", render); render();
  W.openMenu([{ node: box }], { x: rect.left, y: rect.bottom + 4 });
  setTimeout(() => q.focus(), 60);
}

// ───────────────────────── find & replace ─────────────────────────
let findEl = null, matches = [], matchIdx = -1;
function openFind(withReplace) {
  if (findEl) { findEl.querySelector(".f-find").focus(); findEl.querySelector(".f-find").select(); findEl.classList.toggle("noreplace", !withReplace); findEl.querySelectorAll(".rep").forEach((e) => (e.hidden = !withReplace)); return; }
  findEl = el("div", "find");
  findEl.innerHTML = `
    <div class="r"><input class="field f-find" spellcheck="false"><button class="icon-btn f-prev">${icon("chevl")}</button><button class="icon-btn f-next">${icon("chevr")}</button><button class="icon-btn f-close">${icon("close")}</button></div>
    <div class="r rep"><input class="field f-rep" spellcheck="false"><button class="btn tonal f-r1"></button><button class="btn tonal f-rall"></button></div>
    <div class="opts"><label><input type="checkbox" class="o-case"><span></span></label><label><input type="checkbox" class="o-whole"><span></span></label><label><input type="checkbox" class="o-all"><span></span></label></div>
    <div class="r"><span class="cnt"></span></div>`;
  const q = (s) => findEl.querySelector(s);
  q(".f-find").placeholder = t("find.find"); q(".f-rep").placeholder = t("find.replacewith");
  const labels = [".o-case", ".o-whole", ".o-all"], keys = ["find.case", "find.whole", "find.allsheets"];
  labels.forEach((s, i) => (q(s).nextElementSibling.textContent = t(keys[i])));
  q(".f-r1").textContent = t("find.replace"); q(".f-rall").textContent = t("find.replaceall");
  q(".f-prev").title = t("find.prev"); q(".f-next").title = t("find.next"); q(".f-close").title = t("btn.close");
  q(".rep").hidden = !withReplace;
  $(".gridarea").appendChild(findEl);
  const collect = () => {
    matches = []; const term = q(".f-find").value;
    if (term) {
      const cs = q(".o-case").checked, whole = q(".o-whole").checked, all = q(".o-all").checked, T = cs ? term : term.toLowerCase();
      const test = (s) => { const x = cs ? s : s.toLowerCase(); return whole ? x === T : x.includes(T); };
      (all ? book.sheets : [sheet()]).forEach((sh) => {
        const si = book.sheets.indexOf(sh);
        [...sh.cells.keys()].sort((a, b) => a - b).forEach((k) => {
          const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS;
          if (test(book.display(sh, r, c).text) || test(book.rawInput(sh, r, c))) matches.push({ si, r, c });
        });
      });
    }
    q(".cnt").textContent = term ? (matches.length ? t("find.count", { i: Math.max(matchIdx + 1, 0), n: matches.length }) : t("find.none")) : "";
  };
  const go = (d) => {
    collect(); if (!matches.length) return;
    const a = grid.active(), cur = book.active;
    if (matchIdx < 0 || d === 0) { const i = matches.findIndex((m) => m.si > cur || (m.si === cur && (m.r > a.r || (m.r === a.r && m.c >= a.c)))); matchIdx = i < 0 ? 0 : i; }
    else matchIdx = (matchIdx + d + matches.length) % matches.length;
    const m = matches[matchIdx];
    if (m.si !== book.active) selectSheet(m.si);
    grid.select(m.r, m.c); q(".cnt").textContent = t("find.count", { i: matchIdx + 1, n: matches.length });
  };
  const rawReplace = (raw) => {
    const term = q(".f-find").value, rep = q(".f-rep").value, cs = q(".o-case").checked, whole = q(".o-whole").checked;
    if (whole) return (cs ? raw === term : raw.toLowerCase() === term.toLowerCase()) ? rep : raw;
    return raw.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), cs ? "g" : "gi"), () => rep);
  };
  q(".f-find").addEventListener("input", () => { matchIdx = -1; go(0); });
  q(".f-find").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); } else if (e.key === "Escape") closeFind(); });
  q(".f-rep").addEventListener("keydown", (e) => { if (e.key === "Enter") q(".f-r1").click(); else if (e.key === "Escape") closeFind(); });
  [".o-case", ".o-whole", ".o-all"].forEach((s) => q(s).addEventListener("change", () => { matchIdx = -1; go(0); }));
  q(".f-prev").addEventListener("click", () => go(-1)); q(".f-next").addEventListener("click", () => go(1)); q(".f-close").addEventListener("click", closeFind);
  q(".f-r1").addEventListener("click", () => {
    collect(); const a = grid.active(), i = matches.findIndex((m) => m.si === book.active && m.r === a.r && m.c === a.c);
    if (i < 0) { go(0); return; }
    const raw = book.rawInput(sheet(), a.r, a.c); book.setInput(sheet(), a.r, a.c, rawReplace(raw)); matchIdx = -1; go(1);
  });
  q(".f-rall").addEventListener("click", () => {
    collect(); if (!matches.length) return;
    const n = matches.length; grid.saveView();
    book.tx(() => matches.forEach((m) => { const sh = book.sheets[m.si]; book._setInput(sh, m.r, m.c, rawReplace(book.rawInput(sh, m.r, m.c))); }));
    toast("find.replaced", { n }); matchIdx = -1; collect();
  });
  q(".f-find").focus();
  const sel = grid.range(); if (sel.r1 === sel.r2 && sel.c1 === sel.c2) { const v = book.display(sheet(), sel.r1, sel.c1).text; if (v && v.length < 60) { q(".f-find").value = v; go(0); } }
  q(".f-find").select();
}
function closeFind() {
  if (!findEl) return; const f = findEl; findEl = null;
  if (S.anim) { f.classList.add("closing"); setTimeout(() => f.remove(), 150); } else f.remove();
  grid.scroll.focus({ preventScroll: true });
}

// ───────────────────────── dialogs ─────────────────────────
function seg(options, value, onPick) {
  const box = el("div", "seg"); box.setAttribute("role", "radiogroup");
  const draw = (val) => {
    box.innerHTML = "";
    for (const [v, text, ico] of options) {
      const b = el("button"); b.setAttribute("role", "radio"); b.setAttribute("aria-checked", v === val);
      b.innerHTML = (ico ? icon(ico) : "") + "<span></span>"; b.querySelector("span").textContent = text;
      b.addEventListener("click", (e) => { onPick(v, e); draw(v); }); box.appendChild(b);
    }
  };
  draw(value); return box;
}
function srow(title, desc, control) {
  const r = el("div", "srow"), g = el("div", "grow"); g.innerHTML = '<div class="tt"></div><div class="muted"></div>';
  g.firstChild.textContent = title; g.lastChild.textContent = desc || ""; if (!desc) g.lastChild.remove(); r.append(g, control); return r;
}
async function settingsDialog(scrollToAbout) {
  const box = el("div", "set-sec");
  box.appendChild(el("h3")).textContent = t("set.appearance");
  box.appendChild(seg([["system", t("theme.system"), "system"], ["light", t("theme.light"), "sun"], ["dark", t("theme.dark"), "moon"]], S.mode, (v, e) => { const rc = e.currentTarget.getBoundingClientRect(); changeMode(v, { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 }); }));
  const sw = el("div", "swatches"); sw.style.marginTop = "18px";
  const drawSw = () => {
    sw.innerHTML = ""; let matched = false;
    for (const [col, name] of PRESETS) {
      const sel = col.toLowerCase() === S.seed.toLowerCase(); matched ||= sel;
      const b = el("button", "swatch"); b.style.background = col; b.title = t("color." + name); b.setAttribute("role", "radio"); b.setAttribute("aria-checked", sel); b.innerHTML = icon("check");
      b.addEventListener("click", () => { changeSeed(col); hex.value = S.seed; hex.classList.remove("invalid"); drawSw(); }); sw.appendChild(b);
    }
    const c = el("label", "swatch custom"); c.title = t("tb.custom"); c.setAttribute("aria-checked", !matched); c.setAttribute("role", "radio"); if (!matched) c.style.background = S.seed;
    c.innerHTML = icon("tune"); const inp = el("input"); inp.type = "color"; inp.value = S.seed.toLowerCase();
    inp.addEventListener("input", () => { changeSeed(inp.value); c.style.background = inp.value; hex.value = S.seed; });
    c.appendChild(inp); sw.appendChild(c);
  };
  box.appendChild(el("h3")).textContent = t("set.color"); box.appendChild(sw);
  const hex = el("input", "field"); hex.maxLength = 7; hex.value = S.seed; hex.spellcheck = false; hex.style.marginTop = "14px";
  hex.addEventListener("input", () => { let v = hex.value.trim(); if (v && v[0] !== "#") v = "#" + v; const ok = /^#[0-9a-f]{6}$/i.test(v); hex.classList.toggle("invalid", !!hex.value && !ok); if (ok) { changeSeed(v); drawSw(); } });
  drawSw(); box.appendChild(hex);
  box.appendChild(el("h3")).textContent = t("set.language");
  box.appendChild(seg([["en", "English"], ["vi", "Tiếng Việt"]], S.lang, (v) => { changeLang(v); dlg.close(); setTimeout(() => settingsDialog(), 200); }));
  box.appendChild(el("h3")).textContent = t("set.general");
  const g = el("input", "switch"); g.type = "checkbox"; g.checked = S.gridlines; g.addEventListener("change", () => { S.gridlines = g.checked; saveSettings(); grid.showLines = S.gridlines; grid.themeChanged(); });
  const a = el("input", "switch"); a.type = "checkbox"; a.checked = S.anim; a.addEventListener("change", () => { S.anim = a.checked; saveSettings(); applyAnim(); });
  const fs = el("input", "switch"); fs.type = "checkbox"; fs.checked = S.fullscreen;
  fs.addEventListener("change", () => { S.fullscreen = fs.checked; saveSettings(); if (fs.checked) { isFull = true; FS.setFullscreen(true); } });
  box.appendChild(srow(t("set.gridlines"), "", g)); box.appendChild(srow(t("set.anim"), t("set.animdesc"), a)); box.appendChild(srow(t("set.fullscreen"), t("set.fullscreendesc"), fs));
  box.appendChild(el("h3")).textContent = t("set.about");
  const ab = el("div", "about"); ab.id = "about-block";
  ab.innerHTML = `<img src="app-icon.png" alt=""><div><div class="nm">Material Xlsx</div><div class="muted" id="ver"></div><div class="by"></div></div>`;
  ab.querySelector(".by").innerHTML = t("about.by"); box.appendChild(ab);
  FS.appVersion().then((v) => { const e = ab.querySelector("#ver"); if (e) e.textContent = t("about.version", { v }); });
  const dlg = W.dialog({ title: t("cmd.settings"), content: box, actions: [{ label: t("btn.close"), primary: true }] });
  if (scrollToAbout) setTimeout(() => ab.scrollIntoView({ behavior: "smooth", block: "end" }), 120);
}
function shortcutsDialog() {
  const rows = [["Ctrl+N / O / S", "cmd.new|cmd.open|cmd.save"], ["Ctrl+Shift+S", "cmd.saveAs"], ["Ctrl+Z / Y", "cmd.undo|cmd.redo"], ["Ctrl+C / X / V", "cmd.copy|cmd.cut|cmd.paste"], ["Ctrl+B / I / U", "cmd.bold|cmd.italic|cmd.underline"], ["Ctrl+F / H", "cmd.find|cmd.replace"], ["Ctrl+A", "cmd.selectAll"], ["Ctrl+D / R", "sc.fill"], ["Ctrl+←↑→↓", "sc.jump"], ["Ctrl+Space / Shift+Space", "sc.selcolrow"], ["F2", "sc.edit"], ["Alt+Enter", "sc.newline"], ["Enter / Tab", "sc.move"], ["Delete", "cmd.clearContents"], ["Alt+=", "cmd.autosum"], ["Ctrl+= / − / 0", "sc.zoom"], ["Ctrl+P", "cmd.print"], ["F11", "cmd.fullscreen"], ["Ctrl+,", "cmd.settings"], ["F1", "cmd.shortcuts"]];
  const box = el("div", "kbd");
  for (const [k, names] of rows) { const a = el("div"); a.textContent = names.split("|").map((n) => t(n)).join(" / "); const b = el("div", "k"); b.textContent = sc(k); box.append(a, b); }
  W.dialog({ title: t("cmd.shortcuts"), content: box, actions: [{ label: t("btn.close"), primary: true }] });
}

// ───────────────────────── context menu ─────────────────────────
function contextMenu(x, y, h) {
  const base = [item("cut"), item("copy"), item("paste"), item("pasteValues")];
  let items;
  if (h.type === "colhdr") items = [...base, { sep: true }, item("colLeft"), item("colRight"), item("delCol"), { sep: true }, item("clearContents")];
  else if (h.type === "rowhdr") items = [...base, { sep: true }, item("rowAbove"), item("rowBelow"), item("delRow"), { sep: true }, item("clearContents")];
  else items = [...base, { sep: true }, item("rowAbove"), item("colLeft"), item("delRow"), item("delCol"), { sep: true }, item("merge"), item("sortAsc"), item("sortDesc"), { sep: true }, item("clearContents"), item("clearFormats")];
  W.openMenu(items, { x, y });
}

// ───────────────────────── keyboard ─────────────────────────
function initKeys() {
  document.addEventListener("keydown", (e) => {
    if (W.modalOpen()) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const inField = e.target.matches && e.target.matches("input,textarea,select");
    if (ctrl && k === "s") { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
    else if (ctrl && k === "o") { e.preventDefault(); openDialog(); }
    else if (ctrl && k === "n") { e.preventDefault(); newDoc(); }
    else if (ctrl && k === "p") { e.preventDefault(); printSheet(); }
    else if (ctrl && (k === "f" || k === "h")) { e.preventDefault(); openFind(k === "h"); }
    else if (ctrl && k === "z" && !inField) { e.preventDefault(); e.shiftKey ? book.redo() : CMD.undo.run(); }
    else if (ctrl && k === "y" && !inField) { e.preventDefault(); CMD.redo.run(); }
    else if (ctrl && !inField && !grid.editing && ["b", "i", "u"].includes(k)) { e.preventDefault(); CMD[{ b: "bold", i: "italic", u: "underline" }[k]].run(); }
    else if (ctrl && (e.key === "=" || e.key === "+")) { e.preventDefault(); stepZoom(1); }
    else if (ctrl && e.key === "-") { e.preventDefault(); stepZoom(-1); }
    else if (ctrl && e.key === "0") { e.preventDefault(); setZoomPct(100); }
    else if (e.altKey && e.key === "=") { e.preventDefault(); CMD.autosum.run(); }
    else if (e.key === "F1") { e.preventDefault(); shortcutsDialog(); }
    else if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); }
    else if (ctrl && e.key === ",") { e.preventDefault(); settingsDialog(); }
  });
}

// ───────────────────────── window events ─────────────────────────
function initWindow() {
  const win = FS.currentWindow();
  if (win && win.onCloseRequested) {
    win.onCloseRequested(async (ev) => {
      if (!book.dirty) return;
      ev.preventDefault();
      if (await guardUnsaved()) win.destroy();
    });
  } else window.addEventListener("beforeunload", (e) => { if (book.dirty) { e.preventDefault(); e.returnValue = ""; } });
  let drop = null;
  const hideDrop = () => { if (drop) { drop.remove(); drop = null; } };
  FS.listen("tauri://drag-enter", () => { if (!drop) { drop = el("div", "drop"); drop.textContent = t("drop.hint"); document.body.appendChild(drop); } });
  FS.listen("tauri://drag-leave", hideDrop);
  FS.listen("tauri://drag-drop", (e) => { hideDrop(); const p = e.payload && e.payload.paths && e.payload.paths[0]; if (p && /\.(xlsx|csv|tsv|txt)$/i.test(p)) openPathDirect(p); });
}

// ───────────────────────── init ─────────────────────────
export async function init() {
  setLang(S.lang); book.lang = S.lang; document.documentElement.lang = S.lang; applyAnim();
  applyColors(S.seed, S.mode);
  onSystemTheme(() => { if (S.mode === "system") { applyColors(S.seed, S.mode); grid.themeChanged(); } });
  W.initRipple(); W.setModalHandler((n) => { grid.enabled = n === 0; });
  grid = new Grid($("#grid"), book, {
    selection: () => { updateNameBox(); updateBar(); refreshToolbar(); updateStats(); },
    edit: (on, text) => { if (on) $("#finput").value = text; else { barEdit = false; updateBar(); } refreshToolbar(); },
    context: contextMenu, filter: filterPanel, zoom: (d) => stepZoom(d),
    toast: (what) => toast(what === "cut" ? "toast.cut" : "toast.copied"),
  });
  grid.showLines = S.gridlines; grid.themeChanged();
  book.on((kind) => {
    renderTabs(); updateDoc(); refreshToolbar(); updateBar(); updateStats();
    if (kind === "change") $("#docname").classList.remove("flash");
  });
  buildMenus(); buildToolbar(); initAppbar(); initBar(); initKeys(); initWindow(); applyI18n(); updateBarLabels();
  $("#tab-add").addEventListener("click", () => CMD.newSheet.run()); $("#tab-add").title = t("tab.add");
  $("#tab-prev").addEventListener("click", () => ($("#tabs").scrollLeft -= 160)); $("#tab-next").addEventListener("click", () => ($("#tabs").scrollLeft += 160));
  $("#z-out").addEventListener("click", () => stepZoom(-1)); $("#z-in").addEventListener("click", () => stepZoom(1));
  $("#z-range").addEventListener("input", (e) => setZoomPct(+e.target.value));
  new ResizeObserver(() => moveInd()).observe($("#tabs"));
  renderTabs(); updateDoc(); grid.refresh(); grid.select(0, 0);
  // window: honour "always start in full screen", then reveal it (the window starts hidden to avoid a size flash)
  if (S.fullscreen) { isFull = true; await FS.setFullscreen(true); }
  await FS.showWindow();
  const lf = await FS.launchFile(); if (lf) openPathDirect(lf);
  window.__mx = { book, grid, CMD, S, openFind, changeLang };   // handy for debugging / tests
}

// File I/O: XLSX (via ExcelJS), CSV/TSV and base64 helpers for the Rust bridge.
import { Book, Sheet } from "./model.js";
import { key, keyRow, keyCol, parseAddr } from "./refs.js";
import { XErr } from "./formula.js";
import { isDateFormat } from "./numfmt.js";

const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];
const DEFAULT_FONT = "Calibri", DEFAULT_SIZE = 11;
const px2w = (px) => Math.max(0, (px - 5) / 7);
const w2px = (w) => Math.round(w * 7 + 5);

function tint(hex, t) {
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const f = (c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
  return ch.map((c) => f(c).toString(16).padStart(2, "0")).join("");
}
function colorOf(c) {
  if (!c) return undefined;
  if (c.argb) return "#" + String(c.argb).slice(-6).toLowerCase();
  if (c.theme !== undefined) { let h = THEME[c.theme] || "000000"; if (c.tint) h = tint(h, c.tint); return "#" + h.toLowerCase(); }
  return undefined;
}
const argb = (hex) => ({ argb: "FF" + hex.replace("#", "").toUpperCase() });
const dateToSerialJS = (d) => d.getTime() / 86400000 + 25569;

function convertValue(v) {
  if (v instanceof Date) return dateToSerialJS(v);
  if (v && typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return typeof v.text === "object" ? convertValue(v.text) : String(v.text);
    if ("error" in v) return String(v.error);
  }
  return v === undefined ? null : v;
}

// ───────────────────────── XLSX import ─────────────────────────
export async function importXlsx(bytes) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  const book = new Book();
  const sheets = [];
  wb.eachSheet((ws) => {
    const sh = new Sheet(ws.name);
    const props = ws.properties || {};
    sh.defW = props.defaultColWidth ? w2px(props.defaultColWidth) : 64;
    sh.defH = props.defaultRowHeight ? Math.round(props.defaultRowHeight * 4 / 3) : 20;
    if (props.tabColor) sh.tab = colorOf(props.tabColor) || null;
    const styleOf = (cell) => {
      const st = {};
      const f = cell.font || {};
      if (f.name && f.name !== DEFAULT_FONT) st.ff = f.name;
      if (f.size && f.size !== DEFAULT_SIZE) st.fs = f.size;
      if (f.bold) st.b = true; if (f.italic) st.i = true; if (f.underline) st.u = true; if (f.strike) st.st = true;
      const fc = colorOf(f.color); if (fc && fc !== "#000000") st.fc = fc;
      const fl = cell.fill;
      if (fl && fl.type === "pattern" && fl.pattern === "solid") { const bg = colorOf(fl.fgColor); if (bg && bg !== "#ffffff") st.bg = bg; }
      const al = cell.alignment || {};
      if (["left", "center", "right"].includes(al.horizontal)) st.ha = al.horizontal;
      if (al.vertical === "top") st.va = "top"; else if (al.vertical === "middle" || al.vertical === "center") st.va = "middle";
      if (al.wrapText) st.wr = true;
      const bd = cell.border || {};
      for (const [k, side] of [["bT", "top"], ["bB", "bottom"], ["bL", "left"], ["bR", "right"]]) if (bd[side] && bd[side].style) st[k] = colorOf(bd[side].color) || "#000000";
      if (cell.numFmt && cell.numFmt !== "General") st.nf = cell.numFmt;
      return book.intern(st);
    };
    ws.eachRow({ includeEmpty: true }, (row, rn) => {
      if (row.height) sh.rowH[rn - 1] = Math.round(row.height * 4 / 3);
      if (row.hidden) sh.hidden.add(rn - 1);
      row.eachCell({ includeEmpty: false }, (cell, cn) => {
        const r = rn - 1, c = cn - 1;
        if (r >= 1048576 || c >= 16384) return;
        const s = styleOf(cell);
        const out = { s };
        if (cell.type === 6) {          // formula
          if (cell.formula) { out.f = String(cell.formula).replace(/^=/, ""); const rv = convertValue(cell.result); if (rv !== null) out.rv = rv; }
          else { const rv = convertValue(cell.result); if (rv !== null) out.v = rv; }
        } else if (cell.type === 1 || cell.type === 0) { /* merge slave / empty: style only */ }
        else {
          const v = convertValue(cell.value);
          if (v !== null) out.v = v;
          if (cell.type === 4 && !isDateFormat(cell.numFmt)) out.s = book.intern({ ...book.styles[s], nf: "yyyy-mm-dd" });
        }
        if (out.v !== undefined || out.f !== undefined || out.s) sh.cells.set(key(r, c), out);
      });
    });
    const maxCol = ws.columnCount || 0;
    for (let i = 1; i <= maxCol; i++) {
      const col = ws.getColumn(i);
      if (col.width) sh.colW[i - 1] = w2px(col.width);
    }
    const merges = (ws.model && ws.model.merges) || [];
    for (const m of merges) {
      const [a, b] = m.split(":"), p1 = parseAddr(a), p2 = parseAddr(b || a);
      if (p1 && p2) sh.merges.push({ r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c });
    }
    const view = (ws.views || [])[0];
    if (view && view.state === "frozen") sh.freeze = { r: view.ySplit || 0, c: view.xSplit || 0 };
    const af = ws.autoFilter;
    if (af) {
      let p1, p2;
      if (typeof af === "string") { const [a, b] = af.split(":"); p1 = parseAddr(a); p2 = parseAddr(b || a); }
      else if (af.from && af.to) { p1 = { r: af.from.row - 1, c: af.from.column - 1 }; p2 = { r: af.to.row - 1, c: af.to.column - 1 }; }
      if (p1 && p2) sh.filter = { r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c, excl: {} };
    }
    sh.touch();
    sheets.push(sh);
  });
  if (!sheets.length) sheets.push(new Sheet("Sheet1"));
  return { sheets, styles: book.styles };
}

// ───────────────────────── XLSX export ─────────────────────────
export async function exportXlsx(book) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Material Xlsx"; wb.created = new Date();
  for (const sh of book.sheets) {
    const ws = wb.addWorksheet(sh.name, {
      views: sh.freeze.r || sh.freeze.c ? [{ state: "frozen", xSplit: sh.freeze.c, ySplit: sh.freeze.r }] : [{}],
      properties: { defaultColWidth: px2w(sh.defW), defaultRowHeight: sh.defH * 0.75, ...(sh.tab ? { tabColor: argb(sh.tab) } : {}) },
    });
    for (const [c, w] of Object.entries(sh.colW)) ws.getColumn(+c + 1).width = px2w(w);
    for (const [r, h] of Object.entries(sh.rowH)) ws.getRow(+r + 1).height = h * 0.75;
    for (const r of sh.hidden) ws.getRow(r + 1).hidden = true;
    for (const [k, cell] of sh.cells) {
      const r = keyRow(k), c = keyCol(k), x = ws.getCell(r + 1, c + 1);
      if (cell.f !== undefined) {
        const v = book.value(sh, r, c);
        const result = v instanceof XErr ? { error: v.code === "#CIRC!" ? "#VALUE!" : v.code } : v;
        x.value = { formula: cell.f, ...(result !== null && result !== undefined ? { result } : {}) };
      } else if (cell.v !== undefined) x.value = cell.v;
      const st = book.styles[cell.s || 0];
      if (st.ff || st.fs || st.b || st.i || st.u || st.st || st.fc) {
        x.font = { name: st.ff || DEFAULT_FONT, size: st.fs || DEFAULT_SIZE, bold: !!st.b, italic: !!st.i, underline: !!st.u, strike: !!st.st, ...(st.fc ? { color: argb(st.fc) } : {}) };
      }
      if (st.bg) x.fill = { type: "pattern", pattern: "solid", fgColor: argb(st.bg) };
      if (st.ha || st.va || st.wr) x.alignment = { ...(st.ha ? { horizontal: st.ha } : {}), ...(st.va ? { vertical: st.va } : {}), ...(st.wr ? { wrapText: true } : {}) };
      const b = {};
      for (const [k, side] of [["bT", "top"], ["bB", "bottom"], ["bL", "left"], ["bR", "right"]]) if (st[k]) b[side] = { style: "thin", color: argb(st[k]) };
      if (Object.keys(b).length) x.border = b;
      if (st.nf) x.numFmt = st.nf;
    }
    for (const m of sh.merges) { try { ws.mergeCells(m.r1 + 1, m.c1 + 1, m.r2 + 1, m.c2 + 1); } catch { /* overlapping merge */ } }
    if (sh.filter) ws.autoFilter = { from: { row: sh.filter.r1 + 1, column: sh.filter.c1 + 1 }, to: { row: sh.filter.r2 + 1, column: sh.filter.c2 + 1 } };
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// ───────────────────────── CSV / TSV ─────────────────────────
export function detectDelimiter(text) {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const score = (d) => (head.match(new RegExp(d === "\t" ? "\\t" : "\\" + d, "g")) || []).length;
  const best = [",", ";", "\t", "|"].map((d) => [d, score(d)]).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : ",";
}
export function parseDelimited(text, delim = ",") {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"' && cur === "") q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
export function toCSV(book, sh, delim = ",") {
  const b = book.bounds(sh);
  const q = (t) => (new RegExp(`[${delim === "\t" ? "\\t" : delim}"\\n\\r]`).test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
  const lines = [];
  for (let r = 0; r <= b.maxR; r++) {
    const row = [];
    for (let c = 0; c <= b.maxC; c++) row.push(q(book.display(sh, r, c).text));
    lines.push(row.join(delim));
  }
  return "\uFEFF" + lines.join("\r\n");
}
export function importCSV(text, name, lang) {
  const book = new Book(); book.lang = lang;
  const grid = parseDelimited(text, detectDelimiter(text));
  const sh = book.sheets[0]; sh.name = name || "Sheet1";
  grid.forEach((row, r) => row.forEach((t, c) => { if (t !== "") book._setInput(sh, r, c, t); }));
  return { sheets: book.sheets, styles: book.styles };
}

// ───────────────────────── base64 ─────────────────────────
export function bytesToBase64(u8) {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(b64), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

// Cell references, address helpers and the formula lexer (shared by parser, copy/paste and insert/delete).
export const MAX_ROWS = 1048576;
export const MAX_COLS = 16384;
export const key = (r, c) => r * MAX_COLS + c;
export const keyRow = (k) => Math.floor(k / MAX_COLS);
export const keyCol = (k) => k % MAX_COLS;

export function colName(c) {
  let s = "";
  c += 1;
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}
export function colIndex(name) {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export const addr = (r, c) => colName(c) + (r + 1);
export function parseAddr(s) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s.trim());
  if (!m) return null;
  const c = colIndex(m[1]), r = parseInt(m[2], 10) - 1;
  return c < MAX_COLS && r >= 0 && r < MAX_ROWS ? { r, c } : null;
}
export function rangeText(r1, c1, r2, c2) {
  return r1 === r2 && c1 === c2 ? addr(r1, c1) : `${addr(r1, c1)}:${addr(r2, c2)}`;
}

const NAME_START = "A-Za-z_\\u00C0-\\uFFFF";
const NAME_BODY = "\\w.\\u00C0-\\uFFFF";
const REF_RE = new RegExp(
  `(?:(?:'(?:[^']|'')+'|[${NAME_START}][${NAME_BODY}]*)!)?(?:\\$?[A-Za-z]{1,3}\\$?\\d+(?::\\$?[A-Za-z]{1,3}\\$?\\d+)?|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}|\\$?\\d+:\\$?\\d+)(?![\\w(])`, "y");
const NUM_RE = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const IDENT_RE = /[A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*/y;
const ERR_RE = /#(?:N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|CIRC!)/y;

export function tokenize(src) {
  const out = [];
  let i = 0;
  const test = (re) => { re.lastIndex = i; return re.exec(src); };
  while (i < src.length) {
    const ch = src[i];
    let m;
    if (/\s/.test(ch)) { m = /\s+/y; m.lastIndex = i; const t = m.exec(src)[0]; out.push({ t: "ws", x: t }); i += t.length; continue; }
    if (ch === '"') {
      let j = i + 1, s = "";
      for (;;) {
        if (j >= src.length) throw new Error("unterminated string");
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      out.push({ t: "str", x: src.slice(i, j + 1), v: s }); i = j + 1; continue;
    }
    if ((m = test(ERR_RE))) { out.push({ t: "err", x: m[0] }); i += m[0].length; continue; }
    if ((m = test(REF_RE))) { out.push({ t: "ref", x: m[0] }); i += m[0].length; continue; }
    if ((m = test(NUM_RE))) { out.push({ t: "num", x: m[0], v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = test(IDENT_RE))) {
      const id = m[0]; i += id.length;
      if (src[i] === "(") out.push({ t: "func", x: id });
      else if (/^(true|false)$/i.test(id)) out.push({ t: "bool", x: id, v: id.toLowerCase() === "true" });
      else out.push({ t: "name", x: id });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") { out.push({ t: "op", x: two }); i += 2; continue; }
    if ("+-*/^&=<>(),;%:".includes(ch)) { out.push({ t: "op", x: ch === ";" ? "," : ch }); i++; continue; }
    throw new Error("unexpected " + ch);
  }
  return out;
}

export function quoteSheet(name) {
  return new RegExp(`^[${NAME_START}][${NAME_BODY}]*$`).test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name)
    ? name : "'" + name.replace(/'/g, "''") + "'";
}

// Parse a ref token to {sheet, kind: cell|col|row, r1,c1,r2,c2, a:{r1,c1,r2,c2}} (a = absolute flags)
export function parseRef(text) {
  let sheet = null, body = text;
  const m = /^(?:'((?:[^']|'')+)'|([^'!]+))!/.exec(text);
  if (m) { sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]; body = text.slice(m[0].length); }
  const parts = body.split(":");
  const one = (s) => {
    const mm = /^(\$?)([A-Za-z]*)(\$?)(\d*)$/.exec(s);
    if (!mm) return null;
    return { ac: !!mm[1], c: mm[2] ? colIndex(mm[2]) : null, ar: !!mm[3], r: mm[4] ? parseInt(mm[4], 10) - 1 : null };
  };
  const p1 = one(parts[0]), p2 = parts[1] !== undefined ? one(parts[1]) : p1;
  if (!p1 || !p2) return null;
  let kind = "cell";
  if (p1.r === null && p2.r === null) kind = "col";
  else if (p1.c === null && p2.c === null) kind = "row";
  const ref = {
    sheet, kind,
    r1: kind === "col" ? 0 : p1.r, r2: kind === "col" ? MAX_ROWS - 1 : p2.r,
    c1: kind === "row" ? 0 : p1.c, c2: kind === "row" ? MAX_COLS - 1 : p2.c,
    a: { r1: p1.ar, c1: p1.ac, r2: p2.ar, c2: p2.ac },
  };
  if (ref.r1 < 0 || ref.r2 < 0 || ref.c1 < 0 || ref.c2 < 0 || ref.r1 >= MAX_ROWS || ref.r2 >= MAX_ROWS || ref.c1 >= MAX_COLS || ref.c2 >= MAX_COLS) return null;
  return ref;
}

export function refToString(ref) {
  const pre = ref.sheet ? quoteSheet(ref.sheet) + "!" : "";
  const C = (c, a) => (a ? "$" : "") + colName(c), R = (r, a) => (a ? "$" : "") + (r + 1);
  const a = ref.a;
  if (ref.kind === "col") return pre + C(ref.c1, a.c1) + ":" + C(ref.c2, a.c2);
  if (ref.kind === "row") return pre + R(ref.r1, a.r1) + ":" + R(ref.r2, a.r2);
  const single = ref.r1 === ref.r2 && ref.c1 === ref.c2 && a.r1 === a.r2 && a.c1 === a.c2;
  return pre + C(ref.c1, a.c1) + R(ref.r1, a.r1) + (single ? "" : ":" + C(ref.c2, a.c2) + R(ref.r2, a.r2));
}

// Rewrite every reference in a formula. fn(ref) returns a new ref or null (=> #REF!)
export function rewriteFormula(formula, fn) {
  let toks;
  try { toks = tokenize(formula); } catch { return formula; }
  let out = "";
  for (const t of toks) {
    if (t.t !== "ref") { out += t.x; continue; }
    const ref = parseRef(t.x);
    if (!ref) { out += t.x; continue; }
    const nr = fn(ref);
    out += nr ? refToString(nr) : "#REF!";
  }
  return out;
}

// Relative shift used by copy / paste / fill
export function shiftRef(ref, dr, dc) {
  const n = { ...ref, a: { ...ref.a } };
  if (ref.kind !== "row") { if (!ref.a.c1) n.c1 += dc; if (!ref.a.c2) n.c2 += dc; }
  if (ref.kind !== "col") { if (!ref.a.r1) n.r1 += dr; if (!ref.a.r2) n.r2 += dr; }
  if (n.r1 < 0 || n.c1 < 0 || n.r2 < 0 || n.c2 < 0 || n.r1 >= MAX_ROWS || n.r2 >= MAX_ROWS || n.c1 >= MAX_COLS || n.c2 >= MAX_COLS) return null;
  return n;
}
export const shiftFormula = (f, dr, dc) => (dr || dc ? rewriteFormula(f, (ref) => shiftRef(ref, dr, dc)) : f);

// Insert (n>0) or delete (n<0) |n| lines at idx along axis; returns new ref or null
export function adjustRefLines(ref, axis, idx, n) {
  const k1 = axis === "row" ? "r1" : "c1", k2 = axis === "row" ? "r2" : "c2";
  if ((axis === "row" && ref.kind === "col") || (axis === "col" && ref.kind === "row")) return ref;
  let a = Math.min(ref[k1], ref[k2]), b = Math.max(ref[k1], ref[k2]);
  if (n > 0) {
    if (a >= idx) a += n;
    if (b >= idx) b += n;
  } else {
    const cnt = -n, end = idx + cnt - 1;
    const na = a < idx ? a : a > end ? a - cnt : idx;
    const nb = b < idx ? b : b > end ? b - cnt : idx - 1;
    if (nb < na) return null;
    a = na; b = nb;
  }
  const out = { ...ref, a: { ...ref.a } };
  out[k1] = a; out[k2] = b;
  return out;
}

// Formula engine: Pratt parser + evaluator + ~110 spreadsheet functions.
import { tokenize, parseRef, parseAddr, MAX_ROWS, MAX_COLS } from "./refs.js";
import { generalText, formatValue, dateToSerial, serialToParts } from "./numfmt.js";

export class XErr {
  constructor(code) { this.code = code; }
  toString() { return this.code; }
}
export const E = {
  DIV0: new XErr("#DIV/0!"), VALUE: new XErr("#VALUE!"), REF: new XErr("#REF!"), NAME: new XErr("#NAME?"),
  NUM: new XErr("#NUM!"), NA: new XErr("#N/A"), NULL: new XErr("#NULL!"), CIRC: new XErr("#CIRC!"),
};
const errFromCode = (c) => Object.values(E).find((e) => e.code === c) || E.VALUE;
export const isErr = (v) => v instanceof XErr;

// ───────────────────────── Parser ─────────────────────────
const PREC = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };
const parseCache = new Map();

export function parse(src) {
  if (parseCache.has(src)) return parseCache.get(src);
  let node;
  try { node = parseUncached(src); } catch { node = { t: "err", v: "#NAME?", syntax: true }; }
  if (parseCache.size > 5000) parseCache.clear();
  parseCache.set(src, node);
  return node;
}

function parseUncached(src) {
  const toks = tokenize(src).filter((t) => t.t !== "ws");
  let p = 0;
  const peek = () => toks[p];
  const isOp = (x) => peek() && peek().t === "op" && peek().x === x;
  function expr(min) {
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !(t.x in PREC) || PREC[t.x] < min) break;
      p++;
      const right = expr(PREC[t.x] + 1);
      left = { t: "bin", op: t.x, a: left, b: right };
    }
    return left;
  }
  function unary() {
    const t = peek();
    if (t && t.t === "op" && (t.x === "-" || t.x === "+")) { p++; return { t: "un", op: t.x, a: unary() }; }
    let a = primary();
    while (isOp("%")) { p++; a = { t: "pct", a }; }
    return a;
  }
  function primary() {
    const t = toks[p++];
    if (!t) throw new Error("eof");
    switch (t.t) {
      case "num": return { t: "num", v: t.v };
      case "str": return { t: "str", v: t.v };
      case "bool": return { t: "bool", v: t.v };
      case "err": return { t: "err", v: t.x };
      case "ref": { const ref = parseRef(t.x); return ref ? { t: "ref", ref } : { t: "err", v: "#REF!" }; }
      case "name": return { t: "err", v: "#NAME?" };
      case "func": {
        if (!isOp("(")) throw new Error("(");
        p++;
        const args = [];
        if (isOp(")")) { p++; return { t: "call", name: t.x.toUpperCase(), args }; }
        for (;;) {
          if (isOp(",") || isOp(")")) args.push({ t: "empty" });
          else args.push(expr(1));
          if (isOp(",")) { p++; continue; }
          if (isOp(")")) { p++; break; }
          throw new Error("expected , or )");
        }
        return { t: "call", name: t.x.toUpperCase(), args };
      }
      case "op":
        if (t.x === "(") { const e = expr(1); if (!isOp(")")) throw new Error(")"); p++; return e; }
    }
    throw new Error("unexpected token");
  }
  const tree = expr(1);
  if (p < toks.length) throw new Error("trailing");
  return tree;
}

// ───────────────────────── Coercion helpers ─────────────────────────
export function toNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i.test(s)) return s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s);
    throw E.VALUE;
  }
  throw v instanceof XErr ? v : E.VALUE;
}
export function toStr(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return generalText(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}
function toBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") { if (/^true$/i.test(v)) return true; if (/^false$/i.test(v)) return false; }
  throw E.VALUE;
}
const chk = (v) => { if (v instanceof XErr) throw v; return v; };

function cmp(a, b) {
  if (a === null || a === undefined) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null || b === undefined) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const rank = (x) => (typeof x === "number" ? 1 : typeof x === "string" ? 2 : 3);
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 2) { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return a < b ? -1 : a > b ? 1 : 0;
}

// ───────────────────────── Evaluation ─────────────────────────
// cx = { env, sheet, r, c }   env: { cellValue, sheetByName, bounds, eachInRange, now }
function scalar(v, cx) {
  if (v && v.rng) {
    if (v.r1 === v.r2 && v.c1 === v.c2) return cx.env.cellValue(v.sheet, v.r1, v.c1);
    if (v.c1 === v.c2 && cx.r >= v.r1 && cx.r <= v.r2) return cx.env.cellValue(v.sheet, cx.r, v.c1);
    if (v.r1 === v.r2 && cx.c >= v.c1 && cx.c <= v.c2) return cx.env.cellValue(v.sheet, v.r1, cx.c);
    return E.VALUE;
  }
  return v;
}
const sv = (n, cx) => scalar(evalNode(n, cx), cx);

export function evalNode(n, cx) {
  switch (n.t) {
    case "num": case "str": case "bool": return n.v;
    case "empty": return null;
    case "err": return errFromCode(n.v);
    case "ref": {
      const sheet = n.ref.sheet ? cx.env.sheetByName(n.ref.sheet) : cx.sheet;
      if (!sheet) return E.REF;
      const { r1, r2, c1, c2 } = n.ref;
      return { rng: true, sheet, r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) };
    }
    case "un": {
      const v = sv(n.a, cx); if (isErr(v)) return v;
      try { return n.op === "-" ? -toNum(v) : v; } catch (e) { return e; }
    }
    case "pct": {
      const v = sv(n.a, cx); if (isErr(v)) return v;
      try { return toNum(v) / 100; } catch (e) { return e; }
    }
    case "bin": {
      const a = sv(n.a, cx); if (isErr(a)) return a;
      const b = sv(n.b, cx); if (isErr(b)) return b;
      try {
        switch (n.op) {
          case "+": return toNum(a) + toNum(b);
          case "-": return toNum(a) - toNum(b);
          case "*": return toNum(a) * toNum(b);
          case "/": { const d = toNum(b); return d === 0 ? E.DIV0 : toNum(a) / d; }
          case "^": { const r = Math.pow(toNum(a), toNum(b)); return Number.isNaN(r) || !isFinite(r) ? E.NUM : r; }
          case "&": return toStr(a) + toStr(b);
          case "=": return cmp(a, b) === 0;
          case "<>": return cmp(a, b) !== 0;
          case "<": return cmp(a, b) < 0;
          case ">": return cmp(a, b) > 0;
          case "<=": return cmp(a, b) <= 0;
          case ">=": return cmp(a, b) >= 0;
        }
      } catch (e) { return e instanceof XErr ? e : E.VALUE; }
      return E.VALUE;
    }
    case "call": return callFn(n, cx);
  }
  return E.VALUE;
}

export function evaluate(node, cx) {
  const v = evalNode(node, cx);
  return v && v.rng ? scalar(v, cx) : v;
}

function callFn(n, cx) {
  const lazy = LAZY[n.name];
  try {
    if (lazy) return lazy(n.args, cx);
    const fn = F[n.name];
    if (!fn) return E.NAME;
    const args = n.args.map((a) => evalNode(a, cx));
    return fn(args, cx);
  } catch (e) {
    if (e instanceof XErr) return e;
    if (e instanceof RangeError) return E.VALUE;
    throw e;
  }
}

// ───────────────────────── Helpers for functions ─────────────────────────
const num = (a, cx) => toNum(chk(scalar(a, cx)));
const str = (a, cx) => toStr(chk(scalar(a, cx)));
const val = (a, cx) => chk(scalar(a, cx));
const optNum = (a, cx, d) => (a === undefined || (a === null) ? d : num(a, cx));

function clampRange(v, cx) {
  const b = cx.env.bounds(v.sheet);
  return { ...v, r2: Math.min(v.r2, Math.max(b.maxR, v.r1)), c2: Math.min(v.c2, Math.max(b.maxC, v.c1)) };
}
function matrix(v, cx) {
  const g = clampRange(v, cx), rows = [];
  for (let r = g.r1; r <= g.r2; r++) {
    const row = [];
    for (let c = g.c1; c <= g.c2; c++) row.push(cx.env.cellValue(v.sheet, r, c));
    rows.push(row);
  }
  return rows;
}
// numbers for aggregate functions
function numbers(args, cx) {
  const out = [];
  for (const a of args) {
    if (a && a.rng) {
      cx.env.eachInRange(a.sheet, a.r1, a.c1, a.r2, a.c2, (v) => {
        if (v instanceof XErr) throw v;
        if (typeof v === "number") out.push(v);
      });
    } else if (a instanceof XErr) throw a;
    else if (a !== null && a !== undefined) out.push(toNum(a));
  }
  return out;
}
function allValues(args, cx, skipEmpty = true) {
  const out = [];
  for (const a of args) {
    if (a && a.rng) cx.env.eachInRange(a.sheet, a.r1, a.c1, a.r2, a.c2, (v) => { if (v instanceof XErr) throw v; out.push(v); });
    else { chk(a); if (!(skipEmpty && a === null)) out.push(a); }
  }
  return out;
}

function critMatcher(crit) {
  if (crit instanceof XErr) return (v) => v instanceof XErr && v.code === crit.code;
  if (typeof crit === "number" || typeof crit === "boolean") return (v) => cmp(v, crit) === 0 && typeof v === typeof crit;
  const s = toStr(crit);
  const m = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/.exec(s);
  const op = m[1] || "=", rest = m[2];
  const n = rest.trim() !== "" && !isNaN(Number(rest)) ? Number(rest) : null;
  const wild = /[*?]/.test(rest) && (op === "=" || op === "<>");
  const re = wild ? new RegExp("^" + rest.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~?\*/g, (x) => (x[0] === "~" ? "\\*" : ".*")).replace(/~?\?/g, (x) => (x[0] === "~" ? "\\?" : ".")) + "$", "i") : null;
  return (v) => {
    if (v instanceof XErr) return false;
    if (n !== null && typeof v === "number") {
      return op === "=" ? v === n : op === "<>" ? v !== n : op === "<" ? v < n : op === ">" ? v > n : op === "<=" ? v <= n : v >= n;
    }
    if (n !== null && op !== "=" && op !== "<>") return false;
    if (n !== null && op === "<>") return !(typeof v === "number" && v === n);
    if (rest === "" ) { const empty = v === null || v === ""; return op === "<>" ? !empty : op === "=" ? empty : false; }
    if (typeof v !== "string") { if (v === null) return op === "<>"; v = toStr(v); }
    if (re) { const t = re.test(v); return op === "=" ? t : !t; }
    const c = cmp(v, rest);
    return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  };
}
function ifs(pairs, cx, first) {
  // pairs: [rangeArg, criteria, ...]; returns list of [r,c] offsets satisfying all, relative to first range
  const rngs = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const rg = pairs[i];
    if (!rg || !rg.rng) throw E.VALUE;
    rngs.push({ rg: clampRange(rg, cx), m: critMatcher(chk(scalar(pairs[i + 1], cx))) });
  }
  const h = first.r2 - first.r1, w = first.c2 - first.c1;
  const hits = [];
  for (let dr = 0; dr <= h; dr++) for (let dc = 0; dc <= w; dc++) {
    let ok = true;
    for (const { rg, m } of rngs) {
      if (rg.r1 + dr > rg.r2 || rg.c1 + dc > rg.c2) { ok = m(null); } else ok = m(cx.env.cellValue(rg.sheet, rg.r1 + dr, rg.c1 + dc));
      if (!ok) break;
    }
    if (ok) hits.push([dr, dc]);
  }
  return hits;
}
const sumHits = (rg, hits, cx) => {
  const out = [];
  for (const [dr, dc] of hits) { const v = cx.env.cellValue(rg.sheet, rg.r1 + dr, rg.c1 + dc); if (v instanceof XErr) throw v; if (typeof v === "number") out.push(v); }
  return out;
};
const dateArg = (a, cx) => { const v = val(a, cx); if (typeof v === "string" && isNaN(Number(v))) { const d = Date.parse(v); if (isNaN(d)) throw E.VALUE; return d / 86400000 + 25569; } return toNum(v); };
const roundHalfAway = (x, d) => { const f = Math.pow(10, d); const y = Math.abs(x) * f; return (Math.sign(x) * Math.round(y + 1e-9 * (y > 1e6 ? 0 : 1))) / f; };
const lookupEq = (a, b) => (typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b);

function matchIn(list, target, type) {
  if (type === 0) {
    if (typeof target === "string" && /[*?]/.test(target)) {
      const re = new RegExp("^" + target.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
      return list.findIndex((v) => typeof v === "string" && re.test(v));
    }
    return list.findIndex((v) => v !== null && lookupEq(v, target));
  }
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v === null || typeof v !== typeof target) continue;
    const c = cmp(v, target);
    if (type === 1 ? c <= 0 : c >= 0) { if (best < 0 || (type === 1 ? cmp(v, list[best]) >= 0 : cmp(v, list[best]) <= 0)) best = i; }
  }
  return best;
}

// ───────────────────────── Lazy functions ─────────────────────────
const LAZY = {
  IF: (a, cx) => { const c = sv(a[0], cx); if (isErr(c)) return c; return toBool(c) ? (a[1] ? sv(a[1], cx) ?? 0 : true) : a[2] ? sv(a[2], cx) ?? 0 : false; },
  IFS: (a, cx) => { for (let i = 0; i + 1 < a.length; i += 2) { const c = sv(a[i], cx); if (isErr(c)) return c; if (toBool(c)) return sv(a[i + 1], cx); } return E.NA; },
  IFERROR: (a, cx) => { const v = sv(a[0], cx); return isErr(v) ? sv(a[1], cx) : v; },
  IFNA: (a, cx) => { const v = sv(a[0], cx); return isErr(v) && v.code === "#N/A" ? sv(a[1], cx) : v; },
  SWITCH: (a, cx) => {
    const x = sv(a[0], cx); if (isErr(x)) return x;
    for (let i = 1; i + 1 < a.length; i += 2) { const k = sv(a[i], cx); if (cmp(x, k) === 0) return sv(a[i + 1], cx); }
    return a.length % 2 === 0 ? sv(a[a.length - 1], cx) : E.NA;
  },
  CHOOSE: (a, cx) => { const i = Math.trunc(toNum(chk(sv(a[0], cx)))); if (i < 1 || i >= a.length) return E.VALUE; return evalNode(a[i], cx); },
};

// ───────────────────────── Function table ─────────────────────────
const F = {
  // math & statistics
  SUM: (a, cx) => numbers(a, cx).reduce((x, y) => x + y, 0),
  AVERAGE: (a, cx) => { const n = numbers(a, cx); if (!n.length) throw E.DIV0; return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: (a, cx) => { const n = numbers(a, cx); return n.length ? Math.min(...n) : 0; },
  MAX: (a, cx) => { const n = numbers(a, cx); return n.length ? Math.max(...n) : 0; },
  COUNT: (a, cx) => { let k = 0; for (const x of a) { if (x && x.rng) cx.env.eachInRange(x.sheet, x.r1, x.c1, x.r2, x.c2, (v) => { if (typeof v === "number") k++; }); else if (typeof x === "number" || typeof x === "boolean") k++; else if (typeof x === "string" && x.trim() !== "" && !isNaN(Number(x))) k++; } return k; },
  COUNTA: (a, cx) => { let k = 0; for (const x of a) { if (x && x.rng) cx.env.eachInRange(x.sheet, x.r1, x.c1, x.r2, x.c2, (v) => { if (v !== null) k++; }); else if (x !== null) k++; } return k; },
  COUNTBLANK: (a, cx) => { const r = a[0]; if (!r || !r.rng) throw E.VALUE; let filled = 0; cx.env.eachInRange(r.sheet, r.r1, r.c1, r.r2, r.c2, (v) => { if (v !== null && v !== "") filled++; }); return (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1) - filled; },
  PRODUCT: (a, cx) => numbers(a, cx).reduce((x, y) => x * y, 1),
  SUMSQ: (a, cx) => numbers(a, cx).reduce((x, y) => x + y * y, 0),
  MEDIAN: (a, cx) => { const n = numbers(a, cx).sort((x, y) => x - y); if (!n.length) throw E.NUM; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
  MODE: (a, cx) => { const n = numbers(a, cx), cnt = new Map(); let best = null, bc = 1; for (const x of n) { const c = (cnt.get(x) || 0) + 1; cnt.set(x, c); if (c > bc) { bc = c; best = x; } } if (best === null) throw E.NA; return best; },
  LARGE: (a, cx) => { const n = numbers([a[0]], cx).sort((x, y) => y - x), k = num(a[1], cx); if (k < 1 || k > n.length) throw E.NUM; return n[k - 1]; },
  SMALL: (a, cx) => { const n = numbers([a[0]], cx).sort((x, y) => x - y), k = num(a[1], cx); if (k < 1 || k > n.length) throw E.NUM; return n[k - 1]; },
  RANK: (a, cx) => { const x = num(a[0], cx), n = numbers([a[1]], cx), asc = a[2] !== undefined && num(a[2], cx) !== 0; if (!n.includes(x)) throw E.NA; return 1 + n.filter((y) => (asc ? y < x : y > x)).length; },
  VAR: (a, cx) => { const n = numbers(a, cx); if (n.length < 2) throw E.DIV0; const m = n.reduce((x, y) => x + y, 0) / n.length; return n.reduce((s, y) => s + (y - m) ** 2, 0) / (n.length - 1); },
  VARP: (a, cx) => { const n = numbers(a, cx); if (!n.length) throw E.DIV0; const m = n.reduce((x, y) => x + y, 0) / n.length; return n.reduce((s, y) => s + (y - m) ** 2, 0) / n.length; },
  STDEV: (a, cx) => Math.sqrt(F.VAR(a, cx)),
  STDEVP: (a, cx) => Math.sqrt(F.VARP(a, cx)),
  SUMPRODUCT: (a, cx) => {
    const ms = a.map((x) => (x && x.rng ? matrix(x, cx) : [[chk(x)]]));
    const h = ms[0].length, w = ms[0][0].length;
    if (ms.some((m) => m.length !== h || m[0].length !== w)) throw E.VALUE;
    let s = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { let p = 1; for (const m of ms) { const v = m[r][c]; if (v instanceof XErr) throw v; p *= typeof v === "number" ? v : typeof v === "boolean" ? 0 : 0; } s += p; }
    return s;
  },
  ABS: (a, cx) => Math.abs(num(a[0], cx)),
  SQRT: (a, cx) => { const x = num(a[0], cx); if (x < 0) throw E.NUM; return Math.sqrt(x); },
  POWER: (a, cx) => { const r = Math.pow(num(a[0], cx), num(a[1], cx)); if (!isFinite(r)) throw E.NUM; return r; },
  MOD: (a, cx) => { const n = num(a[0], cx), d = num(a[1], cx); if (d === 0) throw E.DIV0; return n - d * Math.floor(n / d); },
  INT: (a, cx) => Math.floor(num(a[0], cx)),
  TRUNC: (a, cx) => { const d = optNum(a[1], cx, 0), f = Math.pow(10, d); return Math.trunc(num(a[0], cx) * f) / f; },
  SIGN: (a, cx) => Math.sign(num(a[0], cx)),
  EXP: (a, cx) => Math.exp(num(a[0], cx)),
  LN: (a, cx) => { const x = num(a[0], cx); if (x <= 0) throw E.NUM; return Math.log(x); },
  LOG: (a, cx) => { const x = num(a[0], cx), b = optNum(a[1], cx, 10); if (x <= 0 || b <= 0 || b === 1) throw E.NUM; return Math.log(x) / Math.log(b); },
  LOG10: (a, cx) => { const x = num(a[0], cx); if (x <= 0) throw E.NUM; return Math.log10(x); },
  PI: () => Math.PI,
  SIN: (a, cx) => Math.sin(num(a[0], cx)), COS: (a, cx) => Math.cos(num(a[0], cx)), TAN: (a, cx) => Math.tan(num(a[0], cx)),
  ATAN: (a, cx) => Math.atan(num(a[0], cx)),
  DEGREES: (a, cx) => (num(a[0], cx) * 180) / Math.PI, RADIANS: (a, cx) => (num(a[0], cx) * Math.PI) / 180,
  ROUND: (a, cx) => roundHalfAway(num(a[0], cx), optNum(a[1], cx, 0)),
  ROUNDUP: (a, cx) => { const x = num(a[0], cx), d = optNum(a[1], cx, 0), f = Math.pow(10, d); return (Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-12)) / f; },
  ROUNDDOWN: (a, cx) => { const x = num(a[0], cx), d = optNum(a[1], cx, 0), f = Math.pow(10, d); return (Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-12)) / f; },
  CEILING: (a, cx) => { const x = num(a[0], cx), s = optNum(a[1], cx, 1); return s === 0 ? 0 : Math.ceil(x / s) * s; },
  FLOOR: (a, cx) => { const x = num(a[0], cx), s = optNum(a[1], cx, 1); return s === 0 ? 0 : Math.floor(x / s) * s; },
  FACT: (a, cx) => { const n = Math.trunc(num(a[0], cx)); if (n < 0 || n > 170) throw E.NUM; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  RAND: () => Math.random(),
  RANDBETWEEN: (a, cx) => { const lo = Math.ceil(num(a[0], cx)), hi = Math.floor(num(a[1], cx)); if (hi < lo) throw E.NUM; return lo + Math.floor(Math.random() * (hi - lo + 1)); },
  // conditional aggregates
  SUMIF: (a, cx) => { const rg = a[0]; if (!rg || !rg.rng) throw E.VALUE; const sr = a[2] && a[2].rng ? a[2] : rg; const g = clampRange(rg, cx); const hits = ifs([rg, a[1]], cx, g); return sumHits({ ...sr, sheet: sr.sheet, r1: sr.r1, c1: sr.c1 }, hits, cx).reduce((x, y) => x + y, 0); },
  COUNTIF: (a, cx) => { const rg = a[0]; if (!rg || !rg.rng) throw E.VALUE; return ifs([rg, a[1]], cx, clampRange(rg, cx)).length; },
  AVERAGEIF: (a, cx) => { const rg = a[0]; if (!rg || !rg.rng) throw E.VALUE; const sr = a[2] && a[2].rng ? a[2] : rg; const n = sumHits(sr, ifs([rg, a[1]], cx, clampRange(rg, cx)), cx); if (!n.length) throw E.DIV0; return n.reduce((x, y) => x + y, 0) / n.length; },
  SUMIFS: (a, cx) => { const sr = a[0]; if (!sr || !sr.rng) throw E.VALUE; return sumHits(sr, ifs(a.slice(1), cx, clampRange(sr, cx)), cx).reduce((x, y) => x + y, 0); },
  COUNTIFS: (a, cx) => ifs(a, cx, clampRange(a[0], cx)).length,
  AVERAGEIFS: (a, cx) => { const sr = a[0]; const n = sumHits(sr, ifs(a.slice(1), cx, clampRange(sr, cx)), cx); if (!n.length) throw E.DIV0; return n.reduce((x, y) => x + y, 0) / n.length; },
  MAXIFS: (a, cx) => { const n = sumHits(a[0], ifs(a.slice(1), cx, clampRange(a[0], cx)), cx); return n.length ? Math.max(...n) : 0; },
  MINIFS: (a, cx) => { const n = sumHits(a[0], ifs(a.slice(1), cx, clampRange(a[0], cx)), cx); return n.length ? Math.min(...n) : 0; },
  // logical & information
  AND: (a, cx) => { const v = allValues(a, cx).filter((x) => typeof x !== "string"); if (!v.length) throw E.VALUE; return v.every((x) => toBool(x)); },
  OR: (a, cx) => { const v = allValues(a, cx).filter((x) => typeof x !== "string"); if (!v.length) throw E.VALUE; return v.some((x) => toBool(x)); },
  XOR: (a, cx) => allValues(a, cx).filter((x) => typeof x !== "string").reduce((s, x) => s !== toBool(x), false),
  NOT: (a, cx) => !toBool(val(a[0], cx)),
  TRUE: () => true, FALSE: () => false,
  ISNUMBER: (a, cx) => typeof scalar(a[0], cx) === "number",
  ISTEXT: (a, cx) => typeof scalar(a[0], cx) === "string",
  ISNONTEXT: (a, cx) => typeof scalar(a[0], cx) !== "string",
  ISLOGICAL: (a, cx) => typeof scalar(a[0], cx) === "boolean",
  ISBLANK: (a, cx) => scalar(a[0], cx) === null,
  ISERROR: (a, cx) => scalar(a[0], cx) instanceof XErr,
  ISERR: (a, cx) => { const v = scalar(a[0], cx); return v instanceof XErr && v.code !== "#N/A"; },
  ISNA: (a, cx) => { const v = scalar(a[0], cx); return v instanceof XErr && v.code === "#N/A"; },
  ISEVEN: (a, cx) => Math.trunc(num(a[0], cx)) % 2 === 0,
  ISODD: (a, cx) => Math.abs(Math.trunc(num(a[0], cx))) % 2 === 1,
  N: (a, cx) => { const v = val(a[0], cx); return typeof v === "number" ? v : typeof v === "boolean" ? +v : 0; },
  NA: () => { throw E.NA; },
  // text
  CONCAT: (a, cx) => allValues(a, cx, false).map(toStr).join(""),
  CONCATENATE: (a, cx) => a.map((x) => str(x, cx)).join(""),
  TEXTJOIN: (a, cx) => { const d = str(a[0], cx), skip = toBool(val(a[1], cx)); return allValues(a.slice(2), cx, false).map(toStr).filter((s) => !(skip && s === "")).join(d); },
  LEN: (a, cx) => str(a[0], cx).length,
  LEFT: (a, cx) => str(a[0], cx).slice(0, Math.max(0, optNum(a[1], cx, 1))),
  RIGHT: (a, cx) => { const s = str(a[0], cx), n = Math.max(0, optNum(a[1], cx, 1)); return n ? s.slice(-n) : ""; },
  MID: (a, cx) => { const s = str(a[0], cx), st = num(a[1], cx), n = num(a[2], cx); if (st < 1 || n < 0) throw E.VALUE; return s.substr(st - 1, n); },
  UPPER: (a, cx) => str(a[0], cx).toUpperCase(),
  LOWER: (a, cx) => str(a[0], cx).toLowerCase(),
  PROPER: (a, cx) => str(a[0], cx).toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()),
  TRIM: (a, cx) => str(a[0], cx).trim().replace(/\s+/g, " "),
  CLEAN: (a, cx) => str(a[0], cx).replace(/[\x00-\x1f]/g, ""),
  EXACT: (a, cx) => str(a[0], cx) === str(a[1], cx),
  REPT: (a, cx) => { const n = num(a[1], cx); if (n < 0 || n > 10000) throw E.VALUE; return str(a[0], cx).repeat(Math.trunc(n)); },
  FIND: (a, cx) => { const i = str(a[1], cx).indexOf(str(a[0], cx), optNum(a[2], cx, 1) - 1); if (i < 0) throw E.VALUE; return i + 1; },
  SEARCH: (a, cx) => { const pat = str(a[0], cx).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."); const s = str(a[1], cx), st = optNum(a[2], cx, 1) - 1; const m = new RegExp(pat, "i").exec(s.slice(st)); if (!m) throw E.VALUE; return st + m.index + 1; },
  SUBSTITUTE: (a, cx) => { const s = str(a[0], cx), o = str(a[1], cx), n = str(a[2], cx); if (!o) return s; if (a[3] === undefined) return s.split(o).join(n); let k = num(a[3], cx), idx = -1; while (k-- > 0) { idx = s.indexOf(o, idx + 1); if (idx < 0) return s; } return s.slice(0, idx) + n + s.slice(idx + o.length); },
  REPLACE: (a, cx) => { const s = str(a[0], cx), st = num(a[1], cx) - 1, n = num(a[2], cx); return s.slice(0, st) + str(a[3], cx) + s.slice(st + n); },
  TEXT: (a, cx) => { const v = val(a[0], cx), f = str(a[1], cx); return typeof v === "string" ? v : formatValue(v === null ? 0 : toNum(v), f); },
  VALUE: (a, cx) => { const v = val(a[0], cx); if (typeof v === "number") return v; const s = toStr(v).trim().replace(/,/g, ""); if (s === "" || isNaN(Number(s.replace("%", "")))) throw E.VALUE; return s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s); },
  CHAR: (a, cx) => String.fromCharCode(num(a[0], cx)),
  CODE: (a, cx) => { const s = str(a[0], cx); if (!s) throw E.VALUE; return s.charCodeAt(0); },
  // date & time
  TODAY: (a, cx) => Math.floor(cx.env.now() / 86400000 + 25569 - new Date().getTimezoneOffset() / 1440),
  NOW: (a, cx) => cx.env.now() / 86400000 + 25569 - new Date().getTimezoneOffset() / 1440,
  DATE: (a, cx) => { let y = Math.trunc(num(a[0], cx)), m = Math.trunc(num(a[1], cx)), d = Math.trunc(num(a[2], cx)); if (y >= 0 && y < 1900) y += 1900; return dateToSerial(y, m, d); },
  TIME: (a, cx) => (num(a[0], cx) * 3600 + num(a[1], cx) * 60 + num(a[2], cx)) / 86400,
  YEAR: (a, cx) => serialToParts(dateArg(a[0], cx)).y,
  MONTH: (a, cx) => serialToParts(dateArg(a[0], cx)).m,
  DAY: (a, cx) => serialToParts(dateArg(a[0], cx)).d,
  HOUR: (a, cx) => serialToParts(dateArg(a[0], cx)).hh,
  MINUTE: (a, cx) => serialToParts(dateArg(a[0], cx)).mm,
  SECOND: (a, cx) => serialToParts(dateArg(a[0], cx)).ss,
  WEEKDAY: (a, cx) => { const dow = serialToParts(dateArg(a[0], cx)).dow, t = optNum(a[1], cx, 1); return t === 2 ? ((dow + 6) % 7) + 1 : t === 3 ? (dow + 6) % 7 : dow + 1; },
  DAYS: (a, cx) => Math.trunc(dateArg(a[0], cx)) - Math.trunc(dateArg(a[1], cx)),
  EDATE: (a, cx) => { const p = serialToParts(dateArg(a[0], cx)), n = Math.trunc(num(a[1], cx)); const t = new Date(Date.UTC(p.y, p.m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return dateToSerial(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(p.d, last)); },
  EOMONTH: (a, cx) => { const p = serialToParts(dateArg(a[0], cx)), n = Math.trunc(num(a[1], cx)); const t = new Date(Date.UTC(p.y, p.m + n, 0)); return dateToSerial(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); },
  DATEDIF: (a, cx) => { const s = serialToParts(dateArg(a[0], cx)), e = serialToParts(dateArg(a[1], cx)), u = str(a[2], cx).toUpperCase(); const d0 = dateArg(a[0], cx), d1 = dateArg(a[1], cx); if (d1 < d0) throw E.NUM; const months = (e.y - s.y) * 12 + e.m - s.m - (e.d < s.d ? 1 : 0); if (u === "D") return Math.trunc(d1) - Math.trunc(d0); if (u === "M") return months; if (u === "Y") return Math.floor(months / 12); throw E.NUM; },
  // lookup & reference
  ROW: (a, cx) => (a[0] && a[0].rng ? a[0].r1 + 1 : cx.r + 1),
  COLUMN: (a, cx) => (a[0] && a[0].rng ? a[0].c1 + 1 : cx.c + 1),
  ROWS: (a) => (a[0] && a[0].rng ? a[0].r2 - a[0].r1 + 1 : 1),
  COLUMNS: (a) => (a[0] && a[0].rng ? a[0].c2 - a[0].c1 + 1 : 1),
  INDEX: (a, cx) => {
    const rg = a[0]; if (!rg || !rg.rng) return chk(rg);
    let r = Math.trunc(optNum(a[1], cx, 0)), c = Math.trunc(optNum(a[2], cx, 0));
    const h = rg.r2 - rg.r1 + 1, w = rg.c2 - rg.c1 + 1;
    if (h === 1 && a[2] === undefined) { c = r; r = 1; }
    if (r < 0 || c < 0 || r > h || c > w) throw E.REF;
    if (r === 0 || c === 0) return { rng: true, sheet: rg.sheet, r1: r ? rg.r1 + r - 1 : rg.r1, r2: r ? rg.r1 + r - 1 : rg.r2, c1: c ? rg.c1 + c - 1 : rg.c1, c2: c ? rg.c1 + c - 1 : rg.c2 };
    return cx.env.cellValue(rg.sheet, rg.r1 + r - 1, rg.c1 + c - 1);
  },
  MATCH: (a, cx) => {
    const t = val(a[0], cx), rg = a[1]; if (!rg || !rg.rng) throw E.NA;
    const list = matrix(rg, cx).flat(); const i = matchIn(list, t, optNum(a[2], cx, 1)); if (i < 0) throw E.NA; return i + 1;
  },
  VLOOKUP: (a, cx) => {
    const t = val(a[0], cx), rg = a[1], ci = Math.trunc(num(a[2], cx)), approx = a[3] === undefined ? true : toBool(val(a[3], cx));
    if (!rg || !rg.rng) throw E.VALUE; const m = matrix(rg, cx); if (ci < 1 || ci > m[0].length) throw E.REF;
    const i = matchIn(m.map((r) => r[0]), t, approx ? 1 : 0); if (i < 0) throw E.NA; return chk(m[i][ci - 1]);
  },
  HLOOKUP: (a, cx) => {
    const t = val(a[0], cx), rg = a[1], ri = Math.trunc(num(a[2], cx)), approx = a[3] === undefined ? true : toBool(val(a[3], cx));
    if (!rg || !rg.rng) throw E.VALUE; const m = matrix(rg, cx); if (ri < 1 || ri > m.length) throw E.REF;
    const i = matchIn(m[0], t, approx ? 1 : 0); if (i < 0) throw E.NA; return chk(m[ri - 1][i]);
  },
  XLOOKUP: (a, cx) => {
    const t = val(a[0], cx), look = a[1], ret = a[2]; if (!look || !look.rng || !ret || !ret.rng) throw E.VALUE;
    const list = matrix(look, cx).flat(); const i = matchIn(list, t, 0);
    if (i < 0) { if (a[3] !== undefined) return val(a[3], cx); throw E.NA; }
    const rm = matrix(ret, cx); const vertical = look.c1 === look.c2;
    return chk(vertical ? rm[i][0] : rm[0][i]);
  },
  INDIRECT: (a, cx) => {
    const ref = parseRef(str(a[0], cx).trim()); if (!ref) throw E.REF;
    const sheet = ref.sheet ? cx.env.sheetByName(ref.sheet) : cx.sheet; if (!sheet) throw E.REF;
    return { rng: true, sheet, r1: Math.min(ref.r1, ref.r2), r2: Math.max(ref.r1, ref.r2), c1: Math.min(ref.c1, ref.c2), c2: Math.max(ref.c1, ref.c2) };
  },
};
const ALIASES = { "STDEV.S": "STDEV", "STDEV.P": "STDEVP", "VAR.S": "VAR", "VAR.P": "VARP", "MODE.SNGL": "MODE", "RANK.EQ": "RANK", "CEILING.MATH": "CEILING", "FLOOR.MATH": "FLOOR" };
for (const [k, v] of Object.entries(ALIASES)) F[k] = F[v];

export const FUNCTION_NAMES = [...Object.keys(F), ...Object.keys(LAZY)].sort();
export { parseAddr, MAX_ROWS, MAX_COLS };

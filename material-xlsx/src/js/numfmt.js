// Excel-compatible number / date format codes (subset) and parsing of typed input.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function serialToParts(serial) {
  const ms = Math.round((serial - 25569) * 86400000);
  // Excel 1900 leap-year bug: serials < 61 are shifted by one day
  const d = new Date(serial < 61 ? Math.round((serial - 25568) * 86400000) : ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds(), dow: d.getUTCDay() };
}
export function dateToSerial(y, m, d, hh = 0, mm = 0, ss = 0) {
  const t = Date.UTC(y, m - 1, d, hh, mm, ss);
  const s = t / 86400000 + 25569;
  return s < 61 ? s + 1 : s;
}

const stripLits = (code) => code.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
export function isDateFormat(nf) {
  if (!nf || nf === "General" || nf === "@") return false;
  const sec = stripLits(nf.split(";")[0]);
  return /[ymdhs]/i.test(sec) && !/[0#?]/.test(sec);
}

export function generalText(v) {
  if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
  if (!isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a >= 1e11 || (a < 1e-9 && a !== 0)) return v.toExponential(5).replace(/\.?0+e/, "e").replace("e+", "E+").replace("e-", "E-").replace(/E([+-])(\d)$/, "E$10$2");
  return String(parseFloat(v.toPrecision(10)));
}

function roundTo(x, d) {
  const f = Math.pow(10, d);
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
}

function splitSections(code) {
  const out = []; let cur = "", q = false;
  for (const ch of code) {
    if (ch === '"') q = !q;
    if (ch === ";" && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function literal(s) {
  return s.replace(/\[\$([^\]-]*)[^\]]*\]/g, "$1").replace(/\[[^\]]*\]/g, "").replace(/"([^"]*)"/g, "$1").replace(/\\(.)/g, "$1").replace(/_./g, " ").replace(/\*./g, "");
}

function formatDate(serial, code) {
  const p = serialToParts(serial);
  const ampm = /AM\/PM|A\/P/i.test(code);
  const toks = code.match(/"[^"]*"|\[[^\]]*\]|\\.|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|\.0+|[\s\S]/gi) || [];
  let out = "", lastTime = false;
  toks.forEach((tk, i) => {
    const l = tk.toLowerCase();
    const next = toks.slice(i + 1).find((x) => /^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s)$/i.test(x));
    const pad = (n, w) => String(n).padStart(w, "0");
    if (l === "yyyy") out += pad(p.y, 4);
    else if (l === "yy") out += pad(p.y % 100, 2);
    else if (l === "mmmm") out += MONTHS[p.m - 1];
    else if (l === "mmm") out += MONTHS[p.m - 1].slice(0, 3);
    else if (l === "mm" || l === "m") {
      const minute = lastTime || (next && /^s/i.test(next));
      const n = minute ? p.mm : p.m;
      out += l === "mm" ? pad(n, 2) : n;
    }
    else if (l === "dddd") out += DAYS[p.dow];
    else if (l === "ddd") out += DAYS[p.dow].slice(0, 3);
    else if (l === "dd") out += pad(p.d, 2);
    else if (l === "d") out += p.d;
    else if (l === "hh" || l === "h") { const h = ampm ? (p.hh % 12 || 12) : p.hh; out += l === "hh" ? pad(h, 2) : h; }
    else if (l === "ss") out += pad(p.ss, 2);
    else if (l === "s") out += p.ss;
    else if (l === "am/pm") out += p.hh < 12 ? "AM" : "PM";
    else if (l === "a/p") out += p.hh < 12 ? "A" : "P";
    else if (tk[0] === '"') out += tk.slice(1, -1);
    else if (tk[0] === "[") { /* ignore */ }
    else if (tk[0] === "\\") out += tk[1];
    else out += tk;
    if (/^(hh|h)$/i.test(tk)) lastTime = true; else if (!/^[\s:]$/.test(tk) && !/^(mm|m|ss|s)$/i.test(tk)) lastTime = false;
  });
  return out;
}

function formatPattern(v, sec, forceAbs) {
  const code = sec.replace(/\[[^\]]*\]/g, (m) => (/^\[\$/.test(m) ? m : ""));
  const pct = (stripLits(code).match(/%/g) || []).length;
  let x = Math.abs(v) * Math.pow(100, pct);
  // find numeric mask (outside quotes)
  let mask = null, idx = -1, inQ = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') inQ = !inQ;
    if (inQ) continue;
    if (ch === "\\" || ch === "_") { i++; continue; }
    if (/[0#?.,]/.test(ch)) {
      let j = i;
      while (j < code.length && /[0#?.,]/.test(code[j])) j++;
      mask = code.slice(i, j); idx = i; break;
    }
  }
  const sci = /E[+-]0+/i.exec(code);
  if (mask === null) return (v < 0 && !forceAbs ? "-" : "") + literal(code);
  let pre = literal(code.slice(0, idx));
  let suf = code.slice(idx + mask.length);
  let expPart = "";
  if (sci && suf.toUpperCase().startsWith(sci[0].toUpperCase())) {
    const digits = sci[0].length - 2;
    let e = x === 0 ? 0 : Math.floor(Math.log10(x));
    let mant = x / Math.pow(10, e);
    const dec0 = (mask.split(".")[1] || "").length;
    if (roundTo(mant, dec0) >= 10) { mant /= 10; e++; }
    x = mant;
    expPart = "E" + (e < 0 ? "-" : "+") + String(Math.abs(e)).padStart(digits, "0");
    suf = suf.slice(sci[0].length);
  }
  suf = literal(suf);
  const dot = mask.indexOf(".");
  const intMask = dot >= 0 ? mask.slice(0, dot) : mask;
  const decMask = dot >= 0 ? mask.slice(dot + 1) : "";
  const group = intMask.includes(",");
  const decimals = (decMask.match(/[0#?]/g) || []).length;
  const minDec = (decMask.match(/0/g) || []).length;
  const minInt = (intMask.match(/0/g) || []).length;
  const r = roundTo(x, decimals);
  let [ip, dp = ""] = r.toFixed(decimals).split(".");
  while (dp.length > minDec && dp.endsWith("0")) dp = dp.slice(0, -1);
  if (ip === "0" && minInt === 0 && (dp || decimals > 0) ) ip = "";
  ip = ip.padStart(minInt, "0");
  if (group) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const neg = v < 0 && !forceAbs && r !== 0;
  return (neg ? "-" : "") + pre + ip + (dp ? "." + dp : "") + expPart + suf;
}

// Returns display text for a raw (non-error) value
export function formatValue(v, nf) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") {
    if (nf && nf.includes("@")) return nf.split("@").map(literal).join(v);
    return v;
  }
  if (!nf || nf === "General") return generalText(v);
  if (nf === "@") return generalText(v);
  const secs = splitSections(nf);
  if (isDateFormat(nf)) return formatDate(v, secs[0].replace(/\[[^\]]*\]/g, ""));
  if (v < 0 && secs.length > 1) return formatPattern(v, secs[1], true);
  if (v === 0 && secs.length > 2) return formatPattern(v, secs[2], false);
  return formatPattern(v, secs[0], false);
}

// +1 / -1 decimal places
export function adjustDecimals(nf, delta) {
  if (!nf || nf === "General") return delta > 0 ? "0.0" : "0";
  if (isDateFormat(nf) || nf === "@") return nf;
  return nf.split(";").map((sec) => {
    const m = /[0#?][0#?,]*(?:\.([0#?]*))?/.exec(sec);
    if (!m) return sec;
    const cur = m[1] !== undefined ? m[1].length : 0;
    const next = Math.max(0, cur + delta);
    const base = m[0].split(".")[0];
    return sec.replace(m[0], base + (next ? "." + "0".repeat(next) : ""));
  }).join(";");
}

export const NUM_PRESETS = [
  ["General", "General"], ["0", "0"], ["0.00", "0.00"], ["#,##0", "#,##0"], ["#,##0.00", "#,##0.00"],
  ["usd", '"$"#,##0.00'], ["vnd", '#,##0" ₫"'], ["eur", '#,##0.00" €"'],
  ["0%", "0%"], ["0.00%", "0.00%"], ["sci", "0.00E+00"],
  ["yyyy-mm-dd", "yyyy-mm-dd"], ["dd/mm/yyyy", "dd/mm/yyyy"], ["mm/dd/yyyy", "mm/dd/yyyy"], ["datetime", "yyyy-mm-dd hh:mm"], ["hh:mm:ss", "hh:mm:ss"], ["@", "@"],
];

// Parse text typed by the user into {v, nf?}; returns null if it is plain text
export function parseTyped(text, lang) {
  const s = text.trim();
  if (s === "") return null;
  if (/^true$/i.test(s)) return { v: true };
  if (/^false$/i.test(s)) return { v: false };
  const num = (str) => {
    let t = str;
    if (lang === "vi") {
      if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
      else if (/^[+-]?\d+,\d+$/.test(t)) t = t.replace(",", ".");
    } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? parseFloat(t) : null;
  };
  let n = num(s);
  if (n !== null) return { v: n };
  if (s.endsWith("%")) { n = num(s.slice(0, -1).trim()); if (n !== null) return { v: n / 100, nf: s.includes(".") || s.includes(",") ? "0.00%" : "0%" }; }
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  let y, mo, d, hh = 0, mi = 0, ss = 0, hasTime = false;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4]) { hh = +m[4]; mi = +m[5]; ss = +(m[6] || 0); hasTime = true; } }
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) {
    y = +m[3];
    if (lang === "vi") { d = +m[1]; mo = +m[2]; } else { mo = +m[1]; d = +m[2]; }
  }
  if (y !== undefined && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
    const chk = new Date(Date.UTC(y, mo - 1, d));
    if (chk.getUTCMonth() === mo - 1) {
      return { v: dateToSerial(y, mo, d, hh, mi, ss), nf: hasTime ? "yyyy-mm-dd hh:mm" : lang === "vi" && /\//.test(s) ? "dd/mm/yyyy" : /\//.test(s) ? "mm/dd/yyyy" : "yyyy-mm-dd" };
    }
  }
  if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)) && +m[1] < 24 && +m[2] < 60) {
    return { v: (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400, nf: "hh:mm:ss" };
  }
  return null;
}

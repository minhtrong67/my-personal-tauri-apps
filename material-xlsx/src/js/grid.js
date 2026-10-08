// The spreadsheet grid: virtualised rendering (4 panes for freeze), selection, in-cell editing,
// mouse / keyboard interaction, fill handle, clipboard and column / row resizing.
import { key, colName, addr, rangeText, MAX_ROWS, MAX_COLS, tokenize, parseAddr } from "./refs.js";
import { FUNCTION_NAMES } from "./formula.js";
const POPULAR = ["SUM", "IF", "AVERAGE", "COUNT", "COUNTA", "MAX", "MIN", "VLOOKUP", "XLOOKUP", "COUNTIF", "SUMIF", "ROUND", "CONCAT", "TEXT", "TODAY", "NOW", "AND", "OR", "IFERROR", "LEFT", "RIGHT", "MID", "LEN", "INDEX", "MATCH", "SUMIFS", "COUNTIFS", "AVERAGEIF"];
const rank = (n) => { const i = POPULAR.indexOf(n); return i < 0 ? 999 : i; };
import { parseDelimited } from "./io.js";

export const ROWHDR = 54, COLHDR = 28;
const MIN_COLS = 26, MIN_ROWS = 100, PT = 4 / 3;
const norm = (a) => ({ r1: Math.min(a.r1, a.r2), r2: Math.max(a.r1, a.r2), c1: Math.min(a.c1, a.c2), c2: Math.max(a.c1, a.c2) });
const $ = (el, s) => el.querySelector(s);

export class Grid {
  constructor(root, book, hooks = {}) {
    this.root = root; this.book = book; this.hooks = hooks;
    this.zoom = 1; this.sel = { ar: 0, ac: 0, fr: 0, fc: 0 };
    this.extR = MIN_ROWS; this.extC = MIN_COLS;
    this.edit = null; this.clip = null; this.marquee = null; this.enabled = true; this.drag = null; this.point = null;
    this.views = new Map(); this.lastSheet = null; this.colors = {};
    this.colX = new Float64Array(2); this.rowY = new Float64Array(2);
    this._raf = 0; this.fixed = { w: 0, h: 0 };
    this.build();
    this.bind();
    this.rebuild();
    book.on((k) => { if (k === "reset") { this.views.clear(); this.sel = { ar: 0, ac: 0, fr: 0, fc: 0 }; this.marquee = null; this.extR = MIN_ROWS; this.extC = MIN_COLS; } this.refresh(); });
    new ResizeObserver(() => this.requestRender()).observe(this.scroll);
    this.themeChanged();
  }

  get sheet() { return this.book.sheet; }

  // ───────────────────────── DOM ─────────────────────────
  build() {
    this.root.innerHTML = `
      <div class="g-scroll" tabindex="0">
        <div class="g-view">
          ${["main", "top", "left", "corner"].map((p) => `<div class="g-pane g-${p}"><canvas></canvas><div class="g-cells"></div></div>`).join("")}
          <div class="g-hdr g-colhdr"></div><div class="g-hdr g-rowhdr"></div><div class="g-corner" title=""></div>
          <div class="g-overlay no-t">
            <div class="g-marquee" hidden></div><div class="g-sel" hidden></div><div class="g-fillprev" hidden></div>
            <div class="g-act" hidden></div><div class="g-handle" hidden></div><div class="g-flashes"></div>
            <textarea class="g-editor" spellcheck="false" autocomplete="off" hidden></textarea>
            <div class="g-ac" hidden></div>
          </div>
          <div class="g-guide" hidden></div>
        </div>
        <div class="g-sizer"></div>
      </div>`;
    const q = (s) => $(this.root, s);
    this.scroll = q(".g-scroll"); this.view = q(".g-view"); this.sizer = q(".g-sizer");
    this.panes = {};
    for (const p of ["main", "top", "left", "corner"]) {
      const el = q(".g-" + p);
      this.panes[p] = { el, canvas: el.querySelector("canvas"), cells: el.querySelector(".g-cells"), ctx: el.querySelector("canvas").getContext("2d") };
    }
    this.colhdr = q(".g-colhdr"); this.rowhdr = q(".g-rowhdr"); this.corner = q(".g-corner");
    this.overlay = q(".g-overlay"); this.elMarquee = q(".g-marquee"); this.elSel = q(".g-sel"); this.elAct = q(".g-act");
    this.elHandle = q(".g-handle"); this.elFillPrev = q(".g-fillprev"); this.flashes = q(".g-flashes");
    this.editor = q(".g-editor"); this.ac = q(".g-ac"); this.guide = q(".g-guide");
    this.measureCtx = document.createElement("canvas").getContext("2d");
  }

  themeChanged() {
    const cs = getComputedStyle(document.documentElement);
    this.colors = { line: this.showLines === false ? "rgba(0,0,0,0)" : cs.getPropertyValue("--grid-line").trim() || "#ddd", freeze: cs.getPropertyValue("--grid-freeze").trim() || "#999" };
    this.requestRender();
  }

  // ───────────────────────── geometry ─────────────────────────
  rebuild() {
    const sh = this.sheet, z = this.zoom, b = this.book.bounds(sh);
    this.extR = Math.min(MAX_ROWS, Math.max(this.extR, MIN_ROWS, b.maxR + 40, this.sel.fr + 30, this.sel.ar + 30));
    this.extC = Math.min(MAX_COLS, Math.max(this.extC, MIN_COLS, b.maxC + 8, this.sel.fc + 8, this.sel.ac + 8));
    const cx = new Float64Array(this.extC + 1), ry = new Float64Array(this.extR + 1);
    for (let c = 0; c < this.extC; c++) cx[c + 1] = cx[c] + (sh.colW[c] ?? sh.defW) * z;
    for (let r = 0; r < this.extR; r++) ry[r + 1] = ry[r] + (sh.hidden.has(r) ? 0 : (sh.rowH[r] ?? sh.defH) * z);
    this.colX = cx; this.rowY = ry;
    this.sizer.style.width = ROWHDR + cx[this.extC] + 160 + "px";
    this.sizer.style.height = COLHDR + ry[this.extR] + 160 + "px";
  }
  refresh() {
    const sh = this.sheet;
    if (this.lastSheet && this.lastSheet !== sh.name) this.restoreView(sh);
    this.lastSheet = sh.name;
    this.clampSel(); this.rebuild(); this.requestRender(); this.hooks.selection && this.hooks.selection();
  }
  saveView() { if (this.lastSheet) this.views.set(this.lastSheet, { sl: this.scroll.scrollLeft, st: this.scroll.scrollTop, sel: { ...this.sel } }); }
  restoreView(sh) {
    const v = this.views.get(sh.name);
    this.sel = v ? { ...v.sel } : { ar: 0, ac: 0, fr: 0, fc: 0 };
    this.rebuild();
    this.scroll.scrollLeft = v ? v.sl : 0; this.scroll.scrollTop = v ? v.st : 0;
    this.edit = null; this.editor.hidden = true;
  }
  clampSel() {
    const s = this.sel, cl = (v, m) => Math.max(0, Math.min(m, v));
    s.ar = cl(s.ar, MAX_ROWS - 1); s.fr = cl(s.fr, MAX_ROWS - 1); s.ac = cl(s.ac, MAX_COLS - 1); s.fc = cl(s.fc, MAX_COLS - 1);
  }
  bs(arr, v) { // largest i with arr[i] <= v, within [0, len-2]
    let lo = 0, hi = arr.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; }
    return lo;
  }
  get frozen() { const f = this.sheet.freeze; return { r: Math.min(f.r, this.extR - 1), c: Math.min(f.c, this.extC - 1) }; }
  edgeL(c) { const { c: fc } = this.frozen; return this.colX[c] - (c < fc ? 0 : this.scroll.scrollLeft); }
  edgeR(c) { const { c: fc } = this.frozen; return this.colX[c + 1] - (c < fc ? 0 : this.scroll.scrollLeft); }
  edgeT(r) { const { r: fr } = this.frozen; return this.rowY[r] - (r < fr ? 0 : this.scroll.scrollTop); }
  edgeB(r) { const { r: fr } = this.frozen; return this.rowY[r + 1] - (r < fr ? 0 : this.scroll.scrollTop); }
  colAt(px) { const { c: fc } = this.frozen, fw = this.colX[fc]; return px < fw ? this.bs(this.colX, Math.max(0, px)) : this.bs(this.colX, px + this.scroll.scrollLeft); }
  rowAt(py) { const { r: fr } = this.frozen, fh = this.rowY[fr]; return py < fh ? this.bs(this.rowY, Math.max(0, py)) : this.bs(this.rowY, py + this.scroll.scrollTop); }
  rectOf(r1, c1, r2, c2) {
    const x1 = this.edgeL(c1), x2 = this.edgeR(c2), y1 = this.edgeT(r1), y2 = this.edgeB(r2);
    return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
  }
  growIfNeeded(r, c) {
    let grew = false;
    if (r >= this.extR - 15 && this.extR < MAX_ROWS) { this.extR = Math.min(MAX_ROWS, r + 60); grew = true; }
    if (c >= this.extC - 4 && this.extC < MAX_COLS) { this.extC = Math.min(MAX_COLS, c + 12); grew = true; }
    if (grew) this.rebuild();
  }

  // ───────────────────────── selection ─────────────────────────
  masterOf(r, c) { const m = this.book.mergeAt(this.sheet, r, c); return m ? { r: m.r1, c: m.c1, m } : { r, c, m: null }; }
  active() { const { r, c } = this.masterOf(this.sel.ar, this.sel.ac); return { r, c }; }
  range() { // normalized selection, expanded to include merged cells
    let g = norm({ r1: this.sel.ar, c1: this.sel.ac, r2: this.sel.fr, c2: this.sel.fc });
    const merges = this.sheet.merges;
    if (merges.length) for (let again = true; again;) {
      again = false;
      for (const m of merges) {
        if (m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2) continue;
        const n = { r1: Math.min(g.r1, m.r1), r2: Math.max(g.r2, m.r2), c1: Math.min(g.c1, m.c1), c2: Math.max(g.c2, m.c2) };
        if (n.r1 !== g.r1 || n.r2 !== g.r2 || n.c1 !== g.c1 || n.c2 !== g.c2) { g = n; again = true; }
      }
    }
    return g;
  }
  select(ar, ac, fr = ar, fc = ac, opts = {}) {
    this.sel = { ar, ac, fr, fc }; this.clampSel();
    this.growIfNeeded(Math.max(this.sel.ar, this.sel.fr), Math.max(this.sel.ac, this.sel.fc));
    if (opts.reveal !== false) this.reveal(fr, fc);
    this.requestRender(true); this.hooks.selection && this.hooks.selection();
  }
  selectRange(rg) { this.select(rg.r1, rg.c1, rg.r2, rg.c2); }
  selectAll() { this.select(0, 0, MAX_ROWS - 1, MAX_COLS - 1, { reveal: false }); }
  isFullRows(g) { return g.c1 === 0 && g.c2 === MAX_COLS - 1; }
  isFullCols(g) { return g.r1 === 0 && g.r2 === MAX_ROWS - 1; }
  reveal(r, c) {
    const { r: fr, c: fc } = this.frozen, sc = this.scroll;
    const viewW = sc.clientWidth - ROWHDR, viewH = sc.clientHeight - COLHDR;
    if (c >= fc) {
      const l = this.colX[c], rr = this.colX[c + 1], fw = this.colX[fc];
      if (l < sc.scrollLeft + fw) sc.scrollLeft = Math.max(0, l - fw);
      else if (rr > sc.scrollLeft + viewW) sc.scrollLeft = rr - viewW + 2;
    }
    if (r >= fr) {
      const t = this.rowY[r], b = this.rowY[r + 1], fh = this.rowY[fr];
      if (t < sc.scrollTop + fh) sc.scrollTop = Math.max(0, t - fh);
      else if (b > sc.scrollTop + viewH) sc.scrollTop = b - viewH + 2;
    }
  }

  // ───────────────────────── rendering ─────────────────────────
  requestRender(animate = false) {
    this._animate = this._animate || animate;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; const a = this._animate; this._animate = false; this.render(a); });
  }

  render(animate = false) {
    const sh = this.sheet, z = this.zoom, sc = this.scroll;
    const W = sc.clientWidth, H = sc.clientHeight;
    if (!W || !H) return;
    if (sc.scrollTop + H > this.rowY[this.extR] + COLHDR - 100 && this.extR < MAX_ROWS) { this.extR = Math.min(MAX_ROWS, this.extR + 100); this.rebuild(); }
    if (sc.scrollLeft + W > this.colX[this.extC] + ROWHDR - 100 && this.extC < MAX_COLS) { this.extC = Math.min(MAX_COLS, this.extC + 12); this.rebuild(); }
    const { r: fr, c: fc } = this.frozen;
    const viewW = W - ROWHDR, viewH = H - COLHDR;
    const fw = this.colX[fc], fh = this.rowY[fr];
    const sl = sc.scrollLeft, st = sc.scrollTop;
    const c0 = Math.max(fc, this.bs(this.colX, sl + fw)), c1 = Math.min(this.extC - 1, this.bs(this.colX, sl + viewW));
    const r0 = Math.max(fr, this.bs(this.rowY, st + fh)), r1 = Math.min(this.extR - 1, this.bs(this.rowY, st + viewH));
    const colsS = [], colsF = [], rowsS = [], rowsF = [];
    for (let c = 0; c < fc; c++) colsF.push(c);
    for (let c = c0; c <= c1; c++) colsS.push(c);
    for (let r = 0; r < fr; r++) if (!sh.hidden.has(r)) rowsF.push(r);
    for (let r = r0; r <= r1; r++) if (!sh.hidden.has(r)) rowsS.push(r);
    this.fixed = { w: fw, h: fh };
    const spec = {
      main: { l: fw, t: fh, w: viewW - fw, h: viewH - fh, rows: rowsS, cols: colsS, ox: sl + fw, oy: st + fh },
      top: { l: fw, t: 0, w: viewW - fw, h: fh, rows: rowsF, cols: colsS, ox: sl + fw, oy: 0 },
      left: { l: 0, t: fh, w: fw, h: viewH - fh, rows: rowsS, cols: colsF, ox: 0, oy: st + fh },
      corner: { l: 0, t: 0, w: fw, h: fh, rows: rowsF, cols: colsF, ox: 0, oy: 0 },
    };
    this.drawn = new Set();
    for (const p of ["main", "top", "left", "corner"]) this.drawPane(this.panes[p], spec[p], z);
    this.drawHeaders(colsF, colsS, rowsF, rowsS, fw, fh, viewW, viewH);
    this.updateOverlay(animate);
    this.positionEditor();
  }

  drawPane(pane, s, z) {
    const el = pane.el;
    if (s.w <= 0 || s.h <= 0 || !s.rows.length || !s.cols.length) { el.style.display = "none"; pane.cells.replaceChildren(); return; }
    el.style.display = "block";
    el.style.left = ROWHDR + s.l + "px"; el.style.top = COLHDR + s.t + "px"; el.style.width = s.w + "px"; el.style.height = s.h + "px";
    const dpr = window.devicePixelRatio || 1, cv = pane.canvas;
    if (cv.width !== Math.round(s.w * dpr) || cv.height !== Math.round(s.h * dpr)) { cv.width = Math.round(s.w * dpr); cv.height = Math.round(s.h * dpr); cv.style.width = s.w + "px"; cv.style.height = s.h + "px"; }
    const ctx = pane.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, s.w, s.h);
    ctx.strokeStyle = this.colors.line; ctx.lineWidth = 1; ctx.beginPath();
    for (const c of s.cols) { const x = Math.round(this.colX[c + 1] - s.ox) - 0.5; if (x > 0 && x < s.w) { ctx.moveTo(x, 0); ctx.lineTo(x, s.h); } }
    for (const r of s.rows) { const y = Math.round(this.rowY[r + 1] - s.oy) - 0.5; if (y > 0 && y < s.h) { ctx.moveTo(0, y); ctx.lineTo(s.w, y); } }
    ctx.stroke();

    const book = this.book, sh = this.sheet, frag = document.createDocumentFragment();
    const filter = sh.filter;
    for (const r of s.rows) {
      for (const c of s.cols) {
        const cell = sh.cells.get(key(r, c));
        const m = sh.merges.length ? book.mergeAt(sh, r, c) : null;
        if (m && (m.r1 !== r || m.c1 !== c)) {
          if (this.drawn.has(m) || (m.r1 >= s.rows[0] && m.c1 >= s.cols[0])) continue;
          // master is outside this pane's visible list: draw it from here once
          this.drawn.add(m);
          const mc = sh.cells.get(key(m.r1, m.c1));
          frag.appendChild(this.cellEl(m.r1, m.c1, mc, m, s, z));
          continue;
        }
        const isHdr = filter && r === filter.r1 && c >= filter.c1 && c <= filter.c2;
        if (!cell && !isHdr && !m) continue;
        if (cell && !cell.s && cell.v === undefined && cell.f === undefined && !m) continue;
        if (m) this.drawn.add(m);
        frag.appendChild(this.cellEl(r, c, cell, m, s, z, isHdr));
      }
    }
    pane.cells.replaceChildren(frag);
    // freeze divider
    el.classList.toggle("edge-r", s.l === 0 && this.fixed.w > 0 && (el === this.panes.left.el || el === this.panes.corner.el));
    el.classList.toggle("edge-b", s.t === 0 && this.fixed.h > 0 && (el === this.panes.top.el || el === this.panes.corner.el));
  }

  cellEl(r, c, cell, m, s, z, isHdr = false) {
    const book = this.book, sh = this.sheet;
    const d = cell ? book.display(sh, r, c) : { text: "", v: null, st: book.styles[0], err: false };
    const st = d.st, e = document.createElement("div");
    const r2 = m ? m.r2 : r, c2 = m ? m.c2 : c;
    let x = this.colX[c] - s.ox, y = this.rowY[r] - s.oy, w = this.colX[c2 + 1] - this.colX[c], h = this.rowY[r2 + 1] - this.rowY[r];
    const fpx = (st.fs || 11) * PT * z;
    const isNum = typeof d.v === "number", isStr = typeof d.v === "string";
    const ha = st.ha || (d.err || typeof d.v === "boolean" ? "center" : isNum ? "right" : "left");
    let text = d.text;
    if (isNum && !st.wr && text.length * fpx * 0.56 > w - 8) text = "#".repeat(Math.max(1, Math.floor((w - 8) / (fpx * 0.56))));
    // let long left-aligned text spill into empty neighbours
    if (!st.wr && !m && ha === "left" && (isStr || d.err) && text.length * fpx * 0.5 > w - 8) {
      let cc = c + 1, extra = 0;
      while (cc < c + 40 && cc < this.extC && !sh.cells.has(key(r, cc)) && extra < text.length * fpx * 0.55 - w) { extra += this.colX[cc + 1] - this.colX[cc]; cc++; }
      w += extra;
    }
    e.className = "cell" + (d.err ? " err" : "") + (isHdr ? " fhdr" : "");
    e.dataset.r = r; e.dataset.c = c;
    const css = e.style;
    css.left = x + "px"; css.top = y + "px"; css.width = w + "px"; css.height = h + "px";
    css.fontSize = fpx + "px";
    if (st.ff) css.fontFamily = `"${st.ff}", system-ui, sans-serif`;
    if (st.b) css.fontWeight = "700"; if (st.i) css.fontStyle = "italic";
    const deco = [st.u ? "underline" : "", st.st ? "line-through" : ""].filter(Boolean).join(" ");
    if (deco) css.textDecoration = deco;
    if (st.fc && !d.err) css.color = st.fc;
    if (st.bg) css.background = st.bg; else if (isHdr) { css.background = "var(--md-surface-container)"; if (!st.b) css.fontWeight = "600"; } else if (m) css.background = "var(--cell-bg)";
    css.justifyContent = ha === "center" ? "center" : ha === "right" ? "flex-end" : "flex-start";
    css.alignItems = st.va === "top" ? "flex-start" : st.va === "middle" || !st.va ? "center" : "flex-end";
    if (st.va === "bottom") css.alignItems = "flex-end";
    if (st.wr) { css.whiteSpace = "pre-wrap"; css.wordBreak = "break-word"; css.lineHeight = "1.25"; }
    const sh1 = [];
    if (st.bT) sh1.push(`inset 0 1px 0 0 ${st.bT}`); if (st.bB) sh1.push(`inset 0 -1px 0 0 ${st.bB}`);
    if (st.bL) sh1.push(`inset 1px 0 0 0 ${st.bL}`); if (st.bR) sh1.push(`inset -1px 0 0 0 ${st.bR}`);
    if (sh1.length) css.boxShadow = sh1.join(",");
    const span = document.createElement("span"); span.className = "t"; span.textContent = text;
    e.appendChild(span);
    if (isHdr) {
      const f = sh.filter, active = f.excl[c] && f.excl[c].size;
      const b = document.createElement("button"); b.className = "fbtn" + (active ? " on" : ""); b.dataset.col = c; b.tabIndex = -1;
      b.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
      e.appendChild(b);
    }
    return e;
  }

  drawHeaders(colsF, colsS, rowsF, rowsS, fw, fh, viewW, viewH) {
    const g = this.range(), full = { cols: this.isFullCols(g), rows: this.isFullRows(g) };
    const sc = this.scroll;
    this.colhdr.style.left = ROWHDR + "px"; this.colhdr.style.height = COLHDR + "px";
    this.rowhdr.style.top = COLHDR + "px"; this.rowhdr.style.width = ROWHDR + "px";
    const cf = document.createDocumentFragment(), rf = document.createDocumentFragment();
    const mk = (cls, text, style) => { const e = document.createElement("div"); e.className = cls; e.textContent = text; Object.assign(e.style, style); return e; };
    const hs = (a, b, lo, hi) => (a <= hi && b >= lo);
    for (const c of colsS) cf.appendChild(mk("hc" + (hs(c, c, g.c1, g.c2) ? (full.cols ? " full" : " sel") : ""), colName(c), { left: this.colX[c] - sc.scrollLeft - 0 + "px", width: this.colX[c + 1] - this.colX[c] + "px" }));
    for (const c of colsF) cf.appendChild(mk("hc fz" + (hs(c, c, g.c1, g.c2) ? (full.cols ? " full" : " sel") : ""), colName(c), { left: this.colX[c] + "px", width: this.colX[c + 1] - this.colX[c] + "px" }));
    for (const r of rowsS) rf.appendChild(mk("hr" + (hs(r, r, g.r1, g.r2) ? (full.rows ? " full" : " sel") : ""), r + 1, { top: this.rowY[r] - sc.scrollTop + "px", height: this.rowY[r + 1] - this.rowY[r] + "px" }));
    for (const r of rowsF) rf.appendChild(mk("hr fz" + (hs(r, r, g.r1, g.r2) ? (full.rows ? " full" : " sel") : ""), r + 1, { top: this.rowY[r] + "px", height: this.rowY[r + 1] - this.rowY[r] + "px" }));
    this.colhdr.replaceChildren(cf); this.rowhdr.replaceChildren(rf);
    this.colhdr.style.width = viewW + "px"; this.rowhdr.style.height = viewH + "px";
    this.corner.style.width = ROWHDR + "px"; this.corner.style.height = COLHDR + "px";
    this.overlay.style.left = ROWHDR + "px"; this.overlay.style.top = COLHDR + "px"; this.overlay.style.width = viewW + "px"; this.overlay.style.height = viewH + "px";
  }

  place(el, rect, inset = 0) {
    const s = el.style;
    s.left = rect.x - inset + "px"; s.top = rect.y - inset + "px"; s.width = rect.w + inset * 2 + "px"; s.height = rect.h + inset * 2 + "px";
  }
  updateOverlay(animate) {
    const ov = this.overlay;
    if (animate) { ov.classList.remove("no-t"); clearTimeout(this._tt); this._tt = setTimeout(() => ov.classList.add("no-t"), 160); }
    const g = this.range(), a = this.active(), m = this.masterOf(a.r, a.c).m;
    const viewW = ov.clientWidth || this.scroll.clientWidth - ROWHDR, viewH = ov.clientHeight || this.scroll.clientHeight - COLHDR;
    const clampRect = (rc) => { const x = Math.max(rc.x, -2), y = Math.max(rc.y, -2); return { x, y, w: Math.min(rc.x + rc.w, viewW + 2) - x, h: Math.min(rc.y + rc.h, viewH + 2) - y }; };
    const rg = this.rectOf(g.r1, g.c1, g.r2, g.c2), ar = this.rectOf(m ? m.r1 : a.r, m ? m.c1 : a.c, m ? m.r2 : a.r, m ? m.c2 : a.c);
    // selections that start in the scrolling area must not paint over the frozen rows / columns
    const { r: fr, c: fc } = this.frozen, fw = this.colX[fc], fh = this.rowY[fr];
    const clipTo = (e, rc, r1, c1) => {
      const top = r1 >= fr && fh > 0 ? Math.max(0, fh - rc.y) : 0, left = c1 >= fc && fw > 0 ? Math.max(0, fw - rc.x) : 0;
      e.style.clipPath = top || left ? `inset(${top}px 0 0 ${left}px)` : "";
    };
    const multi = g.r1 !== g.r2 || g.c1 !== g.c2;
    const ok = rg.x + rg.w > -4 && rg.y + rg.h > -4 && rg.x < viewW && rg.y < viewH;
    this.elSel.hidden = !multi || !ok; this.place(this.elSel, clampRect(rg)); clipTo(this.elSel, clampRect(rg), g.r1, g.c1);
    this.elAct.hidden = !(ar.x + ar.w > 0 && ar.y + ar.h > 0 && ar.x < viewW && ar.y < viewH); this.place(this.elAct, ar); clipTo(this.elAct, ar, m ? m.r1 : a.r, m ? m.c1 : a.c);
    const fullAny = this.isFullCols(g) || this.isFullRows(g);
    const hx = rg.x + rg.w, hy = rg.y + rg.h;
    this.elHandle.hidden = fullAny || !(hx > 0 && hy > 0 && hx < viewW && hy < viewH) || !!this.edit || (g.r2 >= fr && hy < fh) || (g.c2 >= fc && hx < fw);
    this.elHandle.style.left = hx - 5 + "px"; this.elHandle.style.top = hy - 5 + "px";
    const mq = this.marquee && this.marquee.sheet === this.sheet.name ? this.rectOf(this.marquee.r1, this.marquee.c1, this.marquee.r2, this.marquee.c2) : null;
    this.elMarquee.hidden = !mq; if (mq) { this.place(this.elMarquee, mq); clipTo(this.elMarquee, mq, this.marquee.r1, this.marquee.c1); }
  }

  flash(rg) {
    rg = norm(rg);
    const rc = this.rectOf(rg.r1, rg.c1, rg.r2, rg.c2), e = document.createElement("div");
    e.className = "g-flash"; this.place(e, rc);
    e.addEventListener("animationend", () => e.remove());
    this.flashes.appendChild(e);
  }

  // ───────────────────────── editing ─────────────────────────
  get editing() { return !!this.edit; }
  startEdit(text, mode = "edit") {
    if (this.edit || !this.enabled) return;
    const { r, c } = this.active();
    this.edit = { r, c, mode, sheet: this.sheet.name };
    this.editor.hidden = false;
    this.editor.value = text !== undefined && text !== null ? text : this.book.rawInput(this.sheet, r, c);
    this.positionEditor(); this.editor.focus();
    if (text === undefined || text === null) { const l = this.editor.value.length; this.editor.setSelectionRange(l, l); }
    this.point = null;
    this.hooks.edit && this.hooks.edit(true, this.editor.value);
    this.updateOverlay(false);
  }
  positionEditor() {
    if (!this.edit) return;
    const { r, c } = this.edit, m = this.masterOf(r, c).m;
    const rc = this.rectOf(m ? m.r1 : r, m ? m.c1 : c, m ? m.r2 : r, m ? m.c2 : c);
    const st = this.book.styleOf(this.sheet.cells.get(key(r, c)));
    const e = this.editor, s = e.style, fpx = (st.fs || 11) * PT * this.zoom;
    s.left = rc.x + "px"; s.top = rc.y + "px"; s.minWidth = rc.w + "px"; s.minHeight = rc.h + "px";
    s.fontSize = fpx + "px"; s.fontFamily = st.ff ? `"${st.ff}", system-ui, sans-serif` : "";
    s.fontWeight = st.b ? "700" : ""; s.fontStyle = st.i ? "italic" : "";
    s.textAlign = st.ha || ""; s.color = st.fc || ""; s.background = st.bg || "";
    this.autosizeEditor(rc);
  }
  autosizeEditor(rc) {
    const e = this.editor;
    e.style.width = "0px"; e.style.height = "0px";
    const maxW = Math.max(rc ? rc.w : 0, this.overlay.clientWidth - (rc ? rc.x : 0) - 4);
    e.style.width = Math.min(maxW, Math.max((rc ? rc.w : 60), e.scrollWidth + 6)) + "px";
    e.style.height = Math.max(rc ? rc.h : 24, e.scrollHeight + 2) + "px";
  }
  setEditorText(t) { if (this.edit) { this.editor.value = t; this.autosizeEditor(this.rectOf(this.edit.r, this.edit.c, this.edit.r, this.edit.c)); } }
  commitEdit(dr = 1, dc = 0, kind = null) {
    if (!this.edit) return;
    const { r, c, sheet } = this.edit, text = this.editor.value;
    this.closeEditor();
    if (sheet === this.sheet.name) this.book.setInput(this.sheet, r, c, text);
    this.moveSel(dr, dc, false, false, kind);
  }
  commitText(text, dr = 1, dc = 0) { // used by the formula bar
    const { r, c } = this.edit ? this.edit : this.active();
    this.closeEditor();
    this.book.setInput(this.sheet, r, c, text);
    this.moveSel(dr, dc, false, false, "enter");
  }
  cancelEdit() { this.closeEditor(); this.requestRender(); }
  closeEditor() {
    this.edit = null; this.point = null; this.editor.hidden = true; this.hideAc();
    this.scroll.focus({ preventScroll: true });
    this.hooks.edit && this.hooks.edit(false, "");
    this.updateOverlay(false);
  }

  // function-name autocomplete
  updateAc() {
    const v = this.editor.value, pos = this.editor.selectionStart;
    this.acItems = [];
    if (v.startsWith("=")) {
      const m = /(?:^|[^A-Za-z0-9_.!$])([A-Za-z][A-Za-z0-9_.]*)$/.exec(v.slice(0, pos));
      if (m && !/^[A-Za-z]{1,3}\d+$/.test(m[1])) this.acItems = FUNCTION_NAMES.filter((n) => n.startsWith(m[1].toUpperCase()) && n !== m[1].toUpperCase()).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 7);
      this.acWord = m ? m[1] : "";
    }
    this.acIndex = -1;
    if (!this.acItems.length) { this.hideAc(); return; }
    this.ac.replaceChildren(...this.acItems.map((n, i) => {
      const d = document.createElement("div"); d.className = "ac-item"; d.textContent = n;
      d.addEventListener("mousedown", (ev) => { ev.preventDefault(); this.acIndex = i; this.pickAc(); });
      return d;
    }));
    const rc = this.rectOf(this.edit.r, this.edit.c, this.edit.r, this.edit.c);
    this.ac.style.left = rc.x + "px"; this.ac.style.top = rc.y + rc.h + 4 + "px"; this.ac.hidden = false;
  }
  hideAc() { this.ac.hidden = true; this.acItems = []; this.acIndex = -1; }
  moveAc(d) {
    this.acIndex = (this.acIndex + d + this.acItems.length) % this.acItems.length;
    [...this.ac.children].forEach((e, i) => e.classList.toggle("on", i === this.acIndex));
  }
  pickAc() {
    const name = this.acItems[this.acIndex < 0 ? 0 : this.acIndex]; if (!name) return;
    const v = this.editor.value, pos = this.editor.selectionStart, start = pos - this.acWord.length;
    this.editor.value = v.slice(0, start) + name + "(" + v.slice(pos);
    const np = start + name.length + 1; this.editor.setSelectionRange(np, np);
    this.hideAc(); this.onEditorInput();
  }
  onEditorInput() {
    this.hooks.edit && this.hooks.edit(true, this.editor.value);
    this.autosizeEditor(this.rectOf(this.edit.r, this.edit.c, this.edit.r, this.edit.c));
    this.updateAc();
  }

  // click on a cell while typing a formula inserts its reference
  canPoint() {
    if (!this.edit || !this.editor.value.startsWith("=")) return false;
    const pos = this.editor.selectionStart, before = this.editor.value.slice(0, pos);
    if (this.point && pos === this.point.end) return true;
    return /[=(+\-*/^&,<>:;]\s*$/.test(before);
  }
  pointInsert(r1, c1, r2, c2) {
    const text = (this.sheet.name !== this.edit.sheet ? "" : "") + rangeText(r1, c1, r2, c2);
    const v = this.editor.value, pos = this.editor.selectionStart;
    const start = this.point && pos === this.point.end ? this.point.start : pos, end = this.point && pos === this.point.end ? this.point.end : pos;
    this.editor.value = v.slice(0, start) + text + v.slice(end);
    this.point = { start, end: start + text.length };
    this.editor.setSelectionRange(this.point.end, this.point.end);
    this.hooks.edit && this.hooks.edit(true, this.editor.value);
    this.autosizeEditor(this.rectOf(this.edit.r, this.edit.c, this.edit.r, this.edit.c));
  }

  // ───────────────────────── movement ─────────────────────────
  hasContent(r, c) { const cell = this.sheet.cells.get(key(r, c)); return !!cell && (cell.v !== undefined || cell.f !== undefined) && cell.v !== ""; }
  jump(r, c, dr, dc) {
    const b = this.book.bounds(this.sheet), inb = (rr, cc) => rr >= 0 && cc >= 0 && rr < MAX_ROWS && cc < MAX_COLS;
    let nr = r + dr, nc = c + dc;
    if (!inb(nr, nc)) return { r, c };
    if (this.hasContent(r, c) && this.hasContent(nr, nc)) {
      while (inb(nr + dr, nc + dc) && this.hasContent(nr + dr, nc + dc)) { nr += dr; nc += dc; }
      return { r: nr, c: nc };
    }
    while (!this.hasContent(nr, nc)) {
      if (!inb(nr + dr, nc + dc)) return { r: nr, c: nc };
      if ((dr > 0 && nr > b.maxR) || (dc > 0 && nc > b.maxC)) return { r: dr > 0 ? Math.min(MAX_ROWS - 1, Math.max(this.extR - 1, nr)) : nr, c: dc > 0 ? Math.min(MAX_COLS - 1, Math.max(this.extC - 1, nc)) : nc };
      nr += dr; nc += dc;
    }
    return { r: nr, c: nc };
  }
  moveSel(dr, dc, extend = false, ctrl = false, kind = null) {
    const s = this.sel;
    let from = extend ? { r: s.fr, c: s.fc } : this.active();
    if (!extend) { const mm = this.masterOf(from.r, from.c).m; if (mm) { from = { r: dr > 0 ? mm.r2 : dr < 0 ? mm.r1 : from.r, c: dc > 0 ? mm.c2 : dc < 0 ? mm.c1 : from.c }; } }
    let t = ctrl ? this.jump(from.r, from.c, dr, dc) : { r: from.r + dr, c: from.c + dc };
    if (!ctrl) { // skip hidden rows
      while (this.sheet.hidden.has(t.r) && t.r > 0 && t.r < MAX_ROWS - 1) t.r += dr || 1;
    }
    // Excel behaviour: after a chain of Tab presses, Enter returns to the column where the chain started
    if (kind === "tab" && !extend) { if (this._tabStart == null) this._tabStart = from.c; }
    else if (kind === "enter" && !extend && this._tabStart != null) { t.c = this._tabStart; this._tabStart = null; }
    else if (kind !== "enter") this._tabStart = null;
    t.r = Math.max(0, Math.min(MAX_ROWS - 1, t.r)); t.c = Math.max(0, Math.min(MAX_COLS - 1, t.c));
    if (extend) this.select(s.ar, s.ac, t.r, t.c);
    else this.select(t.r, t.c);
  }

  // ───────────────────────── mouse ─────────────────────────
  bind() {
    const sc = this.scroll;
    sc.addEventListener("scroll", () => { this.requestRender(); if (this.edit) this.positionEditor(); }, { passive: true });
    sc.addEventListener("mousedown", (e) => this.onMouseDown(e));
    sc.addEventListener("dblclick", (e) => this.onDblClick(e));
    sc.addEventListener("contextmenu", (e) => this.onContext(e));
    sc.addEventListener("mousemove", (e) => this.onHover(e));
    sc.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); this.hooks.zoom && this.hooks.zoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));
    window.addEventListener("mouseup", (e) => this.onMouseUp(e));
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    document.addEventListener("copy", (e) => this.onCopyEvent(e, false));
    document.addEventListener("cut", (e) => this.onCopyEvent(e, true));
    document.addEventListener("paste", (e) => this.onPasteEvent(e));
    const ed = this.editor;
    ed.addEventListener("input", () => this.onEditorInput());
    ed.addEventListener("keydown", (e) => this.onEditorKey(e));
    ed.addEventListener("mousedown", (e) => e.stopPropagation());
    ed.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== this.editor) this.hideAc(); }, 120));
  }
  localXY(e) { const rc = this.scroll.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
  hit(e) {
    const { x, y } = this.localXY(e);
    const W = this.scroll.clientWidth, H = this.scroll.clientHeight;
    if (x > W || y > H) return { type: "scrollbar" };
    if (x < ROWHDR && y < COLHDR) return { type: "corner" };
    if (y < COLHDR) {
      const c = Math.min(this.extC - 1, this.colAt(x - ROWHDR));
      const edge = this.edgeR(c) + ROWHDR;
      if (Math.abs(x - edge) <= 4) return { type: "colresize", c };
      const prev = c > 0 ? this.edgeR(c - 1) + ROWHDR : -99;
      if (Math.abs(x - prev) <= 4 && c > 0 && this.edgeR(c - 1) !== this.edgeR(c)) return { type: "colresize", c: c - 1 };
      return { type: "colhdr", c };
    }
    if (x < ROWHDR) {
      const r = Math.min(this.extR - 1, this.rowAt(y - COLHDR));
      const edge = this.edgeB(r) + COLHDR;
      if (Math.abs(y - edge) <= 3) return { type: "rowresize", r };
      return { type: "rowhdr", r };
    }
    const hb = this.elHandle.getBoundingClientRect();
    if (!this.elHandle.hidden && e.clientX >= hb.left - 3 && e.clientX <= hb.right + 3 && e.clientY >= hb.top - 3 && e.clientY <= hb.bottom + 3) return { type: "handle" };
    return { type: "cell", r: Math.min(this.extR - 1, this.rowAt(y - COLHDR)), c: Math.min(this.extC - 1, this.colAt(x - ROWHDR)) };
  }
  onHover(e) {
    if (this.drag) return;
    const h = this.hit(e);
    this.scroll.style.cursor = h.type === "colresize" ? "col-resize" : h.type === "rowresize" ? "row-resize" : h.type === "handle" ? "crosshair" : h.type === "colhdr" || h.type === "rowhdr" ? "pointer" : "";
  }
  onMouseDown(e) {
    if (e.button === 2 && !e.target.closest(".cell")) { /* handled in contextmenu */ }
    if (e.target.closest(".fbtn")) { e.preventDefault(); const col = +e.target.closest(".fbtn").dataset.col; this.hooks.filter && this.hooks.filter(col, e.target.closest(".fbtn").getBoundingClientRect()); return; }
    if (e.target === this.editor || e.button === 1) return;
    const h = this.hit(e);
    if (h.type === "scrollbar") return;
    if (e.button === 2) {
      if (h.type === "cell") { const g = this.range(); if (h.r < g.r1 || h.r > g.r2 || h.c < g.c1 || h.c > g.c2) this.select(h.r, h.c); }
      else if (h.type === "colhdr") { const g = this.range(); if (!(this.isFullCols(g) && h.c >= g.c1 && h.c <= g.c2)) this.select(0, h.c, MAX_ROWS - 1, h.c, { reveal: false }); }
      else if (h.type === "rowhdr") { const g = this.range(); if (!(this.isFullRows(g) && h.r >= g.r1 && h.r <= g.r2)) this.select(h.r, 0, h.r, MAX_COLS - 1, { reveal: false }); }
      return;
    }
    if (this.edit) {
      if (h.type === "cell" && this.canPoint()) {
        e.preventDefault();
        this.pointInsert(h.r, h.c, h.r, h.c);
        this.drag = { type: "point", r: h.r, c: h.c };
        return;
      }
      this.commitEdit(0, 0);
    }
    this.scroll.focus({ preventScroll: true });
    this._tabStart = null;
    switch (h.type) {
      case "corner": this.selectAll(); break;
      case "colhdr":
        e.preventDefault();
        if (e.shiftKey) this.select(0, this.sel.ac, MAX_ROWS - 1, h.c, { reveal: false });
        else this.select(0, h.c, MAX_ROWS - 1, h.c, { reveal: false });
        this.drag = { type: "cols", c: e.shiftKey ? this.sel.ac : h.c }; break;
      case "rowhdr":
        e.preventDefault();
        if (e.shiftKey) this.select(this.sel.ar, 0, h.r, MAX_COLS - 1, { reveal: false });
        else this.select(h.r, 0, h.r, MAX_COLS - 1, { reveal: false });
        this.drag = { type: "rows", r: e.shiftKey ? this.sel.ar : h.r }; break;
      case "colresize": e.preventDefault(); this.drag = { type: "colresize", c: h.c, x0: e.clientX, w0: (this.sheet.colW[h.c] ?? this.sheet.defW), snap: this.book.manualBegin() }; this.showGuide(true); break;
      case "rowresize": e.preventDefault(); this.drag = { type: "rowresize", r: h.r, y0: e.clientY, h0: (this.sheet.rowH[h.r] ?? this.sheet.defH), snap: this.book.manualBegin() }; this.showGuide(true); break;
      case "handle": e.preventDefault(); this.drag = { type: "fill", src: this.range(), tgt: this.range() }; this.overlay.classList.add("dragging"); break;
      case "cell":
        e.preventDefault();
        if (e.shiftKey) this.select(this.sel.ar, this.sel.ac, h.r, h.c);
        else this.select(h.r, h.c);
        this.drag = { type: "cells" };
        this.overlay.classList.add("dragging");
        break;
    }
    if (this.drag) { this.autoScroll = null; this.dragEvt = e; }
  }
  onMouseMove(e) {
    const d = this.drag; if (!d) return;
    this.dragEvt = e;
    const { x, y } = this.localXY(e);
    if (d.type === "colresize") {
      const w = Math.max(16, d.w0 + (e.clientX - d.x0) / this.zoom);
      this.book.setColWidth(this.sheet, d.c, w); this.rebuild(); this.requestRender();
      this.guide.hidden = false; this.guide.className = "g-guide v"; this.guide.style.left = this.edgeR(d.c) + ROWHDR + "px"; this.guide.textContent = Math.round(w) + " px"; return;
    }
    if (d.type === "rowresize") {
      const h = Math.max(10, d.h0 + (e.clientY - d.y0) / this.zoom);
      this.book.setRowHeight(this.sheet, d.r, h); this.rebuild(); this.requestRender();
      this.guide.hidden = false; this.guide.className = "g-guide h"; this.guide.style.top = this.edgeB(d.r) + COLHDR + "px"; this.guide.textContent = Math.round(h) + " px"; return;
    }
    this.autoScrollTick(x, y);
    this.dragTo(x, y);
  }
  dragTo(x, y) {
    const d = this.drag; if (!d) return;
    const cx = Math.max(ROWHDR, x), cy = Math.max(COLHDR, y);
    const c = Math.min(MAX_COLS - 1, this.colAt(cx - ROWHDR)), r = Math.min(MAX_ROWS - 1, this.rowAt(cy - COLHDR));
    if (d.type === "cells") this.select(this.sel.ar, this.sel.ac, r, c, { reveal: false });
    else if (d.type === "cols") this.select(0, d.c, MAX_ROWS - 1, c, { reveal: false });
    else if (d.type === "rows") this.select(d.r, 0, r, MAX_COLS - 1, { reveal: false });
    else if (d.type === "point") { this.pointInsert(Math.min(d.r, r), Math.min(d.c, c), Math.max(d.r, r), Math.max(d.c, c)); }
    else if (d.type === "fill") {
      const s = d.src; let t = { ...s };
      const dr = r > s.r2 ? r - s.r2 : r < s.r1 ? r - s.r1 : 0, dc = c > s.c2 ? c - s.c2 : c < s.c1 ? c - s.c1 : 0;
      if (Math.abs(dr) * (s.c2 - s.c1 + 1) >= Math.abs(dc) * (s.r2 - s.r1 + 1)) { if (dr > 0) t.r2 = r; else if (dr < 0) t.r1 = r; }
      else { if (dc > 0) t.c2 = c; else if (dc < 0) t.c1 = c; }
      d.tgt = t;
      const rc = this.rectOf(t.r1, t.c1, t.r2, t.c2); this.elFillPrev.hidden = false; this.place(this.elFillPrev, rc);
    }
  }
  autoScrollTick(x, y) {
    const sc = this.scroll, W = sc.clientWidth, H = sc.clientHeight;
    let dx = 0, dy = 0;
    if (x > W - 24) dx = Math.min(40, (x - (W - 24)) / 2 + 6); else if (x < ROWHDR + 24 + this.fixed.w) dx = -Math.min(40, (ROWHDR + 24 + this.fixed.w - x) / 2 + 6);
    if (y > H - 24) dy = Math.min(40, (y - (H - 24)) / 2 + 6); else if (y < COLHDR + 24 + this.fixed.h) dy = -Math.min(40, (COLHDR + 24 + this.fixed.h - y) / 2 + 6);
    clearInterval(this._as);
    if ((dx || dy) && this.drag && ["cells", "cols", "rows", "fill", "point"].includes(this.drag.type)) {
      this._as = setInterval(() => {
        if (!this.drag) { clearInterval(this._as); return; }
        sc.scrollLeft += dx; sc.scrollTop += dy;
        const ev = this.dragEvt; if (ev) { const p = this.localXY(ev); this.dragTo(p.x, p.y); }
      }, 30);
    }
  }
  onMouseUp(e) {
    const d = this.drag; if (!d) return;
    clearInterval(this._as); this.drag = null;
    this.overlay.classList.remove("dragging"); this.showGuide(false);
    if (d.type === "colresize" || d.type === "rowresize") { this.book.manualCommit(d.snap); this.rebuild(); this.requestRender(); }
    else if (d.type === "fill") {
      this.elFillPrev.hidden = true;
      const t = d.tgt, s = d.src;
      if (t.r1 !== s.r1 || t.r2 !== s.r2 || t.c1 !== s.c1 || t.c2 !== s.c2) { this.book.fill(this.sheet, s, t); this.select(t.r1, t.c1, t.r2, t.c2, { reveal: false }); this.flash(t); }
    } else if (d.type === "point") { this.editor.focus(); }
    this.requestRender();
  }
  showGuide(on) { this.guide.hidden = !on; }
  onDblClick(e) {
    const h = this.hit(e);
    if (h.type === "colresize") { this.autoFitCol(h.c); return; }
    if (h.type === "rowresize") { const snap = this.book.manualBegin(); this.book.setRowHeight(this.sheet, h.r, null); this.book.manualCommit(snap); return; }
    if (h.type === "cell" && !this.edit) { this.startEdit(); }
  }
  onContext(e) {
    e.preventDefault();
    const h = this.hit(e);
    this.hooks.context && this.hooks.context(e.clientX, e.clientY, h);
  }
  autoFitCol(c) {
    const sh = this.sheet, ctx = this.measureCtx; let maxW = 0;
    this.book.eachCell(sh, { r1: 0, c1: c, r2: Math.min(MAX_ROWS - 1, this.book.bounds(sh).maxR), c2: c }, (cell, r) => {
      const d = this.book.display(sh, r, c), st = d.st, fpx = (st.fs || 11) * PT;
      ctx.font = `${st.i ? "italic " : ""}${st.b ? "700 " : ""}${fpx}px ${st.ff ? `"${st.ff}"` : "system-ui"}, sans-serif`;
      maxW = Math.max(maxW, ctx.measureText(d.text).width);
    });
    const snap = this.book.manualBegin();
    this.book.setColWidth(sh, c, maxW ? Math.min(600, Math.max(40, maxW + 18)) : null);
    this.book.manualCommit(snap);
  }
  setZoom(z) { this.zoom = Math.max(0.5, Math.min(2, Math.round(z * 100) / 100)); this.rebuild(); this.requestRender(); }

  // ───────────────────────── keyboard ─────────────────────────
  onEditorKey(e) {
    const ed = this.editor;
    if (e.isComposing) return;
    if (!this.ac.hidden && this.acItems.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.moveAc(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.moveAc(-1); return; }
      if (e.key === "Tab" || (e.key === "Enter" && this.acIndex >= 0)) { e.preventDefault(); this.pickAc(); return; }
      if (e.key === "Escape") { e.preventDefault(); this.hideAc(); return; }
    }
    if (e.key === "Enter") {
      if (e.altKey) { e.preventDefault(); const p = ed.selectionStart; ed.setRangeText("\n", p, ed.selectionEnd, "end"); this.onEditorInput(); return; }
      e.preventDefault(); this.commitEdit(e.shiftKey ? -1 : 1, 0, "enter");
    } else if (e.key === "Tab") { e.preventDefault(); this.commitEdit(0, e.shiftKey ? -1 : 1, "tab"); }
    else if (e.key === "Escape") { e.preventDefault(); this.cancelEdit(); }
    else if (this.edit && this.edit.mode === "enter" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.shiftKey) {
      if (this.editor.value.startsWith("=") && /[=(+\-*/^&,<>:;]\s*$/.test(ed.value.slice(0, ed.selectionStart))) return; // keep caret movement inside formulas
      e.preventDefault();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      this.commitEdit(d[0], d[1], null);
    }
  }
  onKeyDown(e) {
    if (!this.enabled || e.defaultPrevented) return;
    const t = e.target;
    if (t !== this.scroll && t !== document.body && !(t === this.editor)) return;
    if (t === this.editor) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); this.moveSel(arrows[k][0], arrows[k][1], e.shiftKey, ctrl); return; }
    if (ctrl) {
      if (k === "a" || k === "A") { e.preventDefault(); this.selectAll(); }
      else if (k === "Home") { e.preventDefault(); this.select(0, 0); this.scroll.scrollTo(0, 0); }
      else if (k === "End") { e.preventDefault(); const b = this.book.bounds(this.sheet); this.select(Math.max(0, b.maxR), Math.max(0, b.maxC)); }
      else if (k === " ") { e.preventDefault(); const g = this.range(); this.select(0, g.c1, MAX_ROWS - 1, g.c2, { reveal: false }); }
      else if (k === "d" || k === "D") { e.preventDefault(); this.fillDirection("down"); }
      else if (k === "r" || k === "R") { e.preventDefault(); this.fillDirection("right"); }
      return;
    }
    if (e.shiftKey && k === " ") { e.preventDefault(); const g = this.range(); this.select(g.r1, 0, g.r2, MAX_COLS - 1, { reveal: false }); return; }
    switch (k) {
      case "Enter": e.preventDefault(); this.moveSel(e.shiftKey ? -1 : 1, 0, false, false, "enter"); return;
      case "Tab": e.preventDefault(); this.moveSel(0, e.shiftKey ? -1 : 1, false, false, "tab"); return;
      case "F2": e.preventDefault(); this.startEdit(); return;
      case "Delete": case "Backspace": e.preventDefault(); this.clearSelection(); return;
      case "Home": e.preventDefault(); this.select(this.sel.ar, 0, e.shiftKey ? this.sel.fr : this.sel.ar, 0); if (!e.shiftKey) this.scroll.scrollLeft = 0; return;
      case "PageDown": case "PageUp": {
        e.preventDefault();
        const rows = Math.max(1, Math.floor((this.scroll.clientHeight - COLHDR) / ((this.sheet.defH) * this.zoom)) - 1) * (k === "PageDown" ? 1 : -1);
        const a = this.active(); this.select(Math.max(0, a.r + rows), a.c); return;
      }
      case "Escape": if (this.marquee) { this.marquee = null; this.clip = null; this.requestRender(); } return;
    }
    if (k.length === 1 || k === "Process" || e.isComposing) { // start typing; the browser sends the character to the editor
      if (e.altKey) return;
      this.startEdit("", "enter");
    }
  }

  // ───────────────────────── actions ─────────────────────────
  clearSelection() { this.book.clear(this.sheet, this.range(), "contents"); }
  fillDirection(dir) {
    const g = this.range();
    if (dir === "down" && g.r2 > g.r1) this.book.fill(this.sheet, { ...g, r2: g.r1 }, g);
    else if (dir === "right" && g.c2 > g.c1) this.book.fill(this.sheet, { ...g, c2: g.c1 }, g);
    this.flash(g);
  }
  onCopyEvent(e, cut) {
    if (!this.enabled || this.edit || (document.activeElement !== this.scroll && document.activeElement !== document.body)) return;
    e.preventDefault();
    const text = this.copy(cut);
    e.clipboardData.setData("text/plain", text);
  }
  copy(cut = false) {
    const g = this.range(), big = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
    const rg = this.isFullCols(g) || this.isFullRows(g) || big > 2e6 ? this.clipBounds(g) : g;
    const p = this.book.copyPayload(this.sheet, rg); p.cut = cut;
    this.clip = p; this.marquee = { sheet: this.sheet.name, ...rg };
    this.requestRender(); this.hooks.toast && this.hooks.toast(cut ? "cut" : "copied");
    return p.text;
  }
  clipBounds(g) { const b = this.book.bounds(this.sheet); return { r1: g.r1, c1: g.c1, r2: Math.min(g.r2, Math.max(g.r1, b.maxR)), c2: Math.min(g.c2, Math.max(g.c1, b.maxC)) }; }
  onPasteEvent(e) {
    if (!this.enabled || this.edit || (document.activeElement !== this.scroll && document.activeElement !== document.body)) return;
    e.preventDefault();
    this.pasteText(e.clipboardData.getData("text/plain") || "");
  }
  pasteText(text, mode = "all") {
    if (!text && !this.clip) return;
    const g = this.range(), a = { r: g.r1, c: g.c1 };
    let out;
    if (this.clip && (text === this.clip.text || !text)) {
      const p = this.clip;
      this.book.tx(() => {
        out = this.book.pasteCells(this.sheet, g, p, mode);
        if (p.cut && mode === "all") {
          const o = p.origin, sh = this.book.sheetByName(o.sheet);
          if (sh) this.book.clear(sh, { r1: o.r, c1: o.c, r2: o.r + p.rows - 1, c2: o.c + p.cols - 1 }, "contents");
        }
      });
      if (p.cut && mode === "all") { this.clip = null; this.marquee = null; }
    } else {
      const grid = parseDelimited(text.replace(/\r\n$/, "").replace(/\n$/, ""), "\t");
      if (!grid.length) return;
      if (mode === "values" || mode === "all") out = this.book.pasteText(this.sheet, a.r, a.c, grid);
    }
    if (out) { this.select(out.r1, out.c1, out.r2, out.c2, { reveal: false }); this.flash(out); }
  }
  // clipboard text for the current selection without touching marquee (used by "copy" toolbar)
  toggleStyle(k) {
    const a = this.active(), st = this.book.styleOf(this.sheet.cells.get(key(a.r, a.c)));
    this.book.applyStyle(this.sheet, this.range(), { [k]: st[k] ? undefined : true });
  }
  setStyle(patch) { this.book.applyStyle(this.sheet, this.range(), patch); }
  activeStyle() { const a = this.active(); return this.book.styleOf(this.sheet.cells.get(key(a.r, a.c))); }

  insertLines(axis, after = false) {
    const g = this.range(), n = axis === "row" ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
    const idx = axis === "row" ? (after ? g.r2 + 1 : g.r1) : (after ? g.c2 + 1 : g.c1);
    this.book.insertLines(this.sheet, axis, idx, n);
  }
  deleteLines(axis) {
    const g = this.range(), n = axis === "row" ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
    this.book.deleteLines(this.sheet, axis, axis === "row" ? g.r1 : g.c1, n);
  }
  toggleMerge() {
    const g = this.range(), m = this.book.mergeAt(this.sheet, g.r1, g.c1);
    if (m || (g.r1 === g.r2 && g.c1 === g.c2)) { if (m) this.book.unmerge(this.sheet, g); }
    else this.book.merge(this.sheet, g);
  }
  sortSelection(asc) {
    let g = this.range();
    const single = g.r1 === g.r2 && g.c1 === g.c2;
    const col = this.active().c;
    if (single || this.isFullCols(g)) g = this.currentRegion(this.active().r, this.active().c);
    if (!g) return false;
    const sh = this.sheet, V = (r, c) => this.book.value(sh, r, c);
    const header = g.r2 > g.r1 && typeof V(g.r1, col) === "string" && typeof V(g.r1 + 1, col) !== "string" && V(g.r1 + 1, col) !== null;
    this.book.sort(sh, g, Math.min(Math.max(col, g.c1), g.c2), asc, header);
    this.select(g.r1, g.c1, g.r2, g.c2, { reveal: false }); this.flash(g);
    return true;
  }
  currentRegion(r, c) {
    const has = (rr, cc) => rr >= 0 && cc >= 0 && this.hasContent(rr, cc);
    if (!has(r, c) && !has(r - 1, c) && !has(r + 1, c) && !has(r, c - 1) && !has(r, c + 1)) return null;
    let g = { r1: r, r2: r, c1: c, c2: c }, grew = true;
    const rowHas = (rr, c1, c2) => { for (let cc = c1 - 1; cc <= c2 + 1; cc++) if (has(rr, cc)) return true; return false; };
    const colHas = (cc, r1, r2) => { for (let rr = r1 - 1; rr <= r2 + 1; rr++) if (has(rr, cc)) return true; return false; };
    let guard = 0;
    while (grew && guard++ < 5000) {
      grew = false;
      if (g.r1 > 0 && rowHas(g.r1 - 1, g.c1, g.c2)) { g.r1--; grew = true; }
      if (rowHas(g.r2 + 1, g.c1, g.c2) && g.r2 < MAX_ROWS - 1) { g.r2++; grew = true; }
      if (g.c1 > 0 && colHas(g.c1 - 1, g.r1, g.r2)) { g.c1--; grew = true; }
      if (colHas(g.c2 + 1, g.r1, g.r2) && g.c2 < MAX_COLS - 1) { g.c2++; grew = true; }
    }
    return g;
  }
  autosum() {
    const g = this.range(), sh = this.sheet;
    const isNum = (r, c) => typeof this.book.value(sh, r, c) === "number";
    if (g.r1 === g.r2 && g.c1 === g.c2) {
      const { r, c } = this.active();
      let top = r - 1; while (top >= 0 && isNum(top, c)) top--; top++;
      if (top < r) { this.book.setInput(sh, r, c, `=SUM(${rangeText(top, c, r - 1, c)})`); }
      else { let left = c - 1; while (left >= 0 && isNum(r, left)) left--; left++; if (left < c) this.book.setInput(sh, r, c, `=SUM(${rangeText(r, left, r, c - 1)})`); else this.startEdit("=SUM()", "edit"); }
      this.select(r, c); return;
    }
    this.book.tx(() => { for (let c = g.c1; c <= g.c2; c++) this.book._setInput(sh, g.r2 + 1, c, `=SUM(${rangeText(g.r1, c, g.r2, c)})`); });
    this.select(g.r2 + 1, g.c1, g.r2 + 1, g.c2);
  }
}

// .docx export (DOM → WordprocessingML) and import (WordprocessingML → HTML).
import { createZip, readZip, decodeText, encodeText } from './zip.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

export const PAGE_SIZES = {
  A4: { w: 794, h: 1123, tw: 11906, th: 16838 },
  Letter: { w: 816, h: 1056, tw: 12240, th: 15840 },
  A5: { w: 559, h: 794, tw: 8392, th: 11906 },
};
export const MARGINS = { narrow: 720, moderate: 1080, normal: 1440, wide: 2160 }; // twips

const esc = (s) =>
  String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ */
/*  Export                                                            */
/* ------------------------------------------------------------------ */

const NAMED_COLORS = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00',
  orange: 'FFA500', purple: '800080', gray: '808080', grey: '808080', cyan: '00FFFF', magenta: 'FF00FF',
  pink: 'FFC0CB', brown: 'A52A2A', navy: '000080', teal: '008080', lime: '00FF00', maroon: '800000',
};

function cssColorToHex(c) {
  if (!c) return null;
  c = String(c).trim().toLowerCase();
  if (c === 'transparent' || c === 'inherit' || c === 'initial' || c === 'currentcolor') return null;
  let m = c.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split('').map((x) => x + x).join('').toUpperCase();
  m = c.match(/^#([0-9a-f]{6})/);
  if (m) return m[1].toUpperCase();
  m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return NAMED_COLORS[c] || null;
}

function cssLenToPx(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(-?[\d.]+)\s*(px|pt|em|rem|cm|mm|in)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2] || 'px') {
    case 'px': return n;
    case 'pt': return (n * 96) / 72;
    case 'em': case 'rem': return n * 16;
    case 'cm': return (n * 96) / 2.54;
    case 'mm': return (n * 96) / 25.4;
    case 'in': return n * 96;
    default: return null;
  }
}

const GENERIC_FONTS = /^(system-ui|-apple-system|ui-sans-serif|sans-serif|serif|monospace|blinkmacsystemfont|inherit)$/i;
function firstFont(v) {
  if (!v) return null;
  for (let f of v.split(',')) {
    f = f.trim().replace(/^["']|["']$/g, '');
    if (f && !GENERIC_FONTS.test(f)) return f;
  }
  return null;
}

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'HR', 'DIV', 'PRE', 'FIGURE', 'SECTION', 'ARTICLE']);

function dataUriToBytes(uri) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  let bin;
  if (m[2]) bin = atob(m[3]);
  else bin = unescape(m[3]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { mime: m[1].toLowerCase(), bytes: out };
}

async function toPngIfNeeded(img) {
  // Converts webp/svg/bmp… data URIs to PNG using a canvas (browser only).
  const src = img.getAttribute('src') || '';
  const d = dataUriToBytes(src);
  if (!d) return null;
  if (/^image\/(png|jpeg|jpg|gif)$/.test(d.mime)) return d;
  if (typeof document === 'undefined' || !document.createElement) return null;
  try {
    const el = new Image();
    el.src = src;
    await el.decode();
    const c = document.createElement('canvas');
    c.width = el.naturalWidth || 300;
    c.height = el.naturalHeight || 150;
    c.getContext('2d').drawImage(el, 0, 0);
    return dataUriToBytes(c.toDataURL('image/png'));
  } catch {
    return null;
  }
}

/**
 * Converts an editor element to a .docx file.
 * @param {HTMLElement} root
 * @param {{size?:string, orientation?:string, margin?:string, title?:string}} page
 * @returns {Promise<Uint8Array>}
 */
export async function exportDocx(root, page = {}) {
  const size = PAGE_SIZES[page.size] || PAGE_SIZES.A4;
  const landscape = page.orientation === 'landscape';
  const pw = landscape ? size.th : size.tw;
  const ph = landscape ? size.tw : size.th;
  const mar = MARGINS[page.margin] || MARGINS.normal;
  const contentTw = pw - mar * 2;
  const contentPx = contentTw / 15;

  const rels = []; // {id, type, target, external}
  const media = []; // {name, bytes}
  let relSeq = 10;
  const numOverrides = []; // numIds that restart decimal numbering
  let numSeq = 2;
  let docPrId = 1;

  // Pre-convert exotic image formats.
  const imgData = new Map();
  for (const img of root.querySelectorAll('img')) imgData.set(img, await toPngIfNeeded(img));

  const addRel = (type, target, external) => {
    const id = 'rId' + relSeq++;
    rels.push({ id, type, target, external });
    return id;
  };

  /* ---- run properties ---- */
  const rPrXml = (s) => {
    let x = '';
    if (s.font) x += `<w:rFonts w:ascii="${esc(s.font)}" w:hAnsi="${esc(s.font)}" w:cs="${esc(s.font)}"/>`;
    if (s.b) x += '<w:b/>';
    if (s.i) x += '<w:i/>';
    if (s.s) x += '<w:strike/>';
    if (s.color) x += `<w:color w:val="${s.color}"/>`;
    if (s.sz) x += `<w:sz w:val="${s.sz}"/><w:szCs w:val="${s.sz}"/>`;
    if (s.hl) x += `<w:shd w:val="clear" w:color="auto" w:fill="${s.hl}"/>`;
    if (s.u) x += '<w:u w:val="single"/>';
    if (s.va) x += `<w:vertAlign w:val="${s.va}"/>`;
    return x ? `<w:rPr>${x}</w:rPr>` : '';
  };

  const styleFrom = (el, st) => {
    const s = { ...st };
    const tag = el.tagName;
    if (tag === 'B' || tag === 'STRONG') s.b = true;
    if (tag === 'I' || tag === 'EM' || tag === 'CITE') s.i = true;
    if (tag === 'U' || tag === 'INS') s.u = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.s = true;
    if (tag === 'SUP') s.va = 'superscript';
    if (tag === 'SUB') s.va = 'subscript';
    if (tag === 'CODE' || tag === 'KBD' || tag === 'PRE') s.font = s.font || 'Consolas';
    if (tag === 'FONT') {
      const c = cssColorToHex(el.getAttribute('color'));
      if (c) s.color = c;
      const f = firstFont(el.getAttribute('face'));
      if (f) s.font = f;
    }
    if (tag === 'MARK') s.hl = 'FFFF00';
    const cs = el.style;
    if (cs) {
      const fw = cs.fontWeight;
      if (fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600) s.b = true;
      else if (fw === 'normal' || (fw && parseInt(fw, 10) < 600)) s.b = false;
      if (cs.fontStyle === 'italic' || cs.fontStyle === 'oblique') s.i = true;
      const td_ = cs.textDecoration || cs.textDecorationLine || '';
      if (td_.includes('underline')) s.u = true;
      if (td_.includes('line-through')) s.s = true;
      const col = cssColorToHex(cs.color);
      if (col) s.color = col;
      const bg = cssColorToHex(cs.backgroundColor);
      if (bg) s.hl = bg;
      const ff = firstFont(cs.fontFamily);
      if (ff) s.font = ff;
      const px = cssLenToPx(cs.fontSize);
      if (px) s.sz = Math.max(2, Math.round(px * 0.75 * 2));
      if (cs.verticalAlign === 'super') s.va = 'superscript';
      if (cs.verticalAlign === 'sub') s.va = 'subscript';
    }
    return s;
  };

  /* ---- images ---- */
  const imageRun = (img) => {
    const d = imgData.get(img);
    if (!d) return '';
    const ext = d.mime.includes('png') ? 'png' : d.mime.includes('gif') ? 'gif' : 'jpeg';
    const name = `image${media.length + 1}.${ext}`;
    media.push({ name, bytes: d.bytes });
    const rid = addRel('image', `media/${name}`);
    let wpx = parseFloat(img.getAttribute('width')) || cssLenToPx(img.style && img.style.width) || img.naturalWidth || img.width || 200;
    let hpx = parseFloat(img.getAttribute('height')) || cssLenToPx(img.style && img.style.height) || img.naturalHeight || img.height || 0;
    const nw = img.naturalWidth || wpx, nh = img.naturalHeight || hpx || wpx;
    if (!hpx) hpx = (wpx * nh) / nw;
    if (wpx > contentPx) { hpx = (hpx * contentPx) / wpx; wpx = contentPx; }
    const cx = Math.round(wpx * 9525), cy = Math.round(hpx * 9525);
    const id = docPrId++;
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="Picture ${id}" descr="${esc(img.getAttribute('alt') || '')}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    );
  };

  /* ---- inline content ---- */
  const inline = (node, st) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue.replace(/ /g, ' ');
      if (!text) return '';
      const parts = text.split(/(\t|\n)/);
      let x = '';
      for (const p of parts) {
        if (p === '\t') x += `<w:r>${rPrXml(st)}<w:tab/></w:r>`;
        else if (p === '\n') continue;
        else if (p) x += `<w:r>${rPrXml(st)}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`;
      }
      return x;
    }
    if (node.nodeType !== 1) return '';
    const tag = node.tagName;
    if (tag === 'BR') return '<w:r><w:br/></w:r>';
    if (tag === 'IMG') return imageRun(node);
    if (tag === 'A' && node.getAttribute('href')) {
      const href = node.getAttribute('href');
      const s2 = styleFrom(node, { ...st, u: true, color: st.color || '0563C1' });
      const inner = [...node.childNodes].map((c) => inline(c, s2)).join('');
      if (/^#/.test(href)) return inner;
      const rid = addRel('hyperlink', href, true);
      return `<w:hyperlink r:id="${rid}" w:history="1">${inner}</w:hyperlink>`;
    }
    const s2 = styleFrom(node, st);
    return [...node.childNodes].map((c) => inline(c, s2)).join('');
  };

  /* ---- paragraphs ---- */
  const pPrXml = (el, o = {}) => {
    let x = '';
    if (o.style) x += `<w:pStyle w:val="${o.style}"/>`;
    if (o.num) x += `<w:numPr><w:ilvl w:val="${o.num.lvl}"/><w:numId w:val="${o.num.id}"/></w:numPr>`;
    if (o.border) x += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="9A9AA0"/></w:pBdr>';
    const cs = el && el.style;
    let jc = (cs && cs.textAlign) || (el && el.getAttribute && el.getAttribute('align')) || '';
    jc = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both' }[jc];
    if (cs && cs.lineHeight) {
      const lh = cs.lineHeight;
      let ratio = null;
      if (/^[\d.]+$/.test(lh)) ratio = parseFloat(lh);
      else if (/%$/.test(lh)) ratio = parseFloat(lh) / 100;
      if (ratio) x += `<w:spacing w:line="${Math.round(ratio * 240)}" w:lineRule="auto"/>`;
    }
    if (!o.num && cs) {
      const left = cssLenToPx(cs.marginLeft) || cssLenToPx(cs.paddingLeft) || 0;
      const first = cssLenToPx(cs.textIndent) || 0;
      if (left > 0 || first) x += `<w:ind w:left="${Math.round(left * 15)}"${first ? ` w:firstLine="${Math.round(first * 15)}"` : ''}/>`;
    }
    if (jc) x += `<w:jc w:val="${jc}"/>`;
    return x ? `<w:pPr>${x}</w:pPr>` : '';
  };

  const para = (el, runsXml, o) => `<w:p>${pPrXml(el, o)}${runsXml}</w:p>`;

  const styleForTag = (tag) => ({ H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', H4: 'Heading3', H5: 'Heading3', H6: 'Heading3', BLOCKQUOTE: 'Quote' }[tag]);

  /* ---- lists ---- */
  const newDecimalList = () => {
    const id = numSeq++;
    numOverrides.push(id);
    return id;
  };
  const listChildren = (list, depth, numId) => {
    const ordered = list.tagName === 'OL';
    let x = '';
    for (const li of list.children) {
      if (li.tagName !== 'LI') continue;
      const inl = [];
      const nested = [];
      for (const c of li.childNodes) {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) nested.push(c);
        else inl.push(c);
      }
      x += para(li, inl.map((c) => inline(c, {})).join(''), { style: 'ListParagraph', num: { lvl: Math.min(depth, 8), id: numId } });
      for (const n of nested) {
        const nOrdered = n.tagName === 'OL';
        let nid = numId;
        if (nOrdered !== ordered) {
          nid = nOrdered ? newDecimalList() : 1;
        }
        x += listChildren(n, depth + 1, nid);
      }
    }
    return x;
  };

  /* ---- tables ---- */
  const tableXml = (table) => {
    const rows = [...table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr')];
    let cols = 1;
    for (const r of rows) {
      let n = 0;
      for (const c of r.children) n += parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      cols = Math.max(cols, n);
    }
    const colW = Math.floor(contentTw / cols);
    let x =
      '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + colW * cols + '" w:type="dxa"/>' +
      '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="B8B8C0"/>`).join('') +
      '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>';
    x += '<w:tblGrid>' + Array.from({ length: cols }, () => `<w:gridCol w:w="${colW}"/>`).join('') + '</w:tblGrid>';
    for (const r of rows) {
      x += '<w:tr>';
      for (const c of r.children) {
        if (c.tagName !== 'TD' && c.tagName !== 'TH') continue;
        const span = parseInt(c.getAttribute('colspan') || '1', 10) || 1;
        let tcPr = `<w:tcW w:w="${colW * span}" w:type="dxa"/>`;
        if (span > 1) tcPr += `<w:gridSpan w:val="${span}"/>`;
        const bg = cssColorToHex(c.style && c.style.backgroundColor);
        if (bg) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
        let body = containerBlocks(c, c.tagName === 'TH' ? { b: true } : {});
        if (!body.endsWith('</w:p>')) body += '<w:p/>';
        if (!body) body = '<w:p/>';
        x += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${body}</w:tc>`;
      }
      x += '</w:tr>';
    }
    x += '</w:tbl><w:p/>';
    return x;
  };

  /* ---- block containers ---- */
  const containerBlocks = (el, baseStyle = {}) => {
    let out = '';
    let pending = [];
    const flush = () => {
      if (!pending.length) return;
      const runs = pending.map((n) => inline(n, baseStyle)).join('');
      pending = [];
      if (runs.trim()) out += `<w:p>${runs}</w:p>`;
    };
    for (const n of el.childNodes) {
      if (n.nodeType === 1 && BLOCK_TAGS.has(n.tagName)) {
        flush();
        out += blockXml(n, baseStyle);
      } else pending.push(n);
    }
    flush();
    return out;
  };

  const blockXml = (el, baseStyle = {}) => {
    const tag = el.tagName;
    if (tag === 'UL' || tag === 'OL') return listChildren(el, 0, tag === 'OL' ? newDecimalList() : 1);
    if (tag === 'TABLE') return tableXml(el);
    if (tag === 'HR') return para(null, '', { border: true });
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'FIGURE') {
      const hasBlock = [...el.childNodes].some((c) => c.nodeType === 1 && BLOCK_TAGS.has(c.tagName));
      if (hasBlock) return containerBlocks(el, baseStyle);
    }
    const st = styleFrom(el, baseStyle);
    const runs = [...el.childNodes].map((c) => inline(c, tag === 'BLOCKQUOTE' ? baseStyle : st)).join('');
    return para(el, runs, { style: styleForTag(tag) });
  };

  /* ---- document body ---- */
  let body = containerBlocks(root);
  if (!body) body = '<w:p/>';
  const orient = landscape ? ' w:orient="landscape"' : '';
  const sect =
    `<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"${orient}/>` +
    `<w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"><w:body>${body}${sect}</w:body></w:document>`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${R}/numbering" Target="numbering.xml"/>` +
    `<Relationship Id="rId3" Type="${R}/settings" Target="settings.xml"/>` +
    rels.map((r) => `<Relationship Id="${r.id}" Type="${R}/${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
    `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${esc(page.title || '')}</dc:title><dc:creator>Material Docx</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
  const app =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Material Docx</Application></Properties>`;

  const settings =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: relsXml },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml(numOverrides) },
    { name: 'word/settings.xml', data: settings },
    { name: 'docProps/core.xml', data: core },
    { name: 'docProps/app.xml', data: app },
    ...media.map((m) => ({ name: 'word/media/' + m.name, data: m.bytes })),
  ];
  return createZip(files);
}

function stylesXml() {
  const head = (id, name, extra = '', ppr = '', rpr = '') =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra}` +
    `${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    head('Heading1', 'heading 1', '', '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="40"/><w:szCs w:val="40"/>') +
    head('Heading2', 'heading 2', '', '<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="32"/><w:szCs w:val="32"/>') +
    head('Heading3', 'heading 3', '', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="26"/><w:szCs w:val="26"/>') +
    head('Quote', 'Quote', '', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="B9B3C4"/></w:pBdr><w:ind w:left="360"/>', '<w:i/><w:color w:val="49454F"/>') +
    head('ListParagraph', 'List Paragraph', '', '<w:spacing w:after="40"/><w:contextualSpacing/>') +
    `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:tblPr><w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`).join('') +
    `</w:tblBorders></w:tblPr></w:style></w:styles>`
  );
}

function numberingXml(overrides) {
  const bulletLvls = Array.from({ length: 9 }, (_, i) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '◦', '▪'][i % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr></w:lvl>`
  ).join('');
  const fmts = ['decimal', 'lowerLetter', 'lowerRoman'];
  const decLvls = Array.from({ length: 9 }, (_, i) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmts[i % 3]}"/><w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`
  ).join('');
  const ovr = (id) =>
    `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/>` +
    Array.from({ length: 9 }, (_, i) => `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="1"/></w:lvlOverride>`).join('') +
    `</w:num>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${W}">` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bulletLvls}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decLvls}</w:abstractNum>` +
    `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
    [...new Set(overrides)].map(ovr).join('') +
    `</w:numbering>`
  );
}

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

const HL = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
  darkBlue: '#00008b', darkCyan: '#008b8b', darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000',
  darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000', white: '#ffffff',
};

const htmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function bytesToB64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

/**
 * Reads a .docx file.
 * @param {Uint8Array} bytes
 * @returns {Promise<{html:string, page:{size?:string, orientation?:string, margin?:string}}>}
 */
export async function importDocx(bytes) {
  const zip = readZip(bytes);
  const read = async (name) => (zip.has(name) ? decodeText(await zip.get(name)()) : null);
  const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');

  const docXml = await read('word/document.xml');
  if (!docXml) throw new Error('word/document.xml not found');
  const doc = parse(docXml);
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid document XML');

  const attr = (el, name) => (el ? el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name) : null);
  const kids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
  const kid = (el, name) => kids(el, name)[0] || null;
  const onOff = (el) => {
    if (!el) return false;
    const v = attr(el, 'val');
    return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
  };

  // relationships
  const rels = {};
  const relsXml = await read('word/_rels/document.xml.rels');
  if (relsXml) {
    for (const r of parse(relsXml).getElementsByTagName('Relationship')) {
      rels[r.getAttribute('Id')] = { target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode') };
    }
  }

  // styles (id → { name, basedOn })
  const styles = {};
  const stylesDoc = await read('word/styles.xml');
  if (stylesDoc) {
    for (const s of parse(stylesDoc).getElementsByTagNameNS(W, 'style')) {
      const id = attr(s, 'styleId');
      styles[id] = { name: attr(kid(s, 'name'), 'val') || id, basedOn: attr(kid(s, 'basedOn'), 'val') };
    }
  }
  const styleKind = (id) => {
    for (let g = 0; id && g < 6; g++) {
      const s = styles[id];
      const nm = ((s && s.name) || id).toLowerCase().replace(/\s+/g, '');
      let m = nm.match(/^heading([1-9])$/);
      if (m) return 'h' + Math.min(6, +m[1]);
      if (nm === 'title') return 'h1';
      if (nm === 'subtitle') return 'h2';
      if (nm === 'quote' || nm === 'intensequote') return 'blockquote';
      id = s && s.basedOn;
    }
    return null;
  };

  // numbering
  const numFmt = {}; // numId → { ilvl → fmt }
  const numXml = await read('word/numbering.xml');
  if (numXml) {
    const nd = parse(numXml);
    const abs = {};
    for (const a of nd.getElementsByTagNameNS(W, 'abstractNum')) {
      const lv = {};
      for (const l of kids(a, 'lvl')) lv[attr(l, 'ilvl')] = attr(kid(l, 'numFmt'), 'val');
      abs[attr(a, 'abstractNumId')] = lv;
    }
    for (const n of nd.getElementsByTagNameNS(W, 'num')) {
      numFmt[attr(n, 'numId')] = abs[attr(kid(n, 'abstractNumId'), 'val')] || {};
    }
  }

  const imgCache = {};
  const imageHtml = async (blip, extent) => {
    const rid = blip.getAttributeNS(R, 'embed') || blip.getAttribute('r:embed');
    const rel = rels[rid];
    if (!rel) return '';
    const path = 'word/' + rel.target.replace(/^\/?(word\/)?/, '');
    if (!zip.has(path)) return '';
    if (!imgCache[path]) {
      const data = await zip.get(path)();
      const ext = path.split('.').pop().toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
      imgCache[path] = mime ? `data:${mime};base64,${bytesToB64(data)}` : null;
    }
    if (!imgCache[path]) return '';
    let style = '';
    if (extent) {
      const cx = +extent.getAttribute('cx'), cy = +extent.getAttribute('cy');
      if (cx > 0 && cy > 0) style = ` width="${Math.round(cx / 9525)}" height="${Math.round(cy / 9525)}"`;
    }
    return `<img src="${imgCache[path]}"${style} alt="">`;
  };

  const find = (el, ns, name) => el.getElementsByTagNameNS(ns, name);

  // ---- runs ----
  const runHtml = async (r) => {
    const rPr = kid(r, 'rPr');
    let css = '';
    let open = '', close = '';
    if (rPr) {
      if (onOff(kid(rPr, 'b'))) { open += '<b>'; close = '</b>' + close; }
      if (onOff(kid(rPr, 'i'))) { open += '<i>'; close = '</i>' + close; }
      const u = kid(rPr, 'u');
      if (u && attr(u, 'val') !== 'none') { open += '<u>'; close = '</u>' + close; }
      if (onOff(kid(rPr, 'strike')) || onOff(kid(rPr, 'dstrike'))) { open += '<s>'; close = '</s>' + close; }
      const va = attr(kid(rPr, 'vertAlign'), 'val');
      if (va === 'superscript') { open += '<sup>'; close = '</sup>' + close; }
      if (va === 'subscript') { open += '<sub>'; close = '</sub>' + close; }
      const col = attr(kid(rPr, 'color'), 'val');
      if (col && col !== 'auto' && /^[0-9a-fA-F]{6}$/.test(col)) css += `color:#${col};`;
      const hl = attr(kid(rPr, 'highlight'), 'val');
      const shd = attr(kid(rPr, 'shd'), 'fill');
      if (hl && HL[hl]) css += `background-color:${HL[hl]};`;
      else if (shd && shd !== 'auto' && /^[0-9a-fA-F]{6}$/.test(shd)) css += `background-color:#${shd};`;
      const rf = kid(rPr, 'rFonts');
      const font = rf && (attr(rf, 'ascii') || attr(rf, 'hAnsi'));
      if (font) css += `font-family:'${font.replace(/'/g, '')}';`;
      const sz = attr(kid(rPr, 'sz'), 'val');
      if (sz) css += `font-size:${(+sz / 2).toString()}pt;`;
    }
    let inner = '';
    for (const c of r.children) {
      switch (c.localName) {
        case 't': inner += htmlEsc(c.textContent); break;
        case 'tab': inner += '&emsp;'; break;
        case 'br': case 'cr': inner += '<br>'; break;
        case 'noBreakHyphen': inner += '‑'; break;
        case 'drawing': {
          const blip = find(c, A, 'blip')[0];
          if (blip) inner += await imageHtml(blip, find(c, WP, 'extent')[0]);
          break;
        }
        default: break;
      }
    }
    if (!inner) return '';
    if (css) inner = `<span style="${css}">${inner}</span>`;
    return open + inner + close;
  };

  const inlineHtml = async (parent) => {
    let h = '';
    for (const c of parent.children) {
      switch (c.localName) {
        case 'r': h += await runHtml(c); break;
        case 'hyperlink': {
          const inner = await inlineHtml(c);
          const rid = c.getAttributeNS(R, 'id') || c.getAttribute('r:id');
          const href = rid && rels[rid] ? rels[rid].target : null;
          h += href && /^(https?:|mailto:|tel:)/i.test(href) ? `<a href="${htmlEsc(href)}">${inner}</a>` : inner;
          break;
        }
        case 'ins': case 'smartTag': case 'fldSimple': case 'sdt': case 'sdtContent':
          h += await inlineHtml(c);
          break;
        default: break;
      }
    }
    return h;
  };

  // ---- blocks ----
  const blocksHtml = async (parent) => {
    const out = [];
    const stack = []; // open list tags
    const closeLists = () => { while (stack.length) out.push(`</li></${stack.pop()}>`); };
    const listItem = (level, ordered, inner, attrs) => {
      const tag = ordered ? 'ol' : 'ul';
      while (stack.length > level + 1) out.push(`</li></${stack.pop()}>`);
      if (stack.length === level + 1) {
        if (stack[level] !== tag) out.push(`</li></${stack.pop()}>`);
        else { out.push('</li>'); out.push(`<li${attrs}>${inner}`); return; }
      }
      while (stack.length < level) { out.push(`<${tag}><li>`); stack.push(tag); }
      out.push(`<${tag}><li${attrs}>${inner}`);
      stack.push(tag);
    };

    const walk = async (node) => {
      for (const c of node.children) {
        switch (c.localName) {
          case 'p': {
            const pPr = kid(c, 'pPr');
            const sid = pPr && attr(kid(pPr, 'pStyle'), 'val');
            const kind = styleKind(sid);
            let inner = await inlineHtml(c);
            if (!inner.replace(/<[^>]*>/g, '').trim() && !inner.includes('<img')) inner = '<br>';
            let st = '';
            const jc = pPr && attr(kid(pPr, 'jc'), 'val');
            const jcMap = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };
            if (jcMap[jc]) st += `text-align:${jcMap[jc]};`;
            const sp = pPr && kid(pPr, 'spacing');
            const line = sp && attr(sp, 'line');
            if (line && (attr(sp, 'lineRule') || 'auto') === 'auto') {
              const ratio = Math.round((+line / 240) * 100) / 100;
              if (ratio && Math.abs(ratio - 1.15) > 0.02) st += `line-height:${ratio};`;
            }
            const numPr = pPr && kid(pPr, 'numPr');
            const numId = numPr && attr(kid(numPr, 'numId'), 'val');
            if (numPr && numId && numId !== '0' && !kind) {
              const lvl = parseInt(attr(kid(numPr, 'ilvl'), 'val') || '0', 10) || 0;
              const fmt = (numFmt[numId] || {})[String(lvl)];
              const ordered = !!fmt && fmt !== 'bullet' && fmt !== 'none';
              listItem(Math.min(lvl, 5), ordered, inner, st ? ` style="${st}"` : '');
              break;
            }
            closeLists();
            const ind = pPr && kid(pPr, 'ind');
            const left = ind && (attr(ind, 'left') || attr(ind, 'start'));
            if (left && +left > 0 && !kind) st += `margin-left:${Math.round(+left / 15)}px;`;
            const tag = kind || 'p';
            out.push(`<${tag}${st ? ` style="${st}"` : ''}>${inner}</${tag}>`);
            break;
          }
          case 'tbl':
            closeLists();
            out.push(await tableHtml(c));
            break;
          case 'sdt': {
            const content = kid(c, 'sdtContent');
            if (content) await walk(content);
            break;
          }
          default: break;
        }
      }
    };
    await walk(parent);
    closeLists();
    return out.join('');
  };

  const tableHtml = async (tbl) => {
    const rows = kids(tbl, 'tr');
    const grid = []; // grid[r][col] = cell record (for vMerge)
    let html = '<table><tbody>';
    const recs = [];
    for (let ri = 0; ri < rows.length; ri++) {
      grid[ri] = [];
      let col = 0;
      const cellsHtml = [];
      for (const tc of kids(rows[ri], 'tc')) {
        const tcPr = kid(tc, 'tcPr');
        const span = parseInt(attr(kid(tcPr, 'gridSpan'), 'val') || '1', 10) || 1;
        const vm = kid(tcPr, 'vMerge');
        const vmVal = vm ? attr(vm, 'val') || 'continue' : null;
        const fill = attr(kid(tcPr, 'shd'), 'fill');
        if (vmVal === 'continue' && ri > 0 && grid[ri - 1][col]) {
          const above = grid[ri - 1][col];
          above.rowspan++;
          grid[ri][col] = above;
          col += span;
          continue;
        }
        const rec = {
          rowspan: 1, span,
          bg: fill && fill !== 'auto' && /^[0-9a-fA-F]{6}$/.test(fill) ? `#${fill}` : '',
          html: (await blocksHtml(tc)) || '<p><br></p>',
        };
        grid[ri][col] = rec;
        cellsHtml.push(rec);
        col += span;
      }
      recs.push(cellsHtml);
    }
    for (const row of recs) {
      html += '<tr>';
      for (const rec of row) {
        html += `<td${rec.span > 1 ? ` colspan="${rec.span}"` : ''}${rec.rowspan > 1 ? ` rowspan="${rec.rowspan}"` : ''}${rec.bg ? ` style="background-color:${rec.bg}"` : ''}>${rec.html}</td>`;
      }
      html += '</tr>';
    }
    return html + '</tbody></table><p><br></p>';
  };

  const body = find(doc, W, 'body')[0];
  if (!body) throw new Error('Document body not found');
  const html = await blocksHtml(body);

  // page setup
  const page = {};
  const sect = [...body.children].filter((c) => c.localName === 'sectPr').pop() || find(doc, W, 'sectPr')[0];
  if (sect) {
    const pgSz = kid(sect, 'pgSz');
    if (pgSz) {
      let w = +attr(pgSz, 'w'), h = +attr(pgSz, 'h');
      const landscape = attr(pgSz, 'orient') === 'landscape' || w > h;
      if (landscape) [w, h] = [h, w];
      let best = null, bd = Infinity;
      for (const [name, s] of Object.entries(PAGE_SIZES)) {
        const d = Math.abs(s.tw - w) + Math.abs(s.th - h);
        if (d < bd) { bd = d; best = name; }
      }
      if (best && bd < 600) page.size = best;
      page.orientation = landscape ? 'landscape' : 'portrait';
    }
    const pgMar = kid(sect, 'pgMar');
    if (pgMar) {
      const m = +attr(pgMar, 'left') || +attr(pgMar, 'top');
      if (m) {
        let best = 'normal', bd = Infinity;
        for (const [name, tw] of Object.entries(MARGINS)) {
          const d = Math.abs(tw - m);
          if (d < bd) { bd = d; best = name; }
        }
        page.margin = best;
      }
    }
  }
  return { html: html || '<p><br></p>', page };
}

export { encodeText, bytesToB64 };

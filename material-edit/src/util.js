export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const baseName = (p) => String(p).split(/[\\/]/).pop();
export const stripExt = (n) => String(n).replace(/\.[^.]+$/, '');

export function fmtTime(t, ms = true) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t % 1) * 100);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return ms ? `${base}.${String(c).padStart(2, '0')}` : base;
}

/** Tiny element builder: h('div', {class:'x', onclick(){}}, child, 'text') */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const icon = (id, cls = '') =>
  h('span', { class: 'ico ' + cls, html: `<svg class="i"><use href="#i-${id}"/></svg>` });

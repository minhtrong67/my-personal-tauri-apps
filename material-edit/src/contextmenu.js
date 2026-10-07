// Material-style context menu. Items: { label, icon?, kbd?, run, disabled?, danger?, checked? } or '-' (separator).
import { h, icon } from './util.js';

let menu = null;
let cleanup = null;

export function closeMenu() {
  if (!menu) return;
  const m = menu;
  menu = null;
  if (cleanup) cleanup();
  cleanup = null;
  m.classList.add('closing');
  setTimeout(() => m.remove(), 110);
}

export const isMenuOpen = () => !!menu;

export function showMenu(x, y, items) {
  closeMenu();
  const list = items.filter(Boolean).filter((it, i, a) => !(it === '-' && (i === 0 || a[i - 1] === '-' || i === a.length - 1)));
  if (!list.length) return;
  const el = h('div', { class: 'ctx-menu', role: 'menu', tabindex: '-1' });
  const buttons = [];
  for (const it of list) {
    if (it === '-') { el.append(h('div', { class: 'menu-sep' })); continue; }
    const b = h('button', {
      class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled ? true : null,
      onclick: (e) => { e.stopPropagation(); closeMenu(); if (!it.disabled) setTimeout(() => it.run && it.run(), 0); },
    },
    it.checked != null ? h('span', { class: 'chk' + (it.checked ? ' on' : '') }, icon('check')) : (it.icon ? icon(it.icon) : h('span', { class: 'ico-gap' })),
    h('span', { text: it.label }),
    it.kbd ? h('kbd', { text: it.kbd }) : null);
    buttons.push(b);
    el.append(b);
  }
  document.body.append(el);
  const r = el.getBoundingClientRect();
  const pad = 8;
  const left = Math.max(pad, Math.min(x, window.innerWidth - r.width - pad));
  const top = y + r.height + pad > window.innerHeight ? Math.max(pad, y - r.height) : y;
  el.style.left = left + 'px';
  el.style.top = Math.max(pad, top) + 'px';
  el.style.transformOrigin = `${x > left + r.width / 2 ? 'right' : 'left'} ${top < y ? 'bottom' : 'top'}`;
  menu = el;

  const onDown = (e) => { if (!el.contains(e.target)) closeMenu(); };
  const onKey = (e) => {
    const enabled = buttons.filter((b) => !b.disabled);
    const i = enabled.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); (enabled[(i + 1) % enabled.length] || enabled[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); (enabled[(i - 1 + enabled.length) % enabled.length] || enabled[enabled.length - 1]).focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  };
  const onAny = () => closeMenu();
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onAny);
  window.addEventListener('resize', onAny);
  window.addEventListener('wheel', onAny, { passive: true });
  cleanup = () => {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', onAny);
    window.removeEventListener('resize', onAny);
    window.removeEventListener('wheel', onAny);
  };
}

/** Anchors a menu under an element (for "⋮" buttons). */
export function showMenuAt(anchor, items) {
  const r = anchor.getBoundingClientRect();
  showMenu(r.right - 4, r.bottom + 4, items);
}

/** Suppress the browser's own menu except in text fields. */
document.addEventListener('contextmenu', (e) => {
  const t = e.target;
  if (t && t.closest && t.closest('input:not([type=range]):not([type=checkbox]):not([type=color]), textarea')) return;
  e.preventDefault();
});

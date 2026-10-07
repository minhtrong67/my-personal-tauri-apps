// Resizable panels (media library | preview | inspector | timeline). Sizes are remembered between launches.
import { settings, saveSettings, DEFAULTS } from './settings.js';
import { $ } from './util.js';

const root = document.documentElement;
const MIN = { left: 240, right: 260, tl: 160 };
const MAX = { left: 640, right: 640 };
const MIN_CENTER = 380;

function effective() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const L = settings.layout;
  let left = Math.min(Math.max(L.left, MIN.left), MAX.left);
  let right = Math.min(Math.max(L.right, MIN.right), MAX.right);
  const room = vw - 16 - 16 - MIN_CENTER; // paddings + splitters
  if (left + right > room) {
    const over = left + right - room;
    const cutL = Math.min(over / 2, left - MIN.left);
    left -= cutL;
    right -= Math.min(over - cutL, right - MIN.right);
  }
  const maxTl = Math.max(MIN.tl, Math.min(vh * 0.62, vh - 60 - 16 - 280));
  const tl = Math.min(Math.max(L.tl, MIN.tl), maxTl);
  return { left: Math.round(left), right: Math.round(right), tl: Math.round(tl), maxTl };
}

export function applyLayout() {
  const e = effective();
  root.style.setProperty('--left-w', e.left + 'px');
  root.style.setProperty('--right-w', e.right + 'px');
  root.style.setProperty('--tl-h', e.tl + 'px');
  $('#sp-left').setAttribute('aria-valuenow', e.left);
  $('#sp-right').setAttribute('aria-valuenow', e.right);
  $('#sp-tl').setAttribute('aria-valuenow', e.tl);
  return e;
}

export function resetLayout() {
  settings.layout = { ...DEFAULTS.layout };
  saveSettings();
  applyLayout();
}

function bind(el, key, axis, sign) {
  const apply = (v) => { settings.layout[key] = Math.round(v); applyLayout(); };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const start = effective()[key];
    const origin = axis === 'x' ? e.clientX : e.clientY;
    el.classList.add('drag');
    root.classList.add('resizing');
    root.classList.toggle('rows', axis === 'y');
    const move = (ev) => {
      const d = (axis === 'x' ? ev.clientX : ev.clientY) - origin;
      let v = start + sign * d;
      v = key === 'tl' ? Math.min(Math.max(v, MIN.tl), effective().maxTl) : Math.min(Math.max(v, MIN[key]), MAX[key]);
      apply(v);
    };
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('drag');
      root.classList.remove('resizing', 'rows');
      saveSettings();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('dblclick', () => { settings.layout[key] = DEFAULTS.layout[key]; saveSettings(); applyLayout(); });
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 64 : 16;
    const dir = axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
    if (e.key === 'Enter') { settings.layout[key] = DEFAULTS.layout[key]; saveSettings(); applyLayout(); return; }
    if (!(e.key in dir)) return;
    e.preventDefault();
    apply(effective()[key] + sign * dir[e.key] * step);
    saveSettings();
  });
}

bind($('#sp-left'), 'left', 'x', 1);
bind($('#sp-right'), 'right', 'x', -1);
bind($('#sp-tl'), 'tl', 'y', -1);
window.addEventListener('resize', applyLayout);
applyLayout();

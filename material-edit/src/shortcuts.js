// Keyboard shortcuts: one table drives both the key handler and the "Keyboard shortcuts" dialog.
import { $, h } from './util.js';
import { t } from './i18n.js';

/** [combo(s), command, i18n label]. Combos use "Ctrl" for Ctrl/⌘. */
export const GROUPS = [
  { title: 'sc.g.playback', items: [
    [['Space', 'K'], 'play', 'sc.play'],
    [['Left'], 'stepBack', 'sc.stepBack'],
    [['Right'], 'stepFwd', 'sc.stepFwd'],
    [['Shift+Left'], 'back1s', 'sc.back1s'],
    [['Shift+Right'], 'fwd1s', 'sc.fwd1s'],
    [['Up'], 'prevEdit', 'sc.prevEdit'],
    [['Down'], 'nextEdit', 'sc.nextEdit'],
    [['Home'], 'toStart', 'sc.toStart'],
    [['End'], 'toEnd', 'sc.toEnd'],
    [['F', 'F11'], 'fullscreen', 'sc.fullscreen'],
  ] },
  { title: 'sc.g.edit', items: [
    [['S', 'Ctrl+B', 'Ctrl+K'], 'split', 'sc.split'],
    [['Q'], 'trimLeft', 'sc.trimLeft'],
    [['W'], 'trimRight', 'sc.trimRight'],
    [['Delete', 'Backspace'], 'delete', 'sc.delete'],
    [['Shift+Delete'], 'rippleDelete', 'sc.rippleDelete'],
    [['Ctrl+D'], 'duplicate', 'sc.duplicate'],
    [['Ctrl+C'], 'copy', 'sc.copy'],
    [['Ctrl+X'], 'cut', 'sc.cut'],
    [['Ctrl+V'], 'paste', 'sc.paste'],
    [['M'], 'mute', 'sc.mute'],
    [['T'], 'addText', 'sc.addText'],
    [['Ctrl+Z'], 'undo', 'sc.undo'],
    [['Ctrl+Y', 'Ctrl+Shift+Z'], 'redo', 'sc.redo'],
  ] },
  { title: 'sc.g.timeline', items: [
    [['N'], 'snap', 'sc.snap'],
    [['=', 'Ctrl+='], 'zoomIn', 'sc.zoomIn'],
    [['-', 'Ctrl+-'], 'zoomOut', 'sc.zoomOut'],
    [['\\', 'Shift+Z'], 'fit', 'sc.fit'],
  ] },
  { title: 'sc.g.project', items: [
    [['Ctrl+N'], 'new', 'sc.new'],
    [['Ctrl+Shift+H'], 'home', 'sc.home'],
    [['Ctrl+O'], 'openFile', 'sc.openFile'],
    [['Ctrl+S'], 'save', 'sc.save'],
    [['Ctrl+Shift+S'], 'saveAs', 'sc.saveAs'],
    [['Ctrl+I'], 'import', 'sc.import'],
    [['Ctrl+E'], 'export', 'sc.export'],
    [['Ctrl+/', '?'], 'shortcuts', 'sc.shortcuts'],
    [['Ctrl+,'], 'settings', 'sc.settings'],
  ] },
];

// extra aliases that are not shown in the dialog
const ALIASES = { 'Ctrl++': 'zoomIn', '+': 'zoomIn', 'Shift+?': 'shortcuts', 'Shift+/': 'shortcuts', 'Escape': 'escape' };

const MAP = new Map();
for (const g of GROUPS) for (const [combos, cmd] of g.items) for (const c of combos) MAP.set(c, cmd);
for (const [c, cmd] of Object.entries(ALIASES)) MAP.set(c, cmd);

const NAMES = { ' ': 'Space', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down' };

export function comboOf(e) {
  let key = NAMES[e.key] || e.key;
  if (key.length === 1) key = key.toUpperCase();
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  // Shift is part of printable symbols already ("?", "+"); keep it only for letters/named keys
  if (e.shiftKey && (key.length > 1 || /[A-Z0-9]/.test(key))) parts.push('Shift');
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';
  parts.push(key);
  return parts.join('+');
}

const NATIVE_WHEN_TYPING = new Set(['Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+A', 'Ctrl+D', 'Ctrl+B', 'Ctrl+K', 'Delete', 'Backspace']);
const HOME_CMDS = new Set(['new', 'openFile', 'shortcuts', 'settings']);

/**
 * @param {Record<string, () => void>} cmds   command implementations
 * @param {{ blocked: () => boolean, onHome: () => boolean }} env
 */
export function initShortcuts(cmds, env) {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const combo = comboOf(e);
    if (!combo) return;
    const cmd = MAP.get(combo);
    if (!cmd) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'textarea' || tag === 'select' || (tag === 'input' && !['range', 'checkbox', 'color', 'button'].includes(e.target.type));
    if (typing && (NATIVE_WHEN_TYPING.has(combo) || !combo.includes('Ctrl'))) return;
    if (document.querySelector('dialog[open]') && cmd !== 'shortcuts') return;
    if (env.blocked()) return;
    if (env.onHome() && !HOME_CMDS.has(cmd)) return;
    const fn = cmds[cmd];
    if (!fn) return;
    e.preventDefault();
    fn(e);
  });
}

const PRETTY = { Left: '←', Right: '→', Up: '↑', Down: '↓', Delete: 'Del', Backspace: '⌫', Space: 'Space' };

export function keyChips(combo) {
  return h('span', { class: 'sc-keys' }, combo.split(/\+(?=.)/).map((k) => h('kbd', { class: 'k', text: PRETTY[k] || k })));
}

export function renderShortcutsDialog() {
  const body = $('#shortcuts-body');
  const row = ([combos, , label]) => {
    const keys = h('span', { class: 'sc-keys' });
    combos.forEach((c, i) => {
      if (i) keys.append(h('span', { class: 'hint-or', text: t('sc.or') }));
      keys.append(keyChips(c));
    });
    return h('div', { class: 'sc-row' }, h('span', { text: t(label) }), keys);
  };
  body.replaceChildren(...GROUPS.map((g) => h('section', { class: 'sc-group' }, h('h3', { text: t(g.title) }), ...g.items.map(row))));
}

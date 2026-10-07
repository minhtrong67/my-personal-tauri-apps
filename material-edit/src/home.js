// Home screen: the project library (grid / list), search, sort, rename, duplicate, delete.
import { libList, libRead, libWrite, libDelete } from './io.js';
import { settings, saveSettings } from './settings.js';
import { showMenu, showMenuAt } from './contextmenu.js';
import { $, $$, h, icon, fmtTime, uid } from './util.js';
import { t, lang } from './i18n.js';

const root = $('#home');
const listEl = $('#home-list');
const emptyEl = $('#home-empty');
let api = { open() {}, create() {}, openFile() {}, prompt: async () => null, confirm: async () => 'no', toast() {} };
let items = [];
let loaded = false;

export const initHome = (o) => Object.assign(api, o);
export const isHomeOpen = () => !root.hidden;

function fmtDate(ms) {
  if (!ms) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 45) return t('home.justNow');
  const rtf = new Intl.RelativeTimeFormat(lang(), { numeric: 'auto' });
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 7 * 86400) return rtf.format(-Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(lang(), { dateStyle: 'medium' }).format(ms);
}

const displayName = (p) => p.name || t('project.untitled');

function visible() {
  const q = $('#home-search').value.trim().toLowerCase();
  let out = items.filter((p) => !q || displayName(p).toLowerCase().includes(q));
  const sort = settings.home.sort;
  out = [...out].sort((a, b) => (sort === 'name' ? displayName(a).localeCompare(displayName(b), lang()) : sort === 'duration' ? b.duration - a.duration : b.updated - a.updated));
  return out;
}

function menuItems(p) {
  return [
    { label: t('home.open'), icon: 'open', run: () => api.open(p.id) },
    { label: t('home.rename'), icon: 'edit', run: () => rename(p) },
    { label: t('home.duplicate'), icon: 'copy', run: () => duplicate(p) },
    '-',
    { label: t('home.delete'), icon: 'trash', danger: true, run: () => remove(p) },
  ];
}

async function rename(p) {
  const v = await api.prompt({ title: t('home.rename'), value: displayName(p) === t('project.untitled') ? '' : p.name, ok: t('btn.ok') });
  if (v == null) return;
  try {
    const data = JSON.parse(await libRead(p.id));
    data.name = v.trim();
    await libWrite(p.id, JSON.stringify(data));
    await refreshHome();
  } catch (e) { api.toast(t('toast.error', { msg: e.message || e })); }
}

async function duplicate(p) {
  try {
    const data = JSON.parse(await libRead(p.id));
    data.id = uid();
    data.name = `${displayName(p)} ${t('home.copySuffix')}`;
    data.updated = Date.now();
    await libWrite(data.id, JSON.stringify(data));
    await refreshHome();
    api.toast(t('home.duplicated'));
  } catch (e) { api.toast(t('toast.error', { msg: e.message || e })); }
}

async function remove(p) {
  const r = await api.confirm({ title: t('home.deleteTitle'), msg: t('home.deleteMsg', { name: displayName(p) }), yes: t('home.delete'), no: t('btn.cancel'), cancel: false });
  if (r !== 'yes') return;
  try {
    await libDelete(p.id);
    const el = listEl.querySelector(`[data-id="${p.id}"]`);
    if (el) { el.style.transition = 'opacity .2s, transform .2s'; el.style.opacity = '0'; el.style.transform = 'scale(.92)'; await new Promise((r2) => setTimeout(r2, 180)); }
    await refreshHome();
    api.toast(t('home.deleted'));
  } catch (e) { api.toast(t('toast.error', { msg: e.message || e })); }
}

function card(p, i) {
  const list = settings.home.view === 'list';
  const cover = h('div', { class: 'cover' }, p.cover ? h('img', { src: p.cover, alt: '', draggable: 'false' }) : icon('film'));
  if (!list && p.duration > 0) cover.append(h('span', { class: 'badge', text: fmtTime(p.duration, false) }));
  const meta = [p.duration > 0 ? fmtTime(p.duration, false) : null, p.aspect, t('home.mediaCount', { n: p.mediaCount }), fmtDate(p.updated)].filter(Boolean).join('  ·  ');
  const more = h('button', { class: 'icon-btn sm more', title: t('home.more'), 'aria-label': t('home.more'), onclick(e) { e.stopPropagation(); showMenuAt(e.currentTarget, menuItems(p)); } }, icon('more'));
  const el = h('div', {
    class: 'proj', role: 'button', tabindex: '0', dataset: { id: p.id }, style: { '--i': Math.min(i, 14) },
    onclick: () => api.open(p.id),
    onkeydown(e) { if (e.key === 'Enter') api.open(p.id); else if (e.key === 'Delete') remove(p); else if (e.key === 'F2') rename(p); },
    oncontextmenu(e) { e.preventDefault(); showMenu(e.clientX, e.clientY, menuItems(p)); },
  }, cover, h('div', { class: 'info' }, h('div', { class: 'p-name', text: displayName(p), title: displayName(p) }), h('div', { class: 'p-meta', text: meta })), more);
  return el;
}

export function renderHome() {
  const list = settings.home.view === 'list';
  listEl.classList.toggle('list', list);
  $$('#home-view button').forEach((b) => b.classList.toggle('on', b.dataset.view === settings.home.view));
  $('#home-sort').value = settings.home.sort;
  const shown = visible();
  listEl.replaceChildren();
  const add = h('button', { class: 'proj new', onclick: () => api.create(), style: { '--i': 0 } },
    h('span', { class: 'plus' }, icon('plus')), h('span', { class: 't', text: t('file.new') }));
  listEl.append(add);
  shown.forEach((p, i) => listEl.append(card(p, i + 1)));
  const none = loaded && !items.length;
  emptyEl.hidden = !none && !(items.length && !shown.length);
  if (items.length && !shown.length) {
    $('h3', emptyEl).textContent = t('home.noResults');
    $('p', emptyEl).textContent = '';
  } else {
    $('h3', emptyEl).textContent = t('home.emptyTitle');
    $('p', emptyEl).textContent = t('home.emptyText');
  }
}

export async function refreshHome() {
  try { items = await libList(); } catch { items = []; }
  loaded = true;
  renderHome();
}

export async function showHome() {
  root.classList.remove('leaving');
  root.hidden = false;
  await refreshHome();
  $('#home-body').scrollTop = 0;
}

export function hideHome() {
  if (root.hidden) return;
  root.classList.add('leaving');
  setTimeout(() => { root.hidden = true; root.classList.remove('leaving'); }, 170);
}

$('#home-new').addEventListener('click', () => api.create());
$('#home-open').addEventListener('click', () => api.openFile());
$('#home-search').addEventListener('input', renderHome);
$('#home-sort').addEventListener('change', (e) => { settings.home.sort = e.target.value; saveSettings(); renderHome(); });
$('#home-view').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.home.view = b.dataset.view;
  saveSettings();
  renderHome();
});

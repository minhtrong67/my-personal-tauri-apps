import './styles.css';
import { t, setLang, locale } from './i18n.js';
import { applyTheme, PRESETS } from './theme.js';
import { initWindow, captureSize } from './window.js';

/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mins = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (o, d) => new Intl.DateTimeFormat(locale(), o).format(d);
const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;

const I = {
  menu: svg('M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'),
  chevL: svg('M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
  chevR: svg('M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
  search: svg('M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'),
  plus: svg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
  close: svg('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
  cog: svg('M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'),
  logo: svg('M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm2 4h5v5H7z'),
};

/* ───────── state ───────── */
const COLORS = ['#1a73e8', '#d93025', '#e37400', '#188038', '#a142f4', '#d01884', '#007b83', '#5f6368'];
const HOUR = 52;
const DEF = { lang: 'auto', theme: 'system', seed: PRESETS[0], windowMode: 'remember', winSize: null, weekStart: 1, holidays: true, anim: true, view: 'month' };
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const settings = { ...DEF, ...load('cal.settings', {}) };
let events = load('cal.events', []);
let cursor = sod(new Date());
let sidebar = true;
let gridScroll = null;
let dirFlag = 0;

const persist = () => localStorage.setItem('cal.settings', JSON.stringify(settings));
const saveEvents = () => localStorage.setItem('cal.events', JSON.stringify(events));
const onSize = (s) => { settings.winSize = s; persist(); };

/* ───────── date logic ───────── */
const HOL = { '01-01': 'newYear', '04-30': 'liberation', '05-01': 'labour', '09-02': 'national' };
const holiday = (d) => (settings.holidays ? HOL[`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`] : null);
const weekStart = (d) => addDays(d, -((d.getDay() - settings.weekStart + 7) % 7));

function occurs(e, d) {
  const s = parse(e.date);
  if (d < s) return false;
  if (+d === +s) return true;
  switch (e.repeat) {
    case 'daily': return true;
    case 'weekly': return Math.round((d - s) / 864e5) % 7 === 0;
    case 'monthly': return d.getDate() === s.getDate();
    case 'yearly': return d.getDate() === s.getDate() && d.getMonth() === s.getMonth();
    default: return false;
  }
}
const eventsOn = (d) => events.filter((e) => occurs(e, d)).sort((a, b) => (+b.allDay - +a.allDay) || (a.start || '').localeCompare(b.start || ''));

function lanes(list) {
  const out = []; let cluster = []; let end = 0; const laneEnd = [];
  const flush = () => { const n = Math.max(...cluster.map((c) => c.lane)) + 1; cluster.forEach((c) => { c.n = n; }); out.push(...cluster); cluster = []; };
  for (const e of list) {
    const s = mins(e.start), en = Math.max(mins(e.end || e.start), s + 30);
    if (cluster.length && s >= end) { flush(); laneEnd.length = 0; end = 0; }
    let l = laneEnd.findIndex((x) => x <= s); if (l < 0) l = laneEnd.length;
    laneEnd[l] = en; cluster.push({ e, s, en, lane: l }); end = Math.max(end, en);
  }
  if (cluster.length) flush();
  return out;
}

/* ───────── shell ───────── */
function shell() {
  $('#app').innerHTML = `
  <header class="appbar">
    <button class="icon-btn rp" data-action="menu" title="${t('menu')}">${I.menu}</button>
    <div class="brand">${I.logo}<span>${t('app.name')}</span></div>
    <button class="btn tonal rp" data-action="today">${t('today')}</button>
    <div class="navs">
      <button class="icon-btn rp" data-action="prev" title="${t('prev')}">${I.chevL}</button>
      <button class="icon-btn rp" data-action="next" title="${t('next')}">${I.chevR}</button>
    </div>
    <h1 id="title"></h1>
    <div class="spacer"></div>
    <div class="search"><span class="s-ico">${I.search}</span>
      <input id="q" placeholder="${t('search')}" autocomplete="off" spellcheck="false"><div id="results" hidden></div></div>
    <div class="seg" id="views">${['month', 'week', 'day', 'agenda'].map((v) => `<button class="rp" data-action="view" data-v="${v}">${t(v)}</button>`).join('')}</div>
    <button class="icon-btn rp cog" data-action="settings" title="${t('settings')}">${I.cog}</button>
  </header>
  <div class="body ${sidebar ? '' : 'collapsed'}" id="body">
    <aside class="side"><div class="side-in">
      <button class="fab rp" data-action="new">${I.plus}<span>${t('create')}</span></button>
      <div id="mini"></div><div id="upcoming"></div>
      <div class="credit"><small>${t('s.author')}</small> <span class="pill">minhtrong67</span> <span class="pill ai">Claude</span></div>
    </div></aside>
    <main class="main"><div id="view" class="view"></div></main>
  </div>`;
}

function titleText() {
  const v = settings.view;
  if (v === 'day') return cap(fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, cursor));
  if (v === 'week') {
    const s = weekStart(cursor), e = addDays(s, 6);
    if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${e.getDate()}, ${cap(fmt({ month: 'long', year: 'numeric' }, e))}`;
    return `${fmt({ day: 'numeric', month: 'short' }, s)} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }, e)}`;
  }
  return cap(fmt({ month: 'long', year: 'numeric' }, cursor));
}

/* ───────── views ───────── */
const chip = (e, ds) => `<button class="chip" data-action="edit" data-id="${e.id}" data-date="${ds}" style="--c:${e.color}" title="${esc(e.title)}">${e.allDay ? '' : `<em>${e.start}</em> `}${esc(e.title)}</button>`;
const dowNames = (n = 7, style = 'short') => Array.from({ length: n }, (_, i) => fmt({ weekday: style }, new Date(2024, 0, 7 + settings.weekStart + i)));

function monthView() {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -((first.getDay() - settings.weekStart + 7) % 7));
  const todayS = ymd(new Date());
  let h = `<div class="month"><div class="dow">${dowNames().map((d) => `<span>${esc(d)}</span>`).join('')}</div><div class="grid">`;
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), ds = ymd(d), list = eventsOn(d), hol = holiday(d);
    const shown = list.slice(0, 3);
    h += `<div class="cell ${d.getMonth() !== cursor.getMonth() ? 'dim' : ''} ${ds === todayS ? 'today' : ''}" data-action="cell" data-date="${ds}" style="--i:${i}">
      <span class="num">${d.getDate()}</span>${hol ? `<div class="hol" title="${t('h.' + hol)}">${t('h.' + hol)}</div>` : ''}
      ${shown.map((e) => chip(e, ds)).join('')}${list.length > 3 ? `<button class="more" data-action="goto" data-date="${ds}">+${list.length - 3} ${t('more')}</button>` : ''}</div>`;
  }
  return h + '</div></div>';
}

function timeGrid(days) {
  const now = new Date(), todayS = ymd(now);
  const hours = Array.from({ length: 23 }, (_, i) => `<span style="top:${(i + 1) * HOUR}px">${pad(i + 1)}:00</span>`).join('');
  let h = `<div class="tg" style="--cols:${days.length};--h:${HOUR}px"><div class="tg-head"><div></div>`;
  h += days.map((d) => { const ds = ymd(d), hol = holiday(d); return `<div class="th ${ds === todayS ? 'today' : ''}" data-action="goto" data-date="${ds}" ${hol ? `title="${t('h.' + hol)}"` : ''}><small>${fmt({ weekday: 'short' }, d)}</small><b>${d.getDate()}</b></div>`; }).join('');
  h += `</div><div class="tg-allday"><div class="gut"><small>${t('allDay')}</small></div>`;
  h += days.map((d) => { const ds = ymd(d); return `<div class="ad" data-action="cell" data-date="${ds}">${eventsOn(d).filter((e) => e.allDay).map((e) => chip(e, ds)).join('')}</div>`; }).join('');
  h += `</div><div class="tg-scroll"><div class="tg-body" style="height:${24 * HOUR}px"><div class="gut">${hours}</div>`;
  h += days.map((d) => {
    const ds = ymd(d);
    const blocks = lanes(eventsOn(d).filter((e) => !e.allDay)).map(({ e, s, en, lane, n }) =>
      `<button class="ev" data-action="edit" data-id="${e.id}" data-date="${ds}" style="--c:${e.color};top:${(s / 60) * HOUR}px;height:${Math.max(((en - s) / 60) * HOUR - 2, 22)}px;left:calc(${(lane / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)"><b>${esc(e.title)}</b><small>${e.start}${e.end ? '–' + e.end : ''}</small></button>`).join('');
    const nowLine = ds === todayS ? `<div class="now" style="top:${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR}px"></div>` : '';
    return `<div class="col ${ds === todayS ? 'today' : ''}" data-action="col" data-date="${ds}">${blocks}${nowLine}</div>`;
  }).join('');
  return h + '</div></div></div>';
}
const weekView = () => timeGrid(Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i)));
const dayView = () => timeGrid([cursor]);

function agendaView() {
  const todayS = ymd(new Date());
  let h = '<div class="agenda">', n = 0;
  for (let i = 0; i < 60; i++) {
    const d = addDays(cursor, i), ds = ymd(d), list = eventsOn(d), hol = holiday(d);
    if (!list.length && !hol) continue;
    h += `<section style="--i:${Math.min(n++, 12)}"><div class="a-date ${ds === todayS ? 'today' : ''}"><b>${d.getDate()}</b><small>${fmt({ weekday: 'short', month: 'short' }, d)}</small></div><div class="a-list">`;
    if (hol) h += `<div class="a-hol">${t('h.' + hol)}</div>`;
    h += list.map((e) => `<button class="a-ev" data-action="edit" data-id="${e.id}" data-date="${ds}" style="--c:${e.color}"><span class="a-time">${e.allDay ? t('allDay') : e.start + (e.end ? ' – ' + e.end : '')}</span><b>${esc(e.title)}</b>${e.desc ? `<small>${esc(e.desc)}</small>` : ''}</button>`).join('');
    h += '</div></section>';
  }
  if (!n) h += `<div class="empty">${I.logo}<p>${t('noUpcoming')}</p></div>`;
  return h + '</div>';
}
const VIEWS = { month: monthView, week: weekView, day: dayView, agenda: agendaView };

/* ───────── sidebar ───────── */
function miniCal() {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -((first.getDay() - settings.weekStart + 7) % 7));
  const todayS = ymd(new Date()), curS = ymd(cursor);
  let h = `<div class="mini-h"><span>${cap(fmt({ month: 'long', year: 'numeric' }, cursor))}</span><span><button class="icon-btn sm rp" data-action="mprev">${I.chevL}</button><button class="icon-btn sm rp" data-action="mnext">${I.chevR}</button></span></div><div class="mini-g">`;
  h += dowNames(7, 'narrow').map((d) => `<span class="dow">${esc(d)}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), ds = ymd(d);
    h += `<button class="md ${d.getMonth() !== cursor.getMonth() ? 'dim' : ''} ${ds === todayS ? 'today' : ''} ${ds === curS ? 'sel' : ''}" data-action="mday" data-date="${ds}">${d.getDate()}${eventsOn(d).length ? '<i></i>' : ''}</button>`;
  }
  return h + '</div>';
}

function upcomingList() {
  const out = [], now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), today = sod(now);
  for (let i = 0; i < 30 && out.length < 5; i++) {
    const d = addDays(today, i);
    for (const e of eventsOn(d)) {
      if (i === 0 && !e.allDay && mins(e.end || e.start) < nm) continue;
      out.push({ e, d, i }); if (out.length >= 5) break;
    }
  }
  const body = out.length ? out.map(({ e, d, i }) => `<button class="up rp" data-action="edit" data-id="${e.id}" data-date="${ymd(d)}" style="--c:${e.color}"><span><b>${esc(e.title)}</b><small>${i === 0 ? t('today') : fmt({ weekday: 'short', day: 'numeric', month: 'short' }, d)}${e.allDay ? '' : ' · ' + e.start}</small></span></button>`).join('') : `<p class="muted">${t('noUpcoming')}</p>`;
  return `<h3>${t('upcoming')}</h3>${body}`;
}

/* ───────── render ───────── */
function render() {
  $('#title').textContent = titleText();
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.view));
  const v = $('#view');
  v.innerHTML = VIEWS[settings.view]();
  v.classList.remove('in-r', 'in-l', 'in-f'); void v.offsetWidth;
  v.classList.add(dirFlag > 0 ? 'in-r' : dirFlag < 0 ? 'in-l' : 'in-f'); dirFlag = 0;
  const sc = $('.tg-scroll', v);
  if (sc) sc.scrollTop = gridScroll ?? Math.max(0, (new Date().getHours() - 1.5) * HOUR);
  $('#mini').innerHTML = miniCal();
  $('#upcoming').innerHTML = upcomingList();
}

function step(dir) {
  dirFlag = dir;
  const v = settings.view;
  if (v === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  else cursor = addDays(cursor, dir * (v === 'week' ? 7 : v === 'day' ? 1 : 30));
  render();
}
const goToday = () => { dirFlag = +cursor < +sod(new Date()) ? 1 : -1; cursor = sod(new Date()); render(); };
const setView = (v) => { if (settings.view !== v) { settings.view = v; persist(); render(); } };

/* ───────── toasts ───────── */
function toast(msg, label, fn, ms = 4500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${label ? `<button class="btn text rp">${esc(label)}</button>` : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  if (label) el.querySelector('button').onclick = () => { fn(); kill(); };
  $('#toasts').append(el);
  setTimeout(kill, ms);
}

/* ───────── event dialog ───────── */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function openEvent(id, date, startMin) {
  let e = id && events.find((x) => x.id === id);
  if (!e) {
    const ds = date || ymd(cursor);
    const now = new Date();
    let s = startMin ?? (ds === ymd(now) ? Math.min(23 * 60, (now.getHours() + 1) * 60) : 9 * 60);
    const tm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
    e = { title: '', desc: '', date: ds, start: tm(s), end: tm(Math.min(s + 60, 23 * 60 + 59)), allDay: false, color: COLORS[0], repeat: 'none', remind: -1 };
  }
  const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  const d = $('#evDlg');
  d.innerHTML = `<form id="evForm" novalidate data-id="${id || ''}">
    <h2>${id ? t('editEvent') : t('newEvent')}</h2>
    <label class="tf"><input name="title" placeholder=" " value="${esc(e.title)}" maxlength="120" autocomplete="off"><span>${t('title')}</span></label>
    <div class="row"><label class="tf float"><input type="date" name="date" value="${e.date}"><span>${t('date')}</span></label>
      <label class="switch"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}><i></i><b>${t('allDay')}</b></label></div>
    <div class="row" id="times" ${e.allDay ? 'hidden' : ''}>
      <label class="tf float"><input type="time" name="start" value="${e.start}"><span>${t('start')}</span></label>
      <label class="tf float"><input type="time" name="end" value="${e.end || ''}"><span>${t('end')}</span></label></div>
    <div class="row">
      <label class="tf float sel"><select name="repeat">${['none', 'daily', 'weekly', 'monthly', 'yearly'].map((r) => opt(r, e.repeat, t('r.' + r))).join('')}</select><span>${t('repeat')}</span></label>
      <label class="tf float sel"><select name="remind">${[-1, 0, 5, 15, 30, 60].map((r) => opt(r, e.remind, t('rm.' + r))).join('')}</select><span>${t('remind')}</span></label></div>
    <div class="colors" role="radiogroup" aria-label="${t('desc')}">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}><i style="--c:${c}"></i></label>`).join('')}</div>
    <label class="tf"><textarea name="desc" rows="3" placeholder=" ">${esc(e.desc)}</textarea><span>${t('desc')}</span></label>
    <div class="actions">${id ? `<button type="button" class="btn text danger rp" data-action="del" data-id="${id}">${t('delete')}</button>` : ''}<span class="spacer"></span>
      <button type="button" class="btn text rp" data-action="closeDlg">${t('cancel')}</button><button type="submit" class="btn filled rp">${t('save')}</button></div></form>`;
  d.showModal();
  if (!id) d.querySelector('[name=title]').focus();
}

function submitEvent(form) {
  const f = new FormData(form), id = form.dataset.id;
  const title = (f.get('title') || '').trim(), allDay = f.get('allDay') === 'on';
  const bad = (name, msg) => {
    const tf = form.querySelector(`[name=${name}]`).closest('.tf');
    tf.classList.remove('shake'); void tf.offsetWidth; tf.classList.add('shake', 'err');
    form.querySelector(`[name=${name}]`).focus(); toast(msg);
  };
  if (!title) return bad('title', t('needTitle'));
  const start = f.get('start') || '09:00', end = f.get('end') || '';
  if (!allDay && end && mins(end) <= mins(start)) return bad('end', t('badTime'));
  if (!f.get('date')) return bad('date', t('needTitle'));
  const data = { title, desc: (f.get('desc') || '').trim(), date: f.get('date'), allDay, start: allDay ? '' : start, end: allDay ? '' : end, color: f.get('color'), repeat: f.get('repeat'), remind: Number(f.get('remind')) };
  if (id) events = events.map((e) => (e.id === id ? { ...e, ...data } : e));
  else events.push({ id: newId(), ...data });
  saveEvents(); fired.clear(); $('#evDlg').close(); render(); toast(t('saved'));
}

function deleteEvent(id) {
  const idx = events.findIndex((e) => e.id === id); if (idx < 0) return;
  const [removed] = events.splice(idx, 1);
  saveEvents(); $('#evDlg').close(); render();
  toast(t('deleted'), t('undo'), () => { events.splice(idx, 0, removed); saveEvents(); render(); });
}

/* ───────── settings dialog ───────── */
const seg = (k, vals) => `<div class="seg">${vals.map(([v, l]) => `<button class="rp ${String(settings[k]) === String(v) ? 'on' : ''}" data-action="set" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
const sw = (k, label) => `<label class="switch set-row"><b>${label}</b><input type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}><i></i></label>`;
const opt2 = (v, title, d) => `<button class="opt rp ${settings.windowMode === v ? 'on' : ''}" data-action="set" data-k="windowMode" data-v="${v}"><span class="dot"></span><span><b>${title}</b><small>${d}</small></span></button>`;

function fillSettings() {
  const d = $('#setDlg'), sc = d.querySelector('.dlg-body')?.scrollTop || 0;
  d.innerHTML = `<div class="dlg-head"><h2>${t('settings')}</h2><button class="icon-btn rp" data-action="closeDlg" title="${t('close')}">${I.close}</button></div>
  <div class="dlg-body">
    <section><h3>${t('s.appearance')}</h3>
      <div class="set-row"><span>${t('s.theme')}</span>${seg('theme', [['system', t('t.system')], ['light', t('t.light')], ['dark', t('t.dark')]])}</div>
      <div class="set-col"><span>${t('s.color')}</span><div class="swatches">${PRESETS.map((c) => `<button class="swb ${settings.seed.toLowerCase() === c ? 'on' : ''}" data-action="set" data-k="seed" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}
        <label class="swb custom" title="${t('s.custom')}" style="--c:${esc(settings.seed)}"><input type="color" id="seedInput" value="${esc(settings.seed)}"></label></div></div>
      <div class="set-row"><span>${t('s.language')}</span>${seg('lang', [['auto', t('l.auto')], ['en', 'English'], ['vi', 'Tiếng Việt']])}</div></section>
    <section><h3>${t('s.window')}</h3><div class="opts">${opt2('remember', t('w.remember'), t('w.rememberD'))}${opt2('maximized', t('w.max'), t('w.maxD'))}</div></section>
    <section><h3>${t('s.calendar')}</h3>
      <div class="set-row"><span>${t('s.weekStart')}</span>${seg('weekStart', [[1, t('d.mon')], [0, t('d.sun')]])}</div>
      ${sw('holidays', t('s.holidays'))}${sw('anim', t('s.anim'))}</section>
    <section><h3>${t('s.about')}</h3><div class="about"><div class="a-logo">${I.logo}</div>
      <div><b>${t('app.name')}</b> <small>${t('s.version')} 1.0.0</small>
      <p>${t('s.author')}: <span class="pill">minhtrong67</span></p><p>${t('s.assist')}: <span class="pill ai">Claude</span></p></div></div>
      <p class="muted">${t('shortcuts')}</p></section></div>`;
  d.querySelector('.dlg-body').scrollTop = sc;
}

function applySetting(k, refill = true) {
  if (k === 'theme' || k === 'seed') applyTheme(settings);
  if (k === 'lang') { setLang(settings.lang); shell(); }
  if (k === 'anim') document.documentElement.dataset.anim = settings.anim ? 'on' : 'off';
  if (k === 'windowMode' && settings.windowMode === 'remember') captureSize(onSize);
  persist(); render();
  if (refill && $('#setDlg').open) fillSettings();
}

/* ───────── reminders ───────── */
const fired = new Set();
function checkReminders() {
  const now = new Date(), today = sod(now), nm = now.getHours() * 60 + now.getMinutes();
  for (const e of events) {
    if (e.allDay || e.remind < 0 || !occurs(e, today)) continue;
    const key = e.id + ymd(today); if (fired.has(key)) continue;
    const st = mins(e.start);
    if (nm >= st - e.remind && nm <= st) {
      fired.add(key);
      toast(`${t('reminder')}: ${e.title} (${e.start})`, null, null, 9000);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(e.title, { body: e.start }); } catch { /* ignore */ }
    }
  }
}

/* ───────── search ───────── */
function search(q) {
  const box = $('#results'); q = q.trim().toLowerCase();
  if (!q) { box.hidden = true; return; }
  const hits = events.filter((e) => (e.title + ' ' + e.desc).toLowerCase().includes(q)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  box.innerHTML = hits.length ? hits.map((e) => `<button class="res" data-action="edit" data-id="${e.id}" data-date="${e.date}" style="--c:${e.color}"><i></i><span><b>${esc(e.title)}</b><small>${fmt({ day: 'numeric', month: 'short', year: 'numeric' }, parse(e.date))}${e.allDay ? '' : ' · ' + e.start}</small></span></button>`).join('') : `<p class="muted">${t('noResults')}</p>`;
  box.hidden = false;
}

/* ───────── events ───────── */
document.addEventListener('click', (ev) => {
  if (ev.target.tagName === 'DIALOG') return ev.target.close();
  if (!ev.target.closest('.search')) $('#results') && ($('#results').hidden = true);
  const a = ev.target.closest('[data-action]'); if (!a) return;
  const { action, id, date, v, k } = a.dataset;
  switch (action) {
    case 'menu': sidebar = !sidebar; $('#body').classList.toggle('collapsed', !sidebar); break;
    case 'today': goToday(); break;
    case 'prev': step(-1); break;
    case 'next': step(1); break;
    case 'view': setView(v); break;
    case 'new': openEvent(null, ymd(cursor)); break;
    case 'settings': fillSettings(); $('#setDlg').showModal(); break;
    case 'closeDlg': a.closest('dialog').close(); break;
    case 'mprev': dirFlag = -1; cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); render(); break;
    case 'mnext': dirFlag = 1; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); render(); break;
    case 'mday': cursor = parse(date); render(); break;
    case 'goto': cursor = parse(date); settings.view = 'day'; persist(); render(); break;
    case 'cell': openEvent(null, date); break;
    case 'col': {
      const r = a.getBoundingClientRect();
      openEvent(null, date, Math.floor(((ev.clientY - r.top) / HOUR) * 2) * 30); break;
    }
    case 'edit': $('#results').hidden = true; openEvent(id, date); break;
    case 'del': deleteEvent(id); break;
    case 'set': settings[k] = k === 'weekStart' ? Number(v) : v; applySetting(k); break;
  }
  // ripple
  const rp = ev.target.closest('.rp');
  if (rp) {
    const r = rp.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, el = document.createElement('span');
    el.className = 'ripple'; el.style.cssText = `width:${s}px;height:${s}px;left:${ev.clientX - r.left - s / 2}px;top:${ev.clientY - r.top - s / 2}px`;
    rp.append(el); setTimeout(() => el.remove(), 600);
  }
});

document.addEventListener('submit', (ev) => { if (ev.target.id === 'evForm') { ev.preventDefault(); submitEvent(ev.target); } });
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.name === 'allDay') $('#times').hidden = el.checked;
  if (el.dataset.set) { settings[el.dataset.set] = el.checked; applySetting(el.dataset.set, false); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'q') { clearTimeout(search.t); search.t = setTimeout(() => search(el.value), 120); }
  if (el.id === 'seedInput') { settings.seed = el.value; applyTheme(settings); persist(); }
  if (el.closest?.('.tf.err')) el.closest('.tf').classList.remove('err');
});
document.addEventListener('scroll', (ev) => { if (ev.target.classList?.contains('tg-scroll')) gridScroll = ev.target.scrollTop; }, true);
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#q').focus(); return; }
  if (ev.key === 'Escape') { $('#results').hidden = true; $('#q').blur(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) || document.querySelector('dialog[open]') || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'n') { ev.preventDefault(); openEvent(null, ymd(cursor)); }
  else if (k === 't') goToday();
  else if (k === 'm') setView('month'); else if (k === 'w') setView('week');
  else if (k === 'd') setView('day'); else if (k === 'a') setView('agenda');
  else if (k === 'arrowleft') step(-1); else if (k === 'arrowright') step(1);
});
document.addEventListener('contextmenu', (ev) => { if (!import.meta.env.DEV) ev.preventDefault(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

/* ───────── boot ───────── */
setLang(settings.lang);
applyTheme(settings);
document.documentElement.dataset.anim = settings.anim ? 'on' : 'off';
shell();
render();
checkReminders();
setInterval(checkReminders, 20000);
requestAnimationFrame(() => initWindow(() => settings, onSize));

import './styles/main.css';
import { state, saveSettings, setActive, getActive, upsertPlace, removePlace, placeId, cacheGet, cacheSet } from './lib/store.js';
import { setLang, t, getLang, wmoText } from './lib/i18n.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
import { fetchWeather, locateByGPS, locateByIP, geoPermission, unitsKey } from './lib/api.js';
import { initWindow, applyWindowMode, setTitle, setOnTop } from './lib/window.js';
import { createFX } from './lib/fx.js';
import { ic } from './lib/icons.js';
import { skyClass, fmtPlaceDateTime, deg, windLabel, compass } from './lib/format.js';
import { heroHTML, sectionsHTML, skeletonHTML, errorHTML, emptyHTML, drawerListHTML } from './ui/view.js';
import { openSettings, creditHTML, closeDialog, isDialogOpen, openLocationDialog } from './ui/dialogs.js';
import { initSearch } from './ui/search.js';
import { initRipple } from './ui/ripple.js';
import { toast } from './ui/toast.js';

const $ = (id) => document.getElementById(id);
const el = { hero: $('hero'), heroBody: $('heroBody'), sections: $('sections'), foot: $('foot'), list: $('locList'), refresh: $('btnRefresh'), app: $('app') };
const fx = createFX($('fx'));

let model = null; // currently displayed weather
let offline = false;
let token = 0;
let busy = false;
let shownTemp = null;
const STALE = 5 * 60 * 1000;

const cacheKey = (p) => `${p.id}|${unitsKey(state.settings)}`;

/* ---------- static texts / language ---------- */
function applyTexts() {
  const s = state.settings;
  document.title = t('app.name');
  $('brandName').textContent = t('app.name');
  $('locLabel').textContent = t('nav.locations');
  $('btnDetect').innerHTML = ic('locate', 20) + `<span>${t('nav.detect')}</span>`;
  $('credit').innerHTML = creditHTML();
  $('searchInput').placeholder = t('search.placeholder');
  $('searchIco').innerHTML = ic('search', 22);
  $('searchClear').innerHTML = ic('close', 18);
  $('searchClear').setAttribute('aria-label', t('action.clear'));
  $('btnMenu').innerHTML = ic('menu'); $('btnMenu').setAttribute('aria-label', t('nav.menu'));
  $('btnPin').innerHTML = ic('pushpin'); $('btnPin').title = t('action.pin'); $('btnPin').setAttribute('aria-label', t('action.pin')); $('btnPin').classList.toggle('on', s.alwaysOnTop);
  $('btnRefresh').innerHTML = ic('refresh'); $('btnRefresh').title = t('action.refresh'); $('btnRefresh').setAttribute('aria-label', t('action.refresh'));
  $('btnSettings').innerHTML = ic('gear'); $('btnSettings').title = t('action.settings'); $('btnSettings').setAttribute('aria-label', t('action.settings'));
  el.foot.innerHTML = `<span>${t('about.data')}</span><span class="dot">·</span>${creditHTML()}`;
}

/* ---------- painting ---------- */
function paintDrawer() {
  el.list.innerHTML = drawerListHTML(state.places, state.activeId);
}
function paint({ animate = true } = {}) {
  paintDrawer();
  if (!model) return;
  const m = model;
  el.hero.hidden = false;
  el.hero.className = `hero ${skyClass(m.now.code, m.now.isDay)}`;
  el.heroBody.innerHTML = heroHTML(m, offline);
  el.sections.innerHTML = sectionsHTML(m);
  el.sections.classList.toggle('no-anim', !animate);
  fx.set(m.now.code, m.now.isDay);
  countUp($('heroTemp'), Math.round(m.now.temp));
  setTitle(`${m.place.name} ${Math.round(m.now.temp)}° · ${wmoText(m.now.code)}`);
}
function countUp(node, to) {
  const from = shownTemp ?? to;
  shownTemp = to;
  if (!node || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now(), dur = 650;
  const step = (now) => {
    const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
    node.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function showEmpty() {
  model = null;
  el.hero.hidden = true;
  el.sections.innerHTML = emptyHTML();
  paintDrawer();
  $('btnDetect2')?.addEventListener('click', () => startLocate());
}
function showSkeleton() {
  el.hero.hidden = false;
  el.hero.className = 'hero sky-loading';
  el.heroBody.innerHTML = '<div class="skel-line w60"></div><div class="skel-line w30"></div><div class="skel-big"></div>';
  el.sections.innerHTML = skeletonHTML();
}
function showError() {
  el.hero.hidden = true;
  el.sections.innerHTML = errorHTML(t('status.error'), t('status.errorHint'));
  $('btnRetry')?.addEventListener('click', () => load(getActive(), { force: true }));
}
function setBusy(v) {
  busy = v;
  el.refresh.classList.toggle('spin', v);
  el.refresh.disabled = v;
}

/* ---------- loading ---------- */
async function load(place, { force = false, quiet = false } = {}) {
  if (!place) return showEmpty();
  const my = ++token;
  const cached = cacheGet(cacheKey(place));
  const switching = place.id !== model?.place.id;
  if (cached) { model = cached; offline = false; paint({ animate: switching }); }
  else if (switching || !model) { model = null; showSkeleton(); paintDrawer(); }
  if (!force && cached && Date.now() - cached.fetchedAt < STALE) return;

  setBusy(true);
  try {
    const m = await fetchWeather(place, state.settings);
    if (my !== token) return;
    model = m; offline = false;
    cacheSet(cacheKey(place), m);
    upsertPlace({ id: place.id, temp: m.now.temp, code: m.now.code, isDay: m.now.isDay });
    paint({ animate: !cached || switching });
    if (quiet === 'toast') toast(t('status.refreshed'), { duration: 1800 });
  } catch (e) {
    if (my !== token) return;
    console.warn('weather failed', e);
    if (model) { offline = true; paint({ animate: false }); toast(t('status.offline')); }
    else showError();
  } finally {
    if (my === token) setBusy(false);
  }
}

function selectPlace(p, { notify = false } = {}) {
  const place = { id: placeId(p.lat, p.lon), name: p.name, admin: p.admin, country: p.country, lat: p.lat, lon: p.lon };
  const isNew = !state.places.some((x) => x.id === place.id);
  upsertPlace(place);
  setActive(place.id);
  closeNav();
  if (notify && isNew) toast(t('status.added', { name: place.name }), { duration: 2200 });
  load(state.places.find((x) => x.id === place.id));
}

/* ---------- location (asks for permission, falls back to IP) ---------- */
let locating = false;
function setLocating(v) {
  locating = v;
  const b = $('btnDetect'); b.disabled = v; b.classList.toggle('loading', v);
}
function useLocation(p, { approx = false } = {}) {
  const named = { ...p, name: p.name || t('loc.mine'), admin: p.name ? p.admin : `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` };
  selectPlace(named, { notify: true });
  if (approx) toast(t('loc.approxUsed'), { duration: 3200 });
}
async function runIP({ fallback = false } = {}) {
  setLocating(true);
  try {
    const p = await locateByIP();
    useLocation(p, { approx: true });
    return true;
  } catch {
    toast(t('status.detectFail'), { action: t('action.retry'), onAction: () => startLocate() });
    return false;
  } finally { setLocating(false); }
}
async function runGPS(opts = {}) {
  setLocating(true);
  toast(t('loc.waiting'), { duration: 2500 });
  try {
    useLocation(await locateByGPS(getLang()));
    return true;
  } catch (e) {
    setLocating(false);
    if (e.code === 'denied') {
      openLocationDialog('denied', { onAllow: () => runGPS(opts), onApprox: () => runIP(), onDismiss: opts.onDismiss });
      return false;
    }
    toast(t('loc.fallback'), { duration: 3000 });
    return runIP({ fallback: true }); // timeout / unavailable / unsupported webview
  } finally { setLocating(false); }
}
/** Entry point: asks permission first (custom explanation + OS prompt), never silently uses the IP. */
async function startLocate({ firstRun = false } = {}) {
  if (locating) return;
  closeNav();
  const onDismiss = firstRun ? useDefaultPlace : undefined;
  const st = await geoPermission();
  if (st === 'granted') return runGPS({ onDismiss });
  openLocationDialog(st === 'denied' ? 'denied' : 'prompt', { onAllow: () => runGPS({ onDismiss }), onApprox: () => runIP(), onDismiss });
}
function useDefaultPlace() {
  if (!state.places.length) selectPlace({ name: 'Hà Nội', admin: '', country: 'Việt Nam', lat: 21.0285, lon: 105.8542 });
}

/* ---------- copy summary ---------- */
async function copySummary() {
  if (!model) return;
  const n = model.now, d = model.daily[0], u = windLabel(model.windUnit);
  const text = [
    `${model.place.name}: ${deg(n.temp)}${model.tempUnit.toUpperCase()} · ${wmoText(n.code)}`,
    `${t('hero.high')} ${deg(d.max)} / ${t('hero.low')} ${deg(d.min)} · ${t('hero.feels')} ${deg(n.feels)}`,
    `${t('detail.humidity')} ${Math.round(n.humidity)}% · ${t('detail.wind')} ${Math.round(n.wind)} ${u} (${compass(n.windDir)})`,
  ].join('\n');
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(t('status.copied'), { duration: 1800 });
}

/* ---------- settings ---------- */
function applySetting(patch) {
  const prev = { ...state.settings };
  saveSettings(patch);
  const s = state.settings;
  if ('lang' in patch) { setLang(s.lang); applyTexts(); paint({ animate: false }); }
  if ('theme' in patch || 'seed' in patch) applyTheme(s, true);
  if ('effects' in patch) fx.enable(s.effects);
  if ('windowMode' in patch) applyWindowMode();
  if ('alwaysOnTop' in patch) { setOnTop(s.alwaysOnTop); $('btnPin').classList.toggle('on', s.alwaysOnTop); }
  if (('tempUnit' in patch && prev.tempUnit !== s.tempUnit) || ('windUnit' in patch && prev.windUnit !== s.windUnit)) {
    shownTemp = null;
    load(getActive(), { force: true });
  }
  scheduleAuto();
}

/* ---------- refresh scheduling ---------- */
let autoTimer = 0;
function scheduleAuto() {
  clearInterval(autoTimer);
  if (state.settings.autoRefresh) autoTimer = setInterval(() => { if (!document.hidden) load(getActive(), { force: true }); }, 15 * 60 * 1000);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && model && Date.now() - model.fetchedAt > 10 * 60 * 1000) load(getActive(), { force: true });
});
window.addEventListener('online', () => { if (offline) load(getActive(), { force: true }); });
setInterval(() => { // keep the local clock in the hero fresh
  const n = $('heroTime');
  if (n && model && !document.hidden) n.textContent = fmtPlaceDateTime(model);
}, 30000);

/* ---------- navigation drawer (small windows) ---------- */
const openNav = () => el.app.classList.add('nav-open');
function closeNav() { el.app.classList.remove('nav-open'); }

/* ---------- events ---------- */
function wire() {
  $('btnMenu').addEventListener('click', openNav);
  $('navScrim').addEventListener('click', closeNav);
  $('btnDetect').addEventListener('click', () => startLocate());
  $('btnPin').addEventListener('click', () => applySetting({ alwaysOnTop: !state.settings.alwaysOnTop }));
  el.heroBody.addEventListener('click', (e) => { if (e.target.closest('#btnCopy')) copySummary(); });
  $('btnRefresh').addEventListener('click', () => { if (!busy) load(getActive(), { force: true, quiet: 'toast' }); });
  $('btnSettings').addEventListener('click', () => openSettings(applySetting));
  el.list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del, p = state.places.find((x) => x.id === id);
      removePlace(id);
      toast(t('status.removed', { name: p?.name || '' }), { duration: 2200 });
      if (id === state.activeId) { const next = state.places[0]; setActive(next?.id ?? null); load(next || null); } else paintDrawer();
      return;
    }
    const row = e.target.closest('.loc');
    if (row && row.dataset.id !== state.activeId) { setActive(row.dataset.id); closeNav(); load(getActive()); }
    else if (row) closeNav();
  });
  el.list.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.closest('.loc'); if (r && e.target === r) { e.preventDefault(); r.click(); } } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) { e.preventDefault(); if (!busy) load(getActive(), { force: true, quiet: 'toast' }); }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); isDialogOpen() ? closeDialog() : openSettings(applySetting); }
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && state.places.length > 1) {
      e.preventDefault();
      const i = state.places.findIndex((p) => p.id === state.activeId), n = state.places.length;
      const next = state.places[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n];
      setActive(next.id); load(next);
    }
    if (e.key === 'Escape') closeNav();
  });
  if (import.meta.env.PROD) document.addEventListener('contextmenu', (e) => { if (!/input|textarea/i.test(e.target.tagName)) e.preventDefault(); });
  initSearch({ onPick: (p) => selectPlace(p, { notify: true }) });
}

/* ---------- boot ---------- */
async function boot() {
  setLang(state.settings.lang);
  applyTheme(state.settings);
  watchSystemTheme(() => state.settings);
  applyTexts();
  fx.enable(state.settings.effects);
  initRipple();
  wire();
  scheduleAuto();
  paintDrawer();

  await initWindow(); // applies window mode, then shows the window

  const place = getActive() || state.places[0] || null;
  if (place) { setActive(place.id); return load(place); }
  showEmpty();
  startLocate({ firstRun: true });
}
boot();

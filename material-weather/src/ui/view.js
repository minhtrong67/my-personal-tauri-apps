import { t, wmoText } from '../lib/i18n.js';
import { ic, sic } from '../lib/icons.js';
import { wxIcon } from '../lib/wxicons.js';
import {
  esc, clamp, deg, fmtHour, fmtClock, dayName, fmtPlaceDateTime, fmtUpdated, windLabel, compass,
  uvInfo, aqiInfo, sunProgress, daylight, placeSub, kindOf,
} from '../lib/format.js';

const COL = 68; // hourly column width (px)

/* ---------- smart tips ---------- */
const toC = (m, v) => (m.tempUnit === 'f' ? ((v - 32) * 5) / 9 : v);
const toKmh = (m, v) => (m.windUnit === 'ms' ? v * 3.6 : m.windUnit === 'mph' ? v * 1.609 : v);

export function tipsOf(m) {
  const n = m.now, tips = [];
  const add = (p, icon, tone, key, vars) => tips.push({ p, icon, tone, text: t(key, vars) });
  const kind = kindOf(n.code);
  const rainy = ['rain', 'drizzle', 'storm'].includes(kind) || n.precip > 0.1;
  const stormSoon = kind === 'storm' || m.hourly.slice(0, 12).some((h) => kindOf(h.code) === 'storm');
  if (stormSoon) add(0, 'bolt', 'warn', 'tips.storm');
  if (rainy) add(1, 'umbrella', 'info', 'tips.rainNow');
  else {
    const h = m.hourly.slice(1, 13).find((x) => x.pop >= 50 || ['rain', 'drizzle'].includes(kindOf(x.code)));
    if (h) add(1, 'umbrella', 'info', 'tips.rainAt', { time: fmtHour(h.time) });
    else add(6, 'umbrella', 'good', 'tips.dry');
  }
  const a = m.aqi?.us;
  if (a > 150) add(2, 'leaf', 'warn', 'tips.aqiBad');
  else if (a > 100) add(3, 'leaf', 'warn', 'tips.aqiSens');
  else if (a != null && a <= 50) add(7, 'leaf', 'good', 'tips.aqiGood');
  const uv = m.daily[0].uvMax ?? 0;
  if (uv >= 6) add(2, 'sun', 'warn', 'tips.uvHigh', { v: uv.toFixed(0) });
  else if (uv >= 3) add(5, 'sun', 'info', 'tips.uvMod', { v: uv.toFixed(0) });
  const f = toC(m, n.feels);
  if (f >= 35) add(2, 'thermo', 'warn', 'tips.hot');
  else if (f >= 30) add(4, 'thermo', 'info', 'tips.warm');
  else if (f <= 10) add(2, 'thermo', 'info', 'tips.cold');
  else if (f <= 18) add(4, 'thermo', 'info', 'tips.cool');
  else add(8, 'thermo', 'good', 'tips.mild');
  if (toKmh(m, n.wind) >= 40) add(3, 'wind', 'warn', 'tips.wind');
  return tips.sort((x, y) => x.p - y.p).slice(0, 4);
}
const tipsHTML = (m) => `<div class="tips">${tipsOf(m).map((x, i) => `<div class="tip ${x.tone}" style="--i:${i}">${sic(x.icon, 22)}<span>${esc(x.text)}</span></div>`).join('')}</div>`;

/* ---------- moon phase (computed locally) ---------- */
export function moonPhase(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const p = (((jd - 2451550.1) / 29.530588853) % 1 + 1) % 1;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const idx = p < 0.03 || p > 0.97 ? 0 : p < 0.22 ? 1 : p < 0.28 ? 2 : p < 0.47 ? 3 : p < 0.53 ? 4 : p < 0.72 ? 5 : p < 0.78 ? 6 : 7;
  return { p, illum, idx };
}
export function moonSVG(p, size = 56) {
  const r = 26, c = 28, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  const limb = waxing ? 1 : 0;
  const term = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  const lit = `M${c} ${c - r} A${r} ${r} 0 0 ${limb} ${c} ${c + r} A${rx.toFixed(2)} ${r} 0 0 ${term} ${c} ${c - r}Z`;
  return `<svg viewBox="0 0 56 56" width="${size}" height="${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" class="moon-dark"/><path d="${lit}" class="moon-lit"/></svg>`;
}
function moonTile() {
  const mp = moonPhase();
  return `<div class="tile moon-tile"><div class="tile-h">${sic('eye', 18)}<span>${t('detail.moon')}</span></div>
    <div class="moon-row">${moonSVG(mp.p)}<div><div class="tile-v small">${t('moon.' + mp.idx)}</div><div class="tile-s">${t('moon.illum', { v: Math.round(mp.illum * 100) })}</div></div></div></div>`;
}
const dewPoint = (m) => {
  const T = toC(m, m.now.temp), g = Math.log(Math.max(m.now.humidity, 1) / 100) + (17.62 * T) / (243.12 + T);
  const td = (243.12 * g) / (17.62 - g);
  return m.tempUnit === 'f' ? (td * 9) / 5 + 32 : td;
};

export function heroHTML(m, offline) {
  const n = m.now, today = m.daily[0], u = m.tempUnit.toUpperCase();
  return `
  <div class="hero-main">
    <div class="hero-loc">${ic('pin', 22)}<h1>${esc(m.place.name)}</h1></div>
    <div class="hero-sub">${esc(placeSub(m.place))}</div>
    <div class="hero-time" id="heroTime">${esc(fmtPlaceDateTime(m))}</div>
    <div class="hero-temp"><span id="heroTemp">${Math.round(n.temp)}</span><sup>°${u}</sup></div>
    <div class="hero-cond">${esc(wmoText(n.code))}</div>
    <div class="hero-chips">
      <span class="hchip">${t('hero.high')} ${deg(today.max)}</span>
      <span class="hchip">${t('hero.low')} ${deg(today.min)}</span>
      <span class="hchip">${t('hero.feels')} ${deg(n.feels)}</span>
    </div>
  </div>
  <button class="hero-copy ripple" id="btnCopy" title="${t('action.copy')}" aria-label="${t('action.copy')}">${ic('copy', 20)}</button>
  <div class="hero-art">${wxIcon(n.code, n.isDay, 168, true)}</div>
  <div class="hero-foot ${offline ? 'is-offline' : ''}">
    ${offline ? ic('cloudOff', 16) + `<span>${t('hero.offline')} · </span>` : ''}<span>${t('hero.updated', { time: fmtUpdated(m.fetchedAt) })}</span>
  </div>`;
}

function smooth(p) {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function hourlyHTML(m) {
  const hrs = m.hourly;
  const temps = hrs.map((h) => h.temp);
  const lo = Math.min(...temps), hi = Math.max(...temps);
  const H = 96, top = 28, bot = 14;
  const pts = hrs.map((h, i) => [i * COL + COL / 2, top + ((hi - h.temp) / (hi - lo || 1)) * (H - top - bot)]);
  const line = smooth(pts);
  const W = hrs.length * COL;
  const labels = hrs.map((h, i) => `<text x="${pts[i][0]}" y="${pts[i][1] - 11}" text-anchor="middle">${Math.round(h.temp)}°</text><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5"/>`).join('');
  return `
  <div class="hscroll"><div class="hinner" style="width:${W}px">
    <div class="hrow">${hrs.map((h, i) => `<div class="hcell"><span class="hh">${i === 0 ? t('hour.now') : fmtHour(h.time)}</span>${wxIcon(h.code, h.isDay, 34)}</div>`).join('')}</div>
    <svg class="hchart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--md-primary)" stop-opacity=".28"/><stop offset="1" stop-color="var(--md-primary)" stop-opacity="0"/></linearGradient></defs>
      <path class="harea" d="${line} L${pts.at(-1)[0]},${H} L${pts[0][0]},${H} Z" fill="url(#hg)"/>
      <path class="hline" d="${line}" pathLength="1"/>
      <g class="hdots">${labels}</g>
    </svg>
    <div class="hrow pops">${hrs.map((h) => `<div class="hcell ${h.pop < 10 ? 'dim' : ''}">${sic('drop', 13)}<span>${Math.round(h.pop)}%</span></div>`).join('')}</div>
  </div></div>`;
}

function dailyHTML(m) {
  const lo = Math.min(...m.daily.map((d) => d.min)), hi = Math.max(...m.daily.map((d) => d.max));
  const span = hi - lo || 1;
  return m.daily.map((d, i) => {
    const left = ((d.min - lo) / span) * 100, width = Math.max(((d.max - d.min) / span) * 100, 6);
    const marker = i === 0 ? `<i class="dmark" style="left:${clamp(((m.now.temp - d.min) / (d.max - d.min || 1)) * 100, 0, 100)}%"></i>` : '';
    return `<div class="drow" style="--i:${i}">
      <span class="dname">${esc(dayName(d.date, i))}</span>
      ${wxIcon(d.code, true, 34)}
      <span class="dpop ${d.pop < 10 ? 'dim' : ''}">${sic('drop', 13)}${Math.round(d.pop)}%</span>
      <span class="dtemp lo">${deg(d.min)}</span>
      <span class="dbar"><span class="dfill" style="left:${left}%;width:${width}%">${marker}</span></span>
      <span class="dtemp hi">${deg(d.max)}</span>
    </div>`;
  }).join('');
}

const tile = (icon, title, value, unit, sub, extra = '', cls = '') => `
  <div class="tile ${cls}">
    <div class="tile-h">${sic(icon, 18)}<span>${title}</span></div>
    <div class="tile-v">${value}${unit ? `<small>${unit}</small>` : ''}</div>
    ${extra}${sub ? `<div class="tile-s">${sub}</div>` : ''}
  </div>`;
const bar = (pct, color = 'var(--md-primary)') => `<div class="meter"><i style="width:${clamp(pct, 0, 100)}%;background:${color}"></i></div>`;

function sunHTML(m) {
  const d = m.daily[0];
  const p = sunProgress(m.now.time, d.sunrise, d.sunset);
  const q = p ?? 0;
  const th = Math.PI * (1 - q);
  const x = 120 + 100 * Math.cos(th), y = 76 - 64 * Math.sin(th);
  const dl = daylight(d.sunrise, d.sunset);
  const arc = 'M20 76 A100 64 0 0 1 220 76';
  return `
  <div class="tile sun-tile">
    <div class="tile-h">${sic('sun', 18)}<span>${t('detail.sun')}</span></div>
    <div class="sun-wrap">
      <div class="sun-side">${sic('sunrise', 22)}<b>${fmtClock(d.sunrise)}</b><small>${t('detail.sunrise')}</small></div>
      <svg viewBox="0 0 240 92" class="sun-arc" aria-hidden="true">
        <path d="${arc}" class="arc-bg"/><path d="${arc}" class="arc-fg" pathLength="1" style="--p:${q}"/>
        <line x1="10" y1="76" x2="230" y2="76" class="arc-ground"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="arc-sun ${p == null ? 'night' : ''}"/>
      </svg>
      <div class="sun-side">${sic('sunset', 22)}<b>${fmtClock(d.sunset)}</b><small>${t('detail.sunset')}</small></div>
    </div>
    <div class="tile-s center">${t('detail.daylight', { h: dl.h, m: dl.m })}</div>
  </div>`;
}

function detailsHTML(m) {
  const n = m.now;
  const wu = windLabel(m.windUnit);
  const imperial = m.windUnit === 'mph';
  const vis = n.visibility == null ? null : imperial ? n.visibility / 1609.34 : n.visibility / 1000;
  const uv = uvInfo(n.uv);
  const hum = tile('drop', t('detail.humidity'), Math.round(n.humidity), '%', t('detail.dew', { v: deg(dewPoint(m)) }), bar(n.humidity));
  const wind = `
  <div class="tile">
    <div class="tile-h">${sic('wind', 18)}<span>${t('detail.wind')}</span></div>
    <div class="wind-row">
      <div><div class="tile-v">${Math.round(n.wind)}<small>${wu}</small></div>
      <div class="tile-s">${t('detail.windFrom', { dir: compass(n.windDir) })}</div>
      <div class="tile-s">${t('detail.gusts', { v: Math.round(n.gust) + ' ' + wu })}</div></div>
      <div class="compass"><span>N</span><i style="transform:rotate(${(n.windDir + 180) % 360}deg)">${ic('arrow', 22)}</i></div>
    </div>
  </div>`;
  const aqi = m.aqi && m.aqi.us != null
    ? (() => { const a = aqiInfo(m.aqi.us); return tile('leaf', t('detail.aqi'), Math.round(m.aqi.us), 'AQI', `${t(a.key)}`, bar((m.aqi.us / 300) * 100, a.color) + `<div class="tile-s">${t('detail.aqiHint', { v: Math.round(m.aqi.pm25) })}</div>`) })()
    : tile('leaf', t('detail.aqi'), '–', '', t('detail.unavailable'));
  return [
    hum, wind,
    tile('gauge', t('detail.pressure'), Math.round(n.pressure), 'hPa', ''),
    tile('sun', t('detail.uv'), n.uv == null ? '–' : n.uv.toFixed(1), '', t(uv.key), `<div class="meter uv"><i class="uvdot" style="left:${clamp(((n.uv ?? 0) / 11) * 100, 0, 100)}%;background:${uv.color}"></i></div>`),
    tile('eye', t('detail.visibility'), vis == null ? '–' : vis >= 10 ? Math.round(vis) : vis.toFixed(1), imperial ? 'mi' : 'km', ''),
    tile('cloud', t('detail.cloud'), Math.round(n.cloud), '%', '', bar(n.cloud, 'var(--md-secondary)')),
    tile('drop', t('detail.precip'), n.precip.toFixed(1), m.tempUnit === 'f' ? 'in' : 'mm', t('detail.precipHint')),
    aqi,
    moonTile(),
    sunHTML(m),
  ].map((h, i) => h.replace('class="tile', `style="--i:${i}" class="tile`)).join('');
}

export function sectionsHTML(m) {
  return `
  <section class="rise" style="--i:0"><h2 class="sec-title">${t('tips.title')}</h2>${tipsHTML(m)}</section>
  <section class="card rise" style="--i:1"><h2>${t('section.hourly')}</h2>${hourlyHTML(m)}</section>
  <section class="rise" style="--i:2"><h2 class="sec-title">${t('section.details')}</h2><div class="tiles">${detailsHTML(m)}</div></section>
  <section class="card rise" style="--i:3"><h2>${t('section.daily')}</h2><div class="dlist">${dailyHTML(m)}</div></section>`;
}

export function skeletonHTML() {
  return `<div class="skel-card rise" style="height:150px"></div><div class="skel-card rise" style="height:200px;--i:1"></div>
  <div class="tiles">${Array.from({ length: 8 }, (_, i) => `<div class="skel-card" style="height:120px;--i:${i}"></div>`).join('')}</div>`;
}

export function errorHTML(msg, hint) {
  return `<div class="state rise">${ic('cloudOff', 56)}<h2>${esc(msg)}</h2><p>${esc(hint)}</p><button class="btn filled ripple" id="btnRetry">${ic('refresh', 18)}${t('action.retry')}</button></div>`;
}
export function emptyHTML() {
  return `<div class="state rise"><img src="/logo.svg" width="96" height="96" alt=""/><h2>${t('empty.title')}</h2><p>${t('empty.hint')}</p>
  <button class="btn tonal ripple" id="btnDetect2">${ic('locate', 18)}${t('nav.detect')}</button></div>`;
}

export function drawerListHTML(places, activeId) {
  if (!places.length) return `<div class="loc-empty">${t('nav.empty')}</div>`;
  return places.map((p) => `
    <div class="loc ripple ${p.id === activeId ? 'active' : ''}" role="button" tabindex="0" data-id="${p.id}">
      <span class="loc-ico">${p.code != null ? wxIcon(p.code, p.isDay !== false, 28) : ic('pin', 22)}</span>
      <span class="loc-txt"><b>${esc(p.name)}</b><small>${esc(placeSub(p))}</small></span>
      <span class="loc-temp">${p.temp != null ? Math.round(p.temp) + '°' : ''}</span>
      <button class="loc-del" data-del="${p.id}" title="${t('nav.remove')}" aria-label="${t('nav.remove')}">${ic('close', 18)}</button>
    </div>`).join('');
}

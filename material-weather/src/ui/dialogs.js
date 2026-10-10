import { t, LANGS, getLang } from '../lib/i18n.js';
import { ic } from '../lib/icons.js';
import { PRESETS } from '../lib/theme.js';
import { state } from '../lib/store.js';
import { openExternal } from '../lib/window.js';

export const APP_VERSION = '1.0.0';
const layer = () => document.getElementById('layer');
let openDialog = null;

function mount(html, { onClose } = {}) {
  closeDialog();
  const prev = document.activeElement;
  const scrim = document.createElement('div');
  scrim.className = 'dialog-scrim';
  scrim.innerHTML = html;
  layer().appendChild(scrim);
  const dlg = scrim.querySelector('.dialog');
  const close = () => {
    if (!scrim.isConnected || scrim.classList.contains('out')) return;
    scrim.classList.add('out');
    const done = () => { scrim.remove(); onClose?.(); prev?.focus?.(); };
    scrim.addEventListener('animationend', done, { once: true });
    setTimeout(done, 400);
    if (openDialog?.scrim === scrim) openDialog = null;
  };
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  scrim.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  openDialog = { scrim, close, dlg };
  dlg.querySelector('button, input')?.focus({ preventScroll: true });
  return openDialog;
}
export function closeDialog() { openDialog?.close(); }
export const isDialogOpen = () => !!openDialog;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDialog(); });

export const creditHTML = () =>
  `<span class="credit-line"><span class="hl-author">minhtrong67</span><span class="credit-x">×</span><span class="hl-ai">Claude</span></span>`;

const seg = (name, opts, val) => `<div class="seg" role="radiogroup" data-seg="${name}">${opts.map(([v, label]) =>
  `<button type="button" class="ripple ${v === val ? 'on' : ''}" role="radio" aria-checked="${v === val}" data-v="${v}">${ic('check', 16)}<span>${label}</span></button>`).join('')}</div>`;
const sw = (name, on) => `<label class="switch"><input type="checkbox" role="switch" data-sw="${name}" ${on ? 'checked' : ''}/><span class="track"><span class="thumb"></span></span></label>`;
const opt = (v, title, desc, cur) => `<button type="button" class="opt ripple ${v === cur ? 'on' : ''}" role="radio" aria-checked="${v === cur}" data-opt="${v}"><span class="radio"></span><span><b>${title}</b><small>${desc}</small></span></button>`;

function settingsHTML() {
  const s = state.settings;
  const swatches = PRESETS.map((c) => `<button type="button" class="swatch ${c.toLowerCase() === s.seed.toLowerCase() ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="${c}">${ic('check', 18)}</button>`).join('');
  const custom = !PRESETS.some((c) => c.toLowerCase() === s.seed.toLowerCase());
  return `
  <div class="dialog settings" role="dialog" aria-modal="true" aria-label="${t('settings.title')}">
    <header class="dlg-head">${ic('gear', 28, 'dlg-ico')}<h2>${t('settings.title')}</h2><button class="icon-btn ripple" data-close aria-label="${t('action.close')}">${ic('close')}</button></header>
    <div class="dlg-body">
      <h3>${t('settings.appearance')}</h3>
      <div class="row"><label>${t('settings.theme')}</label>${seg('theme', [['light', t('theme.light')], ['dark', t('theme.dark')], ['system', t('theme.system')]], s.theme)}</div>
      <div class="row col"><label>${t('settings.color')}</label>
        <div class="swatches">${swatches}<label class="swatch custom ${custom ? 'on' : ''}" style="--c:${s.seed}" title="${t('settings.colorCustom')}"><input type="color" id="customColor" value="${s.seed}"/>${ic('check', 18)}</label></div></div>
      <div class="row"><label>${t('settings.language')}</label>${seg('lang', LANGS.map((l) => [l.id, l.label]), s.lang)}</div>

      <h3>${t('settings.units')}</h3>
      <div class="row"><label>${t('settings.temp')}</label>${seg('tempUnit', [['c', '°C'], ['f', '°F']], s.tempUnit)}</div>
      <div class="row"><label>${t('settings.wind')}</label>${seg('windUnit', [['kmh', 'km/h'], ['ms', 'm/s'], ['mph', 'mph']], s.windUnit)}</div>

      <h3>${t('settings.window')}</h3>
      <div class="opts" role="radiogroup">
        ${opt('remember', t('window.remember'), t('window.rememberDesc'), s.windowMode)}
        ${opt('maximized', t('window.maximized'), t('window.maximizedDesc'), s.windowMode)}
      </div>

      <h3>${t('settings.general')}</h3>
      <div class="row"><div class="lbl"><b>${t('settings.effects')}</b><small>${t('settings.effectsDesc')}</small></div>${sw('effects', s.effects)}</div>
      <div class="row"><div class="lbl"><b>${t('settings.onTop')}</b><small>${t('settings.onTopDesc')}</small></div>${sw('alwaysOnTop', s.alwaysOnTop)}</div>
      <div class="row"><div class="lbl"><b>${t('settings.autoRefresh')}</b><small>${t('settings.autoRefreshDesc')}</small></div>${sw('autoRefresh', s.autoRefresh)}</div>

      <div class="dlg-credit">${creditHTML()}<button class="btn text ripple" id="btnAbout">${ic('info', 18)}${t('action.about')}</button></div>
    </div>
  </div>`;
}

export function openSettings(apply) {
  const d = mount(settingsHTML());
  const root = d.dlg;
  const rebuild = () => { const top = root.querySelector('.dlg-body').scrollTop; root.outerHTML = settingsHTML(); wire(); document.querySelector('.settings .dlg-body').scrollTop = top; };
  function wire() {
    const r = document.querySelector('.settings');
    d.dlg = r;
    r.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => d.close()));
    r.querySelectorAll('.seg').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const name = g.dataset.seg, v = b.dataset.v;
      g.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      apply({ [name]: v });
      if (name === 'lang') rebuild();
    }));
    r.querySelectorAll('.swatch[data-c]').forEach((s) => (s.onclick = () => {
      r.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === s));
      r.querySelector('.swatch.custom').style.setProperty('--c', s.dataset.c);
      r.querySelector('#customColor').value = s.dataset.c;
      apply({ seed: s.dataset.c });
    }));
    const cc = r.querySelector('#customColor');
    let tm = 0;
    cc.addEventListener('input', () => {
      r.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x.classList.contains('custom')));
      cc.parentElement.style.setProperty('--c', cc.value);
      clearTimeout(tm); tm = setTimeout(() => apply({ seed: cc.value.toUpperCase() }), 120);
    });
    r.querySelectorAll('.opt').forEach((o) => (o.onclick = () => {
      r.querySelectorAll('.opt').forEach((x) => { const on = x === o; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      apply({ windowMode: o.dataset.opt });
    }));
    r.querySelectorAll('[data-sw]').forEach((i) => (i.onchange = () => apply({ [i.dataset.sw]: i.checked })));
    r.querySelector('#btnAbout').onclick = () => openAbout();
  }
  wire();
}

export function openAbout() {
  const d = mount(`
  <div class="dialog about" role="dialog" aria-modal="true" aria-label="${t('about.title')}">
    <button class="icon-btn ripple about-x" data-close aria-label="${t('action.close')}">${ic('close')}</button>
    <div class="about-body">
      <img class="about-logo" src="/logo.svg" width="96" height="96" alt=""/>
      <h2>${t('app.name')}</h2><div class="muted">${t('about.version', { v: APP_VERSION })}</div>
      <p>${t('about.desc')}</p>
      <div class="about-credit">
        <div><small>${t('about.createdBy')}</small><span class="hl-author big">minhtrong67</span></div>
        <div><small>${t('about.withAi')}</small><span class="hl-ai big">Claude</span></div>
      </div>
      <a href="#" class="link" id="lnkData">${t('about.data')}</a>
    </div>
  </div>`);
  d.dlg.querySelector('#lnkData').onclick = (e) => { e.preventDefault(); openExternal('https://open-meteo.com/'); };
}

/** Explains why we need the location and lets the user grant it (mode: 'prompt' | 'denied'). */
export function openLocationDialog(mode, { onAllow, onApprox, onDismiss } = {}) {
  let acted = false;
  const denied = mode === 'denied';
  const actions = denied
    ? `<button class="btn text ripple" data-close>${t('action.close')}</button>
       <button class="btn tonal ripple" data-act="allow">${t('loc.retry')}</button>
       <button class="btn filled ripple" data-act="approx">${t('loc.approx')}</button>`
    : `<button class="btn text ripple" data-close>${t('loc.notNow')}</button>
       <button class="btn tonal ripple" data-act="approx">${t('loc.approx')}</button>
       <button class="btn filled ripple" data-act="allow">${ic('locate', 18)}${t('loc.allow')}</button>`;
  const d = mount(`
  <div class="dialog loc-dlg" role="dialog" aria-modal="true" aria-label="${t(denied ? 'loc.deniedTitle' : 'loc.title')}">
    <div class="loc-body">
      <div class="loc-hero ${denied ? 'denied' : ''}">${ic('locate', 36)}</div>
      <h2>${t(denied ? 'loc.deniedTitle' : 'loc.title')}</h2>
      <p>${t(denied ? 'loc.deniedBody' : 'loc.body')}</p>
    </div>
    <div class="dlg-actions">${actions}</div>
  </div>`, { onClose: () => { if (!acted) onDismiss?.(); } });
  d.dlg.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    acted = true; d.close();
    (b.dataset.act === 'allow' ? onAllow : onApprox)?.();
  }));
}

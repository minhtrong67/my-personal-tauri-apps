import { searchPlaces } from '../lib/api.js';
import { getLang, t } from '../lib/i18n.js';
import { esc, placeSub } from '../lib/format.js';
import { ic } from '../lib/icons.js';

/** Search bar with debounced geocoding, request cancellation and keyboard navigation. */
export function initSearch({ onPick }) {
  const bar = document.getElementById('searchbar');
  const input = document.getElementById('searchInput');
  const pop = document.getElementById('searchPop');
  const clear = document.getElementById('searchClear');
  let timer = 0, ctrl = null, items = [], sel = -1;

  const close = () => { pop.hidden = true; sel = -1; };
  const open = (html) => { pop.innerHTML = html; pop.hidden = false; };
  const msg = (text) => open(`<div class="pop-msg">${esc(text)}</div>`);

  function paint() {
    open(items.map((p, i) => `
      <div class="pop-item ripple ${i === sel ? 'sel' : ''}" role="option" data-i="${i}">
        <span class="pop-ico">${ic('pin', 20)}</span>
        <span class="pop-txt"><b>${esc(p.name)}</b><small>${esc(placeSub(p))}</small></span>
      </div>`).join(''));
  }
  async function run(q) {
    ctrl?.abort();
    ctrl = new AbortController();
    msg(t('search.loading'));
    try {
      items = await searchPlaces(q, getLang(), ctrl.signal);
      sel = items.length ? 0 : -1;
      items.length ? paint() : msg(t('search.none'));
    } catch (e) {
      if (e.name !== 'AbortError') msg(t('search.error'));
    }
  }
  function pick(i) {
    const p = items[i];
    if (!p) return;
    input.value = ''; clear.hidden = true; close(); input.blur();
    onPick(p);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clear.hidden = !input.value;
    clearTimeout(timer);
    if (q.length < 2) { ctrl?.abort(); close(); return; }
    timer = setTimeout(() => run(q), 280);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; clear.hidden = true; close(); input.blur(); return; }
    if (!items.length || pop.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      paint();
    } else if (e.key === 'Enter') { e.preventDefault(); pick(Math.max(sel, 0)); }
  });
  pop.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // keep input focus until we handle the pick
    const el = e.target.closest('.pop-item');
    if (el) pick(+el.dataset.i);
  });
  clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; close(); input.focus(); });
  input.addEventListener('focus', () => { if (items.length && input.value) paint(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea/i.test(document.activeElement?.tagName);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      e.preventDefault(); input.focus(); input.select();
    }
  });
  return { focus: () => input.focus() };
}

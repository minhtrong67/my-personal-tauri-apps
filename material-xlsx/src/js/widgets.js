// Reusable Material widgets: ripple, menus, colour palette, dialogs, snackbar, busy bar.
export const $ = (s, r = document) => r.querySelector(s);
export function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
export const icon = (id, cls = "i") => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const layer = () => document.getElementById("layer");

// ── ripple ──
export function initRipple() {
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".btn, .icon-btn, .menu-item, .tab, .chip, .seg button, .swatch, .fbtn");
    if (!t || t.disabled || document.documentElement.dataset.anim === "off") return;
    const rc = t.getBoundingClientRect(), size = Math.max(rc.width, rc.height) * 2.2;
    const r = el("span", "ripple");
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rc.left - size / 2}px;top:${e.clientY - rc.top - size / 2}px`;
    t.appendChild(r); r.addEventListener("animationend", () => r.remove());
  }, true);
}

// ── menu ──
let current = null;
export const menuIsOpen = () => !!current;
export function closeMenu(immediate = false) {
  if (!current) return;
  const { menu, off } = current; current = null; off();
  if (immediate || document.documentElement.dataset.anim === "off") menu.remove();
  else { menu.classList.add("closing"); setTimeout(() => menu.remove(), 130); }
}
/** items: {label, icon, key, run, disabled, checked} | {sep:true} | {title:'..'} | {node: Element}
 *  anchor: Element or {x,y} */
export function openMenu(items, anchor, opts = {}) {
  closeMenu(true);
  const menu = el("div", "menu" + (opts.cls ? " " + opts.cls : "")); menu.setAttribute("role", "menu");
  let n = 0;
  for (const it of items) {
    if (it.sep) { menu.appendChild(el("div", "menu-sep")); continue; }
    if (it.title) { menu.appendChild(el("div", "menu-title")).textContent = it.title; continue; }
    if (it.node) { menu.appendChild(it.node); continue; }
    const b = el("button", "menu-item stagger"); b.setAttribute("role", "menuitem"); b.style.setProperty("--n", n++);
    b.innerHTML = `<span class="mc">${it.checked ? icon("check") : ""}</span>${it.icon ? `<span class="mi">${icon(it.icon)}</span>` : ""}<span class="ml"></span>${it.key ? `<span class="mk"></span>` : ""}`;
    b.querySelector(".ml").textContent = it.label; if (it.key) b.querySelector(".mk").textContent = it.key;
    if (!it.checked && !items.some((x) => x.checked !== undefined)) b.querySelector(".mc").remove();
    b.disabled = !!it.disabled;
    b.addEventListener("click", () => { closeMenu(); if (it.run) setTimeout(it.run, 0); });
    menu.appendChild(b);
  }
  layer().appendChild(menu);
  let x, y, ox = "0", oy = "0";
  const mw = menu.offsetWidth, mh = menu.offsetHeight, W = innerWidth, H = innerHeight;
  if (anchor instanceof Element) {
    const rc = anchor.getBoundingClientRect(); x = opts.right ? rc.right - mw : rc.left; y = rc.bottom + 4;
    if (y + mh > H - 8) { y = Math.max(8, rc.top - mh - 4); oy = "100%"; }
  } else { x = anchor.x; y = anchor.y; if (y + mh > H - 8) { y = Math.max(8, y - mh); oy = "100%"; } }
  if (x + mw > W - 8) { x = Math.max(8, W - mw - 8); ox = "100%"; }
  menu.style.left = x + "px"; menu.style.top = y + "px"; menu.style.setProperty("--ox", ox); menu.style.setProperty("--oy", oy);
  if (anchor instanceof Element) anchor.setAttribute("aria-expanded", "true");
  const onDown = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  const onKey = (e) => {
    if (e.key === "Escape") { closeMenu(); return; }
    const btns = [...menu.querySelectorAll(".menu-item:not(:disabled)")]; if (!btns.length) return;
    const i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
  };
  setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
  document.addEventListener("keydown", onKey, true); window.addEventListener("blur", closeMenu); window.addEventListener("resize", closeMenu);
  current = { menu, off: () => { document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("keydown", onKey, true); window.removeEventListener("blur", closeMenu); window.removeEventListener("resize", closeMenu); if (anchor instanceof Element) anchor.removeAttribute("aria-expanded"); if (opts.onClose) opts.onClose(); } };
  return menu;
}

// ── colour palette ──
function hslHex(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function paletteNode({ onPick, noneLabel, customLabel, current }) {
  const box = el("div", "pal"), grid = el("div", "pal-grid");
  const colors = [];
  for (let i = 0; i < 10; i++) { const v = Math.round(255 * (1 - i / 9)); colors.push("#" + v.toString(16).padStart(2, "0").repeat(3)); }
  const hues = [0, 28, 50, 125, 170, 205, 230, 272, 325, 18];
  for (const l of [90, 76, 60, 46, 32]) hues.forEach((h, i) => colors.push(hslHex(h, i === 9 ? 38 : 78, i === 9 ? l * 0.7 : l)));
  colors.forEach((c, i) => { const b = el("button", "sw"); b.style.background = c; b.style.setProperty("--n", i); b.title = c; b.addEventListener("click", () => { closeMenu(); onPick(c); }); grid.appendChild(b); });
  box.appendChild(grid);
  const row = el("div", "pal-row"), none = el("button", "btn tonal"); none.textContent = noneLabel;
  none.addEventListener("click", () => { closeMenu(); onPick(null); });
  const lab = el("span", "muted"); lab.textContent = customLabel;
  const inp = el("input"); inp.type = "color"; inp.value = current || "#1b6b3a";
  inp.addEventListener("change", () => { closeMenu(); onPick(inp.value); });
  row.append(none, el("span", "spacer"), lab, inp); box.appendChild(row);
  return box;
}

// ── dialog ──
let modals = 0, onModal = () => {};
export const setModalHandler = (fn) => (onModal = fn);
export const modalOpen = () => modals > 0;
export function dialog({ title, content, actions = [], size = "", dismissible = true, onClose }) {
  closeMenu(true);
  const scrim = el("div", "scrim"), d = el("div", "dialog " + size);
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
  if (title) d.appendChild(el("h2")).textContent = title;
  if (typeof content === "string") d.appendChild(el("p")).textContent = content; else if (content) d.appendChild(content);
  const bar = el("div", "actions");
  const api = { el: d, close };
  function close(result) {
    if (api.closed) return; api.closed = true;
    document.removeEventListener("keydown", onKey, true);
    modals--; onModal(modals);
    if (document.documentElement.dataset.anim === "off") scrim.remove(); else { scrim.classList.add("closing"); setTimeout(() => scrim.remove(), 180); }
    if (onClose) onClose(result);
  }
  for (const a of actions) {
    const b = el("button", "btn " + (a.primary ? "filled" : "text primary")); b.textContent = a.label;
    b.addEventListener("click", async () => { if (a.run) { const r = await a.run(api); if (r === false) return; } close(a.value); });
    bar.appendChild(b); a.btn = b;
  }
  if (actions.length) d.appendChild(bar);
  scrim.appendChild(d); layer().appendChild(scrim);
  const onKey = (e) => { if (e.key === "Escape" && dismissible) { e.stopPropagation(); close(undefined); } };
  document.addEventListener("keydown", onKey, true);
  scrim.addEventListener("mousedown", (e) => { if (e.target === scrim && dismissible) close(undefined); });
  modals++; onModal(modals);
  setTimeout(() => { const p = d.querySelector(".btn.filled") || d.querySelector("input,button"); if (p) p.focus({ preventScroll: true }); }, 60);
  return api;
}

// ── snackbar & busy ──
let snackTimer;
export function toast(msg, action, ms) {
  const s = $("#snack"), t = $("#snack-t"), a = $("#snack-a");
  t.textContent = msg;
  if (action) { a.hidden = false; a.textContent = action.label; a.onclick = () => { s.classList.remove("show"); action.run(); }; } else { a.hidden = true; a.onclick = null; }
  s.classList.add("show"); clearTimeout(snackTimer); snackTimer = setTimeout(() => s.classList.remove("show"), ms || (action ? 6500 : 3200));
}
let busyCount = 0;
export function busy(on) { busyCount = Math.max(0, busyCount + (on ? 1 : -1)); $("#busy").hidden = busyCount === 0; }

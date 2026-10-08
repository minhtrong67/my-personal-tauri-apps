// Material 3 colour roles generated from a seed colour (material-color-utilities), light / dark / system.
const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
export const PRESETS = [
  ["#1B6B3A", "green"], ["#0B6BCB", "blue"], ["#6750A4", "purple"], ["#006A60", "teal"],
  ["#B5451B", "orange"], ["#B8326B", "pink"], ["#BA1A1A", "red"], ["#8A6A00", "gold"], ["#4A5568", "slate"],
];
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
export const systemDark = () => darkQuery.matches;
export const onSystemTheme = (fn) => darkQuery.addEventListener("change", fn);
export const isDark = (mode) => mode === "dark" || (mode === "system" && darkQuery.matches);

export function applyColors(seed, mode) {
  const { themeFromSourceColor, argbFromHex, hexFromArgb } = window.MCU;
  const theme = themeFromSourceColor(argbFromHex(seed));
  const dark = isDark(mode);
  const scheme = (dark ? theme.schemes.dark : theme.schemes.light).toJSON();
  const root = document.documentElement, set = (k, v) => root.style.setProperty(k, v);
  for (const [k, v] of Object.entries(scheme)) set("--md-" + kebab(k), hexFromArgb(v));
  const n = theme.palettes.neutral, nv = theme.palettes.neutralVariant, h = (p, t) => hexFromArgb(p.tone(t));
  const T = dark ? { lowest: 4, low: 10, base: 12, high: 17, highest: 22 } : { lowest: 100, low: 96, base: 94, high: 92, highest: 90 };
  set("--md-surface-container-lowest", h(n, T.lowest)); set("--md-surface-container-low", h(n, T.low));
  set("--md-surface-container", h(n, T.base)); set("--md-surface-container-high", h(n, T.high)); set("--md-surface-container-highest", h(n, T.highest));
  set("--cell-bg", h(n, dark ? 8 : 100));
  set("--grid-line", h(nv, dark ? 24 : 88)); set("--grid-freeze", h(nv, dark ? 55 : 60));
  set("--hdr-bg", h(n, dark ? 14 : 95));
  root.dataset.scheme = dark ? "dark" : "light";
}

// Applies the theme; uses a circular-reveal View Transition when available and animations are enabled.
export function setTheme(seed, mode, { origin = null, animate = true, done = () => {} } = {}) {
  const run = () => { applyColors(seed, mode); done(); };
  if (!animate || !origin || !document.startViewTransition) { run(); return; }
  const vt = document.startViewTransition(run);
  vt.ready.then(() => {
    const { x, y } = origin, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 620, easing: "cubic-bezier(.2,0,0,1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(() => {});
}

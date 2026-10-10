import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

export const PRESETS = ['#0B57D0', '#6750A4', '#00796B', '#2E7D32', '#E65100', '#C2185B', '#BA1A1A', '#546E7A'];

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const mq = window.matchMedia('(prefers-color-scheme: dark)');
let last = null;
let timer = 0;

export const isDark = (mode) => mode === 'dark' || (mode === 'system' && mq.matches);

/** Generates a Material Design 3 scheme from a seed colour and writes it as CSS variables. */
export function applyTheme(settings, animate = false) {
  const key = settings.theme + settings.seed + mq.matches;
  if (key === last) return;
  last = key;

  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    clearTimeout(timer);
    timer = setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  const theme = themeFromSourceColor(argbFromHex(settings.seed));
  const dark = isDark(settings.theme);
  const scheme = (dark ? theme.schemes.dark : theme.schemes.light).toJSON();
  const css = {};
  for (const k in scheme) css['--md-' + kebab(k)] = hexFromArgb(scheme[k]);

  const n = theme.palettes.neutral;
  const tones = dark ? [4, 10, 12, 17, 22] : [100, 96, 94, 92, 90];
  ['surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest']
    .forEach((name, i) => (css['--md-' + name] = hexFromArgb(n.tone(tones[i]))));

  for (const k in css) root.style.setProperty(k, css[k]);
  root.dataset.scheme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function watchSystemTheme(getSettings) {
  mq.addEventListener('change', () => {
    if (getSettings().theme === 'system') applyTheme(getSettings(), true);
  });
}

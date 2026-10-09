// Material Design 3 style tonal palette generated from a seed colour (HSL approximation).
export const PRESETS = ['#6750a4', '#0b57d0', '#006a6a', '#2e7d32', '#c25e00', '#b3261e', '#9c3d8f', '#5f6368'];

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: Math.round(((h * 60) + 360) % 360), s: max + min === 0 || d === 0 ? 0 : d / (1 - Math.abs(max + min - 1)) };
}
const c = (h, s, l) => `hsl(${h} ${Math.round(Math.min(1, Math.max(0, s)) * 100)}% ${Math.round(l * 1000) / 10}%)`;

export function tokens(seed, dark) {
  const { h, s: s0 } = hexToHsl(seed);
  const s = Math.min(0.85, Math.max(0.35, s0));
  const n = Math.min(0.14, s * 0.2); // neutral tint
  if (!dark) {
    return {
      primary: c(h, s, 0.4), 'on-primary': '#fff', 'primary-container': c(h, s, 0.9), 'on-primary-container': c(h, s, 0.12),
      'secondary-container': c(h, s * 0.4, 0.89), 'on-secondary-container': c(h, s * 0.4, 0.14),
      surface: c(h, n * 1.4, 0.975), card: c(h, n, 0.995), 'surface-low': c(h, n * 1.3, 0.955),
      'surface-container': c(h, n * 1.3, 0.94), 'surface-container-high': c(h, n * 1.3, 0.92),
      'on-surface': c(h, n, 0.1), 'on-surface-variant': c(h, n, 0.3), outline: c(h, n * 0.8, 0.48),
      'outline-variant': c(h, n * 1.2, 0.84), error: '#b3261e', inverse: c(h, n, 0.2), 'inverse-on': c(h, n, 0.95),
    };
  }
  return {
    primary: c(h, s, 0.8), 'on-primary': c(h, s, 0.2), 'primary-container': c(h, s, 0.3), 'on-primary-container': c(h, s, 0.9),
    'secondary-container': c(h, s * 0.3, 0.3), 'on-secondary-container': c(h, s * 0.4, 0.9),
    surface: c(h, n, 0.075), card: c(h, n, 0.105), 'surface-low': c(h, n, 0.1),
    'surface-container': c(h, n, 0.125), 'surface-container-high': c(h, n, 0.165),
    'on-surface': c(h, n, 0.9), 'on-surface-variant': c(h, n, 0.78), outline: c(h, n * 0.8, 0.6),
    'outline-variant': c(h, n, 0.3), error: '#f2b8b5', inverse: c(h, n, 0.9), 'inverse-on': c(h, n, 0.15),
  };
}

const mq = window.matchMedia('(prefers-color-scheme: dark)');
let current = { theme: 'system', seed: PRESETS[0] };

export function applyTheme({ theme, seed }) {
  current = { theme, seed };
  const dark = theme === 'dark' || (theme === 'system' && mq.matches);
  const root = document.documentElement;
  const tk = tokens(seed, dark);
  for (const k in tk) root.style.setProperty('--' + k, tk[k]);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
}
mq.addEventListener('change', () => current.theme === 'system' && applyTheme(current));

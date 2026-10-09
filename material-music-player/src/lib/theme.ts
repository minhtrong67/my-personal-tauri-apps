import {
  CorePalette,
  TonalPalette,
  argbFromHex,
  blueFromArgb,
  greenFromArgb,
  redFromArgb,
} from '@material/material-color-utilities';
import type { ThemeMode } from './types';

export const SEED_PRESETS = ['#6750A4', '#0B6BCB', '#00796B', '#2E7D32', '#E65100', '#C2185B', '#B3261E', '#5D4037'];

const rgb = (argb: number) => `${redFromArgb(argb)} ${greenFromArgb(argb)} ${blueFromArgb(argb)}`;

/** Sinh bộ token Material 3 (baseline tone mapping) từ màu hạt giống */
export function buildTokens(seedHex: string, dark: boolean): Record<string, string> {
  const p = CorePalette.of(argbFromHex(seedHex));
  const t = (pal: TonalPalette, light: number, dk: number) => rgb(pal.tone(dark ? dk : light));
  const { a1, a2, a3, n1, n2, error: e } = p;
  return {
    primary: t(a1, 40, 80),
    'on-primary': t(a1, 100, 20),
    'primary-container': t(a1, 90, 30),
    'on-primary-container': t(a1, 10, 90),
    secondary: t(a2, 40, 80),
    'on-secondary': t(a2, 100, 20),
    'secondary-container': t(a2, 90, 30),
    'on-secondary-container': t(a2, 10, 90),
    tertiary: t(a3, 40, 80),
    'on-tertiary': t(a3, 100, 20),
    'tertiary-container': t(a3, 90, 30),
    'on-tertiary-container': t(a3, 10, 90),
    error: t(e, 40, 80),
    'on-error': t(e, 100, 20),
    'error-container': t(e, 90, 30),
    'on-error-container': t(e, 10, 90),
    surface: t(n1, 98, 6),
    'surface-dim': t(n1, 87, 6),
    'surface-bright': t(n1, 98, 24),
    'surface-variant': t(n2, 90, 30),
    'surface-container-lowest': t(n1, 100, 4),
    'surface-container-low': t(n1, 96, 10),
    'surface-container': t(n1, 94, 12),
    'surface-container-high': t(n1, 92, 17),
    'surface-container-highest': t(n1, 90, 22),
    'on-surface': t(n1, 10, 90),
    'on-surface-variant': t(n2, 30, 80),
    outline: t(n2, 50, 60),
    'outline-variant': t(n2, 80, 30),
    'inverse-surface': t(n1, 20, 90),
    'inverse-on-surface': t(n1, 95, 20),
    'inverse-primary': t(a1, 80, 40),
  };
}

export function isDarkMode(mode: ThemeMode) {
  return mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function applyTheme(seedHex: string, mode: ThemeMode) {
  const dark = isDarkMode(mode);
  const tokens = buildTokens(seedHex, dark);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--md-${k}`, v);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

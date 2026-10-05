// Material Design 3 dynamic color (approximation).
// Builds tonal palettes from a seed color in CIE LCH(ab) space and maps them to
// the MD3 color roles for light and dark schemes.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

const toLinear = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLinear = (c) => {
  c = clamp01(c);
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
};

const WHITE = [0.95047, 1.0, 1.08883];
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);

function rgbToLch(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0];
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

function lchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const X = fInv(fx) * WHITE[0];
  const Y = L > 8 ? Math.pow(fy, 3) : L / 903.3;
  const Z = fInv(fz) * WHITE[2];
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

const inGamut = (v) => v.every((c) => c >= -0.0005 && c <= 1.0005);

/** Color at lightness `tone` (0-100) with the highest chroma ≤ `chroma` that fits sRGB. */
export function tone(hue, chroma, t) {
  if (t <= 0) return '#000000';
  if (t >= 100) return '#ffffff';
  let lo = 0, hi = chroma;
  let lin = lchToLinear(t, hi, hue);
  if (!inGamut(lin)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToLinear(t, mid, hue))) lo = mid;
      else hi = mid;
    }
    lin = lchToLinear(t, lo, hue);
  }
  return rgbToHex(lin.map(fromLinear));
}

export const SWATCHES = [
  { name: 'Violet', hex: '#6750A4' },
  { name: 'Blue', hex: '#1B6EF3' },
  { name: 'Teal', hex: '#00796B' },
  { name: 'Green', hex: '#3B7D2C' },
  { name: 'Amber', hex: '#B26A00' },
  { name: 'Rose', hex: '#C2185B' },
  { name: 'Slate', hex: '#546E7A' },
];

/** Returns a { cssVar: color } map for the given seed and scheme. */
export function buildScheme(seedHex, dark) {
  const rgb = hexToRgb(seedHex) || hexToRgb('#6750A4');
  const hue = rgbToLch(rgb).h;
  const P = (t) => tone(hue, 48, t);
  const S = (t) => tone(hue, 16, t);
  const T = (t) => tone((hue + 60) % 360, 24, t);
  const N = (t) => tone(hue, 4, t);
  const NV = (t) => tone(hue, 8, t);

  const m = dark
    ? {
        primary: P(80), 'on-primary': P(20), 'primary-container': P(30), 'on-primary-container': P(90),
        secondary: S(80), 'on-secondary': S(20), 'secondary-container': S(30), 'on-secondary-container': S(90),
        tertiary: T(80), 'on-tertiary': T(20), 'tertiary-container': T(30), 'on-tertiary-container': T(90),
        error: '#F2B8B5', 'on-error': '#601410', 'error-container': '#8C1D18', 'on-error-container': '#F9DEDC',
        background: N(6), 'on-background': N(90),
        surface: N(6), 'on-surface': N(90), 'surface-variant': NV(30), 'on-surface-variant': NV(80),
        outline: NV(60), 'outline-variant': NV(30),
        'surface-container-lowest': N(4), 'surface-container-low': N(10), 'surface-container': N(12),
        'surface-container-high': N(17), 'surface-container-highest': N(22),
        'inverse-surface': N(90), 'inverse-on-surface': N(20), 'inverse-primary': P(40),
      }
    : {
        primary: P(40), 'on-primary': '#ffffff', 'primary-container': P(90), 'on-primary-container': P(10),
        secondary: S(40), 'on-secondary': '#ffffff', 'secondary-container': S(90), 'on-secondary-container': S(10),
        tertiary: T(40), 'on-tertiary': '#ffffff', 'tertiary-container': T(90), 'on-tertiary-container': T(10),
        error: '#B3261E', 'on-error': '#ffffff', 'error-container': '#F9DEDC', 'on-error-container': '#410E0B',
        background: N(98), 'on-background': N(10),
        surface: N(98), 'on-surface': N(10), 'surface-variant': NV(90), 'on-surface-variant': NV(30),
        outline: NV(50), 'outline-variant': NV(80),
        'surface-container-lowest': '#ffffff', 'surface-container-low': N(96), 'surface-container': N(94),
        'surface-container-high': N(92), 'surface-container-highest': N(90),
        'inverse-surface': N(20), 'inverse-on-surface': N(95), 'inverse-primary': P(80),
      };
  return m;
}

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveDark(mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return !!(mq && mq.matches);
}

/** Applies mode ('light' | 'dark' | 'system') and seed color to the document. */
export function applyTheme(mode, seed) {
  const dark = resolveDark(mode);
  const root = document.documentElement;
  const scheme = buildScheme(seed, dark);
  for (const [k, v] of Object.entries(scheme)) root.style.setProperty('--md-' + k, v);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = scheme.surface;
}

/** Re-applies the theme when the OS scheme changes (only matters in 'system' mode). */
export function watchSystemTheme(cb) {
  if (!mq) return;
  const h = () => cb();
  if (mq.addEventListener) mq.addEventListener('change', h);
  else if (mq.addListener) mq.addListener(h);
}

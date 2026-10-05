/* Material Note - Material Design 3 theming
 *
 * A seed color is converted to OKLCH. Its hue and chroma drive a set of CSS
 * custom properties (--h, --c); styles.css maps them to the M3 color roles
 * (primary, secondary-container, surface-container...) using oklch() tones.
 */
const Theme = (() => {
  const PRESETS = ['#6750A4', '#1A73E8', '#00796B', '#2E7D32', '#C25E00', '#B3261E', '#C2185B', '#546E7A'];

  function hexToOklch(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const r = lin(((n >> 16) & 255) / 255);
    const g = lin(((n >> 8) & 255) / 255);
    const b = lin((n & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { c: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
  }

  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark(mode) {
    return mode === 'dark' || (mode === 'system' && mq.matches);
  }

  function apply(settings, appWindow) {
    const root = document.documentElement;
    const { c, h } = hexToOklch(/^#[0-9a-f]{6}$/i.test(settings.seed) ? settings.seed : PRESETS[0]);
    root.style.setProperty('--h', h.toFixed(1));
    root.style.setProperty('--c', Math.min(0.16, Math.max(0.025, c)).toFixed(3));
    root.dataset.scheme = isDark(settings.theme) ? 'dark' : 'light';
    if (appWindow && appWindow.setTheme) {
      Promise.resolve(appWindow.setTheme(settings.theme === 'system' ? null : settings.theme)).catch(() => {});
    }
  }

  return {
    PRESETS,
    apply,
    onSystemChange(cb) { mq.addEventListener('change', cb); }
  };
})();

// Persistent user settings (localStorage). Nested objects are merged so new keys get their defaults.
const KEY = 'mve.settings.v1';

export const DEFAULTS = {
  theme: 'system', seed: '#6750A4', lang: 'auto', vol: 1,
  start: 'remember', // window on launch: remember | maximized | fullscreen
  layout: { left: 340, right: 320, tl: 296 },
  home: { view: 'grid', sort: 'recent' },
  proxy: true, // smooth-preview proxies for 2K/4K videos
  export: { format: 'mp4', res: '1080', fps: '60', q: 'high', mode: 'fast', dir: '', lastDir: '' },
};

export const settings = JSON.parse(JSON.stringify(DEFAULTS));
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && settings[k] && typeof settings[k] === 'object') Object.assign(settings[k], v);
    else settings[k] = v;
  }
} catch { /* ignore broken settings */ }

export const saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

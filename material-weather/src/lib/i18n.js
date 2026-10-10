import en from '../locales/en.js';
import vi from '../locales/vi.js';

const dict = { en, vi };
let current = 'en';

export const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];

export function setLang(l) {
  current = dict[l] ? l : 'en';
  document.documentElement.lang = current;
}
export const getLang = () => current;
export const locale = () => (current === 'vi' ? 'vi-VN' : 'en-US');

export function t(key, vars) {
  let s = dict[current][key] ?? dict.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

const KNOWN = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
/** Description for a WMO weather code (falls back to the nearest known lower code). */
export function wmoText(code) {
  let c = KNOWN.includes(code) ? code : [...KNOWN].reverse().find((k) => k <= code) ?? 0;
  return t('wmo.' + c);
}

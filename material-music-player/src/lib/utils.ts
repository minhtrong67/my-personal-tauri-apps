import { tr } from './i18n';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const basename = (p: string) => {
  const s = p.replace(/[\\/]+$/, '');
  const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return i >= 0 ? s.slice(i + 1) : s;
};

export const dirname = (p: string) => {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i >= 0 ? p.slice(0, i) : '';
};

export const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function fmtLong(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return tr('hoursMinutes', { h, m });
  return tr('minutesOnly', { m: Math.max(1, m) });
}

export function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Bỏ dấu tiếng Việt và chữ hoa để tìm kiếm */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

export function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return tr('greetLate');
  if (h < 11) return tr('greetMorning');
  if (h < 14) return tr('greetNoon');
  if (h < 18) return tr('greetAfternoon');
  return tr('greetEvening');
}

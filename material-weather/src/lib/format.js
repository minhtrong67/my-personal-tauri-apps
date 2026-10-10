import { getLang, locale, t } from './i18n.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const deg = (v) => (v == null ? '–' : Math.round(v) + '°');

export function kindOf(code) {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

/** CSS class for the hero sky gradient. */
export const skyClass = (code, isDay) => {
  const k = kindOf(code);
  if (k === 'clear' || k === 'partly') return `sky-clear-${isDay ? 'day' : 'night'}`;
  if (k === 'cloudy') return `sky-cloudy-${isDay ? 'day' : 'night'}`;
  if (k === 'drizzle') return 'sky-rain';
  return 'sky-' + k;
};

const mins = (s) => +s.slice(11, 13) * 60 + +s.slice(14, 16);

export function fmtHour(time) {
  const h = +time.slice(11, 13);
  return getLang() === 'vi' ? `${h}h` : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtClock(time) {
  const h = +time.slice(11, 13);
  const m = time.slice(14, 16);
  return getLang() === 'vi' ? `${String(h).padStart(2, '0')}:${m}` : `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}
export function dayName(date, i) {
  if (i === 0) return t('day.today');
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: 'short' });
}
/** Local date/time at the place (uses the API's UTC offset, not the PC's zone). */
export function placeNow(model) {
  return new Date(Date.now() + model.utcOffset * 1000);
}
export function fmtPlaceDateTime(model) {
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: getLang() !== 'vi', timeZone: 'UTC',
  }).format(placeNow(model));
}
export function fmtUpdated(ts) {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: getLang() !== 'vi' }).format(new Date(ts));
}

export const windLabel = (u) => ({ kmh: 'km/h', ms: 'm/s', mph: 'mph' })[u] || u;
export function compass(d) {
  const k = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
  return t('dir.' + k);
}
export function uvInfo(v) {
  if (v == null) return { key: 'uv.low', color: '#9aa0a6' };
  if (v < 3) return { key: 'uv.low', color: '#43a047' };
  if (v < 6) return { key: 'uv.moderate', color: '#f9a825' };
  if (v < 8) return { key: 'uv.high', color: '#fb8c00' };
  if (v < 11) return { key: 'uv.veryHigh', color: '#e53935' };
  return { key: 'uv.extreme', color: '#8e24aa' };
}
export function aqiInfo(v) {
  if (v <= 50) return { key: 'aqi.good', color: '#43a047' };
  if (v <= 100) return { key: 'aqi.moderate', color: '#f9a825' };
  if (v <= 150) return { key: 'aqi.sensitive', color: '#fb8c00' };
  if (v <= 200) return { key: 'aqi.unhealthy', color: '#e53935' };
  if (v <= 300) return { key: 'aqi.veryUnhealthy', color: '#8e24aa' };
  return { key: 'aqi.hazardous', color: '#7b1f3a' };
}
/** Sun position 0..1 between sunrise and sunset (null outside daylight). */
export function sunProgress(nowTime, sunrise, sunset) {
  const n = mins(nowTime), a = mins(sunrise), b = mins(sunset);
  return n < a || n > b ? null : (n - a) / Math.max(b - a, 1);
}
export const daylight = (sunrise, sunset) => {
  const m = mins(sunset) - mins(sunrise);
  return { h: Math.floor(m / 60), m: m % 60 };
};
export const placeSub = (p) => [p.admin, p.country].filter(Boolean).join(', ');

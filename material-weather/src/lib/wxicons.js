import { kindOf } from './format.js';

let uid = 0;
const cloudShape = (fill) =>
  `<g fill="${fill}"><circle cx="22" cy="38" r="10"/><circle cx="34" cy="29" r="13"/><circle cx="47" cy="39" r="9"/><rect x="22" y="38" width="25" height="10"/></g>`;
const cloud = (x, y, s, fill = 'var(--wx-cloud)') => `<g transform="translate(${x} ${y}) scale(${s})">${cloudShape(fill)}</g>`;

function sun(cx, cy, r) {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a), s = Math.sin(a);
    rays += `<line x1="${(cx + c * (r + 4)).toFixed(1)}" y1="${(cy + s * (r + 4)).toFixed(1)}" x2="${(cx + c * (r + 9)).toFixed(1)}" y2="${(cy + s * (r + 9)).toFixed(1)}"/>`;
  }
  return `<g class="wx-spin" style="transform-origin:${cx}px ${cy}px"><g stroke="#FFB300" stroke-width="3" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFC107"/></g>`;
}
function moon(cx, cy, r) {
  // crescent = big circle minus an offset circle, drawn as a path (no masks -> renders everywhere)
  const ox = cx + r * 0.6, oy = cy - r * 0.5, r1 = r * 0.85;
  const dx = ox - cx, dy = oy - cy, d = Math.hypot(dx, dy);
  const a = (r * r - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(Math.max(r * r - a * a, 0));
  const mx = cx + (a * dx) / d, my = cy + (a * dy) / d;
  const p1 = [mx + (h * dy) / d, my - (h * dx) / d], p2 = [mx - (h * dy) / d, my + (h * dx) / d];
  const f = (p) => p.map((v) => v.toFixed(1)).join(' ');
  return `<path d="M${f(p1)} A${r} ${r} 0 1 0 ${f(p2)} A${r1} ${r1} 0 0 1 ${f(p1)}Z" fill="#FFE082"/>`;
}
const drops = (color = '#4FC3F7') =>
  [24, 34, 44].map((x, i) => `<line class="wx-drop" style="animation-delay:${i * 0.25}s" x1="${x}" y1="50" x2="${x - 3}" y2="57" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`).join('');
const flakes = () =>
  [24, 34, 44].map((x, i) => `<circle class="wx-flake" style="animation-delay:${i * 0.5}s" cx="${x}" cy="53" r="2.6" fill="#90CAF9"/>`).join('');

/** Weather icon as inline SVG. `animated` adds the CSS motion (used on the hero only). */
export function wxIcon(code, isDay, size = 40, animated = false) {
  const k = kindOf(code);
  let body;
  switch (k) {
    case 'clear': body = isDay ? sun(32, 32, 12) : moon(32, 32, 17); break;
    case 'partly': body = (isDay ? sun(24, 24, 9) : moon(24, 24, 11)) + cloud(6, 10, 0.95); break;
    case 'cloudy': body = cloud(-4, -6, 0.85, 'var(--wx-cloud2)') + cloud(8, 6, 1); break;
    case 'fog': body = cloud(0, -6, 1) + `<g stroke="var(--wx-cloud)" stroke-width="3" stroke-linecap="round"><line x1="14" y1="47" x2="50" y2="47"/><line x1="20" y1="54" x2="56" y2="54"/></g>`; break;
    case 'drizzle': case 'rain': body = cloud(0, -6, 1) + drops(); break;
    case 'snow': body = cloud(0, -6, 1) + flakes(); break;
    default: body = cloud(0, -9, 1, 'var(--wx-cloud2)') + `<polygon class="wx-bolt" points="35,36 27,49 33,49 30,60 42,44 36,44 39,36" fill="#FFC107"/>`;
  }
  return `<svg class="wx ${animated ? 'wx-anim' : ''}" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-hidden="true"><g class="wx-float">${body}</g></svg>`;
}

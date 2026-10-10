import { kindOf } from './format.js';

/** Lightweight canvas weather effects (rain / snow / clouds / stars / sun glow / lightning). */
export function createFX(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, raf = 0, last = 0, running = false;
  let enabled = true, kind = 'clear', day = true, flash = 0, nextFlash = 0;
  let drops = [], flakes = [], stars = [], clouds = [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rnd = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    drops = []; flakes = []; stars = []; clouds = [];
    const rainN = { drizzle: 60, rain: 130, storm: 190 }[kind] || 0;
    for (let i = 0; i < rainN; i++) drops.push({ x: rnd(-40, w + 40), y: rnd(0, h), l: rnd(10, 22), v: rnd(520, 820) });
    if (kind === 'snow') for (let i = 0; i < 90; i++) flakes.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(1.2, 3.4), v: rnd(30, 70), ph: rnd(0, 6.28) });
    if (!day && (kind === 'clear' || kind === 'partly')) for (let i = 0; i < 70; i++) stars.push({ x: rnd(0, w), y: rnd(0, h * 0.8), r: rnd(0.5, 1.6), ph: rnd(0, 6.28) });
    const cn = { clear: 0, partly: 3, cloudy: 6, fog: 7, drizzle: 5, rain: 6, snow: 5, storm: 6 }[kind] || 0;
    for (let i = 0; i < cn; i++)
      clouds.push({ x: rnd(-100, w), y: rnd(-20, h * 0.7), s: rnd(0.8, 1.6), v: rnd(6, 18), a: kind === 'fog' ? rnd(0.12, 0.2) : rnd(0.1, 0.22) });
  }

  function drawCloud(c) {
    const r = 70 * c.s;
    for (const [dx, dy, k] of [[0, 0, 1], [r * 0.8, r * 0.15, 0.8], [-r * 0.8, r * 0.2, 0.75], [r * 0.35, -r * 0.3, 0.8]]) {
      const g = ctx.createRadialGradient(c.x + dx, c.y + dy, 0, c.x + dx, c.y + dy, r * k);
      g.addColorStop(0, `rgba(255,255,255,${c.a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x + dx - r * k, c.y + dy - r * k, r * 2 * k, r * 2 * k);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    if (dt < 0.028) return; // ~35 fps cap keeps CPU low
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);

    if (kind === 'clear' && day) {
      const gx = w * 0.82, gy = h * 0.22, r = Math.max(w, h) * (0.45 + Math.sin(t * 0.8) * 0.02);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(255,236,160,.55)'); g.addColorStop(1, 'rgba(255,236,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.2 + s.ph));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - 150 * c.s > w) c.x = -150 * c.s;
      drawCloud(c);
    }
    if (drops.length) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath();
      for (const d of drops) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.18;
        if (d.y > h) { d.y = -d.l; d.x = rnd(0, w + 60); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l);
      }
      ctx.stroke();
    }
    if (flakes.length) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath();
      for (const f of flakes) {
        f.y += f.v * dt; f.x += Math.sin(t + f.ph) * 20 * dt;
        if (f.y > h + 5) { f.y = -5; f.x = rnd(0, w); }
        ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 6.283);
      }
      ctx.fill();
    }
    if (kind === 'storm') {
      if (t > nextFlash) { flash = 1; nextFlash = t + rnd(4, 9); }
      if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, w, h); flash *= 0.88; }
    }
  }

  const canRun = () => enabled && !reduce.matches && !document.hidden && w > 0;
  function sync() {
    if (canRun() && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!canRun() && running) { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); }
  }

  new ResizeObserver(() => { resize(); sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);

  return {
    set(code, isDay) { kind = kindOf(code); day = isDay; build(); sync(); },
    enable(v) { enabled = v; sync(); },
  };
}

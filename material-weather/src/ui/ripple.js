/** Material ripple: any element with the .ripple class gets a touch/click wave. */
export function initRipple() {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('.ripple');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  });
}

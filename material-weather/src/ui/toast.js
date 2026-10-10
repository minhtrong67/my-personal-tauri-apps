let el = null;
let timer = 0;

export function toast(message, { action, onAction, duration = 4200 } = {}) {
  const layer = document.getElementById('layer');
  el?.remove();
  clearTimeout(timer);
  el = document.createElement('div');
  el.className = 'snackbar';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span></span>${action ? '<button class="snack-action ripple"></button>' : ''}`;
  el.firstChild.textContent = message;
  if (action) {
    const b = el.querySelector('button');
    b.textContent = action;
    b.onclick = () => { onAction?.(); hide(el); };
  }
  layer.appendChild(el);
  const mine = el;
  timer = setTimeout(() => hide(mine), duration);
}
function hide(node) {
  if (!node || !node.isConnected) return;
  node.classList.add('out');
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

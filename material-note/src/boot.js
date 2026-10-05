/* Runs in <head> before the first paint: applies the saved theme immediately so the
   window never flashes white/light, and suppresses transitions during start-up. */
(function () {
  var s = {};
  try { s = JSON.parse(localStorage.getItem('material-note.settings')) || {}; } catch (e) {}
  Theme.apply({ theme: s.theme || 'system', seed: s.seed || '#6750A4' }, null);
  document.documentElement.classList.add('booting');
})();

// Applies the saved theme before first paint. Kept as an external file so the
// Content-Security-Policy never needs 'unsafe-inline'. Mirrors src/hooks/useTheme.js.
(function () {
  var pref = 'system';
  try {
    pref = localStorage.getItem('bd-discovery-passport:theme') || 'system';
  } catch {
    /* storage blocked: follow the system */
  }
  var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

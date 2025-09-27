// theme-toggle.js
// No layout changes. Adds a simple function to flip theme and persist.
(function () {
  const KEY = 'prefers-theme';
  const saved = localStorage.getItem(KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
  };
})();
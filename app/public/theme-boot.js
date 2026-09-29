/* Applies the saved theme before the first paint (a file, not inline code,
   so the Content Security Policy can forbid inline scripts). Mirrors
   src/theme/theme.ts. */
(function () {
  var choice = 'chronicle';
  try {
    var v = localStorage.getItem('mordheim-theme');
    if (v === 'chronicle' || v === 'parchment' || v === 'system') choice = v;
  } catch (e) { /* storage blocked */ }
  if (choice === 'system') {
    choice = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'parchment' : 'chronicle';
  }
  document.documentElement.setAttribute('data-theme', choice);
})();

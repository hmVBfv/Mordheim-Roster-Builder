/* Shared behaviour of the mockups: the theme strip, sheets that open from
   the bottom, segmented choices and short notices. Nothing is stored except
   the chosen theme, and that only in this browser. */
(function () {
  var KEY = 'mordheim-mockup-theme';

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch { /* private window */ }
    document.querySelectorAll('.mock .themes button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === t));
    });
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private window */ }
  var initial = saved === 'parchment' ? 'parchment' : 'chronicle';
  // loaded in <head>: colour the page now, mark the buttons once they exist
  document.documentElement.setAttribute('data-theme', initial);
  document.addEventListener('DOMContentLoaded', function () { setTheme(initial); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme]');
    if (t && t.closest('.mock')) { setTheme(t.dataset.theme); return; }

    var open = e.target.closest('[data-open]');
    if (open) {
      var d = document.getElementById(open.dataset.open);
      if (d && typeof d.showModal === 'function') openSheet(d);
      return;
    }
    var close = e.target.closest('[data-close]');
    if (close) { var dlg = close.closest('dialog'); if (dlg) dlg.close(); return; }

    var seg = e.target.closest('.seg button, .pick button');
    if (seg && !seg.hasAttribute('data-multi')) {
      seg.parentElement.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === seg)); });
      seg.parentElement.dispatchEvent(new CustomEvent('choose', { detail: seg.dataset.value, bubbles: true }));
    }
  });

  // a tap on the dimmed area closes a sheet
  document.addEventListener('click', function (e) {
    if (e.target.tagName === 'DIALOG') e.target.close();
  });

  // Back closes a sheet instead of leaving the page (as in the app,
  // app/src/ui/useSheet.ts): opening adds a history entry, closing any other
  // way takes it away again
  var leaving = false;
  function openSheet(d) {
    if (d.open) return;
    history.pushState({ sheet: true }, '');
    d.showModal();
    if (!d.dataset.watched) {
      d.dataset.watched = '1';
      d.addEventListener('close', function () {
        if (d.dataset.byBack) { delete d.dataset.byBack; return; }
        if (history.state && history.state.sheet) { leaving = true; history.back(); }
      });
    }
  }
  window.addEventListener('popstate', function () {
    if (leaving) { leaving = false; return; }
    var d = document.querySelector('dialog[open]');
    if (d) { d.dataset.byBack = '1'; d.close(); }
  });

  // the bottom navigation of the campaign app (docs/ui.md §2)
  var ICONS = {
    Home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    Warbands: '<path d="M6 3v18"/><path d="M6 4h12l-3 4 3 4H6"/>',
    Campaign: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    Notes: '<path d="M20 4c-6 0-11 5-12 12l-2 4"/><path d="M8 16c4 0 8-3 9-8"/>',
    More: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
  };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('nav.nav[data-current]').forEach(function (nav) {
      nav.setAttribute('aria-label', 'Main');
      nav.innerHTML = Object.keys(ICONS).map(function (k) {
        return '<a href="#"' + (nav.dataset.current === k ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>' + k + '</a>';
      }).join('');
    });
  });

  // the notice goes after five seconds, can be dismissed, and only its
  // buttons catch taps (Rob, 28.09.2026: undo notices must not stand in the way)
  var timer = null;
  window.mockToast = function (text, undo) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.querySelector('span').textContent = text;
    var b = el.querySelector('button');
    b.hidden = !undo;
    b.onclick = function () { el.hidden = true; if (undo) undo(); };
    var x = el.querySelector('.toast-x');
    if (!x) {
      x = document.createElement('button');
      x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '\u2715';
      el.appendChild(x);
    }
    x.onclick = function () { el.hidden = true; clearTimeout(timer); };
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { el.hidden = true; }, 5000);
  };
})();

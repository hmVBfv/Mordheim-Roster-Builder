/* Shared behaviour of the mockups: the theme strip, sheets that open from
   the bottom, segmented choices, the bottom navigation and the tabs of a
   section, short notices and pixel pictures. Nothing is stored except the
   chosen theme, and that only in this browser. */
(function () {
  var KEY = 'mordheim-mockup-theme';

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch { /* private window */ }
    document.querySelectorAll('.mock .themes button, [data-set-theme]').forEach(function (b) {
      var v = b.dataset.theme || b.dataset.setTheme;
      if (b.matches('input')) b.checked = v === t; else b.setAttribute('aria-pressed', String(v === t));
    });
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private window */ }
  var initial = saved === 'parchment' ? 'parchment' : 'chronicle';
  // loaded in <head>: colour the page now, mark the buttons once they exist
  document.documentElement.setAttribute('data-theme', initial);
  document.addEventListener('DOMContentLoaded', function () { setTheme(initial); });
  window.mockTheme = setTheme;

  /* ---------- sheets ---------- */

  // Back closes a sheet instead of leaving the page (as in the app,
  // app/src/ui/useSheet.ts): opening adds a history entry, closing any other
  // way takes it away again. A sheet opened from another sheet takes the
  // other's place and its history entry.
  var leaving = false, pendingHref = null;
  function watch(d) {
    if (d.dataset.watched) return;
    d.dataset.watched = '1';
    d.addEventListener('close', function () {
      if (d.dataset.byBack) { delete d.dataset.byBack; return; }
      if (leaving) return; // a step back is already on its way
      if (history.state && history.state.sheet) { leaving = true; history.back(); }
      else if (pendingHref) go();
    });
  }
  function openSheet(d) {
    if (d.open) return;
    var other = document.querySelector('dialog[open]');
    if (other) { other.dataset.byBack = '1'; other.close(); } else history.pushState({ sheet: true }, '');
    watch(d);
    d.showModal();
  }
  function go() { var h = pendingHref; pendingHref = null; if (h) location.href = h; }
  // for page scripts that open a sheet themselves
  window.mockOpen = function (id) { var d = document.getElementById(id); if (d && typeof d.showModal === 'function') openSheet(d); };
  window.addEventListener('popstate', function () {
    if (leaving) { leaving = false; go(); return; }
    var d = document.querySelector('dialog[open]');
    if (d) { d.dataset.byBack = '1'; d.close(); }
  });
  // coming back to a page from the cache: no sheet is left standing open
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    leaving = false; pendingHref = null;
    document.querySelectorAll('dialog[open]').forEach(function (d) { d.dataset.byBack = '1'; d.close(); });
  });

  // A link followed while a sheet is open, or while its history entry is still
  // there (the dialog's close event comes a moment later), goes only after
  // that entry is gone; otherwise the step back cancels the new page (the ←
  // that sometimes did nothing, Rob 29.09.2026).
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || a.target || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    var open = document.querySelector('dialog[open]');
    var entry = history.state && history.state.sheet;
    if (!open && !leaving && !entry) return;
    e.preventDefault();
    pendingHref = a.href;
    if (open) open.close(); // its close handler steps back, then we go
    else if (!leaving) { leaving = true; history.back(); }
  }, true);

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
    if (seg && !seg.disabled) {
      if (seg.hasAttribute('data-multi')) {
        seg.setAttribute('aria-pressed', String(seg.getAttribute('aria-pressed') !== 'true'));
      } else {
        seg.parentElement.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === seg)); });
      }
      seg.parentElement.dispatchEvent(new CustomEvent('choose', { detail: seg.dataset.value, bubbles: true }));
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-set-theme]');
    if (t && t.checked) setTheme(t.dataset.setTheme);
  });

  // a tap on the dimmed area closes a sheet
  document.addEventListener('click', function (e) {
    if (e.target.tagName === 'DIALOG') e.target.close();
  });

  /* ---------- navigation ---------- */

  // the bottom navigation of the campaign app (docs/ui.md §2)
  var ICONS = {
    Home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    Warbands: '<path d="M6 3v18"/><path d="M6 4h12l-3 4 3 4H6"/>',
    Campaign: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    Notes: '<path d="M20 4c-6 0-11 5-12 12l-2 4"/><path d="M8 16c4 0 8-3 9-8"/>',
    More: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
  };
  var PLACES = { Home: 'home.html', Warbands: 'warbands.html', Campaign: 'campaign.html', Notes: 'visibility.html', More: 'more.html' };
  // the tabs of a warband and of a campaign (docs/ui.md §2); ⚑ = leaders only
  var TABS = {
    warband: [['Roster', 'roster.html'], ['Story', 'story.html'], ['Versions', 'changes.html']],
    campaign: [['Overview', 'campaign.html'], ['Notes', 'visibility.html'], ['Timeline', 'timeline.html'], ['World', 'world.html'], ['Background ⚑', 'background.html'], ['Manage ⚑', 'manage.html']]
  };
  document.addEventListener('DOMContentLoaded', function () {
    // the bar at the bottom, and the same places in the desktop's sidebar
    document.querySelectorAll('nav.nav[data-current], nav.side-nav[data-current]').forEach(function (nav) {
      if (!nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'Main');
      nav.innerHTML = Object.keys(ICONS).map(function (k) {
        return '<a href="' + PLACES[k] + '"' + (nav.dataset.current === k ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>' + k + '</a>';
      }).join('');
    });
    document.querySelectorAll('nav.tabs[data-tabs]').forEach(function (nav) {
      var cur = nav.dataset.current;
      nav.innerHTML = TABS[nav.dataset.tabs].map(function (t) {
        return '<a href="' + t[1] + '"' + (t[0].replace(' ⚑', '') === cur ? ' aria-current="page"' : '') + '>' + t[0] + '</a>';
      }).join('');
      // the current tab in view, with the one before it whole
      var here = nav.querySelector('[aria-current]'), prev = here && here.previousElementSibling;
      if (here) nav.scrollLeft = prev ? Math.max(0, prev.offsetLeft - nav.offsetLeft - 8) : 0;
    });
  });

  /* ---------- notices ---------- */

  // the notice goes after five seconds, can be dismissed, and only its
  // buttons catch taps (Rob, 28.09.2026: undo notices must not stand in the way)
  var timer = null;
  window.mockToast = function (text, undo) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast'; el.id = 'toast'; el.setAttribute('role', 'status'); el.hidden = true;
      el.innerHTML = '<span></span><button type="button" class="btn-quiet">Undo</button>';
      document.body.appendChild(el);
    }
    el.querySelector('span').textContent = text;
    var b = el.querySelector('button');
    b.hidden = !undo;
    b.onclick = function () { el.hidden = true; if (undo) undo(); };
    var x = el.querySelector('.toast-x');
    if (!x) {
      x = document.createElement('button');
      x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '✕';
      el.appendChild(x);
    }
    x.onclick = function () { el.hidden = true; clearTimeout(timer); };
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { el.hidden = true; }, 5000);
  };

  /* ---------- pixel pictures ---------- */

  // Draws frames of a character map into an <svg>: one <g class="fA|fB|…">
  // per frame, runs of one colour merged into one rect. '.' is transparent.
  // The page's CSS decides which frame shows when (and shows only the first
  // when the phone asks for less motion).
  window.mockPixel = function (svg, palette, frames, width) {
    var out = '';
    Object.keys(frames).forEach(function (k) {
      out += '<g class="' + k + '">';
      frames[k].forEach(function (row, y) {
        row = (row + '.'.repeat(width)).slice(0, width);
        for (var x = 0; x < width;) {
          var c = row[x], n = 1;
          while (x + n < width && row[x + n] === c) n++;
          if (c !== '.' && palette[c]) out += '<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + palette[c] + '"/>';
          x += n;
        }
      });
      out += '</g>';
    });
    svg.innerHTML = out;
  };
})();

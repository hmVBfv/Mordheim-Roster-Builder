/* Is somebody at the app? (Rob, 31.10.2026: "Last seen" of a user.) The tab is in front and a person touched it a moment ago: they changed
   the section, worked on the roster, scrolled. A tab left open in the background is not: it only syncs. The requests carry it
   (X-Roster-Active, api.ts), and while somebody is there one request goes out every few minutes, so "Last seen" is not bound to what the
   sync happens to send. Nothing is kept or sent but that one word. */

/** How long after the last touch somebody still counts as there. */
const STILL_THERE_MS = 3 * 60 * 1000;
/** At most one request of its own, this often. */
const PING_EVERY_MS = 4 * 60 * 1000;

let lastTouch = 0;
let lastPing = 0;
let ping: (() => void) | null = null;
let stop: (() => void) | null = null;

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/** Somebody is at the app now. */
export const isActive = (): boolean => visible() && lastTouch > 0 && Date.now() - lastTouch < STILL_THERE_MS;

function touched() {
  if (!visible()) return;
  const now = Date.now();
  lastTouch = now;
  if (ping && now - lastPing >= PING_EVERY_MS) { lastPing = now; ping(); }
}

/** Listens for somebody at the app; `onPing` makes the request that tells the server. */
export function startActivity(onPing: () => void): void {
  stopActivity();
  ping = onPing;
  const doc = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const;
  const onVisible = () => { if (visible()) touched(); };
  for (const e of doc) document.addEventListener(e, touched, { capture: true, passive: true });
  window.addEventListener('popstate', touched);
  window.addEventListener('hashchange', touched);
  document.addEventListener('visibilitychange', onVisible);
  stop = () => {
    for (const e of doc) document.removeEventListener(e, touched, { capture: true });
    window.removeEventListener('popstate', touched);
    window.removeEventListener('hashchange', touched);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function stopActivity(): void {
  stop?.();
  stop = null;
  ping = null;
  lastTouch = 0;
  lastPing = 0;
}

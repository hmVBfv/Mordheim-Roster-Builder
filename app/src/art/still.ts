/* A window nobody is at holds its pictures still (art.module.css: `html[data-still]`). The banner's lights and wings move for ever, and
   Chrome draws the whole picture again on every frame; a window on a second monitor, in front but not in focus, kept the graphics process
   busy while a video played elsewhere. In front *and* in focus is when somebody can see them move. */

const root = () => document.documentElement;
const hold = () => { if (document.visibilityState !== 'visible' || !document.hasFocus()) root().setAttribute('data-still', ''); else root().removeAttribute('data-still'); };

let stop: (() => void) | null = null;

export function startStill(): void {
  stopStill();
  hold();
  window.addEventListener('focus', hold);
  window.addEventListener('blur', hold);
  document.addEventListener('visibilitychange', hold);
  stop = () => {
    window.removeEventListener('focus', hold);
    window.removeEventListener('blur', hold);
    document.removeEventListener('visibilitychange', hold);
  };
}

export function stopStill(): void {
  stop?.();
  stop = null;
}

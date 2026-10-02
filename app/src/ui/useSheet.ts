/* A sheet (a modal <dialog>) that the Back button closes (docs/ui.md §1.9).
   Opening it adds a history entry, so Back — the phone's button or gesture,
   or the browser's — closes the sheet instead of leaving the screen or the
   app. Closing it any other way (Cancel, Escape, done) takes that entry away
   again; anything that should happen afterwards, such as moving to another
   screen, waits until it is gone, so it does not land on the sheet's entry. */
import { useCallback, useEffect, useRef } from 'react';

const MARK = 'mordheimSheet';
const marked = () => !!(history.state as Record<string, unknown> | null)?.[MARK];

export function useSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const after = useRef<(() => void) | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onPop = () => {
      if (leaving.current) { // our own step back after closing
        leaving.current = false;
        // run it once every sheet has seen this step back: a sheet opened by
        // it would otherwise take the same event for Back and close again
        const f = after.current; after.current = null;
        if (f) setTimeout(f, 0);
      } else if (d.open) { // Back while the sheet is open
        d.dataset.byBack = '1';
        d.close();
      }
    };
    const onClose = () => {
      if (d.dataset.byBack) { delete d.dataset.byBack; return; }
      if (marked()) { leaving.current = true; history.back(); return; }
      const f = after.current; after.current = null; f?.();
    };
    window.addEventListener('popstate', onPop);
    d.addEventListener('close', onClose);
    return () => { window.removeEventListener('popstate', onPop); d.removeEventListener('close', onClose); };
  }, []);

  const open = useCallback(() => {
    const d = ref.current;
    if (!d || d.open) return;
    history.pushState({ ...(history.state as object | null), [MARK]: true }, '');
    d.showModal();
  }, []);

  /** Closes the sheet; `then` runs once its history entry is gone. */
  const close = useCallback((then?: () => void) => {
    after.current = then ?? null;
    ref.current?.close();
  }, []);

  return { ref, open, close };
}

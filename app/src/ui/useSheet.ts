/* A sheet (a modal <dialog>) that the Back button closes (docs/ui.md §1.9).
   Opening it adds a history entry, so Back — the phone's button or gesture,
   or the browser's — closes the sheet instead of leaving the screen or the
   app. Closing it any other way (Cancel, Escape, done) takes that entry away
   again; anything that should happen afterwards, such as moving to another
   screen, waits until it is gone, so it does not land on the sheet's entry.

   A sheet one only reads (`outside`: "What's new", a report one reads) also closes with a click beside it – on its backdrop –, as on a
   desktop one expects (wish #179, Rob, 1.11.2026). A sheet one writes in does not: a stray click would throw the words away. */
import { useCallback, useEffect, useRef } from 'react';
import { note } from '../bugs/trail.ts';

const MARK = 'mordheimSheet';
const marked = () => !!(history.state as Record<string, unknown> | null)?.[MARK];

/** `name`: what the sheet is called in the trail of a problem report (a fixed word, never a title or a name);
    without one it is "a sheet", with `false` it leaves no trace. */
export function useSheet(name?: string | false, opts: { outside?: boolean } = {}) {
  const outside = !!opts.outside;
  const label = name === false ? null : (name ?? 'a sheet');
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
      if (label) note('sheet', `closed ${label}`);
      if (d.dataset.byBack) { delete d.dataset.byBack; return; }
      if (marked()) { leaving.current = true; history.back(); return; }
      const f = after.current; after.current = null; f?.();
    };
    // a click on the backdrop reaches the dialog itself; one on what it holds, or on its own padding, lies inside its box
    const onClick = (e: MouseEvent) => {
      if (e.target !== d || !d.open) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    };
    window.addEventListener('popstate', onPop);
    d.addEventListener('close', onClose);
    if (outside) d.addEventListener('click', onClick);
    return () => { window.removeEventListener('popstate', onPop); d.removeEventListener('close', onClose); d.removeEventListener('click', onClick); };
  }, [label, outside]);

  const open = useCallback(() => {
    const d = ref.current;
    if (!d || d.open) return;
    if (label) note('sheet', `opened ${label}`);
    history.pushState({ ...(history.state as object | null), [MARK]: true }, '');
    d.showModal();
  }, [label]);

  /** Closes the sheet; `then` runs once its history entry is gone. */
  const close = useCallback((then?: () => void) => {
    after.current = then ?? null;
    ref.current?.close();
  }, []);

  return { ref, open, close };
}

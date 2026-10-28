/* A sheet a player can push aside on a desktop (wish #129, Rob, 28.10.2026): the report window covers the entries and the
   gold a report is about, and moving it is better than closing and opening it again. Dragging its heading (`data-handle`)
   offsets the dialog; the pointer stays inside the window so the heading never leaves the screen. A phone keeps its
   bottom sheet, and the offset is gone when the sheet closes. */
import { useEffect, type RefObject } from 'react';

const DESKTOP = '(min-width: 900px)';

/** Where the pointer may be: inside the viewport. */
export function clampTo(v: number, size: number): number {
  return Math.min(Math.max(v, 0), size);
}

export function useMovable(ref: RefObject<HTMLDialogElement | null>): void {
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    let at = { x: 0, y: 0 };
    let drag: { px: number; py: number; x: number; y: number } | null = null;
    const show = () => { d.style.translate = at.x || at.y ? `${at.x}px ${at.y}px` : ''; };
    const onDown = (e: PointerEvent) => {
      const grip = e.target instanceof Element ? e.target.closest('[data-handle]') : null;
      if (!grip || e.button !== 0 || (window.matchMedia && !window.matchMedia(DESKTOP).matches)) return;
      drag = { px: e.clientX, py: e.clientY, x: at.x, y: at.y };
      grip.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      at = { x: drag.x + clampTo(e.clientX, window.innerWidth) - drag.px, y: drag.y + clampTo(e.clientY, window.innerHeight) - drag.py };
      show();
    };
    const onUp = () => { drag = null; };
    const onClose = () => { at = { x: 0, y: 0 }; drag = null; show(); };
    d.addEventListener('pointerdown', onDown);
    d.addEventListener('pointermove', onMove);
    d.addEventListener('pointerup', onUp);
    d.addEventListener('pointercancel', onUp);
    d.addEventListener('close', onClose);
    return () => {
      d.removeEventListener('pointerdown', onDown);
      d.removeEventListener('pointermove', onMove);
      d.removeEventListener('pointerup', onUp);
      d.removeEventListener('pointercancel', onUp);
      d.removeEventListener('close', onClose);
    };
  }, [ref]);
}

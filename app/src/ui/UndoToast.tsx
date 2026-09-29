/* "Undo" instead of "Are you sure?" (docs/ui.md §1.6). It must not stand in
   the way (Rob, 28.09.2026): it goes after five seconds, can be dismissed at
   once, and only its buttons catch taps — everything under the text stays
   usable. */
import { useEffect, useEffectEvent } from 'react';
import { IconClose } from './icons.tsx';
import ui from './ui.module.css';

export const UNDO_MS = 5000;

export function UndoToast({ text, onUndo, onDone, ms = UNDO_MS }: { text: string; onUndo: () => void; onDone: () => void; ms?: number }) {
  const done = useEffectEvent(onDone);
  useEffect(() => { const t = setTimeout(() => done(), ms); return () => clearTimeout(t); }, [ms]);
  return (
    <div className={ui.toast} role="status">
      <span>{text}</span>
      <button type="button" className={ui.buttonQuiet} onClick={onUndo}>Undo</button>
      <button type="button" className={ui.iconButton} onClick={onDone} aria-label="Dismiss"><IconClose /></button>
    </div>
  );
}

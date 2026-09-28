/* "Undo" instead of "Are you sure?" (docs/ui.md §1.6). */
import { useEffect, useEffectEvent } from 'react';
import ui from './ui.module.css';

export function UndoToast({ text, onUndo, onDone, ms = 8000 }: { text: string; onUndo: () => void; onDone: () => void; ms?: number }) {
  const done = useEffectEvent(onDone);
  useEffect(() => { const t = setTimeout(() => done(), ms); return () => clearTimeout(t); }, [ms]);
  return (
    <div className={ui.toast} role="status">
      <span>{text}</span>
      <button type="button" className={ui.buttonQuiet} onClick={onUndo}>Undo</button>
    </div>
  );
}

/* A short notice after something was done ("Password changed."). Like the
   Undo notice it never stands in the way (docs/ui.md §1.6): it goes by
   itself, can be dismissed at once, and only its button catches taps. */
import { useCallback, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { IconClose } from './icons.tsx';
import ui from './ui.module.css';

export const NOTICE_MS = 3500;

export function Notice({ text, onDone, ms = NOTICE_MS }: { text: string; onDone: () => void; ms?: number }) {
  const done = useEffectEvent(onDone);
  useEffect(() => { const t = setTimeout(() => done(), ms); return () => clearTimeout(t); }, [ms, text]);
  return (
    <div className={ui.toast} role="status">
      <span>{text}</span>
      <button type="button" className={ui.iconButton} onClick={onDone} aria-label="Dismiss"><IconClose /></button>
    </div>
  );
}

/** A notice and the function that shows one. */
export function useNotice(): [ReactNode, (text: string) => void] {
  const [text, setText] = useState('');
  const show = useCallback((t: string) => setText(t), []);
  return [text ? <Notice key={text} text={text} onDone={() => setText('')} /> : null, show];
}

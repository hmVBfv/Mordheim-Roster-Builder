/* What stands where a page is still being fetched: nothing for a moment, so a fast page does not flash it, then "Loading …" – a slow connection
   shows a sentence, not an empty page (report of 9.11.2026). */
import { useEffect, useState } from 'react';
import ui from './ui.module.css';

export function LoadingLate({ after = 400 }: { after?: number }) {
  const [late, setLate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLate(true), after); return () => clearTimeout(t); }, [after]);
  return late ? <p className={ui.muted} role="status">Loading …</p> : null;
}

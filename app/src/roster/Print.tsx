/* The roster on paper: every warrior in full, without buttons – a sheet that
   exists only while the browser prints (beforeprint … afterprint), so the
   screen never carries the list twice. */
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Detail } from './Detail.tsx';
import type { RosterView } from './view.ts';
import styles from './Board.module.css';

/** Whether the page is being printed, and a way to start printing it. */
export function usePrinting(): { printing: boolean; print: () => void } {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    // flushSync: the sheet must be in the page before the browser lays it out
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  const print = useCallback(() => { flushSync(() => setPrinting(true)); window.print(); }, []);
  return { printing, print };
}

export function PrintSheet({ v }: { v: RosterView }) {
  const groups = [
    { title: 'Heroes', units: v.heroes },
    { title: 'Henchmen', units: v.henchmen },
    { title: 'Hired Swords & Dramatis Personae', units: v.hires },
  ].filter((g) => g.units.length);
  return (
    <div className={styles.printOnly}>
      {groups.map((g) => (
        <section key={g.title} className={styles.printGroup}>
          <h2>{g.title}</h2>
          <div className={styles.printCards}>
            {g.units.map((u) => <Detail key={u.key} u={u} headed />)}
          </div>
        </section>
      ))}
    </div>
  );
}

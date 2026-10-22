import { useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './Bugs.module.css';

/** The reporter's words. Under a headline they are folded to a few lines, for the whole of them to be opened up (wish #28). */
export function Words({ text, fold }: { text: string; fold: boolean }) {
  const [open, setOpen] = useState(false);
  const long = fold && text.length > 240;
  const folded = long && !open;
  return (
    <>
      <p className={`${styles.words} ${folded ? styles.folded : ''}`} data-folded={folded ? 'true' : 'false'}>{text}</p>
      {long && <button type="button" className={ui.buttonQuiet} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show all'}</button>}
    </>
  );
}

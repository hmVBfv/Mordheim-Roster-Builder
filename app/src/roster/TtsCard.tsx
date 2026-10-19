/* A Tabletop Simulator card: the two fields of a model – Name and
   Description – each to copy on its own (the export screen, the leaders'
   opponents). */
import { useRef } from 'react';
import { copyText } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import styles from './Export.module.css';

export interface CardData { id: string; label: string; group: string | null; name: string; text: string }

/** A field to copy from: read-only, selected on focus, with its button. */
export function CopyField({ label, value, rows, onCopied }: { label: string; value: string; rows: number; onCopied: (what: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={ui.muted}>{label}</span>
        <button type="button" className={ui.buttonQuiet}
          onClick={() => { void copyText(value).then((ok) => { if (ok) onCopied(label); else { ref.current?.focus(); ref.current?.select(); onCopied(''); } }); }}>
          Copy {label.toLowerCase()}
        </button>
      </div>
      <textarea ref={ref} className={`${ui.input} ${styles.mono}`} readOnly rows={rows} value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}

/** A card that opens and closes from its owner's state (`onOpen` with the new state), so a re-render never snaps it shut. */
export function Card({ c, open, onOpen, onCopied }: { c: CardData; open: boolean; onOpen: (open: boolean) => void; onCopied: (what: string) => void }) {
  return (
    <details id={c.id} className={styles.card} open={open} onToggle={(e) => onOpen(e.currentTarget.open)}>
      <summary className={styles.summary}>
        <span>{c.label}</span>
        {c.group && <small className={ui.muted}>of {c.group}</small>}
      </summary>
      <CopyField label="Name" value={c.name} rows={1} onCopied={onCopied} />
      <CopyField label="Description" value={c.text} rows={8} onCopied={onCopied} />
    </details>
  );
}


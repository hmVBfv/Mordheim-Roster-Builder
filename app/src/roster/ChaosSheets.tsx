/* The sheets for Mutations and Blessings of Nurgle, and for the Mark of
   Chaos of a Marauder warband (phase 3c). Mutations change at once, as the
   equipment list does; a new Mark is applied on purpose, because the Seer
   and the Chieftain forget their spells with it. */
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import type { MarkView, MutationView } from './chaos.ts';
import styles from './Roster.module.css';

type Sheet = ReturnType<typeof useSheet>;

export function MutationSheet({ dialogRef, close, view, onToggle }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; view: MutationView | null;
  onToggle: (key: string, on: boolean, name: string) => void;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {view && (
        <div className={ui.page}>
          <div>
            <h2 id={id}>{view.label} · {view.name}</h2>
            <p className={ui.muted}>
              The dearest {view.one} at its price, every further one costs double.
              {view.required ? ` He must have at least one ${view.one}.` : ''}
              {view.viaSkill ? ' Open to him through the Mutant skill.' : ''}
            </p>
            {view.locked && <p className={ui.muted}>After the first battle {view.label.toLowerCase()} are bought only when a warrior is recruited (rulebook); a change now is booked in the ledger.</p>}
          </div>
          <ul className={styles.eqList} aria-label={view.label}>
            {view.items.map((it) => (
              <li key={it.key} className={styles.eqRow}>
                <span className={styles.eqName}>{it.name}<small>{it.text}</small></span>
                <button type="button" className={`${ui.buttonQuiet} ${styles.price}`} aria-pressed={it.on} aria-label={`${it.name}, ${it.price} gc`}
                  onClick={() => onToggle(it.key, !it.on, it.name)}>
                  {it.on ? '✓ ' : ''}{it.price} gc
                </button>
              </li>
            ))}
          </ul>
          <p aria-live="polite">Together: <b>{view.cost} gc</b></p>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
        </div>
      )}
    </dialog>
  );
}

export function MarkSheet({ dialogRef, close, view, onApply }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; view: (MarkView & { key: number }) | null;
  onApply: (mark: string, text: string) => void;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {view && <MarkBody key={view.key} v={view} close={close} onApply={onApply} titleId={id} />}
    </dialog>
  );
}

function MarkBody({ v, close, onApply, titleId }: { v: MarkView; close: Sheet['close']; onApply: (mark: string, text: string) => void; titleId: string }) {
  const [pick, setPick] = useState(v.mark);
  const name = v.options.find((o) => o.key === pick)?.name ?? '';
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (pick && pick !== v.mark) close(() => onApply(pick, `The warband bears the ${name}.`)); }}>
      <div>
        <h2 id={titleId}>Mark of Chaos</h2>
        <p className={ui.muted}>The Seer must bear a Mark; it sets the warband's god. The Chieftain may take the same Mark later.</p>
      </div>
      <div className={`${styles.pickRow} ${styles.pickCol}`} role="group" aria-label="Mark">
        {v.options.map((o) => (
          <button key={o.key} type="button" aria-pressed={pick === o.key} onClick={() => setPick(o.key)}>
            {o.name}{!o.magic && !/no magic/.test(o.name) && <small> · no magic</small>}
          </button>
        ))}
      </div>
      {v.mark && pick !== v.mark && <p>A new Mark: the Seer and the Chieftain forget the spells they know.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!pick || pick === v.mark}>Apply</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

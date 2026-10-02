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

export function MutationSheet({ dialogRef, close, view, onSet }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; view: MutationView | null;
  onSet: (key: string, n: number, name: string) => void;
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
              {view.one === 'mutation' && !view.viaSkill ? ' The same one may be taken again where its effects add up; a claw or tentacle needs an arm.' : ''}
              {view.required ? ` He must have at least one ${view.one}.` : ''}
              {view.viaSkill ? ' The Mutant skill gives him one.' : ''}
            </p>
            {view.locked && <p className={ui.muted}>He has fought his first battle: {view.label.toLowerCase()} are bought only as a warrior is hired.</p>}
          </div>
          <ul className={styles.eqList} aria-label={view.label}>
            {view.items.map((it) => (
              <li key={it.key} className={styles.eqRow}>
                <span className={styles.eqName}>{it.name} · {it.price} gc<small>{it.text}{it.more && it.count === 0 && !view.locked ? ` (${it.more})` : ''}</small></span>
                <span className={styles.stepper}>
                  <button type="button" aria-label={`One ${it.name} less`} disabled={!!it.less} onClick={() => onSet(it.key, it.count - 1, it.name)}>−</button>
                  <span aria-live="polite">{it.count}</span>
                  <button type="button" aria-label={`One ${it.name} more`} disabled={!!it.more} onClick={() => onSet(it.key, it.count + 1, it.name)}>+</button>
                </span>
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

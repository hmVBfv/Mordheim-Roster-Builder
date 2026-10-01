/* The sheets of the roster (docs/mockups/roster.html): the ⋯ menu of a
   warrior, a name, and the recruit list. Each runs what was chosen only
   once it has closed, so a following sheet or an undo notice is not hidden
   behind it, and Back never lands on a closed sheet (useSheet). */
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import styles from './Roster.module.css';
import type { RecruitUnit, RosterView } from './view.ts';

type Sheet = ReturnType<typeof useSheet>;
/** The dialog's ref and its close(), from useSheet in the screen. */
interface SheetProps { dialogRef: Sheet['ref']; close: Sheet['close'] }

export interface MenuItem { label: string; danger?: boolean; run: () => void }

export function MenuSheet({ dialogRef, close, title, items }: SheetProps & { title: string; items: MenuItem[] }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      <div className={ui.page}>
        <h2 id={id}>{title}</h2>
        <ul className={styles.menu}>
          {items.map((it) => (
            <li key={it.label}>
              <button type="button" className={it.danger ? styles.danger : undefined} onClick={() => close(it.run)}>
                {it.label} <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
      </div>
    </dialog>
  );
}

/** What a name sheet edits: a warrior, a group, one man, the warband. */
export interface Naming {
  key: number;
  title: string;
  label: string;
  value: string;
  /** Shown while the field is empty: the name used then. */
  fallback: string;
  save: (v: string) => void;
  /** A second way out, e.g. dismissing the man. */
  extra?: { label: string; run: () => void };
}

function NameForm({ close, naming, titleId }: { close: Sheet['close']; naming: Naming; titleId: string }) {
  const [value, setValue] = useState(naming.value);
  return (
    <form method="dialog" className={ui.page} onSubmit={(e) => { e.preventDefault(); close(() => naming.save(value.trim())); }}>
      <h2 id={titleId}>{naming.title}</h2>
      <label className={ui.field}>
        <span>{naming.label}</span>
        <input className={ui.input} value={value} placeholder={naming.fallback} maxLength={80} autoComplete="off" onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className={ui.row}>
        <button type="submit" className={ui.button}>Save</button>
        {naming.extra && <button type="button" className={`${ui.buttonQuiet} ${styles.danger}`} onClick={() => close(naming.extra!.run)}>{naming.extra.label}</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

export function NameSheet({ dialogRef, close, naming }: SheetProps & { naming: Naming | null }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {naming && <NameForm key={naming.key} close={close} naming={naming} titleId={id} />}
    </dialog>
  );
}

function UnitButton({ u, onPick }: { u: RecruitUnit; onPick: () => void }) {
  const facts = [u.limit === 'any' ? 'any number' : u.limit.startsWith('=') ? `exactly ${u.limit.slice(1)}` : u.limit, `${u.cost} gc`, u.exp ? `${u.exp} exp` : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" className={styles.unit} disabled={!!u.why} onClick={onPick}>
        <span className={styles.unitName}>{u.name}{u.count > 0 && <span className={styles.count}> ×{u.count}</span>}</span>
        <small>{facts}</small>
        {u.why ? <small className={styles.why}>Not now: {u.why}.</small> : u.note && <small className={styles.note}>{u.note}</small>}
      </button>
    </li>
  );
}

export function RecruitSheet({ dialogRef, close, v, onRecruit }: SheetProps & { v: RosterView; onRecruit: (u: RecruitUnit) => void }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      <div className={ui.page}>
        <div>
          <h2 id={id}>Recruit</h2>
          <p className={ui.muted}>{v.gold} gc left · Heroes {v.heroCount} of {v.heroMax} · Models {v.models}/{v.maxModels}</p>
        </div>
        {v.recruit.map((g) => (
          <section key={g.label} className={styles.recruitGroup} aria-label={g.label}>
            <h3>{g.label}</h3>
            <ul className={ui.list}>{g.units.map((u) => <UnitButton key={u.id} u={u} onPick={() => close(() => onRecruit(u))} />)}</ul>
          </section>
        ))}
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
      </div>
    </dialog>
  );
}

/* The sheets of the roster (docs/mockups/roster.html): the ⋯ menu of a
   warrior, a name, and the recruit list. Each runs what was chosen only
   once it has closed, so a following sheet or an undo notice is not hidden
   behind it, and Back never lands on a closed sheet (useSheet). */
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import styles from './Roster.module.css';
import type { RecruitUnit, RosterView } from './view.ts';
import { moreMenVerdict, type MoreMenView } from './men.ts';

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

/** Setting the experience at once (legacy: a click on a step of the track):
    the steps of his track to jump to, or any number. */
export interface ExpSetting {
  key: number;
  who: string;
  value: number;
  steps: number[];
  min: number;
  max: number | null;
  save: (v: number) => void;
}

function ExpForm({ close, e, titleId }: { close: Sheet['close']; e: ExpSetting; titleId: string }) {
  const [value, setValue] = useState(String(e.value));
  const n = Math.round(Number(value));
  const ok = value.trim() !== '' && Number.isFinite(n) && n >= e.min && (e.max == null || n <= e.max);
  return (
    <form method="dialog" className={ui.page} onSubmit={(ev) => { ev.preventDefault(); if (ok) close(() => e.save(n)); }}>
      <h2 id={titleId}>Experience · {e.who}</h2>
      <div className={styles.expSteps} role="group" aria-label="Steps of the track">
        {e.steps.filter((s) => s >= e.min && (e.max == null || s <= e.max)).map((s) => (
          <button key={s} type="button" aria-pressed={n === s} onClick={() => setValue(String(s))}>{s}</button>
        ))}
      </div>
      <label className={ui.field}>
        <span>Experience</span>
        <input className={ui.input} type="number" inputMode="numeric" min={e.min} max={e.max ?? undefined} value={value} onChange={(ev) => setValue(ev.target.value)} />
      </label>
      {!ok && <p className={styles.why}>{e.max != null ? `From ${e.min} to ${e.max}.` : `At least ${e.min}.`}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!ok}>Save</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

export function ExpSheet({ dialogRef, close, setting }: SheetProps & { setting: ExpSetting | null }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {setting && <ExpForm key={setting.key} close={close} e={setting} titleId={id} />}
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

/** More men for a group (mockup roster.html "More men"): how many, the
    veterans roll after the first battle, the price, their names. */
export function MoreMenSheet({ dialogRef, close, view, onAdd }: SheetProps & {
  view: (MoreMenView & { key: number }) | null;
  onAdd: (n: number, roll: number | null, names: string[], text: string) => void;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {view && <MoreMenBody key={view.key} v={view} close={close} onAdd={onAdd} titleId={id} />}
    </dialog>
  );
}

function MoreMenBody({ v, close, onAdd, titleId }: { v: MoreMenView; close: Sheet['close']; onAdd: (n: number, roll: number | null, names: string[], text: string) => void; titleId: string }) {
  const [n, setN] = useState(1);
  const [roll, setRoll] = useState(v.veterans?.roll != null ? String(v.veterans.roll) : '');
  const [names, setNames] = useState<string[]>([]);
  const rollId = useId();
  const r = roll === '' ? null : Number(roll);
  const verdict = moreMenVerdict(v, n, v.veterans ? r : null);
  const total = n * v.each;
  const who = Array.from({ length: n }, (_, i) => (names[i] ?? '').trim() || v.fallbacks[i]!);
  const text = `${who.join(', ')} join${n === 1 ? 's' : ''} ${v.name} (${total} gc).`;
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (!verdict) close(() => onAdd(n, v.veterans ? r : null, names.slice(0, n), text)); }}>
      <div>
        <h2 id={titleId}>More men · {v.name}</h2>
        <p className={ui.muted}>A new man joins with the group's experience and the same gear. He costs the {v.unit} with that gear{v.exp ? `, and ${v.perExp} gc for each point of the group's experience` : ''}.</p>
      </div>
      <div className={ui.row}>
        <span>How many</span>
        <span className={styles.stepper}>
          <button type="button" aria-label="One man less" disabled={n <= 1} onClick={() => setN(n - 1)}>−</button>
          <span aria-live="polite">{n}</span>
          <button type="button" aria-label="One man more" disabled={n >= v.max} onClick={() => setN(n + 1)}>+</button>
        </span>
      </div>
      {v.veterans && (
        <div className={ui.field}>
          <label htmlFor={rollId}>2D6 as rolled for the veterans on offer (post-battle step 5)</label>
          <span className={styles.dice}>
            <input id={rollId} className={ui.input} inputMode="numeric" maxLength={2} value={roll} autoComplete="off" onChange={(e) => setRoll(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <button type="button" className={ui.buttonQuiet} onClick={() => setRoll(String(2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6)))}>Roll the dice</button>
          </span>
          <span className={ui.muted}>{v.veterans.roll != null ? `This round: ${v.veterans.roll}, of which new men brought ${v.veterans.spent}. ` : ''}Together, new men may bring at most that much experience.</span>
        </div>
      )}
      <dl className={styles.costs}>
        <dt>{v.unit} with his gear</dt><dd>{v.base} gc</dd>
        {v.surcharge > 0 && <><dt>Experience: {v.exp} × {v.perExp} gc</dt><dd>{v.surcharge} gc</dd></>}
        <dt className={styles.sum}>{n} × {v.each} gc</dt><dd className={styles.sum}>{total} gc</dd>
      </dl>
      <p aria-live="polite" className={verdict ? styles.why : ui.muted}>{verdict || `Gold left: ${v.gold - total} gc.`}</p>
      {who.map((_, i) => (
        <NameField key={i} label={`Name of new man ${i + 1}`} value={names[i] ?? ''} placeholder={v.fallbacks[i]!} onChange={(x) => setNames((p) => { const c = [...p]; c[i] = x; return c; })} />
      ))}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!!verdict}>Recruit</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}


function NameField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={ui.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={ui.input} value={value} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

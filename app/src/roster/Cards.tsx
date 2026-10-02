/* One card per warrior, as in the roster mockup (docs/mockups/roster.html):
   name and ⋯ on top, the profile, the experience track with its stepper,
   what he carries and knows, and for a henchman group its men. */
import { Fragment, type ReactNode } from 'react';
import { MoreIcon } from '../ui/icons.tsx';
import { TipWord } from '../ui/Tip.tsx';
import ui from '../ui/ui.module.css';
import type { Fact, HireView, StatCell, WarriorView, XpView } from './view.ts';
import styles from './Roster.module.css';

function Stats({ cells, save }: { cells: StatCell[]; save?: string }) {
  return (
    <table className={styles.stats}>
      <thead>
        <tr>{cells.map((c) => <th key={c.key} scope="col">{c.key}</th>)}{save != null && <th scope="col">Sv</th>}</tr>
      </thead>
      <tbody>
        <tr>
          {cells.map((c) => <td key={c.key} className={c.changed ? styles.changed : undefined}>{c.value}</td>)}
          {save != null && <td>{save}</td>}
        </tr>
      </tbody>
    </table>
  );
}

const STEP_WORD = { base: 'before his start', on: 'reached', next: 'next', open: '' } as const;

/* Every step of the experience track framed, those below the starting
   experience dashed, those reached filled, the next one marked – as the
   Roster Builder draws it. The state is also in words for screen readers.
   The stepper beside it sets the experience one point at a time. */
function XpTrack({ xp, who, group, onStep }: { xp: XpView; who: string; group: boolean; onStep: (delta: number) => void }) {
  return (
    <div className={styles.xp}>
      <ol className={styles.steps} aria-label="Experience steps">
        {xp.steps.map((s) => (
          <li key={s.at} className={styles[s.state]}>
            {s.at}{STEP_WORD[s.state] && <span className="visually-hidden"> {STEP_WORD[s.state]}</span>}
          </li>
        ))}
      </ol>
      <div className={styles.xpLine}>
        <span className={styles.stepper}>
          <button type="button" aria-label={`One experience less for ${who}`} disabled={xp.value <= xp.min} onClick={() => onStep(-1)}>−</button>
          <span aria-live="polite" aria-atomic="true">Exp <b>{xp.value}</b>{group ? ' (group)' : ''}</span>
          <button type="button" aria-label={`One experience more for ${who}`} disabled={xp.max != null && xp.value >= xp.max} onClick={() => onStep(1)}>+</button>
        </span>
        <span>{xp.next != null ? `next advance at ${xp.next}` : 'all steps reached'}</span>
      </div>
    </div>
  );
}

/* A line of the card: each word that names a rule opens its bubble. */
function Line({ label, items }: { label: string; items: Fact[] }) {
  if (!items.length) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{items.map((f, i) => <Fragment key={i}>{i > 0 && ', '}<TipWord label={f.label} tips={f.tips} /></Fragment>)}</dd>
    </>
  );
}

function Head({ name, count, type, onMore, children }: { name: string; count?: number; type: string | null; onMore: () => void; children?: ReactNode }) {
  return (
    <header className={styles.head}>
      <div>
        <h3>{name}{count != null && <span className={styles.count}> ×{count}</span>}</h3>
        {type && <p className={ui.muted}>{type}</p>}
      </div>
      <button type="button" className={ui.iconButton} aria-label={`More for ${name}`} onClick={onMore}><MoreIcon /></button>
      {children}
    </header>
  );
}

export interface WarriorActions {
  onMore: () => void;
  onXp: (delta: number) => void;
  onMan: (i: number) => void;
  onAddMan: () => void;
  onAdvance: () => void;
  onInjury: () => void;
  onCaptive: () => void;
}

export function Warrior({ w, act }: { w: WarriorView; act: WarriorActions }) {
  const group = !w.hero;
  const badges = [
    w.leader && <span key="l" className={styles.badge}>Leader</span>,
    w.promoted && <span key="p" className={styles.badge}>Promoted</span>,
    w.advanceDue && <span key="a" className={`${styles.badge} ${styles.due}`}>Advance due</span>,
    w.missGames > 0 && <span key="m" className={`${styles.badge} ${styles.out}`}>Misses {w.missGames} game{w.missGames > 1 ? 's' : ''}</span>,
    w.retire && <span key="r" className={`${styles.badge} ${styles.out}`}>Blind: must retire</span>,
    w.captive != null && <span key="c" className={`${styles.badge} ${styles.out}`}>{w.captive ? `Captive of ${w.captive}` : 'Captive'}</span>,
  ].filter(Boolean);
  return (
    <article className={`${ui.card} ${styles.warrior}`} aria-label={w.name}>
      <Head name={w.name} count={group ? w.count : undefined} type={group ? (w.name !== w.type ? `${w.type} · group` : 'Henchman group') : w.name !== w.type ? w.type : null} onMore={act.onMore}>
        {badges.length > 0 && <p className={styles.badges}>{badges}</p>}
      </Head>
      {group && (
        <ul className={styles.men} aria-label={`Men of ${w.name}`}>
          {w.men.map((m) => (
            <li key={m.i}>
              <button type="button" className={m.named ? undefined : styles.unnamed} aria-label={`${m.name}: name or dismiss`} onClick={() => act.onMan(m.i)}>{m.name}</button>
            </li>
          ))}
        </ul>
      )}
      <Stats cells={w.stats} save={w.save} />
      {w.xp ? <XpTrack xp={w.xp} who={w.name} group={group} onStep={act.onXp} /> : <p className={`${ui.muted} ${styles.xpLine}`}>Gains no experience.</p>}
      <dl className={styles.facts}>
        <Line label="Rules" items={w.rules} />
        <Line label="Equipment" items={w.equipment} />
        <Line label="Skills" items={w.skills} />
        <Line label="Spells" items={w.spells} />
        <Line label="Mutations" items={w.mutations} />
        <Line label="Mark" items={w.mark} />
        <Line label="Injuries" items={w.injuries} />
      </dl>
      <div className={styles.acts}>
        <div className={ui.row}>
          {w.xp && <button type="button" className={`${ui.buttonQuiet} ${w.advanceDue ? styles.dueButton : ''}`} onClick={act.onAdvance}>Advance</button>}
          {w.addMan && (
            <button type="button" className={ui.buttonQuiet} disabled={'why' in w.addMan} onClick={act.onAddMan}>
              + Man{'cost' in w.addMan ? ` · ${w.addMan.cost} gc` : ''}
            </button>
          )}
          {w.captive == null
            ? <button type="button" className={ui.buttonQuiet} aria-label={`Injury for ${w.name}`} onClick={act.onInjury}>Injury</button>
            : <button type="button" className={ui.buttonQuiet} aria-label={`Captivity of ${w.name}: how it ended`} onClick={act.onCaptive}>Captivity…</button>}
        </div>
        {w.addMan && 'why' in w.addMan && <p className={styles.why}>No more men: {w.addMan.why}.</p>}
      </div>
    </article>
  );
}

export interface HireActions { onMore: () => void; onXp: (delta: number) => void; onAdvance: () => void; onInjury: () => void }

export function Hire({ h, act }: { h: HireView; act: HireActions }) {
  return (
    <article className={`${ui.card} ${styles.warrior}`} aria-label={h.name}>
      <Head name={h.name} type={`${h.kind}${h.name !== h.type ? ` · ${h.type}` : ''}`} onMore={act.onMore}>
        {h.advanceDue && <p className={styles.badges}><span className={`${styles.badge} ${styles.due}`}>Advance due</span></p>}
      </Head>
      <Stats cells={h.stats} />
      {h.xp && <XpTrack xp={h.xp} who={h.name} group={false} onStep={act.onXp} />}
      <dl className={styles.facts}>
        <Line label="Rules" items={h.rules} />
        <Line label="Skills" items={h.skills} />
        <Line label="Spells" items={h.spells} />
      </dl>
      {h.xp && (
        <div className={styles.acts}>
          <div className={ui.row}>
            <button type="button" className={`${ui.buttonQuiet} ${h.advanceDue ? styles.dueButton : ''}`} onClick={act.onAdvance}>Advance</button>
            <button type="button" className={ui.buttonQuiet} aria-label={`Injury for ${h.name}`} onClick={act.onInjury}>Injury</button>
          </div>
        </div>
      )}
    </article>
  );
}

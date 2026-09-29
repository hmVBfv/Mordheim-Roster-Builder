/* One warband, read only for now: the new builder comes in phase 3. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { rosterView, type HireView, type WarriorView, type XpView } from '../roster/view.ts';
import ui from '../ui/ui.module.css';
import styles from './Roster.module.css';

function Stats({ cells, save }: { cells: { key: string; value: string; changed: boolean }[]; save?: string }) {
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
   Roster Builder draws it. The state is also in words for screen readers. */
function XpTrack({ xp }: { xp: XpView }) {
  return (
    <div className={styles.xp}>
      <ol className={styles.steps} aria-label="Experience steps">
        {xp.steps.map((s) => (
          <li key={s.at} className={styles[s.state]}>
            {s.at}{STEP_WORD[s.state] && <span className="visually-hidden"> {STEP_WORD[s.state]}</span>}
          </li>
        ))}
      </ol>
      <p className={styles.xpLine}>
        <span>Exp <b>{xp.value}</b></span>
        <span>{xp.next != null ? `next advance at ${xp.next}` : 'all steps reached'}</span>
      </p>
    </div>
  );
}

function Line({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (<><dt>{label}</dt><dd>{items.join(', ')}</dd></>);
}

function Warrior({ w }: { w: WarriorView }) {
  return (
    <article className={`${ui.card} ${styles.warrior}`}>
      <header className={styles.head}>
        <h3>{w.name}{w.count > 1 && <span className={styles.count}> ×{w.count}</span>}</h3>
        {w.name !== w.type && <p className={ui.muted}>{w.type}</p>}
        <p className={styles.badges}>
          {w.leader && <span className={styles.badge}>Leader</span>}
          {w.promoted && <span className={styles.badge}>Promoted</span>}
          {w.advanceDue && <span className={`${styles.badge} ${styles.due}`}>Advance due</span>}
          {w.missGames > 0 && <span className={`${styles.badge} ${styles.out}`}>Misses {w.missGames} game{w.missGames > 1 ? 's' : ''}</span>}
        </p>
      </header>
      <Stats cells={w.stats} save={w.save} />
      {w.xp ? <XpTrack xp={w.xp} /> : <p className={`${ui.muted} ${styles.xpLine}`}>Gains no experience.</p>}
      <dl className={styles.facts}>
        <Line label="Equipment" items={w.equipment} />
        <Line label="Skills" items={w.skills} />
        <Line label="Spells" items={w.spells} />
        <Line label="Mutations" items={w.mutations} />
        <Line label="Injuries" items={w.injuries} />
        <Line label="Men" items={w.members} />
      </dl>
    </article>
  );
}

function Hire({ h }: { h: HireView }) {
  return (
    <article className={`${ui.card} ${styles.warrior}`}>
      <header className={styles.head}>
        <h3>{h.name}</h3>
        <p className={ui.muted}>{h.kind}{h.name !== h.type ? ` · ${h.type}` : ''}</p>
        {h.advanceDue && <p className={styles.badges}><span className={`${styles.badge} ${styles.due}`}>Advance due</span></p>}
      </header>
      <Stats cells={h.stats} />
      {h.xp && <XpTrack xp={h.xp} />}
    </article>
  );
}

function RosterBody({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const v = useMemo(() => rosterView(data, rec.state), [data, rec.state]);
  const navigate = useNavigate();
  return (
    <section className={ui.page}>
      <header>
        <h1>{v.name}</h1>
        <p className={ui.muted}>{v.type}{v.campaign ? ` · ${v.campaign}` : ''}</p>
        <dl className={styles.summary}>
          <div><dt>Rating</dt><dd>{v.rating}</dd></div>
          <div><dt>Gold</dt><dd>{v.gold} gc</dd></div>
          <div><dt>Models</dt><dd>{v.models}/{v.maxModels}</dd></div>
        </dl>
      </header>
      {v.warnings.length > 0 && (
        <ul className={`${ui.card} ${styles.warnings}`} aria-label="Warnings">
          {v.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {v.heroes.length > 0 && <h2>Heroes</h2>}
      <div className={styles.cards}>{v.heroes.map((w) => <Warrior key={w.key} w={w} />)}</div>
      {v.henchmen.length > 0 && <h2>Henchmen</h2>}
      <div className={styles.cards}>{v.henchmen.map((w) => <Warrior key={w.key} w={w} />)}</div>
      {v.hires.length > 0 && <h2>Hired Swords &amp; Dramatis Personae</h2>}
      <div className={styles.cards}>{v.hires.map((h) => <Hire key={h.key} h={h} />)}</div>
      {v.fallen.length > 0 && (
        <details className={ui.card}>
          <summary className={styles.summaryToggle}>Fallen ({v.fallen.length})</summary>
          <ul>{v.fallen.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
      <div className={ui.row}>
        <Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link>
        <button type="button" className={ui.buttonQuiet}
          onClick={() => { void db.warbands.delete(rec.id).then(() => navigate('/warbands', { replace: true, state: { removed: rec } })); }}>
          Remove from this device
        </button>
      </div>
    </section>
  );
}

export function Roster() {
  const { id = '' } = useParams();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
  if (rec === undefined) return null;
  if (rec === null) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p className={ui.muted}>This warband is not stored here (any more).</p>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <RosterBody rec={rec} />
    </Suspense>
  );
}

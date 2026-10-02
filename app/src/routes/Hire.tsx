/* Hire (phase 3d, mockup docs/mockups/hire.html): every Hired Sword and
   Dramatis Persona, found by name or race, by grade and by whether he may
   join this warband – and why not. A sheet shows everything about him and
   hires him, with his weapons or persona chosen first. Before the first
   battle his fee comes out of the starting gold like a recruit's; after it
   the fee is booked in the ledger (V7). Rob, 02.10.2026: the Hire button is
   in reach without scrolling, and after hiring the list starts at its
   filters again. */
import * as core from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, Suspense, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { filterRows, gradesOf, hireDetail, hireFigures, hireRows, type HireKind, type HireOrder, type HireRow } from '../roster/hire.ts';
import { STATS, type Fact, type StatCell } from '../roster/view.ts';
import { useEditor } from '../roster/useEditor.ts';
import rosterStyles from '../roster/Roster.module.css';
import trade from '../roster/Trade.module.css';
import styles from '../roster/Hire.module.css';
import { TipWord } from '../ui/Tip.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';

const KINDS = [['hs', 'Hired Swords'], ['dp', 'Dramatis Personae']] as const;
const ORDERS = [['name', 'By name'], ['fee', 'By hire fee'], ['rating', 'By rating']] as const;
const OPS = ['>=', '>', '=', '<=', '<'] as const;
const INTRO: Record<HireKind, string> = {
  hs: 'Hired Swords join for their fee and cost their upkeep after every battle, the first included. They do not count towards the warband’s warriors or Heroes, and gain experience like Henchmen.',
  dp: 'Dramatis Personae are named characters: some stay, some wander off after one battle. Most gain no experience.',
};

const gc = (n: number) => `${n} gc`;

function Stats({ cells, caption }: { cells: StatCell[]; caption?: string }) {
  return (
    <table className={rosterStyles.stats}>
      {caption && <caption className={styles.caption}>{caption}</caption>}
      <thead><tr>{cells.map((c) => <th key={c.key} scope="col">{c.key}</th>)}</tr></thead>
      <tbody><tr>{cells.map((c) => <td key={c.key}>{c.value}</td>)}</tr></tbody>
    </table>
  );
}

function Words({ items }: { items: Fact[] }) {
  return <>{items.map((f, i) => <Fragment key={i}>{i > 0 && ', '}<TipWord label={f.label} tips={f.tips} /></Fragment>)}</>;
}

function HireForm({ ctx, kind, hkey, gold, locked, titleId, close, onHire }: {
  ctx: core.Ctx; kind: HireKind; hkey: string; gold: number; locked: boolean; titleId: string;
  close: (then?: () => void) => void; onHire: (opt: string | undefined, row: HireRow) => void;
}) {
  const [opt, setOpt] = useState<string | undefined>(undefined);
  const d = hireDetail(ctx, kind, hkey, opt);
  if (!d) return null;
  const r = d.row;
  const why = core.hireProblem(ctx, kind, hkey, opt);
  const left = gold - r.fee;
  const verdict = why
    ? `Not now: ${why}.`
    : left < 0
      ? `That is ${-left} gc more than the warband has; the roster will say so.`
      : locked
        ? 'The fee is booked in the ledger; his upkeep is due after each battle.'
        : 'Until the first battle his fee comes back if he leaves again.';
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (!why) close(() => onHire(opt, r)); }}>
      <div>
        <h2 id={titleId}>{r.name}</h2>
        <p className={ui.muted}>{[r.grade, r.race, d.src].filter(Boolean).join(' · ')}</p>
      </div>
      <Stats cells={d.stats} caption={d.first ?? undefined} />
      {d.second && <Stats cells={d.second.stats} caption={d.second.name} />}
      <dl className={rosterStyles.facts}>
        {d.equipment && <><dt>Equipment</dt><dd>{d.equipment}</dd></>}
        {d.rules.length > 0 && <><dt>Rules</dt><dd><Words items={d.rules} /></dd></>}
        {d.skills.length > 0 && <><dt>Skills</dt><dd><Words items={d.skills} /></dd></>}
        {d.skillLists.length > 0 && <><dt>Skill lists</dt><dd>{d.skillLists.join(', ')}</dd></>}
        <dt>Experience</dt><dd>{d.experience}</dd>
        {d.slot && <><dt>Place</dt><dd>He takes a Hero’s place.</dd></>}
        {d.sizeBonus > 0 && <><dt>Warband</dt><dd>may have {d.sizeBonus} more warrior{d.sizeBonus > 1 ? 's' : ''} while he is with it</dd></>}
        {d.note && <><dt>Note</dt><dd>{d.note}</dd></>}
      </dl>
      {d.choices && (
        <div className={trade.seg} role="group" aria-label={d.choices.label}>
          <span className={styles.label}>{d.choices.label}</span>
          {d.choices.choices.map((c) => <button key={c} type="button" aria-pressed={c === opt} onClick={() => setOpt(c)}>{c}</button>)}
        </div>
      )}
      <dl className={styles.costs}>
        <dt>Hire fee, now</dt>
        <dd>{r.fee !== r.baseFee ? <><s>{gc(r.baseFee)}</s> {gc(r.fee)}</> : gc(r.fee)}{d.discount && <small> · half price: {d.discount}</small>}</dd>
        <dt>Upkeep after each battle</dt><dd>{r.upkeep ? gc(r.upkeep) : 'none'}</dd>
        <dt>Rating</dt><dd>+{r.rating}</dd>
        <dt className={styles.sum}>Gold left</dt><dd className={`${styles.sum} ${left < 0 ? trade.no : ''}`}>{gc(left)}</dd>
      </dl>
      <p className={why ? `${styles.verdict} ${trade.no}` : styles.verdict} aria-live="polite">{verdict}</p>
      <div className={`${ui.row} ${ui.sheetActions}`}>
        <button type="submit" className={ui.button} disabled={!!why}>Hire</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button>
      </div>
    </form>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const [kind, setKind] = useState<HireKind>('hs');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(true);
  const [order, setOrder] = useState<HireOrder>('name');
  const [stat, setStat] = useState<{ stat: string; op: (typeof OPS)[number]; val: string }>({ stat: '', op: '>=', val: '' });
  const [off, setOff] = useState<Record<HireKind, string[]>>({ hs: [], dp: [] });
  const [picked, setPicked] = useState<{ n: number; key: string } | null>(null);
  const { ref: sheetRef, open: openSheet, close: closeSheet } = useSheet();
  const titleId = useId();
  const top = useRef<HTMLDivElement>(null);

  const grades = gradesOf(ctx, kind);
  const shown = new Set(grades.filter((g) => !off[kind].includes(g)));
  const all = useMemo(() => hireRows(ctx, kind), [ctx, kind]);
  const rows = filterRows(all, { q, grades: shown, only, order, stat });
  const may = all.filter((r) => !r.why).length;
  const fig = hireFigures(ctx);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';

  return (
    <section className={ui.page}>
      <div ref={top} className={styles.top}>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {name}</Link>
        <h1>Hire</h1>
      </div>
      <dl className={trade.figures}>
        <div><dt>Gold in hand</dt><dd>{gc(fig.gold)}</dd></div>
        <div><dt>Upkeep after each battle</dt><dd>{gc(fig.upkeep)}</dd></div>
        <div><dt>Hired</dt><dd>{fig.hired}</dd></div>
      </dl>
      <div className={trade.seg} role="group" aria-label="Who">
        {KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <p className={ui.muted}>{INTRO[kind]}</p>
      <div className={styles.filters}>
        <input className={ui.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by name or race" aria-label="Find by name or race" autoComplete="off" />
        <div className={trade.seg} role="group" aria-label="Grade">
          {grades.map((g) => (
            <button key={g} type="button" aria-pressed={shown.has(g)}
              onClick={() => setOff((o) => ({ ...o, [kind]: o[kind].includes(g) ? o[kind].filter((x) => x !== g) : [...o[kind], g] }))}>{g}</button>
          ))}
        </div>
        <label className={trade.check}><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Only those this warband may hire</label>
        <div className={styles.stat} role="group" aria-label="Characteristic">
          <span className={ui.muted}>Characteristic</span>
          <select className={ui.input} value={stat.stat} onChange={(e) => setStat((x) => ({ ...x, stat: e.target.value }))} aria-label="Which characteristic">
            <option value="">—</option>
            {STATS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select className={ui.input} value={stat.op} onChange={(e) => setStat((x) => ({ ...x, op: e.target.value as (typeof OPS)[number] }))} aria-label="Compared">
            {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input className={ui.input} type="number" inputMode="numeric" min={0} max={10} value={stat.val} onChange={(e) => setStat((x) => ({ ...x, val: e.target.value }))} aria-label="Value" />
        </div>
        <label className={ui.field}><span className={ui.muted}>Order</span>
          <select className={ui.input} value={order} onChange={(e) => setOrder(e.target.value as HireOrder)}>
            {ORDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <p className={ui.muted} aria-live="polite">{rows.length} shown · {may} of {all.length} may join this warband</p>
      <ul className={ui.list} aria-label={kind === 'hs' ? 'Hired Swords' : 'Dramatis Personae'}>
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" className={`${trade.item} ${r.why ? styles.blocked : ''}`}
              onClick={() => { setPicked((p) => ({ n: (p?.n ?? 0) + 1, key: r.key })); openSheet(); }}>
              <span className={styles.who}>
                <span>{r.name}</span>
                <small className={r.why && !r.hired ? trade.no : undefined}>
                  {[r.grade, r.race, r.hired ? 'with the warband' : r.why || (r.wanderer ? 'for one battle' : '')].filter(Boolean).join(' · ')}
                </small>
              </span>
              <small className={styles.fee}>{gc(r.fee)}<br />{r.upkeep ? `${gc(r.upkeep)} upkeep` : 'no upkeep'}</small>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className={ui.muted}>Nobody fits the filter.</li>}
      </ul>
      <details className={ui.muted}>
        <summary className={styles.summary}>Grades?</summary>
        <p>Core and 1a: the Mordheim rulebook and its official reprints · 1b: Town Cryer and the Annuals, by the Mordheim team · 1c: later official sources · 2a: the community’s proven additions. Which grades a warband plays is a house rule.</p>
      </details>

      <dialog ref={sheetRef} className={ui.sheet} aria-labelledby={titleId}>
        {picked && <HireForm key={`${kind}-${picked.n}`} ctx={ctx} kind={kind} hkey={picked.key} gold={fig.gold} locked={fig.locked} titleId={titleId}
          close={closeSheet}
          onHire={(opt, r) => {
            ed.edit((c) => core.hire(c, kind, r.key, opt), `${r.name} hired for ${gc(r.fee)}.`, { gold: 'settle' });
            // back up to the filters, not somewhere in the middle of the list (Rob, 02.10.2026)
            top.current?.scrollIntoView({ block: 'start' });
          }} />}
      </dialog>
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function Hire() {
  const { id = '' } = useParams();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
  if (rec === undefined) return null;
  if (rec === null) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <Body rec={rec} />
    </Suspense>
  );
}

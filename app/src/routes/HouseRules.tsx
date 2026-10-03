/* A warband's house rules (phase 3e, mockup docs/mockups/house-rules.html,
   the case "a warband on its own": until the campaign server, every warband
   keeps its own). Each rule with what the rules as written say, a switch,
   and its value in steps when on; the declaration every export carries;
   all back to the rules as written. A price rule never moves gold already
   booked in the ledger. */
import * as core from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { declaration, houseView, setBodyOnly, setGrade, setRule, stepRule, type RuleView } from '../roster/house.ts';
import { useEditor, type Editor } from '../roster/useEditor.ts';
import styles from '../roster/House.module.css';
import trade from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';

const KEEP = { gold: 'keep' } as const;

function Rule({ r, ed }: { r: RuleView; ed: Editor }) {
  return (
    <div className={`${styles.rule} ${r.on ? styles.on : ''}`}>
      <div className={styles.head}>
        <span>
          <b>{r.label}</b>
          {r.on && <span className={styles.tag}>house rule</span>}
        </span>
        {r.kind !== 'grades' && (
          <label className={styles.switch}>
            <input type="checkbox" checked={r.on} aria-label={r.label}
              onChange={(e) => ed.edit((c) => setRule(c, r.key, e.target.checked), `${r.label}: ${e.target.checked ? 'house rule on' : 'as written again'}.`, KEEP)} />
            <span aria-hidden="true" />
          </label>
        )}
      </div>
      <span className={styles.std}>{r.on && r.effect ? `${r.effect} · ` : ''}As written: {r.std}</span>
      {r.kind === 'grades' && (
        <div className={trade.seg} role="group" aria-label={r.label}>
          {r.grades.map((g) => (
            <button key={g.grade} type="button" aria-pressed={g.played}
              onClick={() => ed.edit((c) => setGrade(c, r.key as 'hsGrades' | 'dpGrades', g.grade, !g.played), `Grade ${g.grade} ${g.played ? 'is not played' : 'is played again'}.`, KEEP)}>
              {g.grade}
            </button>
          ))}
        </div>
      )}
      {r.on && r.value && (
        <div className={styles.value}>
          <span className={trade.stepper}>
            <button type="button" aria-label={`Less: ${r.label}`} disabled={!r.canLess} onClick={() => ed.edit((c) => stepRule(c, r.key, -1), undefined, KEEP)}>−</button>
            <output aria-live="polite">{r.value}</output>
            <button type="button" aria-label={`More: ${r.label}`} disabled={!r.canMore} onClick={() => ed.edit((c) => stepRule(c, r.key, 1), undefined, KEEP)}>+</button>
          </span>
          {r.unit && <span className={ui.muted}>{r.unit}</span>}
        </div>
      )}
      {r.bodyOnly != null && (
        <label className={trade.check}>
          <input type="checkbox" checked={r.bodyOnly} onChange={(e) => ed.edit((c) => setBodyOnly(c, e.target.checked), undefined, KEEP)} />
          Body armour only, not helmets, shields and bucklers
        </label>
      )}
    </div>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const v = houseView(data, ed.state);
  const saved = core.houseRules(ed.state).notes ?? '';
  const [notes, setNotes] = useState<string | null>(null);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';
  const decl = declaration(ctx);
  const locked = core.tradeLocked(ctx);

  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {name}</Link>
        <h1>House rules</h1>
      </div>
      <p>Everything is played as written unless a house rule is switched on here. Every export names the rules that are on.</p>
      <dl className={trade.figures}>
        <div><dt>House rules on</dt><dd>{v.count}</dd></div>
        <div><dt>Gold in hand</dt><dd>{core.goldCurrent(ctx)} gc</dd></div>
      </dl>
      <p className={ui.muted}>{locked
        ? 'Prices count from the next purchase; gold already booked in the ledger stays as it is.'
        : 'Until the first battle, prices change what the warband has spent – and so its gold.'}</p>

      {v.groups.map((g) => (
        <section key={g.key} className={styles.group} aria-label={g.label}>
          <h2>{g.label}</h2>
          {g.rules.map((r) => <Rule key={r.key} r={r} ed={ed} />)}
        </section>
      ))}

      <section className={styles.group} aria-labelledby="hr-notes">
        <h2 id="hr-notes">Notes</h2>
        <label className={ui.field}>
          <span className={ui.muted}>Printed with the roster and named on every export</span>
          <textarea className={ui.input} rows={3} value={notes ?? saved} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes != null && notes !== saved) ed.edit((c) => core.setHouseNotes(c, notes), 'House rule notes saved.', KEEP); setNotes(null); }} />
        </label>
      </section>

      <section className={styles.group} aria-labelledby="hr-export">
        <h2 id="hr-export">On every export</h2>
        <p className={styles.declared}>{decl || 'Nothing: the rules as written.'}</p>
      </section>

      {v.count > 0 || saved ? (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => ed.edit((c) => core.resetHouse(c), 'All house rules off: the rules as written.', KEEP)}>All back to the rules as written</button>
        </div>
      ) : null}
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function HouseRules() {
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

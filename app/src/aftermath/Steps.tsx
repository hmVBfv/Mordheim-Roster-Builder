/* The steps of the post-battle sequence (phase 4a4; N2 of docs/plan-postbattle.md): each step's body, the list of steps with its progress. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import { fromAftermath } from './back.ts';
import { experienceTables, injuryTables, locationGroups, shardsTable, type TableData } from './tables.ts';
import { DramatisStep, EquipmentStep, RareStep, RecruitsStep } from './BuyingSteps.tsx';
import { ExperienceStep } from './ExperienceStep.tsx';
import { ExplorationStep } from './ExplorationStep.tsx';
import { UpkeepSection } from './UpkeepSection.tsx';
import { VeteransStep } from './VeteransStep.tsx';
import { WyrdStep } from './WyrdStep.tsx';
import type { UnderdogView } from './underdog.ts';
import type { AftermathView, CasualtyView } from './view.ts';
import { WyrdPrices } from './WyrdPrices.tsx';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

const RESULT_NAME: Record<string, string> = { pending: 'To roll', recovered: 'Recovered', injured: 'Injured', dead: 'Dead' };

/** The casualties of the battle in a table: who, the roll, the result and what it means; our open ones have their "Roll" button. The other
    players' casualties are theirs to roll – listed apart. */
function CasualtyTable({ rows, caption, onRoll }: { rows: CasualtyView[]; caption: string; onRoll?: (c: CasualtyView) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.casualties}>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Warrior</th><th scope="col">Roll</th><th scope="col">Result</th><th scope="col">Action</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.name}{c.by ? <small>out of action by {c.by}</small> : null}</th>
              <td>{c.roll || '–'}</td>
              <td>{RESULT_NAME[c.result] ?? c.result}{c.meaning && c.result !== 'pending' ? <small> {c.meaning}</small> : null}</td>
              <td>{onRoll && c.open ? <button type="button" className={ui.button} aria-label={`Roll for ${c.name}`} onClick={() => onRoll(c)}>Roll</button> : c.ours && c.result !== 'pending' ? <span className={styles.done} role="img" aria-label="rolled">✓</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface StepActs {
  ctx: core.Ctx;
  /** The underdog bonus worked out from the battle's frozen ratings, null when the battle is not at hand. */
  underdog: UnderdogView | null;
  edit: (action: (ctx: core.Ctx) => WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
  roll: (c: CasualtyView) => void;
}

function StepBody({ k, a, data, wid, acts }: { k: string; a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const from = fromAftermath(a.local.serverId);
  const roster = `/warbands/${wid}`;
  switch (k) {
    case 'injuries': return (
      <>
        <p>Heroes taken out of action roll a D66 on the Serious Injuries chart; Henchmen a D6 – 1–2 the man is dead, 3–6 he fights on.</p>
        {a.casualties.length === 0 && <p className={ui.muted}>No casualties in this battle.</p>}
        <CasualtyTable rows={a.casualties.filter((c) => c.ours)} caption="Your casualties" onRoll={acts.roll} />
        <CasualtyTable rows={a.casualties.filter((c) => !c.ours)} caption="The others’ casualties – their players roll for them" />
        {a.toRoll > 0 ? <p className={styles.warn}>{a.toRoll} still to roll.</p> : <p className={ui.muted}>Nothing left to roll.</p>}
      </>
    );
    case 'experience': return <ExperienceStep a={a} data={data} acts={acts} underdog={acts.underdog} rosterLink={`${roster}${from}`} />;
    case 'exploration': return <ExplorationStep a={a} data={data} acts={acts} />;
    case 'wyrdstone': return <><WyrdStep a={a} data={data} acts={acts} /><UpkeepSection a={a} acts={acts} /></>;
    case 'veterans': return <VeteransStep acts={acts} recruitLink={`${roster}${from}`} />;
    case 'rare': return <RareStep a={a} ctx={acts.ctx} tradeLink={`${roster}/trade${from}`} />;
    case 'dramatis': return <DramatisStep ctx={acts.ctx} hireLink={`${roster}/hire${from}`} />;
    case 'recruits': return <RecruitsStep a={a} ctx={acts.ctx} rosterLink={`${roster}${from}`} tradeLink={`${roster}/trade${from}`} />;
    case 'equipment': return <EquipmentStep ctx={acts.ctx} rosterLink={`${roster}${from}`} tradeLink={`${roster}/trade${from}`} />;
    case 'rating': return <p>Warband rating for the next battle: <strong>{a.rating}</strong>.</p>;
    default: return null;
  }
}

/** The tables a step is done with, folded away: the rule at hand without leaving the page. */
function StepTables({ k, a, data }: { k: string; a: AftermathView; data: GameData }) {
  const t = (x: TableData) => <RulesTable key={x.id} caption={x.title} head={x.head} rows={x.rows} note={x.note} link={x.link} rowHeads={false} />;
  let body: React.ReactNode = null;
  if (k === 'injuries') { const i = injuryTables(data); body = <>{t(i.hero)}{t(i.hench)}</>; }
  else if (k === 'experience') { const e = experienceTables(data); body = <>{t(e.awards)}{t(e.underdog)}{t(e.hero)}{t(e.hench)}</>; }
  else if (k === 'exploration') body = <>{t(shardsTable(data))}{locationGroups(data).map((g) => <details key={g.id}><summary className={ui.fold}>{g.title}</summary>{t(g.table)}</details>)}</>;
  else if (k === 'wyrdstone') body = <WyrdPrices size={a.wyrd.size} shards={a.wyrd.sold ? a.wyrd.sold.shards : a.wyrd.shards || null} />;
  if (!body) return null;
  return <details className={styles.tables}><summary className={ui.fold}>Tables</summary>{body}</details>;
}

/** Where we are: "Step 3 of 10" and ten marks, each of which takes you to its step. */
function Progress({ a }: { a: AftermathView }) {
  const doneAll = a.steps.every((s) => s.done);
  const at = a.steps.findIndex((s) => s.active);
  const go = (key: string) => document.getElementById(`am-step-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className={styles.progress}>
      <p aria-live="polite">{doneAll ? 'All ten steps done' : `Step ${at + 1} of ${a.steps.length}: ${a.steps[at]?.title}`}</p>
      <ol className={styles.dots} aria-label="Steps">
        {a.steps.map((s, i) => (
          <li key={s.key}>
            <button type="button" className={`${styles.dot} ${s.done ? styles.dotDone : ''} ${s.active ? styles.dotActive : ''}`} aria-label={`${i + 1}. ${s.title}${s.done ? ', done' : ''}`}
              aria-current={s.active ? 'step' : undefined} onClick={() => go(s.key)}>{s.done ? '✓' : i + 1}</button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Steps({ a, data, wid, acts }: { a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const lastDone = a.steps.filter((s) => s.done).at(-1)?.key;
  return (
    <section aria-labelledby="am-steps" className={ui.page}>
      <h2 id="am-steps">After the battle</h2>
      <Progress a={a} />
      <ol className={styles.steps}>
        {a.steps.map((s, i) => (
          <li key={s.key} id={`am-step-${s.key}`} className={`${styles.step} ${s.active ? styles.active : ''} ${s.locked ? styles.locked : ''}`} aria-current={s.active ? 'step' : undefined}>
            <div className={styles.stepHead}>
              <span className={styles.num}>{s.done ? '✓' : i + 1}</span>
              <h3>{s.title}</h3>
              <a href={s.link} {...ext} className={styles.chart} aria-label={`${s.title} on mordheimer.net`}>Rules ↗</a>
            </div>
            {s.summary && (s.done || s.active) && <p className={styles.result} aria-label={`${s.title}: result`}>{s.summary}</p>}
            {s.active && (
              <div className={styles.stepBody}>
                <StepBody k={s.key} a={a} data={data} wid={wid} acts={acts} />
                <StepTables k={s.key} a={a} data={data} />
                <div className={ui.row}>
                  <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.setPostBattleStep(c, s.key, true, a.round))}>Done – next step</button>
                </div>
              </div>
            )}
            {s.done && <StepTables k={s.key} a={a} data={data} />}
            {s.done && s.key === lastDone && (
              <div className={ui.row}>
                <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.setPostBattleStep(c, s.key, false, a.round))}>Back to this step</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {a.steps.every((s) => s.done) && <p className={ui.message}>The sequence is done. Look over what changed, then mark it.</p>}
    </section>
  );
}

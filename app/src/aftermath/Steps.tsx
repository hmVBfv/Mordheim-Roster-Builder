/* The steps of the post-battle sequence (phase 4a4; N2 of docs/plan-postbattle.md): each step's body, the list of steps with its progress. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import { fromAftermath } from './back.ts';
import { experienceTables, injuryTables, locationGroups, shardsTable, type TableData } from './tables.ts';
import { ExperienceStep } from './ExperienceStep.tsx';
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

/** A step done elsewhere in the app: what it asks, and where. */
function Go({ text, links }: { text: string; links: [string, string][] }) {
  return (
    <>
      <p>{text}</p>
      <div className={ui.row}>{links.map(([to, label]) => <Link key={label} to={to} className={ui.buttonQuiet}>{label}</Link>)}</div>
    </>
  );
}

function StepBody({ k, a, data, wid, acts }: { k: string; a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const [sell, setSell] = useState(a.wyrd.shards);
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
    case 'exploration': return (
      <>
        <p>
          Roll <strong>{a.explore.capped}</strong> {a.explore.capped === 1 ? 'die' : 'dice'}: one for each Hero not taken out of action
          {a.explore.searching.length ? ` (${a.explore.searching.join(', ')})` : ''}{a.explore.winDie ? ', one for the win' : ''}{a.explore.base > 6 ? ', six at most' : ''} – dice from skills and equipment come on top.
          Total them and read the Exploration chart; doubles or better find a special location.
        </p>
        <div className={styles.stepper}>
          <span>Wyrdstone in the stash</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard less" disabled={a.wyrd.shards <= 0} onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', -1))}>−</button>
          <span aria-live="polite">{a.wyrd.shards}</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard more" onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', 1))}>+</button>
        </div>
      </>
    );
    case 'wyrdstone': {
      const n = Math.max(1, Math.min(a.wyrd.shards, sell || a.wyrd.shards));
      return (
        <>
          <p>Wyrdstone is sold once after each battle. The price is for the whole lot, not per shard – smaller lots fetch more each, and a larger warband earns less.</p>
          {a.wyrd.sold
            ? (
              <div className={ui.row}>
                <span>✓ Sold {a.wyrd.sold.shards} shard{a.wyrd.sold.shards === 1 ? '' : 's'} for {a.wyrd.sold.gc} gc (warband of {a.wyrd.sold.size}).</span>
                <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoWyrdstoneSale(c, a.round), 'Sale taken back.')}>Take the sale back</button>
              </div>
            )
            : a.wyrd.shards < 1
              ? <p className={ui.muted}>No wyrdstone in the stash to sell.</p>
              : (
                <>
                  <p>Stash: {a.wyrd.shards} shard{a.wyrd.shards === 1 ? '' : 's'} · warband of {a.wyrd.size} (band {a.wyrd.band}).</p>
                  <div className={styles.stepper}>
                    <span>Sell</span>
                    <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard less" disabled={n <= 1} onClick={() => setSell(n - 1)}>−</button>
                    <span aria-live="polite">{n}</span>
                    <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard more" disabled={n >= a.wyrd.shards} onClick={() => setSell(n + 1)}>+</button>
                    <button type="button" className={ui.button} onClick={() => acts.edit((c) => core.sellWyrdstone(c, a.round, n), `Sold ${n} shard${n === 1 ? '' : 's'} for ${a.wyrd.price(n)} gc.`)}>Sell for {a.wyrd.price(n)} gc</button>
                  </div>
                </>
              )}
        </>
      );
    }
    case 'veterans': return <Go text="Roll 2D6: new recruits may bring experience up to that total between them." links={[[`${roster}/hire${from}`, 'Hire']]} />;
    case 'rare': return <Go text="A Hero not taken out of action may look for one rare item: 2D6 against its rarity. What he finds is bought at the Trading Post." links={[[`${roster}/trade${from}`, 'Trading Post']]} />;
    case 'dramatis': return <Go text="A Dramatis Persona may be found, if the warband may hire one and can pay." links={[[`${roster}/hire${from}`, 'Hire']]} />;
    case 'recruits': return <Go text={`Hire new warriors and buy common equipment. Gold in hand: ${a.gold} gc.`} links={[[`${roster}${from}`, '+ Recruit on the roster'], [`${roster}/trade${from}`, 'Trading Post']]} />;
    case 'equipment': return <Go text="Equipment may move freely between warriors; new warriors may take rare items from the stash." links={[[`${roster}${from}`, 'The roster']]} />;
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

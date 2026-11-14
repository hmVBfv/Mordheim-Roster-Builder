/* The steps of the post-battle sequence (phase 4a4; N2 of docs/plan-postbattle.md): each step's body, the list of steps with its progress. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { useState } from 'react';
import { Link } from 'react-router';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import { grantBattleXp, type AftermathView, type CasualtyView } from './view.ts';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

function CasualtyRow({ c, onRoll }: { c: CasualtyView; onRoll: () => void }) {
  return (
    <li className={styles.casualty}>
      <span>{c.text}{!c.ours && <small> Their player rolls for them.</small>}</span>
      {c.open && <button type="button" className={ui.button} onClick={onRoll}>Roll</button>}
      {c.ours && !c.open && c.result !== 'pending' && <span className={styles.done}>✓</span>}
    </li>
  );
}

export interface StepActs {
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
  const roster = `/warbands/${wid}`;
  switch (k) {
    case 'injuries': return (
      <>
        <p>Heroes taken out of action roll a D66 on the Serious Injuries chart; Henchmen a D6 – 1–2 the man is dead, 3–6 he fights on.</p>
        {a.casualties.length === 0 && <p className={ui.muted}>No casualties in this battle.</p>}
        <ul className={styles.plain} aria-label="Casualties">
          {a.casualties.map((c) => <CasualtyRow key={c.id} c={c} onRoll={() => acts.roll(c)} />)}
        </ul>
        {a.toRoll > 0 ? <p className={styles.warn}>{a.toRoll} still to roll.</p> : <p className={ui.muted}>Nothing left to roll.</p>}
      </>
    );
    case 'experience': return (
      <>
        <p>+1 to every Hero and Henchman group that survived, +1 to the leader of the winning warband, +1 to a Hero for every enemy he put out of action. A scenario may give more: add that on the roster.</p>
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={a.xpAwarded}
            onClick={() => acts.edit((c) => grantBattleXp(data, c, a.local.id), 'The battle’s experience is held, ready to write onto the roster.')}>
            {a.xpAwarded ? '✓ Battle experience granted' : 'Grant the battle’s experience'}
          </button>
        </div>
        {a.pendingXp.length > 0 && (
          <ul className={styles.plain} aria-label="Experience held">
            {a.pendingXp.map((x) => <li key={x.id}>{x.name} +{x.amount} <small className={ui.muted}>{x.reason}</small></li>)}
          </ul>
        )}
        {(a.pendingXp.length > 0 || a.deathsToApply > 0) && (
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={() => acts.edit((c) => core.applyBattleResults(c), 'Written onto the roster.', { gold: 'keep' })}>Write it onto the roster</button>
          </div>
        )}
        {a.advancesDue.length > 0 && (
          <>
            <p>Advance due: {a.advancesDue.join(', ')}.</p>
            <div className={ui.row}><Link to={roster} className={ui.buttonQuiet}>Roll it on the roster</Link></div>
          </>
        )}
      </>
    );
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
    case 'veterans': return <Go text="Roll 2D6: new recruits may bring experience up to that total between them." links={[[`${roster}/hire`, 'Hire']]} />;
    case 'rare': return <Go text="A Hero not taken out of action may look for one rare item: 2D6 against its rarity. What he finds is bought at the Trading Post." links={[[`${roster}/trade`, 'Trading Post']]} />;
    case 'dramatis': return <Go text="A Dramatis Persona may be found, if the warband may hire one and can pay." links={[[`${roster}/hire`, 'Hire']]} />;
    case 'recruits': return <Go text={`Hire new warriors and buy common equipment. Gold in hand: ${a.gold} gc.`} links={[[roster, '+ Recruit on the roster'], [`${roster}/trade`, 'Trading Post']]} />;
    case 'equipment': return <Go text="Equipment may move freely between warriors; new warriors may take rare items from the stash." links={[[roster, 'The roster']]} />;
    case 'rating': return <p>Warband rating for the next battle: <strong>{a.rating}</strong>.</p>;
    default: return null;
  }
}

export function Steps({ a, data, wid, acts }: { a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const lastDone = a.steps.filter((s) => s.done).at(-1)?.key;
  return (
    <section aria-labelledby="am-steps" className={ui.page}>
      <h2 id="am-steps">After the battle</h2>
      <ol className={styles.steps}>
        {a.steps.map((s, i) => (
          <li key={s.key} className={`${styles.step} ${s.active ? styles.active : ''} ${s.locked ? styles.locked : ''}`} aria-current={s.active ? 'step' : undefined}>
            <div className={styles.stepHead}>
              <span className={styles.num}>{s.done ? '✓' : i + 1}</span>
              <h3>{s.title}</h3>
              <a href={s.link} {...ext} className={styles.chart} aria-label={`${s.title} on mordheimer.net`}>Rules ↗</a>
            </div>
            {s.active && (
              <div className={styles.stepBody}>
                <StepBody k={s.key} a={a} data={data} wid={wid} acts={acts} />
                <div className={ui.row}>
                  <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.setPostBattleStep(c, s.key, true, a.round))}>Done – next step</button>
                </div>
              </div>
            )}
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

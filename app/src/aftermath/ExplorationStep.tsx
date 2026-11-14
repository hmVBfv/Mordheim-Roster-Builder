/* Step 3, exploration (N5): the dice go in – typed from the table or rolled here – and the total gives the shards, a double or better the
   unusual place; "Record" puts the shards into the stash and keeps the roll, taking it back undoes it. Dice from skills and equipment are
   added with "+ A die" (docs/plan-postbattle.md, N6 offers them by name). Rolling is done here: core only reads numbers. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { useMemo, useState } from 'react';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import { locationGroups, shardsTable } from './tables.ts';
import type { AftermathView } from './view.ts';

export interface ExploreActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

const die = (v: string): number | null => { const n = Number(v); return v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 6 ? n : null; };
const rollDie = (): number => 1 + Math.floor(Math.random() * 6);

export function ExplorationStep({ a, data, acts }: { a: AftermathView; data: GameData; acts: ExploreActs }) {
  const [dice, setDice] = useState<string[]>(() => Array(Math.max(1, a.explore.base)).fill(''));
  const [by, setBy] = useState<'entered' | 'app'>('entered');
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [used, setUsed] = useState<string[]>([]);
  const [rerolls, setRerolls] = useState(0);
  const [adjusts, setAdjusts] = useState(0);
  const rec = a.exploreRecord;
  const allowances = useMemo(() => core.exploreAllowances(acts.ctx, a.round), [acts.ctx, a.round]);
  const usedList = allowances.filter((x) => used.includes(x.id));
  const sum = (k: 'reroll' | 'adjust' | 'drop') => usedList.reduce((n, x) => n + x[k], 0);
  const rerollsLeft = sum('reroll') - rerolls, adjustsLeft = sum('adjust') - adjusts, usedDrop = sum('drop');
  const places = useMemo(() => Object.fromEntries(data.PB_LOCATIONS.map((l) => [l[0], l])), [data]);

  const values = dice.map(die);
  const complete = values.every((v) => v != null);
  const rolled = complete ? (values as number[]) : [];
  // more than six dice: the best six are kept unless the player chose; a die that was taken out of the six is `dropped`
  // the dice kept: at most six, and one less for each die a rule lets the player discard; by default the lowest are dropped, the player may choose
  const keptTarget = Math.max(1, Math.min(core.EXPLORE_DICE_MAX, rolled.length - usedDrop));
  const dropCount = rolled.length - keptTarget;
  const lowest = new Set(rolled.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0] || y[1] - x[1]).slice(0, dropCount).map(([, i]) => i));
  const dropSet = dropped.size === dropCount ? dropped : lowest;
  const keptIdx = rolled.flatMap((_, i) => (dropSet.has(i) ? [] : [i]));
  const kept = keptIdx.map((i) => rolled[i] as number);
  const result = complete && kept.length ? core.exploreResult(data, kept) : null;
  const problem = complete ? core.explorationProblem(acts.ctx, a.round, { rolled, kept, by, used }) : null;
  const tooMany = kept.length > core.EXPLORE_DICE_MAX;
  const place = result?.location ? places[result.location] : undefined;

  const set = (i: number, v: string) => { setDice((d) => d.map((x, j) => (j === i ? v.replace(/\D/g, '').slice(0, 1) : x))); setBy('entered'); setDropped(new Set()); };
  const rollAll = () => { setDice((d) => d.map(() => String(rollDie()))); setBy('app'); setDropped(new Set()); };
  const applyAllowance = (x: core.Allowance) => { setUsed((u) => [...u, x.id]); if (x.dice) setDice((d) => [...d, ...Array(x.dice).fill('')]); setDropped(new Set()); };
  const rerollDie = (i: number) => { setDice((d) => d.map((v, j) => (j === i ? String(rollDie()) : v))); setBy('app'); setRerolls((n) => n + 1); setDropped(new Set()); };
  const adjustDie = (i: number, by1: number) => { setDice((d) => d.map((v, j) => (j === i ? String(Math.min(6, Math.max(1, Number(v) + by1))) : v))); setAdjusts((n) => n + 1); setDropped(new Set()); };
  const toggleKeep = (i: number) => setDropped(() => {
    // the number of dice kept is fixed: keeping a die drops the lowest of the others, dropping one lets the oldest drop go
    const next = new Set(dropSet);
    if (next.has(i)) {
      next.delete(i);
      const other = rolled.map((v, k) => [v, k] as const).filter(([, k]) => k !== i && !next.has(k)).sort((x, y) => x[0] - y[0] || y[1] - x[1])[0];
      if (other) next.add(other[1]);
    } else {
      next.add(i);
      while (next.size > dropCount) next.delete(next.values().next().value as number);
    }
    return next;
  });
  const record = () => acts.edit((c) => core.recordExploration(c, a.round, { rolled, kept, by, used }), result ? `Explored: ${result.shards} shard${result.shards === 1 ? '' : 's'} into the stash.` : undefined);
  const shardsRow = result ? data.PB_EXPLORE_SHARDS.findIndex(([, n]) => n === result.shards) : null;
  const sh = shardsTable(data);

  return (
    <>
      <p>
        Roll <strong>{a.explore.capped}</strong> {a.explore.capped === 1 ? 'die' : 'dice'}: one for each Hero not taken out of action
        {a.explore.searching.length ? ` (${a.explore.searching.join(', ')})` : ''}{a.explore.winDie ? ', one for the win' : ''}{a.explore.base > 6 ? ', six at most' : ''}. Dice from skills and equipment
        come on top – add them with “+ A die”. Type what the table showed, or roll here.
      </p>

      {rec && (
        <div className={styles.recorded}>
          <p>
            <strong>✓ Explored:</strong> {rec.kept.join(' + ')} = {rec.total} → {rec.shards} shard{rec.shards === 1 ? '' : 's'}
            {rec.rolled.by === 'app' ? ' (rolled in the app)' : ''}.
            {rec.location && places[rec.location] ? ` An unusual place: ${places[rec.location]![1]}.` : ''}
          </p>
          {rec.location && places[rec.location] && <p className={ui.muted}>{places[rec.location]![2]}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.clearExploration(c, a.round), 'Exploration taken back.')}>Take it back</button>
          </div>
        </div>
      )}

      {allowances.length > 0 && (
        <fieldset className={styles.scenario}>
          <legend>What helps this warband</legend>
          <ul className={styles.plain}>
            {allowances.map((x) => (
              <li key={x.id} className={styles.allowance}>
                <span><strong>{x.name}</strong> <small className={ui.muted}>({x.from})</small><br /><small>{x.text}</small></span>
                <button type="button" className={ui.buttonQuiet} disabled={used.includes(x.id) || !!rec} aria-label={`Use ${x.name}`} onClick={() => applyAllowance(x)}>
                  {used.includes(x.id) ? 'Used' : x.dice ? `+${x.dice} die` : x.reroll ? (x.reroll >= 6 ? 'Re-roll all' : `Re-roll ${x.reroll}`) : x.adjust ? '±1' : 'Use'}
                </button>
              </li>
            ))}
          </ul>
          {rerollsLeft > 0 && <p className={ui.muted}>Tap ↻ beside a die to roll it again – the second result stands. {rerollsLeft} left.</p>}
          {adjustsLeft > 0 && <p className={ui.muted}>Change a die by one with −1 / +1. {adjustsLeft} left.</p>}
        </fieldset>
      )}

      <fieldset className={styles.scenario}>
        <legend>{rec ? 'Roll again (replaces the record)' : 'The dice'}</legend>
        <div className={styles.dice}>
          {dice.map((v, i) => (
            <label key={i} className={styles.die}>
              <span className={styles.dieNo}>{i + 1}</span>
              <input type="text" inputMode="numeric" maxLength={1} className={ui.input} aria-label={`Die ${i + 1}`} value={v} onChange={(e) => set(i, e.target.value)} />
              {complete && rerollsLeft > 0 && <button type="button" className={ui.buttonQuiet} aria-label={`Re-roll die ${i + 1}`} onClick={() => rerollDie(i)}>↻</button>}
              {complete && adjustsLeft > 0 && (
                <span className={styles.adjust}>
                  <button type="button" className={ui.buttonQuiet} aria-label={`Die ${i + 1} one lower`} disabled={Number(v) <= 1} onClick={() => adjustDie(i, -1)}>−1</button>
                  <button type="button" className={ui.buttonQuiet} aria-label={`Die ${i + 1} one higher`} disabled={Number(v) >= 6} onClick={() => adjustDie(i, 1)}>+1</button>
                </span>
              )}
              {dropCount > 0 && (
                <span className={styles.keep}><input type="checkbox" checked={keptIdx.includes(i)} onChange={() => toggleKeep(i)} aria-label={`Keep die ${i + 1}`} /></span>
              )}
            </label>
          ))}
        </div>
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={rollAll}>Roll all</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => setDice((d) => [...d, ''])}>+ A die</button>
          <button type="button" className={ui.buttonQuiet} disabled={dice.length <= 1} onClick={() => { setDice((d) => d.slice(0, -1)); setDropped(new Set()); }}>− A die</button>
        </div>
      </fieldset>

      {result && (
        <div className={styles.recorded} aria-live="polite">
          <p>
            {dropCount > 0 ? `${kept.length} kept: ${kept.join(' + ')}` : kept.join(' + ')} = <strong>{result.total}</strong> → <strong>{result.shards} shard{result.shards === 1 ? '' : 's'}</strong>.
          </p>
          {place ? <p><strong>An unusual place: {place[1]}.</strong> {place[2]}</p> : <p className={ui.muted}>No double, no unusual place.</p>}
          {tooMany && <p className={styles.warn}>Keep at most six dice.</p>}
          {problem && <p className={styles.warn}>{problem}</p>}
        </div>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!result || !!problem || tooMany} onClick={record}>
          {result ? `Record: ${result.shards} shard${result.shards === 1 ? '' : 's'} into the stash` : 'Record the exploration'}
        </button>
      </div>

      <RulesTable caption={sh.title} head={sh.head} rows={sh.rows} row={shardsRow != null && shardsRow >= 0 ? shardsRow : null} rowHeads={false} link={sh.link} />
      {result?.location && (
        <RulesTable caption="The place found" head={['Dice', 'Place', 'What you find']} rowHeads={false} rows={[place ? [place[0].split(' ').join(' · '), place[1], place[2]] : []]} />
      )}
      <details className={styles.tables}>
        <summary className={ui.fold}>All places of the chart</summary>
        {locationGroups(data).map((g) => <RulesTable key={g.id} caption={g.title} head={g.table.head} rows={g.table.rows} rowHeads={false} row={result?.location ? g.table.rows.findIndex((r) => r[1] === place?.[1]) : null} />)}
      </details>

      <details className={styles.tables}>
        <summary className={ui.fold}>Correct the stash by hand</summary>
        <div className={styles.stepper}>
          <span>Wyrdstone in the stash</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard less" disabled={a.wyrd.shards <= 0} onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', -1))}>−</button>
          <span aria-live="polite">{a.wyrd.shards}</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard more" onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', 1))}>+</button>
        </div>
      </details>
    </>
  );
}

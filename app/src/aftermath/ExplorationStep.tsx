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
  const rec = a.exploreRecord;
  const places = useMemo(() => Object.fromEntries(data.PB_LOCATIONS.map((l) => [l[0], l])), [data]);

  const values = dice.map(die);
  const complete = values.every((v) => v != null);
  const rolled = complete ? (values as number[]) : [];
  // more than six dice: the best six are kept unless the player chose; a die that was taken out of the six is `dropped`
  const best = new Set(rolled.map((v, i) => [v, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]).slice(0, core.EXPLORE_DICE_MAX).map(([, i]) => i));
  const keptIdx = rolled.length > core.EXPLORE_DICE_MAX ? rolled.flatMap((_, i) => (dropped.size ? (!dropped.has(i) ? [i] : []) : (best.has(i) ? [i] : []))) : rolled.map((_, i) => i);
  const kept = keptIdx.map((i) => rolled[i] as number);
  const result = complete && kept.length ? core.exploreResult(data, kept) : null;
  const problem = complete ? core.explorationProblem(acts.ctx, a.round, { rolled, kept, by }) : null;
  const tooMany = rolled.length > core.EXPLORE_DICE_MAX && kept.length > core.EXPLORE_DICE_MAX;
  const place = result?.location ? places[result.location] : undefined;

  const set = (i: number, v: string) => { setDice((d) => d.map((x, j) => (j === i ? v.replace(/\D/g, '').slice(0, 1) : x))); setBy('entered'); setDropped(new Set()); };
  const rollAll = () => { setDice((d) => d.map(() => String(rollDie()))); setBy('app'); setDropped(new Set()); };
  const toggleKeep = (i: number) => setDropped((cur) => { const base = cur.size ? cur : new Set(rolled.map((_, k) => k).filter((k) => !best.has(k))); const next = new Set(base); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  const record = () => acts.edit((c) => core.recordExploration(c, a.round, { rolled, kept, by }), result ? `Explored: ${result.shards} shard${result.shards === 1 ? '' : 's'} into the stash.` : undefined);
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

      <fieldset className={styles.scenario}>
        <legend>{rec ? 'Roll again (replaces the record)' : 'The dice'}</legend>
        <div className={styles.dice}>
          {dice.map((v, i) => (
            <label key={i} className={styles.die}>
              <span className={styles.dieNo}>{i + 1}</span>
              <input type="text" inputMode="numeric" maxLength={1} className={ui.input} aria-label={`Die ${i + 1}`} value={v} onChange={(e) => set(i, e.target.value)} />
              {rolled.length > core.EXPLORE_DICE_MAX && (
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
            {rolled.length > core.EXPLORE_DICE_MAX ? `Six kept: ${kept.join(' + ')}` : kept.join(' + ')} = <strong>{result.total}</strong> → <strong>{result.shards} shard{result.shards === 1 ? '' : 's'}</strong>.
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

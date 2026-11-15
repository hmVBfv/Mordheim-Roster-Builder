/* The rules that ask for a roll after a battle (Rob, 15.11.2026): the Marauders' Eye of the Gods and the Huckster's Slick Operator. The dice are typed from
   the table or rolled here (recorded as rolled in the app); core reads the numbers, says what they bring, and applies it. */
import * as core from '@mordheim/core';
import { useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import type { DutyActs } from './DutiesStep.tsx';

const rollDie = (): number => 1 + Math.floor(Math.random() * 6);
const dieOf = (s: string): number | null => (/^[1-6]$/.test(s) ? Number(s) : null);

function DiceField({ label, n, value, onChange }: { label: string; n: number; value: string[]; onChange: (v: string[], by?: 'app') => void }) {
  return (
    <div className={ui.row}>
      {Array.from({ length: n }, (_, i) => (
        <label key={i} className={ui.field}><span>{n > 1 ? `${label} ${i + 1}` : label}</span>
          <input className={ui.input} inputMode="numeric" maxLength={1} autoComplete="off" value={value[i] ?? ''} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value.replace(/[^1-6]/g, '') : v)))} />
        </label>
      ))}
      <button type="button" className={ui.buttonQuiet} onClick={() => onChange(Array.from({ length: n }, () => String(rollDie())), 'app')}>Roll {n === 1 ? 'it' : 'them'} here</button>
    </div>
  );
}

function Line({ d, acts, round }: { d: core.RollDutyLine; acts: DutyActs; round: number }) {
  const [by, setBy] = useState<'entered' | 'app'>('entered');
  const [d1, setD1] = useState<string[]>(['', '']);
  const [gold, setGold] = useState<string[]>(['', '']);
  // the battle record fills what it knows; the player confirms or corrects it
  const [result, setResult] = useState<'won' | 'lost' | 'draw' | ''>(d.suggest?.result ?? '');
  const [count, setCount] = useState(String(d.suggest?.count ?? 0));
  const [fought, setFought] = useState(d.suggest?.leaderFought ?? true);
  const [mark, setMark] = useState('');
  const [has, setHas] = useState(false);
  const eye = d.kind === 'eye';
  const dice = (v: string[], n: number) => { const x = v.slice(0, n).map(dieOf); return x.every((k) => k !== null) && x.length === n ? (x as number[]) : null; };
  const rolled = dice(d1, eye ? 2 : 1), goldDice = dice(gold, 2);
  const input: core.RollDutyInput = eye
    ? (has ? { alreadyMarked: true } : fought ? { result: result || undefined, count: /^\d+$/.test(count) ? Number(count) : -1, roll: rolled ? { value: rolled, by } : undefined, mark: mark || undefined } : { leaderFought: false })
    : { roll: rolled ? { value: rolled, by } : undefined, gold: goldDice ? { value: goldDice, by } : undefined };
  const problem = core.rollDutyProblem(acts.ctx, round, d.id, input);
  const slickGold = !eye && rolled && rolled[0]! >= 2;
  const total = eye && fought && rolled && result && /^\d+$/.test(count) ? rolled[0]! + rolled[1]! + (result === 'draw' ? 0 : Number(count)) : null;
  const need = core.eyeThreshold(acts.ctx);
  const wantsMark = eye && total !== null && total >= need && result === 'won';
  // a warband that follows a Mark may take only that one, or Chaos Undivided
  const marks = acts.ctx.data.MARAUDER_MARKS.filter(([k]) => !acts.ctx.s.mark || k === acts.ctx.s.mark || k === 'undivided');
  const track = (set: (v: string[]) => void) => (n: string[], b?: 'app') => { set(n); setBy(b ?? 'entered'); };

  if (d.resolved) {
    return (
      <div className={styles.recorded}>
        <p><strong>✓ {d.title}:</strong> {d.resolved.text}</p>
        {d.resolved.outcome !== 'spawn' && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoRollDuty(c, round, d.id), 'Taken back.', { gold: 'keep' })}>Take it back</button></div>}
      </div>
    );
  }
  return (
    <fieldset className={styles.scenario}>
      <legend>{d.title}</legend>
      <p>{d.text}</p>
      {d.blocked && <p className={styles.warn}>{d.blocked}</p>}
      {eye && d.suggest && <p className={ui.muted}>{d.suggest.from}</p>}
      {eye && acts.ctx.s.mark && (
        <label className={ui.row}><input type="checkbox" checked={has} onChange={(e) => setHas(e.target.checked)} /> The leader already has the warband’s Mark (no roll)</label>
      )}
      {eye && !has && (
        <label className={ui.row}><input type="checkbox" checked={fought} onChange={(e) => setFought(e.target.checked)} /> The leader fought in the battle</label>
      )}
      {(!eye || (fought && !has)) && (
        <>
          {eye && (
            <>
              <label className={ui.field}><span>How the battle ended</span>
                <select className={ui.input} value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
                  <option value="">Choose…</option><option value="won">Won</option><option value="lost">Lost</option><option value="draw">Drawn</option>
                </select>
              </label>
              <label className={ui.field}><span>{result === 'won' ? 'Enemy models the leader took out of action' : result === 'lost' ? 'Own Heroes taken out of action' : 'Count to add (none for a draw)'}</span>
                <input className={ui.input} inputMode="numeric" autoComplete="off" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} />
              </label>
            </>
          )}
          <DiceField label={eye ? '2D6, die' : 'D6'} n={eye ? 2 : 1} value={d1} onChange={track(setD1)} />
          {slickGold && <DiceField label="Gold, die" n={2} value={gold} onChange={track(setGold)} />}
          {total !== null && <p>Total <strong>{total}</strong> — needs {need}+{total >= need ? (result === 'won' ? ': the leader may take a Mark.' : result === 'lost' ? ': the leader turns into a Chaos Spawn.' : '.') : '.'}</p>}
          {wantsMark && (
            <label className={ui.field}><span>Mark of the Dark Gods</span>
              <select className={ui.input} value={mark} onChange={(e) => setMark(e.target.value)}>
                <option value="">Choose…</option>
                {marks.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {problem && !d.blocked && (rolled || !eye || !fought) && <p className={styles.warn}>{problem}</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!!problem || !!d.blocked} onClick={() => acts.edit((c) => core.resolveRollDuty(c, round, d.id, input), `${d.title}.`, { gold: 'keep' })}>Settle it</button>
      </div>
    </fieldset>
  );
}

export function RollDuties({ lines, acts, round }: { lines: core.RollDutyLine[]; acts: DutyActs; round: number }) {
  return <>{lines.map((d) => <Line key={d.id} d={d} acts={acts} round={round} />)}</>;
}

/* The place of the Exploration chart the dice led to (N8): its text, then the questions of the place one after the other (rolls typed or
   rolled here, tests, choices, which Hero), then what it brings – read before it is taken – and "Take it", which books it. Taking it back
   undoes it. The places and their rules are data (PB_LOCATION_RULES, N7); core walks them. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { useMemo, useState } from 'react';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import type { AftermathView } from './view.ts';

export interface LocationActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

const rollOf = (expr: string): number[] => {
  const m = /^(\d*)D(\d+)/i.exec(expr);
  const n = m?.[1] ? Number(m[1]) : 1, sides = m ? Number(m[2]) : 6;
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
};

function Question({ q, ctx, onAnswer }: { q: core.Question; ctx: core.Ctx; onAnswer: (v: core.Answer) => void }) {
  const [typed, setTyped] = useState<string[]>([]);
  const heroes = ctx.s.models.filter((m) => core.isHeroModel(ctx, m));
  if (q.kind === 'pass') {
    return (
      <div className={ui.row}>
        <button type="button" className={ui.button} onClick={() => onAnswer(true)}>Yes, passed</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => onAnswer(false)}>No, failed</button>
      </div>
    );
  }
  if (q.kind === 'hero') {
    return (
      <div className={ui.row}>
        {heroes.map((m) => <button key={m.uid} type="button" className={ui.buttonQuiet} onClick={() => onAnswer(m.uid)}>{core.modelLabel(ctx, m)}</button>)}
        {q.optional && <button type="button" className={ui.buttonQuiet} onClick={() => onAnswer('none')}>Nobody</button>}
      </div>
    );
  }
  if (q.kind === 'choice') {
    return <div className={ui.row}>{q.options!.map((o) => <button key={o.id} type="button" className={ui.buttonQuiet} onClick={() => onAnswer(o.id)}>{o.label}</button>)}</div>;
  }
  const n = q.dice ? (q.min ?? 1) : 1;
  const nums = typed.slice(0, n);
  const parsed = nums.map((x) => Number(x));
  const complete = nums.length === n && nums.every((x) => x.trim() !== '') && parsed.every((x) => Number.isInteger(x));
  return (
    <div className={styles.dice}>
      {Array.from({ length: n }, (_, i) => (
        <label key={i} className={styles.die}>
          <span className={styles.dieNo}>{q.dice ? i + 1 : `${q.min}–${q.max}`}</span>
          <input type="text" inputMode="numeric" maxLength={3} className={ui.input} aria-label={q.dice ? `Die ${i + 1}` : q.label} value={typed[i] ?? ''}
            onChange={(e) => setTyped((t) => { const next = [...t]; next[i] = e.target.value.replace(/\D/g, ''); return next; })} />
        </label>
      ))}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!complete} onClick={() => onAnswer(q.dice ? parsed : parsed[0]!)}>OK</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => { const d = rollOf(q.expr ?? 'D6'); onAnswer(q.dice ? d : d.reduce((x, y) => x + y, 0)); }}>Roll</button>
      </div>
    </div>
  );
}

export function LocationCard({ a, data, acts, keyOfPlace }: { a: AftermathView; data: GameData; acts: LocationActs; keyOfPlace: string }) {
  const [answers, setAnswers] = useState<Record<string, core.Answer>>({});
  const [pick, setPick] = useState<Record<number, string>>({});
  const [spread, setSpread] = useState<Record<number, string>>({});
  const place = useMemo(() => data.PB_LOCATIONS.find((l) => l[0] === keyOfPlace), [data, keyOfPlace]);
  const taken = a.locationRecord;
  const res = core.resolveLocation(acts.ctx, keyOfPlace, answers);
  const loose = res.finds.filter((f) => f.kind === 'exp' && f.uid == null).reduce((n, f) => n + (f.amount ?? 0), 0);
  const heroes = acts.ctx.s.models.filter((m) => core.isHeroModel(acts.ctx, m));
  const spreadNums = Object.fromEntries(Object.entries(spread).map(([u, v]) => [Number(u), Math.max(0, Math.floor(Number(v) || 0))]));
  const input = { key: keyOfPlace, answers, pick, ...(loose > 0 ? { spread: spreadNums } : {}) };
  const problem = res.done ? core.locationProblem(acts.ctx, a.round, input) : null;
  if (!place) return null;

  if (taken) {
    const name = data.PB_LOCATIONS.find((l) => l[0] === taken.key)?.[1] ?? taken.key;
    return (
      <div className={styles.recorded}>
        <p><strong>✓ {name}:</strong> taken.</p>
        <RulesTable caption="What the place brought" head={['What', 'How many', 'Worth', 'Where it went']} rowHeads={false}
          rows={taken.finds.map((f) => [f.text, f.kind === 'gold' || f.kind === 'wyrd' || f.kind === 'exp' ? String(f.amount ?? '') : String(f.qty ?? ''), f.worth != null ? `${f.worth} gc` : '', ({ gold: 'treasury', wyrd: 'stash', item: 'stash', exp: 'held experience', note: '–' } as Record<string, string>)[f.kind] ?? ''])} />
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoLocation(c, a.round), 'The place is taken back.', { gold: 'keep' })}>Take the place back</button></div>
      </div>
    );
  }
  return (
    <fieldset className={styles.scenario}>
      <legend>An unusual place: {place[1]}</legend>
      <p>{place[2]}</p>
      <a href={`https://mordheimer.net/docs/campaigns/income#${keyOfPlace.split(' ').join('-')}-${place[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`} target="_blank" rel="noopener noreferrer" className={styles.chart}>Rules ↗</a>
      {res.problems.length > 0 && <p className={styles.warn}>{res.problems[0]}</p>}
      {!res.done && res.question && (
        <>
          <p><strong>{res.question.label}</strong>{res.question.needs ? ` (${res.question.needs}+ finds it)` : ''}</p>
          <Question key={res.question.id} q={res.question} ctx={acts.ctx} onAnswer={(v) => setAnswers((x) => ({ ...x, [res.question!.id]: v }))} />
        </>
      )}
      {res.done && (
        <>
          <p><strong>You find:</strong></p>
          <ul className={styles.plain} aria-label="What the place brings">
            {res.finds.map((f, i) => (
              <li key={i}>
                {f.text}
                {f.options && (
                  <span className={styles.stepper}>
                    {f.options.map((o) => <label key={o}><input type="radio" name={`pick-${i}`} checked={(pick[i] ?? f.options![0]) === o} onChange={() => setPick((p) => ({ ...p, [i]: o }))} /> {o}</label>)}
                  </span>
                )}
              </li>
            ))}
            {res.finds.length === 0 && <li className={ui.muted}>Nothing.</li>}
          </ul>
          {loose > 0 && (
            <div className={styles.stepper}>
              <span>Spread {loose} experience among the Heroes:</span>
              {heroes.map((m) => (
                <label key={m.uid}>{core.modelLabel(acts.ctx, m)} <input type="text" inputMode="numeric" maxLength={2} className={styles.cell} aria-label={`Experience for ${core.modelLabel(acts.ctx, m)}`} value={spread[m.uid] ?? ''} onChange={(e) => setSpread((s) => ({ ...s, [m.uid]: e.target.value.replace(/\D/g, '') }))} /></label>
              ))}
            </div>
          )}
          {problem && <p className={styles.warn}>{problem}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={!!problem} onClick={() => acts.edit((c) => core.applyLocation(c, a.round, input), `${place[1]} taken.`, { gold: 'keep' })}>Take it</button>
          </div>
        </>
      )}
      {Object.keys(answers).length > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => { setAnswers({}); setPick({}); setSpread({}); }}>Start the place over</button></div>}
    </fieldset>
  );
}

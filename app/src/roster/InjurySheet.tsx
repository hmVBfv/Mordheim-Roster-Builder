/* An injury as rolled at the table (phase 3c, V1; mockup roster.html
   "Serious injury"). A Hero: the D66 with the follow-up its row asks for –
   nested where the chart rolls again (Multiple Injuries, a lost pit fight).
   A Henchman or a Hired Sword: one D6. The answers become one roll for
   core's `injure`; "Roll the dice" fills in random dice for those who do
   not roll at the table. */
import * as core from '@mordheim/core';
import type { HeroCode, HeroRoll, InjuryRoll } from '@mordheim/core';
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import { CHART, emptyDraft, hatesDefault, MULTIPLE, questionOf, randomD66, rollFromDraft, saveQuestionOf, type InjuryEnv, type Option, type RollDraft } from './injury.ts';
import styles from './Roster.module.css';

type Sheet = ReturnType<typeof useSheet>;

function Pick({ label, options, value, onPick }: { label: string; options: Option[]; value: string | undefined; onPick: (k: string) => void }) {
  return (
    <div className={`${styles.pickRow} ${styles.pickCol}`} role="group" aria-label={label}>
      {options.map((o) => <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onPick(o.key)}>{o.label}</button>)}
    </div>
  );
}

const rowLabel = (c: HeroCode) => `${c.replace('-', '–')} · ${CHART[c].label}`;

/** The fields of one result, and of the results it rolls again. */
function RollFields({ d, set, env, allowed, label }: { d: RollDraft; set: (d: RollDraft) => void; env: InjuryEnv; allowed: readonly HeroCode[]; label: string }) {
  const inputId = useId();
  const code = core.heroCodeOf(d.dice);
  const ok = code && allowed.includes(code);
  const sq = ok ? saveQuestionOf(code, env) : null;
  const q = ok ? questionOf(code, env) : null;
  const goesOn = ok && (!sq || d.save === 'stands');
  const n = Number(d.pick) || 0;
  return (
    <>
      <div className={ui.field}>
        <label htmlFor={inputId}>{label}</label>
        <span className={styles.dice}>
          <input id={inputId} className={ui.input} inputMode="numeric" maxLength={2} value={d.dice} autoComplete="off"
            onChange={(e) => set({ dice: e.target.value.replace(/[^1-6]/g, '').slice(0, 2) })} />
          <button type="button" className={ui.buttonQuiet} onClick={() => set({ dice: randomD66(Math.random) })}>Roll the dice</button>
        </span>
      </div>
      <div className={styles.result} aria-live="polite">
        {!code ? <p className={ui.muted}>Two dice, each 1–6, tens die first: a 2 and a 3 is 23.</p>
          : !ok ? <p>{rowLabel(code)}: rolled again here – roll anew.</p> : (
            <>
              <h3>{rowLabel(code)}</h3>
              {sq && (
                <>
                  <p>{sq.note}</p>
                  <Pick label={sq.label} options={sq.options} value={d.save} onPick={(k) => set({ ...d, save: k })} />
                </>
              )}
              {goesOn && <p>{CHART[code].how}</p>}
              {goesOn && code === '31' && env.oneEye && <p><b>His other eye too: he must retire from the warband.</b> Dismiss him once this is applied.</p>}
              {goesOn && code === '61' && env.districts.gaol && <p>Your control of the Gaol frees him: Full Recovery.</p>}
              {goesOn && code === '65' && env.districts.amphitheatre && <p>Your foothold in the Amphitheatre: he wins the fight. +50 gc, +2 experience.</p>}
              {goesOn && q && <Pick label={q.label} options={q.options} value={d.pick} onPick={(k) => set({ ...d, pick: k, hates: undefined, more: code === '16-21' ? Array.from({ length: Number(k) }, (_, i) => d.more?.[i] ?? emptyDraft()) : d.more })} />}
              {goesOn && code === '56' && d.pick && (
                <label className={ui.field}><span>Whom he hates</span>
                  <input className={ui.input} value={d.hates ?? hatesDefault(d.pick, env)} autoComplete="off" onChange={(e) => set({ ...d, hates: e.target.value })} />
                </label>
              )}
              {goesOn && code === '61' && d.pick === 'ransomed' && (
                <label className={ui.field}><span>Ransom paid, in gc</span>
                  <input className={ui.input} inputMode="numeric" value={d.gold ?? ''} autoComplete="off" onChange={(e) => set({ ...d, gold: e.target.value.replace(/\D/g, '') })} />
                </label>
              )}
              {goesOn && code === '65' && d.pick === 'lost' && (
                <div className={styles.subRoll}>
                  <RollFields d={d.then ?? emptyDraft()} set={(t) => set({ ...d, then: t })} env={env} allowed={core.AFTER_PIT} label="Then D66, 11–35" />
                </div>
              )}
              {goesOn && code === '16-21' && n > 0 && (d.more ?? []).slice(0, n).map((x, i) => (
                <div key={i} className={styles.subRoll}>
                  <RollFields d={x} set={(t) => set({ ...d, more: (d.more ?? []).map((y, j) => (j === i ? t : y)) })} env={env} allowed={MULTIPLE} label={`Further result ${i + 1}, D66`} />
                </div>
              ))}
            </>
          )}
      </div>
    </>
  );
}

/** Whom the sheet is for. */
export type InjuryFor =
  | { kind: 'hero'; uid: number; name: string; env: InjuryEnv; by: string | null; dice?: string }
  | { kind: 'hench'; uid: number; name: string; men: { i: number; name: string }[] }
  | { kind: 'hire'; uid: string; name: string };

function HeroBody({ w, close, onApply, titleId }: { w: Extract<InjuryFor, { kind: 'hero' }>; close: Sheet['close']; onApply: (r: InjuryRoll, text: string) => void; titleId: string }) {
  const [d, setD] = useState<RollDraft>(emptyDraft(w.dice ?? ''));
  const roll: HeroRoll | null = rollFromDraft(d, w.env);
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (roll) close(() => onApply({ hero: roll }, `${w.name}: ${CHART[roll.code].label}.`)); }}>
      <div>
        <h2 id={titleId}>{w.dice === '11' ? 'Out of action for good' : 'Serious injury'} · {w.name}</h2>
        <p className={ui.muted}>{w.dice === '11' ? 'Dead – or enter another result if it was a mistake.' : w.by ? `Out of action by ${w.by}.` : 'Heroes out of action roll a D66 after the battle.'}</p>
      </div>
      <RollFields d={d} set={setD} env={w.env} allowed={core.HERO_CODES} label="D66 as rolled" />
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!roll}>Apply</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

function D6Body({ w, close, onApply, titleId }: { w: Exclude<InjuryFor, { kind: 'hero' }>; close: Sheet['close']; onApply: (r: InjuryRoll, text: string) => void; titleId: string }) {
  const [roll, setRoll] = useState('');
  const [man, setMan] = useState(0);
  const inputId = useId();
  const r = Number(roll);
  const ok = roll !== '' && r >= 1 && r <= 6;
  const who = w.kind === 'hench' ? w.men.find((m) => m.i === man)?.name ?? w.name : w.name;
  const verdict = !ok ? 'Enter one die, 1–6.' : r <= 2 ? `${r} — ${who} is dead${w.kind === 'hire' ? ' and gone with his equipment' : ''}.` : `${r} — ${who} fights on.`;
  const text = !ok ? '' : r > 2 ? `${who} fights on.` : w.kind === 'hench' ? `${who} is dead; ${w.men.length - 1 > 0 ? `${w.name}: ${w.men.length - 1} left` : `${w.name} are no more`}.` : `${who} is dead.`;
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (ok) close(() => onApply(w.kind === 'hench' ? { d6: r, member: man } : { d6: r }, text)); }}>
      <div>
        <h2 id={titleId}>Out of action · {w.name}</h2>
        <p className={ui.muted}>{w.kind === 'hire' ? 'A Hired Sword out of action rolls a D6 after the battle, like a Henchman' : 'Each Henchman taken out of action rolls a D6 after the battle'}: 1–2 he is dead, 3–6 he fights on.</p>
      </div>
      {w.kind === 'hench' && w.men.length > 1 && (
        <>
          <span>Who was taken out of action?</span>
          <div className={styles.pickRow} role="group" aria-label="Who">
            {w.men.map((m) => <button key={m.i} type="button" aria-pressed={man === m.i} onClick={() => setMan(m.i)}>{m.name}</button>)}
          </div>
        </>
      )}
      <div className={ui.field}>
        <label htmlFor={inputId}>D6 as rolled</label>
        <span className={styles.dice}>
          <input id={inputId} className={ui.input} inputMode="numeric" maxLength={1} value={roll} autoComplete="off" onChange={(e) => setRoll(e.target.value.replace(/[^1-6]/g, '').slice(0, 1))} />
          <button type="button" className={ui.buttonQuiet} onClick={() => setRoll(String(1 + Math.floor(Math.random() * 6)))}>Roll the die</button>
        </span>
      </div>
      <p aria-live="polite">{verdict}</p>
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!ok}>Apply</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

export function InjurySheet({ dialogRef, close, who, onApply }: { dialogRef: Sheet['ref']; close: Sheet['close']; who: (InjuryFor & { key: number }) | null; onApply: (r: InjuryRoll, text: string) => void }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {who && (who.kind === 'hero'
        ? <HeroBody key={who.key} w={who} close={close} onApply={onApply} titleId={id} />
        : <D6Body key={who.key} w={who} close={close} onApply={onApply} titleId={id} />)}
    </dialog>
  );
}

/** Taking back an injury entered by mistake, and the games he misses. */
export function InjuriesSheet({ dialogRef, close, name, injuries, miss, onRemove, onMiss }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; name: string; injuries: string[]; miss: number;
  onRemove: (i: number, text: string) => void; onMiss: (delta: number) => void;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      <div className={ui.page}>
        <h2 id={id}>Injuries · {name}</h2>
        <p className={ui.muted}>To take back an injury entered by mistake. Games he misses count down as he sits them out.</p>
        {injuries.length === 0 && <p className={ui.muted}>No lasting injuries.</p>}
        <ul className={styles.eqList}>
          {injuries.map((j, i) => (
            <li key={`${i}:${j}`} className={styles.eqRow}>
              <span className={styles.eqName}>{j}</span>
              <button type="button" className={`${ui.buttonQuiet} ${styles.danger}`} onClick={() => close(() => onRemove(i, `${name}: ${j} taken back.`))}>Remove</button>
            </li>
          ))}
        </ul>
        <div className={ui.row}>
          <span>Misses</span>
          <span className={styles.stepper}>
            <button type="button" aria-label={`One game less for ${name}`} disabled={miss <= 0} onClick={() => onMiss(-1)}>−</button>
            <span aria-live="polite">{miss} game{miss === 1 ? '' : 's'}</span>
            <button type="button" aria-label={`One game more for ${name}`} onClick={() => onMiss(1)}>+</button>
          </span>
        </div>
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
      </div>
    </dialog>
  );
}

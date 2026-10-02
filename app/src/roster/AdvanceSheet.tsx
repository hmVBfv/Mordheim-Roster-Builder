/* An advance as rolled at the table (phase 3c, mockup roster.html "Advance"):
   the 2D6, the row of the table it lands on, and the choice that row
   leaves – a characteristic (not past the maximum), a skill from his lists
   or a spell instead, or for a group "The lad's got talent". */
import type { StatKey } from '@mordheim/core';
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import { rowFor, STAT_NAMES, type AdvanceView, type Taken } from './advance.ts';
import styles from './Roster.module.css';

type Sheet = ReturnType<typeof useSheet>;

export type AdvanceChoice =
  | { kind: 'stat'; stat: StatKey }
  | { kind: 'skill'; skill: string }
  | { kind: 'spell'; spell: string; own: boolean }
  | { kind: 'reduce'; spell: string }
  | { kind: 'talent'; man: number; lists: string[] };

function Body({ v, close, onApply, titleId }: { v: AdvanceView; close: Sheet['close']; onApply: (c: AdvanceChoice, text: string) => void; titleId: string }) {
  const [roll, setRoll] = useState('');
  const [stat, setStat] = useState<StatKey | null>(null);
  const [pick, setPick] = useState<string | null>(null); // "skill:…", "spell:…", "reduce:i"
  const [man, setMan] = useState(0);
  const [lists, setLists] = useState<string[]>([]);
  const row = rowFor(v.table, Number(roll));
  const open = row?.stats?.filter((k) => v.canRaise[k]) ?? [];
  const chosenStat = row?.kind === 'stat' ? (stat && open.includes(stat) ? stat : open.length === 1 ? open[0]! : null) : null;
  const talent = row?.kind === 'talent' ? v.talent : null;
  const talentOk = !!talent && 'men' in talent && (talent.fixed ? true : lists.length === 2);
  const all = v.skills.flatMap((g) => g.items);
  const pickedText = pick?.startsWith('skill:') ? all.find((s) => s.key === pick.slice(6))?.text
    : pick?.startsWith('spell:') ? v.spells?.items.find((s) => s.key === pick.slice(6))?.text : null;

  let choice: AdvanceChoice | null = null;
  let text = '';
  if (row?.kind === 'stat' && chosenStat) { choice = { kind: 'stat', stat: chosenStat }; text = `${v.name}: +1 ${STAT_NAMES[chosenStat]}.`; }
  if (row?.kind === 'skill' && pick) {
    const [k, rest] = [pick.slice(0, pick.indexOf(':')), pick.slice(pick.indexOf(':') + 1)];
    if (k === 'skill') { choice = { kind: 'skill', skill: rest }; text = `${v.name} learned ${rest}.`; }
    if (k === 'spell') { choice = { kind: 'spell', spell: rest, own: !!v.spells?.own }; text = `${v.name} learned the spell ${v.spells?.items.find((s) => s.key === rest)?.name ?? rest}.`; }
    if (k === 'reduce') { choice = { kind: 'reduce', spell: rest }; text = `${v.name}: ${v.spells?.items.find((s) => s.key === rest)?.name ?? rest} is 1 easier to cast.`; }
  }
  if (row?.kind === 'talent' && talent && 'men' in talent && talentOk) {
    choice = { kind: 'talent', man, lists };
    text = `${talent.men[man]?.name ?? 'One man'} of ${v.name} is a Hero now.`;
  }

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); if (choice) { const c = choice, t = text; close(() => onApply(c, t)); } }}>
      <div>
        <h2 id={titleId}>Advance · {v.name}</h2>
        <p className={ui.muted}>
          {v.kind === 'hench' ? 'The group rolls 2D6 once on the Henchmen table; every man gets the advance.'
            : v.kind === 'hire' ? 'Hired Swords gain experience like Henchmen (2, 5, 9, 14) but roll on the Heroes table.'
              : 'Heroes roll 2D6 on the Heroes table.'} Taken {v.applied} of {v.earned} earned.
        </p>
        {v.applied >= v.earned && <p className={ui.muted}>No advance is due by his experience; enter one only if the rules give it (a scenario, a house rule).</p>}
      </div>
      <details className={styles.table}>
        <summary>The table</summary>
        <ul>{v.table.map((r) => <li key={r.from}><b>{r.from === r.to ? r.from : `${r.from}–${r.to}`}</b> {r.label}</li>)}</ul>
      </details>
      <label className={ui.field}><span>2D6 as rolled</span>
        <input className={ui.input} inputMode="numeric" maxLength={2} value={roll} autoComplete="off"
          onChange={(e) => { setRoll(e.target.value.replace(/\D/g, '')); setStat(null); setPick(null); }} />
      </label>
      <div className={styles.result} aria-live="polite">
        {!row ? <p className={ui.muted}>Enter the total of two dice, 2–12.</p> : (
          <>
            <h3>{roll} · {row.label}</h3>
            {row.how && <p>{row.how}</p>}
            {row.kind === 'stat' && (
              <>
                <div className={styles.pickRow} role="group" aria-label="Characteristic">
                  {row.stats!.map((k) => (
                    <button key={k} type="button" disabled={!v.canRaise[k]} aria-pressed={chosenStat === k} onClick={() => setStat(k)}>
                      +1 {STAT_NAMES[k]}{!v.canRaise[k] && <small> at his maximum</small>}
                    </button>
                  ))}
                </div>
                {!open.length && <p>{row.stats!.length > 1 ? 'Both are at his maximum: roll again.' : 'At his maximum: roll again.'}</p>}
                {open.length > 0 && open.length < row.stats!.length && row.stats!.length > 1 && <p className={ui.muted}>One is at his maximum: he takes the other.</p>}
                <p className={ui.muted}>{v.maxNote}</p>
              </>
            )}
            {row.kind === 'skill' && (
              <>
                {v.skills.map((g) => (
                  <div key={g.label} className={styles.skillGroup} role="group" aria-label={g.label}>
                    <span>{g.label}</span>
                    <div className={styles.pickRow}>
                      {g.items.map((s) => (
                        <button key={s.key} type="button" disabled={s.known} title={s.text || undefined} aria-pressed={pick === `skill:${s.key}`} onClick={() => setPick(`skill:${s.key}`)}>{s.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {v.spells && (
                  <div className={styles.skillGroup} role="group" aria-label={`Instead a spell: ${v.spells.lore}`}>
                    <span>Instead a spell · {v.spells.lore}</span>
                    <div className={styles.pickRow}>
                      {v.spells.items.map((s) => s.known
                        ? <button key={s.key} type="button" title="Known: rolled again, it gets 1 easier to cast" aria-pressed={pick === `reduce:${s.key}`} onClick={() => setPick(`reduce:${s.key}`)}>{s.name} −1</button>
                        : <button key={s.key} type="button" title={s.text || undefined} aria-pressed={pick === `spell:${s.key}`} onClick={() => setPick(`spell:${s.key}`)}>{s.name}</button>)}
                    </div>
                  </div>
                )}
                {pickedText && <p className={styles.text}>{pickedText}</p>}
              </>
            )}
            {row.kind === 'talent' && talent && ('why' in talent ? <p>No: {talent.why}.</p> : (
              <>
                <p>One man of the group becomes a Hero. He keeps his experience, equipment and increases; the rest of the group rolls again, re-rolling 10–12.</p>
                <div className={styles.pickRow} role="group" aria-label="Who">
                  {talent.men.map((m) => <button key={m.i} type="button" aria-pressed={man === m.i} onClick={() => setMan(m.i)}>{m.name}</button>)}
                </div>
                {talent.fixed ? <p className={ui.muted}>His skill lists are fixed: {talent.fixed.join(' and ')}.</p> : (
                  <>
                    <p className={ui.muted}>His two skill lists, from those of the warband's Heroes ({lists.length} of 2):</p>
                    <div className={styles.pickRow} role="group" aria-label="Skill lists">
                      {talent.lists.map((l) => {
                        const on = lists.includes(l.key);
                        return <button key={l.key} type="button" aria-pressed={on} disabled={!on && lists.length >= 2}
                          onClick={() => setLists(on ? lists.filter((x) => x !== l.key) : [...lists, l.key])}>{l.name}</button>;
                      })}
                    </div>
                  </>
                )}
              </>
            ))}
          </>
        )}
      </div>
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!choice}>Apply</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

export function AdvanceSheet({ dialogRef, close, view, onApply }: { dialogRef: Sheet['ref']; close: Sheet['close']; view: (AdvanceView & { key: number }) | null; onApply: (c: AdvanceChoice, text: string) => void }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {view && <Body key={view.key} v={view} close={close} onApply={onApply} titleId={id} />}
    </dialog>
  );
}

/* Taking back what was taken by mistake: each removal closes the sheet and
   leaves a notice with Undo. */
export type Correction = { kind: 'stat'; stat: StatKey } | { kind: 'skill'; index: number } | { kind: 'spell'; index: number } | { kind: 'unreduce'; index: number };

export function TakenSheet({ dialogRef, close, name, taken, onRemove }: { dialogRef: Sheet['ref']; close: Sheet['close']; name: string; taken: Taken | null; onRemove: (c: Correction, text: string) => void }) {
  const id = useId();
  const empty = taken && !taken.advances.length && !taken.skills.length && !taken.spells.length;
  const row = (key: string, label: string, sub: string, c: Correction, text: string) => (
    <li key={key} className={styles.eqRow}>
      <span className={styles.eqName}>{label}{sub && <small>{sub}</small>}</span>
      <button type="button" className={`${ui.buttonQuiet} ${styles.danger}`} onClick={() => close(() => onRemove(c, text))}>Remove</button>
    </li>
  );
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      <div className={ui.page}>
        <h2 id={id}>Advances · {name}</h2>
        <p className={ui.muted}>To take back an advance entered by mistake. A real loss (an injury) is entered as an injury.</p>
        {empty && <p className={ui.muted}>Nothing taken yet.</p>}
        {taken && (
          <ul className={styles.eqList}>
            {taken.advances.map((a) => row(`a:${a.stat}`, `+${a.n} ${STAT_NAMES[a.stat]}`, '', { kind: 'stat', stat: a.stat }, `${name}: one +1 ${STAT_NAMES[a.stat]} taken back.`))}
            {taken.skills.map((s) => row(`s:${s.i}`, s.name, s.text.slice(0, 90), { kind: 'skill', index: s.i }, `${name}: ${s.name} taken back.`))}
            {taken.spells.map((s) => row(`p:${s.i}`, s.name, s.red ? `${s.red} easier to cast` : 'spell', s.red ? { kind: 'unreduce', index: s.i } : { kind: 'spell', index: s.i }, `${name}: ${s.red ? 'one step easier' : s.name} taken back.`))}
          </ul>
        )}
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
      </div>
    </dialog>
  );
}

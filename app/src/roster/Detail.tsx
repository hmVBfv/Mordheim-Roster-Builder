/* The opened warrior, as the roster mockup draws it (docs/ui.md §3, Rob,
   18.10.2026): everything the old ⋯ menu hid is a section here – profile and
   experience with their buttons, equipment, skills and injuries, the name and
   what leaves him. On a phone the sections sit behind four tabs under his
   row; from the width of a desktop they all stand in the pane beside the
   list. Without `acts` it only reads (another player's warband, the printout). */
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { TipWord } from '../ui/Tip.tsx';
import type { Taken } from './advance.ts';
import { ChipView, xpNote } from './Bits.tsx';
import { isWarrior, unitChips, type Fact, type HireView, type MaxLine, type StatCell, type WarriorView, type XpView } from './view.ts';
import styles from './Board.module.css';

export type TabId = 'overview' | 'gear' | 'skills' | 'story';
export const TAB_LABEL: Record<TabId, string> = { overview: 'Overview', gear: 'Gear', skills: 'Skills & injuries', story: 'Story & more' };

/** The tabs of a phone: a hired one carries nothing of his own to manage. */
export const tabsFor = (u: WarriorView | HireView): TabId[] => (isWarrior(u) ? ['overview', 'gear', 'skills', 'story'] : ['overview', 'skills', 'story']);

export interface UnitActs {
  /** Experience one point at a time, and set at once. */
  xp(delta: number): void;
  setXp(): void;
  advance(): void;
  injury(): void;
  /** Held captive: how it ended. */
  captive?(): void;
  /** Another man in the group, or why not (the view says). */
  addMan?(): void;
  man?(i: number): void;
  lead?(): void;
  /** His own list while the warband is founded, the Trading Post after his first battle. */
  equipSheet?(): void;
  equipLink?: string;
  rename(value: string): void;
  /** The name of the field: "Name of this Mercenary Captain" or "Name of the group". */
  nameLabel: string;
  /** What the field shows: empty when he goes by his type. */
  nameValue: string;
  story: string;
  card: string;
  /** What he has taken, to correct (stat advances are listed; skills and spells are on their own lines). */
  taken: Taken | null;
  correctTaken?(): void;
  correctInjuries?(): void;
  /** Chooses one of the spells he starts with (#81), by its name in the data. */
  learnSpell?(name: string): void;
  /** Mutations and the Mark: one button each. */
  chaos: { label: string; run: () => void }[];
  outOfAction?(): void;
  leave: { label: string; run: () => void };
}

function Stats({ cells, save, max }: { cells: StatCell[]; save?: string; max?: MaxLine | null }) {
  return (
    <>
      <table className={styles.prof}>
        <thead>
          <tr>{cells.map((c) => <th key={c.key} scope="col">{c.key}</th>)}{save != null && <th scope="col">Sv</th>}</tr>
        </thead>
        <tbody>
          <tr>
            {cells.map((c) => <td key={c.key} className={c.changed ? styles.changed : undefined}>{c.value}</td>)}
            {save != null && <td>{save}</td>}
          </tr>
          {max && (
            <tr className={styles.profMax} aria-label={`Racial maximum (${max.label})`}>
              {max.cells.map((v, i) => <td key={cells[i]?.key ?? i}>{v}</td>)}
              {save != null && <td />}
            </tr>
          )}
        </tbody>
      </table>
      {max && <small className={styles.profMaxNote}>Racial maximum · {max.label}</small>}
    </>
  );
}

const STEP_WORD = { base: 'before his start', on: 'reached', next: 'next', open: '' } as const;
const STEP_CLASS = { base: styles.stepBase, on: styles.stepOn, next: styles.stepNext, open: undefined } as const;

/* Every step of the track framed with its number, those below the starting
   experience dashed, those reached filled (an advance still to be taken in
   gold), the next one marked – as the Roster Builder draws it. */
function Steps({ xp }: { xp: XpView }) {
  const reached = xp.steps.filter((s) => s.state === 'on').length;
  let seen = 0;
  return (
    <ol className={styles.steps} aria-label="Experience steps">
      {xp.steps.map((s) => {
        if (s.state === 'on') seen++;
        const due = s.state === 'on' && seen > reached - xp.owed;
        return (
          <li key={s.at} className={due ? styles.stepDue : STEP_CLASS[s.state]}>
            {s.at}{STEP_WORD[s.state] && <span className="visually-hidden"> {STEP_WORD[s.state]}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, side, children }: { title: string; side?: string; children: ReactNode }) {
  return (
    <section className={styles.sec}>
      <h3>{title}{side && <span>{side}</span>}</h3>
      {children}
    </section>
  );
}

/* Each word that names a rule opens its bubble. */
function Facts({ items, empty, chips }: { items: Fact[]; empty?: string; chips?: boolean }) {
  if (!items.length) return empty ? <p className={styles.empty}>{empty}</p> : null;
  return (
    <ul className={chips ? styles.chipList : styles.lines}>
      {items.map((f, i) => <li key={i}><TipWord label={f.label} tips={f.tips} /></li>)}
    </ul>
  );
}

function Stepper({ xp, who, group, acts }: { xp: XpView; who: string; group: boolean; acts: UnitActs }) {
  return (
    <span className={styles.stepper}>
      <button type="button" aria-label={`One experience less for ${who}`} disabled={xp.value <= xp.min} onClick={() => acts.xp(-1)}>−</button>
      <button type="button" className={styles.xpValue} aria-label={`Experience of ${who}: ${xp.value}. Set it`} onClick={acts.setXp}>
        <span aria-live="polite" aria-atomic="true">Exp <b>{xp.value}</b>{group ? ' (group)' : ''}</span>
      </button>
      <button type="button" aria-label={`One experience more for ${who}`} disabled={xp.max != null && xp.value >= xp.max} onClick={() => acts.xp(1)}>+</button>
    </span>
  );
}

function Overview({ u, acts }: { u: WarriorView | HireView; acts?: UnitActs }) {
  const w = isWarrior(u) ? u : null;
  const group = !!w && !w.hero;
  const chips = unitChips(u);
  const togo = u.xp?.next != null && !u.advanceDue ? ` · ${u.xp.next - u.xp.value} to go` : '';
  return (
    <>
      {chips.length > 0 && <div className={styles.chips} aria-label="Status">{chips.map((c, i) => <ChipView key={i} chip={c} />)}</div>}
      <Section title="Profile" side={group ? 'same for the whole group' : undefined}>
        <Stats cells={u.stats} save={w?.save} max={u.max} />
      </Section>
      {u.xp ? (
        <Section title="Experience" side={`${xpNote(u.xp)}${togo}`}>
          <Steps xp={u.xp} />
          {acts && (
            <div className={styles.xpLine}>
              <Stepper xp={u.xp} who={u.name} group={group} acts={acts} />
            </div>
          )}
          {!acts && <p className={styles.plain}>Exp <b>{u.xp.value}</b>{group ? ' (group)' : ''}</p>}
          {w && w.expNeeded != null && <p className={styles.plain}>Needs <b>{w.expNeeded}</b> exp for the advances {group ? 'the group has' : 'he has'}.</p>}
        </Section>
      ) : (
        <p className={styles.empty}>Gains no experience.</p>
      )}
      {acts && (
        <div className={styles.acts}>
          {u.xp && <button type="button" className={`${styles.btn} ${u.advanceDue ? styles.gold : ''}`} onClick={acts.advance}>Advance</button>}
          {w?.addMan && (
            <button type="button" className={styles.btn} disabled={'why' in w.addMan} onClick={acts.addMan}>
              + Man{'cost' in w.addMan ? ` · ${w.addMan.cost} gc` : ''}
            </button>
          )}
          {w && w.captive != null
            ? <button type="button" className={styles.btn} aria-label={`Captivity of ${u.name}: how it ended`} onClick={acts.captive}>Captivity…</button>
            : (w || u.xp) && <button type="button" className={styles.btn} aria-label={`Injury for ${u.name}`} onClick={acts.injury}>Injury</button>}
          {w?.canLead && acts.lead && <button type="button" className={styles.btn} onClick={acts.lead}>Lead the warband</button>}
        </div>
      )}
      {acts && w?.addMan && 'why' in w.addMan && <p className={styles.why}>No more men: {w.addMan.why}.</p>}
      {w && group && (
        <Section title="Men" side={`${w.count} in the group`}>
          <ul className={styles.men} aria-label={`Men of ${u.name}`}>
            {w.men.map((m) => (
              <li key={m.i}>
                {acts?.man
                  ? <button type="button" className={m.named ? undefined : styles.unnamed} aria-label={`${m.name}: name or dismiss`} onClick={() => acts.man!(m.i)}>{m.name}</button>
                  : <span className={m.named ? undefined : styles.unnamed}>{m.name}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {u.rules.length > 0 && <Section title="Special rules"><Facts items={u.rules} chips /></Section>}
    </>
  );
}

function Gear({ w, acts }: { w: WarriorView; acts?: UnitActs }) {
  return (
    <Section title="Equipment" side={w.equipment.length ? `${w.equipment.length} carried` : undefined}>
      {w.equipment.length === 0 && <Facts items={[]} empty="Nothing carried yet." />}
      {/* by kind, as the items are (#113) */}
      {[...new Set(w.equipment.map((f) => f.group ?? ''))].map((g) => (
        <div key={g} className={styles.gearGroup}>
          {g && <h4>{g}</h4>}
          <Facts items={w.equipment.filter((f) => (f.group ?? '') === g)} />
        </div>
      ))}
      {acts && (
        <div className={styles.acts}>
          {acts.equipSheet && <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={acts.equipSheet}>Equipment &amp; rare items</button>}
          {acts.equipLink && <Link to={acts.equipLink} className={`${styles.btn} ${styles.primary}`}>Equipment – at the Trading Post</Link>}
        </div>
      )}
    </Section>
  );
}

function Skills({ u, acts }: { u: WarriorView | HireView; acts?: UnitActs }) {
  const w = isWarrior(u) ? u : null;
  const adv = acts?.taken?.advances ?? [];
  const mine = w ? w.injuries : [];
  return (
    <>
      <Section title="Skills"><Facts items={u.skills} empty={u.xp ? 'No skills yet. The next advance can bring one.' : 'None.'} /></Section>
      {u.spells.length > 0 && <Section title="Spells"><Facts items={u.spells} /></Section>}
      {u.lore && (
        <Section title={`Spell list · ${u.lore.name}`} side={u.lore.open > 0 && acts?.learnSpell ? `${u.lore.open} to choose at the start` : undefined}>
          <ul className={styles.lore} aria-label={`Spell list: ${u.lore.name}`}>
            {u.lore.spells.map((sp) => (
              <li key={sp.name} className={sp.known ? styles.loreKnown : undefined}>
                <span><b>{sp.name}</b>{sp.diff && <span className={styles.loreDiff}> · cast on {sp.diff}{sp.red > 0 && `(−${sp.red})`}{sp.diff === 'auto' ? '' : '+'}</span>}{sp.known && <span className={styles.loreMark}> · known</span>}</span>
                {sp.text && <small>{sp.text}</small>}
                {!sp.known && u.lore!.open > 0 && acts?.learnSpell && (
                  <button type="button" className={styles.btn} onClick={() => acts.learnSpell!(sp.key)}>{`Choose ${sp.name}`}</button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {w && w.mutations.length > 0 && <Section title="Mutations"><Facts items={w.mutations} /></Section>}
      {w && w.mark.length > 0 && <Section title="Mark of Chaos"><Facts items={w.mark} /></Section>}
      {acts && acts.chaos.length > 0 && (
        <div className={styles.acts}>{acts.chaos.map((c) => <button key={c.label} type="button" className={styles.btn} onClick={c.run}>{c.label}</button>)}</div>
      )}
      {w && (
        <Section title="Injuries">
          <Facts items={mine} empty="No lasting injuries." />
          {(w.missGames > 0 || w.retire) && <p className={styles.plain}>{[w.missGames > 0 && `Misses ${w.missGames} game${w.missGames > 1 ? 's' : ''}`, w.retire && 'Blind in both eyes: must retire'].filter(Boolean).join(' · ')}</p>}
          {acts?.correctInjuries && <div className={styles.acts}><button type="button" className={styles.btn} onClick={acts.correctInjuries}>Injuries – correct</button></div>}
        </Section>
      )}
      {acts && u.xp && (
        <Section title="Advances taken" side="correct a wrong entry">
          {adv.length > 0
            ? <ul className={styles.chipList}>{adv.map((a) => <li key={a.stat} className={styles.plainChip}>+{a.n} {a.stat}</li>)}</ul>
            : <p className={styles.empty}>No stat advances taken.</p>}
          {acts.correctTaken && <div className={styles.acts}><button type="button" className={styles.btn} onClick={acts.correctTaken}>Advances taken – correct</button></div>}
        </Section>
      )}
    </>
  );
}

/* The name is a field: Enter or leaving it saves, Esc puts the old one back. */
function NameField({ acts }: { acts: UnitActs }) {
  const [text, setText] = useState(acts.nameValue);
  // Esc puts the old name back, and the blur that follows must not save what was typed
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) { cancelled.current = false; return; }
    if (text.trim() !== acts.nameValue.trim()) acts.rename(text.trim());
  };
  return (
    <label className={styles.field}>
      {acts.nameLabel}
      <input
        value={text} autoComplete="off" maxLength={80}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { cancelled.current = true; setText(acts.nameValue); e.currentTarget.blur(); }
        }}
      />
    </label>
  );
}

function Story({ u, acts }: { u: WarriorView | HireView; acts?: UnitActs }) {
  const w = isWarrior(u) ? u : null;
  if (!acts) return null;
  return (
    <>
      <Section title="Name"><NameField key={`${u.uid}:${acts.nameValue}`} acts={acts} /></Section>
      <Section title="Story and table">
        <Link to={acts.story} className={styles.rowLink}><span>{w && !w.hero ? 'Story so far' : 'Story so far & profile'}<small>Write his part of the chronicle</small></span><span aria-hidden="true">›</span></Link>
        <Link to={acts.card} className={styles.rowLink}><span>Tabletop Simulator card<small>Name and description for the model</small></span><span aria-hidden="true">›</span></Link>
      </Section>
      <Section title="Leaving the warband">
        <div className={styles.acts}>
          {acts.outOfAction && <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={acts.outOfAction}>Out of action for good…</button>}
          <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={acts.leave.run}>{acts.leave.label}</button>
        </div>
      </Section>
    </>
  );
}

/** One section of the detail by its tab. */
function Part({ id, u, acts }: { id: TabId; u: WarriorView | HireView; acts?: UnitActs }) {
  if (id === 'overview') return <Overview u={u} acts={acts} />;
  if (id === 'gear') return isWarrior(u) ? <Gear w={u} acts={acts} /> : null;
  if (id === 'skills') return <Skills u={u} acts={acts} />;
  return <Story u={u} acts={acts} />;
}

/** `tab`: the one section group shown (a phone); without it all of them (the pane, the printout). */
export function Detail({ u, acts, tab, headed, id }: { u: WarriorView | HireView; acts?: UnitActs; tab?: TabId; headed?: boolean; id?: string }) {
  const shown = tab ? [tab] : tabsFor(u);
  const kind = isWarrior(u) ? (u.hero ? u.type : `Henchman group`) : `${u.kind}`;
  return (
    <article className={styles.detail} aria-label={u.name} id={id}>
      {headed && (
        <header className={styles.unitHead}>
          <h2>{u.name}{isWarrior(u) && !u.hero && <span className={styles.count}> ×{u.count}</span>}</h2>
          <span>{u.name !== u.type ? u.type : kind}</span>
        </header>
      )}
      {shown.map((t) => <Part key={t} id={t} u={u} acts={acts} />)}
    </article>
  );
}

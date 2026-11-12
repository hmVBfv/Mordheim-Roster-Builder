/* Finding a warband to start (wish #116, Rob, 28.10.2026): a filter over what the list knows of each warband – name, race, grade,
   Heroes at the start, a big creature, starting gold and the most models – and a sort, so a player need not scroll the whole list.
   Wishes #121–#125 (Rob, 28.10.2026): the filter is always open, the gold and model fields start at the range over all warbands
   (they leave everything in until a player narrows them), and the matches are a table, one row a warband. */
import { filterWarbands, sortWarbands, type WarbandFact, type WarbandFilter, type WarbandSort } from '@mordheim/core';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { TipWord } from '../ui/Tip.tsx';
import type { TipEntry } from '../ui/Tip.tsx';
import ui from '../ui/ui.module.css';
import styles from './WarbandFinder.module.css';

export const GRADE_NAMES: Record<string, string> = { core: 'Core', '1a': 'Grade 1a', '1b': 'Grade 1b', '1c': 'Grade 1c', '2a': 'Grade 2a' };
const SORTS: [WarbandSort, string][] = [['grade', 'Grade, A to Z'], ['name', 'A to Z'], ['gold-asc', 'Gold, least first'], ['gold-desc', 'Gold, most first'],
  ['size-desc', 'Max. models, most first'], ['heroes-desc', 'Heroes at the start, most first']];

const GRADE_ORDER = ['core', '1a', '1b', '1c', '2a'];
const GRADE_LABELS: Record<string, string> = { core: 'Core — official', '1a': 'Grade 1a — official supplements', '1b': 'Grade 1b — official magazines',
  '1c': 'Grade 1c — semi-official', '2a': 'Grade 2a — fan-made, reliable' };

const num = (v: string): number | '' => (v.trim() === '' ? '' : Number(v));

/** The filter's state and what it leaves of the list, sorted. */
export function useWarbandFinder(facts: WarbandFact[]) {
  // the range over all warbands: what the gold and model fields show before a player narrows them
  const range = useMemo(() => {
    const golds = facts.flatMap((f) => [f.gold, f.goldMax]);
    const sizes = facts.map((f) => f.max);
    return { goldFrom: Math.min(...golds), goldTo: Math.max(...golds), sizeFrom: Math.min(...sizes), sizeTo: Math.max(...sizes) };
  }, [facts]);
  const [filter, setFilter] = useState<WarbandFilter>(range);
  const [sort, setSort] = useState<WarbandSort>('grade');
  const shown = useMemo(() => sortWarbands(filterWarbands(facts, filter), sort), [facts, filter, sort]);
  const active = Object.entries(filter).some(([k, v]) => v !== '' && v !== undefined && v !== (range as Record<string, number>)[k]);
  return { filter, setFilter: (f: WarbandFilter | null) => setFilter(f ?? range), sort, setSort, shown, active };
}

/** A spell school as the list names it: its name, and its spells with their effects (no lore) for the bubble. */
export interface SchoolInfo { name: string; tips: TipEntry[] }

export function WarbandFinder({ facts, finder, schoolInfo }: { facts: WarbandFact[]; finder: ReturnType<typeof useWarbandFinder>; schoolInfo: Record<string, SchoolInfo> }) {
  const { filter, setFilter, sort, setSort, shown, active } = finder;
  const id = useId();
  const races = useMemo(() => [...new Set(facts.map((f) => f.race).filter(Boolean))].sort(), [facts]);
  const grades = useMemo(() => Object.keys(GRADE_NAMES).filter((g) => facts.some((f) => f.grade === g)), [facts]);
  const set = (patch: Partial<WarbandFilter>) => setFilter({ ...filter, ...patch });
  const schools = useMemo(() => [...new Set(facts.flatMap((f) => f.families))].map((key) => ({ key, name: schoolInfo[key]?.name ?? key })).sort((a, b) => a.name.localeCompare(b.name)), [facts, schoolInfo]);
  return (
    <section className={styles.finder} aria-label="Find a warband">
      <div className={styles.grid}>
        <label className={`${ui.field} ${styles.search}`}><span>Look for</span>
          <input className={ui.input} type="search" value={filter.q ?? ''} autoComplete="off" onChange={(e) => set({ q: e.target.value })} /></label>
        <label className={ui.field}><span>Race</span>
          <select className={ui.select} value={filter.race ?? ''} onChange={(e) => set({ race: e.target.value })}>
            <option value="">Any</option>{races.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <label className={ui.field}><span>Grade</span>
          <select className={ui.select} value={filter.grade ?? ''} onChange={(e) => set({ grade: e.target.value })}>
            <option value="">Any</option>{grades.map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
          </select></label>
        <div className={styles.pair}>
          <label className={ui.field}><span>Gold from</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} step={50} value={filter.goldFrom ?? ''} onChange={(e) => set({ goldFrom: num(e.target.value) })} /></label>
          <label className={ui.field}><span>Gold to</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} step={50} value={filter.goldTo ?? ''} onChange={(e) => set({ goldTo: num(e.target.value) })} /></label>
        </div>
        <div className={styles.pair}>
          <label className={ui.field}><span>Max. models from</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} value={filter.sizeFrom ?? ''} onChange={(e) => set({ sizeFrom: num(e.target.value) })} /></label>
          <label className={ui.field}><span>Max. models to</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} value={filter.sizeTo ?? ''} onChange={(e) => set({ sizeTo: num(e.target.value) })} /></label>
        </div>
        <label className={ui.field}><span>Heroes at the start</span>
          <select className={ui.select} value={String(filter.heroes ?? '')} onChange={(e) => set({ heroes: num(e.target.value) })}>
            <option value="">Any</option>{[4, 5, 6].map((n) => <option key={n} value={n}>Up to {n}</option>)}
          </select></label>
        <label className={ui.field}><span>School of magic</span>
          <select className={ui.select} value={filter.magic ?? ''} onChange={(e) => set({ magic: e.target.value })}>
            <option value="">Either way</option><option value="none">No caster of its own</option>
            {schools.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select></label>
        <label className={ui.field}><span>Big creature</span>
          <select className={ui.select} title="A big creature among its units: Kroxigor, Minotaur …" value={filter.large ?? ''} onChange={(e) => set({ large: e.target.value as WarbandFilter['large'] })}>
            <option value="">Either way</option><option value="with">Has one</option><option value="without">Has none</option>
          </select></label>
        <label className={ui.field}><span>Sort by</span>
          <select className={ui.select} value={sort} onChange={(e) => setSort(e.target.value as WarbandSort)}>
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select></label>
      </div>
      <div className={styles.foot}>
        <span id={`${id}-n`} role="status">{shown.length === 0 ? 'No warband fits.' : `${shown.length} of ${facts.length} warbands`}</span>
        {active && <button type="button" className={ui.buttonQuiet} onClick={() => setFilter(null)}>Clear filter</button>}
      </div>
    </section>
  );
}

/** The warbands that pass the filter, one row each: tap a row to pick it (its radio is hidden but there for the keyboard). With the sort by grade, a heading row opens each grade. */
/** `detail`: what unfolds under the row of the chosen warband (its options), so nothing has to be looked for further down. */
export function WarbandTable({ shown, sort, chosen, onChoose, detail, schoolInfo, filtered = false }: { shown: WarbandFact[]; sort: WarbandSort; chosen: string; onChoose: (key: string) => void; detail?: ReactNode; schoolInfo: Record<string, SchoolInfo>; filtered?: boolean }) {
  const byGrade = sort === 'grade';
  // with the sort by grade each grade is a section a player folds out: Core is open to begin with, the others closed (67 warbands are a long page on a phone);
  // a filter in use, or the warband chosen, opens what it concerns (plan P6)
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({ core: true });
  const cols = byGrade ? 7 : 8;
  // the chosen warband chosen again is let go
  const toggle = (key: string) => onChoose(key === chosen ? '' : key);
  const row = (w: WarbandFact) => [
    <tr key={w.key} className={w.key === chosen ? styles.picked : undefined} data-picked={w.key === chosen ? 'true' : undefined} onClick={(e) => { if (!(e.target as HTMLElement).closest('label, button')) toggle(w.key); }}>
      <td className={styles.pick} data-label="">
        {/* the radio lies invisibly over the name, so a keyboard and a screen reader find the row; a tap anywhere in the row chooses it */}
        <label className={styles.pickLabel}>
          {/* a radio already checked sends no change, so the tap itself chooses or lets go (a second tap folds the options up, #232) */}
          <input type="radio" name="warband" value={w.key} aria-label={w.name} checked={w.key === chosen} onChange={() => undefined}
            onClick={() => toggle(w.key)} />
          <span className={styles.name}>{w.name}</span>
        </label>
      </td>
      <td data-label="Race">{w.race}</td>
      {!byGrade && <td data-label="Grade">{GRADE_NAMES[w.grade] ?? w.grade}</td>}
      <td data-label="Gold">{w.gold === w.goldMax ? w.gold : `${w.gold}–${w.goldMax}`} gc</td>
      <td data-label="Max. models">{w.max}</td>
      <td data-label="Heroes">{w.heroes}</td>
      <td data-label="School of magic" className={styles.magic}>
        {w.families.length === 0
          ? <span className={ui.muted}>None</span>
          : w.families.map((k) => <div key={k}><TipWord label={schoolInfo[k]?.name ?? k} tips={schoolInfo[k]?.tips ?? []} /></div>)}
      </td>
      <td data-label="Big creature">{w.large ? 'Yes' : 'No'}</td>
    </tr>,
    ...(w.key === chosen && detail ? [<tr key={`${w.key}-options`} className={styles.options}><td colSpan={cols}>{detail}</td></tr>] : []),
  ];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>
          <th scope="col">Warband</th><th scope="col">Race</th>{!byGrade && <th scope="col">Grade</th>}<th scope="col">Gold</th><th scope="col">Max. models</th><th scope="col">Heroes</th><th scope="col">School of magic</th><th scope="col">Big creature</th>
        </tr></thead>
        <tbody>
          {byGrade
            ? GRADE_ORDER.flatMap((g) => {
              const here = shown.filter((w) => w.grade === g);
              if (!here.length) return [];
              const open = filtered || unfolded[g] === true || here.some((w) => w.key === chosen);
              const head = (
                <tr key={`g-${g}`} className={styles.grade}>
                  <th colSpan={cols} scope="colgroup">
                    {/* a filter in use shows every match, so there is nothing to fold then */}
                    <button type="button" className={styles.gradeButton} aria-expanded={open} disabled={filtered}
                      onClick={() => setUnfolded((u) => ({ ...u, [g]: !open }))}>
                      <span>{GRADE_LABELS[g]}</span><span className={styles.gradeCount}>{here.length}</span>
                    </button>
                  </th>
                </tr>
              );
              return open ? [head, ...here.flatMap(row)] : [head];
            })
            : shown.flatMap(row)}
        </tbody>
      </table>
    </div>
  );
}

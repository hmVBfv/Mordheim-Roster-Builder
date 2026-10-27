/* Finding a warband to start (wish #116, Rob, 28.10.2026): a filter over what the list knows of each warband – name, race, grade,
   Heroes at the start, a big creature, starting gold and the most models – and a sort, so a player need not scroll the whole list. */
import { filterWarbands, sortWarbands, type WarbandFact, type WarbandFilter, type WarbandSort } from '@mordheim/core';
import { useId, useMemo, useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './WarbandFinder.module.css';

export const GRADE_NAMES: Record<string, string> = { core: 'Core', '1a': 'Grade 1a', '1b': 'Grade 1b', '1c': 'Grade 1c', '2a': 'Grade 2a' };
const SORTS: [WarbandSort, string][] = [['grade', 'Grade, then name'], ['name', 'Name'], ['gold-asc', 'Gold, least first'], ['gold-desc', 'Gold, most first'],
  ['size-desc', 'Most models, most first'], ['heroes-desc', 'Heroes at the start, most first']];

const num = (v: string): number | '' => (v.trim() === '' ? '' : Number(v));

/** The filter's state and what it leaves of the list, sorted. */
export function useWarbandFinder(facts: WarbandFact[]) {
  const [filter, setFilter] = useState<WarbandFilter>({});
  const [sort, setSort] = useState<WarbandSort>('grade');
  const shown = useMemo(() => sortWarbands(filterWarbands(facts, filter), sort), [facts, filter, sort]);
  const active = Object.values(filter).some((v) => v !== '' && v !== undefined);
  return { filter, setFilter, sort, setSort, shown, active };
}

export function WarbandFinder({ facts, finder }: { facts: WarbandFact[]; finder: ReturnType<typeof useWarbandFinder> }) {
  const { filter, setFilter, sort, setSort, shown, active } = finder;
  const id = useId();
  const races = useMemo(() => [...new Set(facts.map((f) => f.race).filter(Boolean))].sort(), [facts]);
  const grades = useMemo(() => Object.keys(GRADE_NAMES).filter((g) => facts.some((f) => f.grade === g)), [facts]);
  const set = (patch: Partial<WarbandFilter>) => setFilter({ ...filter, ...patch });
  return (
    <details className={styles.finder} open={active || undefined}>
      <summary>Find a warband{active ? ` · ${shown.length} of ${facts.length}` : ''}</summary>
      <div className={styles.grid}>
        <label className={ui.field}><span>Name</span>
          <input className={ui.input} type="search" value={filter.q ?? ''} autoComplete="off" onChange={(e) => set({ q: e.target.value })} /></label>
        <label className={ui.field}><span>Race</span>
          <select className={ui.select} value={filter.race ?? ''} onChange={(e) => set({ race: e.target.value })}>
            <option value="">Any</option>{races.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <label className={ui.field}><span>Grade</span>
          <select className={ui.select} value={filter.grade ?? ''} onChange={(e) => set({ grade: e.target.value })}>
            <option value="">Any</option>{grades.map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
          </select></label>
        <label className={ui.field}><span>Heroes at the start</span>
          <select className={ui.select} value={String(filter.heroes ?? '')} onChange={(e) => set({ heroes: num(e.target.value) })}>
            <option value="">Any</option>{[4, 5, 6].map((n) => <option key={n} value={n}>Up to {n}</option>)}
          </select></label>
        <label className={ui.field}><span>Big creature (Kroxigor, Minotaur …)</span>
          <select className={ui.select} value={filter.large ?? ''} onChange={(e) => set({ large: e.target.value as WarbandFilter['large'] })}>
            <option value="">Either way</option><option value="with">Has one</option><option value="without">Has none</option>
          </select></label>
        <div className={styles.pair}>
          <label className={ui.field}><span>Gold from</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} step={50} value={filter.goldFrom ?? ''} onChange={(e) => set({ goldFrom: num(e.target.value) })} /></label>
          <label className={ui.field}><span>to</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} step={50} value={filter.goldTo ?? ''} onChange={(e) => set({ goldTo: num(e.target.value) })} /></label>
        </div>
        <div className={styles.pair}>
          <label className={ui.field}><span>Most models from</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} value={filter.sizeFrom ?? ''} onChange={(e) => set({ sizeFrom: num(e.target.value) })} /></label>
          <label className={ui.field}><span>to</span>
            <input className={ui.input} type="number" inputMode="numeric" min={0} value={filter.sizeTo ?? ''} onChange={(e) => set({ sizeTo: num(e.target.value) })} /></label>
        </div>
        <label className={ui.field}><span>Sort by</span>
          <select className={ui.select} value={sort} onChange={(e) => setSort(e.target.value as WarbandSort)}>
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select></label>
      </div>
      <div className={styles.foot}>
        <span id={`${id}-n`} role="status">{shown.length === 0 ? 'No warband fits.' : `${shown.length} of ${facts.length} warbands`}</span>
        {active && <button type="button" className={ui.buttonQuiet} onClick={() => setFilter({})}>Clear filter</button>}
      </div>
    </details>
  );
}

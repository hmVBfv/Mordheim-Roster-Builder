/* The warriors of one warband, as the roster mockup draws them (docs/ui.md
   §3, docs/mockups/roster-v2.html): a compact row each – name, the whole
   profile, experience, what sets him apart, what he carries. A phone opens
   the warrior under his row, with tabs; from the width of a desktop he stays
   in a pane beside the list, every section open. The same board shows
   another player's warband, read-only (without `acts`). */
import { IconEdit } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Detail, TAB_LABEL, tabsFor, type TabId, type UnitActs } from './Detail.tsx';
import { PrintSheet } from './Print.tsx';
import { ChipView, Strip, XpBar, XpLabel, xpWords } from './Bits.tsx';
import { useLayout, type Layout } from './useLayout.ts';
import { unitRow, type HireView, type RosterView, type UnitRow, type WarriorView } from './view.ts';
import styles from './Board.module.css';

type Unit = WarriorView | HireView;

function Chevron() {
  return <svg className={styles.chev} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

/* What a screen reader hears of a row besides his name: experience, the whole profile, what sets him apart, what he carries. */
const rowWords = (r: UnitRow): string => [
  r.xp && `${xpWords(r.xp)}${r.ready ? ', an advance is ready' : ''}`,
  r.stats.map((c) => `${c.key} ${c.value}`).concat(r.save != null ? [`Sv ${r.save}`] : []).join(', '),
  [...r.chips.map((c) => c.label), ...(r.chipsMore ? [`${r.chipsMore} more`] : [])].join(', '),
  r.carries && `Carries ${r.carries}`,
].filter(Boolean).join('. ');

function RowView({ r, layout, current, onPick, rename, children }: { r: UnitRow; layout: Layout; current: boolean; onPick: () => void; rename?: () => void; children?: ReactNode }) {
  const stack = layout === 'stack';
  const li = useRef<HTMLLIElement>(null);
  const words = useId();
  const label = [r.name, r.count != null ? `${r.count} men` : null, r.sub].filter(Boolean).join(', ');
  // an opened row starts under the bars that stay on top
  useEffect(() => { if (stack && current) li.current?.scrollIntoView?.({ block: 'start' }); }, [stack, current]);
  return (
    <li ref={li} className={styles.row} data-kind={r.kind} data-open={stack && current} aria-current={!stack && current ? 'true' : undefined}>
      <button type="button" className={styles.rowBtn} aria-label={label} aria-describedby={words}
        aria-expanded={stack ? current : undefined} aria-pressed={stack ? undefined : current} onClick={onPick}>
        <span className={styles.r1}>
          <span className={styles.who}>
            <span className={styles.nm}>{r.name}{r.count != null && <span className={styles.count}> ×{r.count}</span>}</span>
            {r.sub && <span className={styles.ty}>{r.sub}</span>}
          </span>
          {r.xp && (
            <span className={`${styles.xpc} ${r.ready ? styles.ready : ''}`}>
              <XpLabel xp={r.xp} ready={r.ready} />
              <XpBar xp={r.xp} />
            </span>
          )}
        </span>
        <Strip cells={r.stats} save={r.save} />
        <span className={styles.r3}>
          {r.chips.map((c, i) => <ChipView key={i} chip={c} />)}
          {r.chipsMore > 0 && <span className={styles.chip} title="More on the card">+{r.chipsMore}</span>}
          <span className={styles.gear}>{r.carries || 'No equipment'}</span>
          <Chevron />
        </span>
      </button>
      <span id={words} className="visually-hidden">{rowWords(r)}</span>
      {stack && current && rename && <button type="button" className={`${ui.iconButton} ${styles.rowPencil}`} aria-label={`Rename ${r.name}`} onClick={rename}><IconEdit /></button>}
      {children}
    </li>
  );
}

/* The four sections of a phone, as tabs; ← and → move between them. */
function Tabs({ ids, tab, onTab }: { ids: TabId[]; tab: TabId; onTab: (t: TabId) => void }) {
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = ids[(ids.indexOf(tab) + step + ids.length) % ids.length]!;
    onTab(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Sections" className={styles.tabs} onKeyDown={key}>
      {ids.map((id) => (
        <button key={id} type="button" role="tab" data-tab={id} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => onTab(id)}>{TAB_LABEL[id]}</button>
      ))}
    </div>
  );
}

export interface BoardProps {
  v: RosterView;
  /** What each warrior may do; without it the board only reads. */
  acts?: (u: Unit) => UnitActs;
  /** Under the list: the fallen, the hint of an empty warband. */
  after?: ReactNode;
  /** The warband's own functions: below the list, or the third column. */
  panel?: ReactNode;
  /** The browser is printing: the sheet replaces the list. */
  printing?: boolean;
}

export function Board({ v, acts, after, panel, printing }: BoardProps) {
  const [layout, ref] = useLayout();
  const stack = layout === 'stack';
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const groups = [
    { id: 'heroes', title: 'Heroes', note: `${v.heroCount} of ${v.heroMax}`, units: v.heroes as Unit[] },
    { id: 'henchmen', title: 'Henchmen', note: `${v.henchmen.reduce((n, w) => n + w.count, 0)} men`, units: v.henchmen as Unit[] },
    { id: 'hires', title: 'Hired Swords & Dramatis Personae', note: '', units: v.hires as Unit[] },
  ].filter((g) => g.units.length);
  const all = groups.flatMap((g) => g.units);
  // a phone opens nothing until asked; a desktop always shows someone
  const current = all.find((u) => u.key === picked) ?? (stack ? null : all[0] ?? null);
  const pick = (u: Unit) => {
    if (stack) {
      setPicked(current?.key === u.key ? null : u.key);
      setTab('overview');
    } else setPicked(u.key);
  };
  const shownTab = (u: Unit): TabId => (tabsFor(u).includes(tab) ? tab : 'overview');

  return (
    <div ref={ref} className={styles.board} data-layout={layout}>
      {printing && <PrintSheet v={v} />}
      <div className={`${styles.list} ${styles.screenOnly}`}>
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`board-${g.id}`}>
            <div className={styles.groupHead}><h2 id={`board-${g.id}`}>{g.title}</h2>{g.note && <span>{g.note}</span>}</div>
            <ul className={styles.rows}>
              {g.units.map((u) => {
                const open = current?.key === u.key;
                return (
                  <RowView key={u.key} r={unitRow(u)} layout={layout} current={open} onPick={() => pick(u)} rename={acts?.(u).editName}>
                    {stack && open && (
                      <div className={styles.open}>
                        <Tabs ids={tabsFor(u)} tab={shownTab(u)} onTab={setTab} />
                        <div role="tabpanel" aria-label={TAB_LABEL[shownTab(u)]}>
                          <Detail u={u} acts={acts?.(u)} tab={shownTab(u)} />
                        </div>
                      </div>
                    )}
                  </RowView>
                );
              })}
            </ul>
          </section>
        ))}
        {after}
      </div>
      {!stack && current && (
        <aside className={`${styles.pane} ${styles.screenOnly}`} aria-label="Selected warrior">
          <Detail u={current} acts={acts?.(current)} headed />
        </aside>
      )}
      {panel && <div className={`${styles.side} ${styles.screenOnly}`}>{panel}</div>}
    </div>
  );
}

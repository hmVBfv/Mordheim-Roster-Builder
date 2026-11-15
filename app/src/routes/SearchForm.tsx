/* The search for a rare item (Trading Post, and the post-battle page): who looks for what, the roll, the price, where it goes. Moved out of
   TradingPost so that both can open the same sheet. */
import * as core from '@mordheim/core';
import { useState } from 'react';
import { filterRare, gradeOptions, SORT_ORDERS, sortRare, sourceOptions, STAT_FILTERS, type SortOrder, type StatFilter } from '../roster/rareFilter.ts';
import { RareLine } from './RareLine.tsx';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import { searchDestinations, searchers, type RareItem, type Recipient } from '../roster/equipment.ts';

type SheetApi = ReturnType<typeof useSheet>;
/** The highest rarity a search may be narrowed to. */
const RARITY_STEPS = [6, 8, 10, 12] as const;

export const gc = (n: number) => `${n} gc`;
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');


/** A list of choices, one pressed: who gets the item. */
export function Pick({ label, items, value, onChange }: { label: string; items: Recipient[]; value: core.Holder | null; onChange: (v: core.Holder) => void }) {
  return (
    <div className={styles.pick} role="group" aria-label={label}>
      {items.map((r) => (
        <button key={String(r.to)} type="button" disabled={!r.ok} aria-pressed={r.to === value} onClick={() => onChange(r.to)}>
          {r.name}<small className={r.ok ? undefined : styles.no}>{r.note}</small>
        </button>
      ))}
    </div>
  );
}


/** The search mask of the rare items: by name or effect, by the characteristic an item touches, by rarity. */
export function RareMask({ q, stat, max, sort, from, grade, items, onQ, onStat, onMax, onSort, onFrom, onGrade, shown, total }: {
  q: string; stat: StatFilter | ''; max: number | null; sort: SortOrder; from: string; grade: string; items: RareItem[];
  onQ: (v: string) => void; onStat: (v: StatFilter | '') => void; onMax: (v: number | null) => void; onSort: (v: SortOrder) => void; onFrom: (v: string) => void; onGrade: (v: string) => void; shown: number; total: number;
}) {
  const sources = sourceOptions(items), grades = gradeOptions(items);
  return (
    <div className={styles.filters}>
      <input className={ui.input} type="search" value={q} placeholder="Find by name or effect" aria-label="Find by name or effect" autoComplete="off" onChange={(e) => onQ(e.target.value)} />
      <div className={styles.filterRow}>
        <label className={ui.field}><span className={ui.muted}>Touches</span>
          <select className={ui.select} value={stat} aria-label="Characteristic it touches" onChange={(e) => onStat(e.target.value as StatFilter | '')}>
            <option value="">any characteristic</option>
            {STAT_FILTERS.map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}
          </select>
        </label>
        <label className={ui.field}><span className={ui.muted}>Rarity</span>
          <select className={ui.select} value={max ?? ''} aria-label="Highest rarity" onChange={(e) => onMax(e.target.value ? Number(e.target.value) : null)}>
            <option value="">any rarity</option>
            {RARITY_STEPS.map((r) => <option key={r} value={r}>Rare {r} or less</option>)}
          </select>
        </label>
      </div>
      <div className={styles.filterRow}>
        <label className={ui.field}><span className={ui.muted}>Released with</span>
          <select className={ui.select} value={from} aria-label="Released with" onChange={(e) => onFrom(e.target.value)}>
            <option value="">any campaign</option>
            {sources.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className={ui.field}><span className={ui.muted}>Warband grade</span>
          <select className={ui.select} value={grade} aria-label="Warband grade" onChange={(e) => onGrade(e.target.value)}>
            <option value="">any grade</option>
            {grades.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className={ui.field}><span className={ui.muted}>Sort by</span>
        <select className={ui.select} value={sort} aria-label="Sort by" onChange={(e) => onSort(e.target.value as SortOrder)}>
          {SORT_ORDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <p className={ui.muted} aria-live="polite">{shown} of {total} shown</p>
    </div>
  );
}


/* ---- search ---- */

export function SearchForm({ ctx, start, items, gold, close, onFound, onMissed, titleId }: {
  ctx: core.Ctx; start: { uid: number | null; de: string | null }; items: RareItem[]; gold: number; close: SheetApi['close'];
  onFound: (uid: number, de: string, paid: number, to: core.Holder) => void; onMissed: (uid: number, de: string) => void; titleId: string;
}) {
  const [de, setDe] = useState<string | null>(start.de);
  // once an item is chosen, only those who may look for it are offered (#60)
  const who = searchers(ctx, de).filter((s) => !s.why);
  // nobody is chosen for the player: a search that starts from an item or from nothing asks who looks for it
  const [picked, setUid] = useState<number | null>(start.uid);
  const uid = who.some((w) => w.uid === picked) ? picked : null;
  const onlyFor = de ? searchers(ctx, de).map((x) => x.why).find((w) => w?.startsWith('only a')) : null;
  const [q, setQ] = useState('');
  const [stat, setStat] = useState<StatFilter | ''>('');
  const [max, setMax] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOrder>('name');
  const [from, setFrom] = useState('');
  const [grade, setGrade] = useState('');
  const [extra, setExtra] = useState('');
  const [roll, setRoll] = useState('');
  const [price, setPrice] = useState('');
  const [to, setTo] = useState<core.Holder>('stash');
  const it = items.find((x) => x.de === de) ?? null;
  const odds = uid != null && de ? core.searchOdds(ctx, uid, de, Number(extra) || 0) : null;
  const r = Number(roll);
  const rolled = Number.isInteger(r) && r >= 2 && r <= 12;
  // a planner (#89) rolls nothing: the merchant has what it looks for, and a price left empty is the average
  const planner = ctx.s.planner === true;
  const average = planner && it?.avg != null ? Math.round(it.avg) : null;
  const found = !!odds && (planner || (rolled && r >= odds.target));
  const paid = price !== '' ? Number(price) : it?.fixed ?? average ?? NaN;
  const priceOk = Number.isFinite(paid) && paid >= 0 && (it?.fixed != null || average != null || price !== '');
  const dest: Recipient[] = de ? searchDestinations(ctx, de, true) : [];
  const matching = sortRare(filterRare(items, { q, stat, maxRarity: max, from, grade }), sort);
  const shown = [...items.filter((x) => x.de === de && !matching.includes(x)), ...matching].slice(0, 60);
  return (
    <div className={ui.page}>
      <h2 id={titleId}>{uid != null ? `${who.find((w) => w.uid === uid)?.name ?? 'A Hero'} searches` : 'Search for a rare item'}</h2>
      {(who.length > 1 || uid == null) && who.length > 0 && (
        <label className={ui.field}><span>Who searches</span>
          <select className={ui.select} value={uid ?? ''} onChange={(e) => setUid(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Choose a Hero…</option>
            {who.map((w) => <option key={w.uid} value={w.uid}>{w.name}</option>)}
          </select>
        </label>
      )}
      {de && who.length === 0 && <p className={`${ui.message} ${styles.no}`} role="status">Nobody here may look for it{onlyFor ? ` – ${onlyFor}` : ''}.</p>}
      <RareMask q={q} stat={stat} max={max} sort={sort} from={from} grade={grade} items={items} onQ={setQ} onStat={setStat} onMax={setMax} onSort={setSort} onFrom={setFrom} onGrade={setGrade} shown={matching.length} total={items.length} />
      <div className={`${styles.pick} ${styles.scroll}`} role="group" aria-label="Rare items">
        {shown.map((x) => (
          <button key={x.de} type="button" className={styles.rareRow} aria-pressed={x.de === de} onClick={() => setDe(x.de)}>
            <RareLine it={x} />
          </button>
        ))}
      </div>
      {it && odds && (
        <div className={styles.result}>
          <p><b>{it.name}</b> — needs <b>{odds.target}+</b> on 2D6 ({Math.round(odds.chance * 100)} %)</p>
          {it.text && <p className={styles.text}>{it.text}</p>}
          <p className={ui.muted}>Rare {odds.rarity}{odds.modifiers.map((m) => `; ${m.label} ${signed(m.value)}`).join('')}{Number(extra) ? `; other ${signed(Number(extra))}` : ''}.</p>
        </div>
      )}
      <label className={ui.field}><span>Other modifiers (a skill, a Hired Sword, the Merchant's reputation …)</span>
        <input className={ui.input} inputMode="numeric" value={extra} placeholder="0" maxLength={3} onChange={(e) => setExtra(e.target.value.replace(/[^\d-]/g, ''))} />
      </label>
      {!planner && (
        <label className={ui.field}><span>2D6 as rolled</span>
          <input className={ui.input} inputMode="numeric" value={roll} maxLength={2} autoComplete="off" onChange={(e) => setRoll(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      <p className={`${styles.verdict} ${rolled || planner ? (found ? styles.found : styles.missed) : ''}`} aria-live="polite">
        {uid == null ? 'Choose who searches.' : !it ? 'Choose the item he looks for.' : planner ? 'A planner has no roll to make: the merchant has one.' : !rolled ? 'Enter the roll (2 to 12).' : found ? `${r} — found. The merchant has one.` : `${r} — not found this time.`}
      </p>
      {found && (
        <>
          <label className={ui.field}><span>{it?.fixed != null ? `Price (${gc(it.fixed)}; Haggle may lower it)` : planner && average != null ? `Price (left empty: the average, ${gc(average)})` : `Price as asked (${it?.price})`}</span>
            <input className={ui.input} inputMode="numeric" value={price} placeholder={it?.fixed != null ? String(it.fixed) : average != null ? String(average) : ''} maxLength={4} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </label>
          <Pick label="Goes to" items={dest} value={to} onChange={setTo} />
        </>
      )}
      <div className={ui.actions}>
        {!planner && <button type="button" className={ui.buttonQuiet} disabled={!it || uid == null} onClick={() => close(() => onMissed(uid!, de!))}>Not found</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="button" className={ui.button} disabled={!found || !priceOk || paid > gold || uid == null}
          onClick={() => close(() => onFound(uid!, de!, paid, to))}>{found && priceOk ? (paid > gold ? 'Not enough gold' : `Buy · ${gc(paid)}`) : 'Buy'}</button>
      </div>
    </div>
  );
}


/* Overviews the interface lists (legacy app.js: the unit list of
   renderSidebar, warbandOptions, passNameFilter, passStatFilter). */
import type { GameData, HireEntry } from '../data/types.ts';
import type { Ctx } from './context.ts';
import { modelTotalCost, totalSpent } from './costs.ts';
import { dpHireCost, hsHireCost } from './pricing.ts';
import { hsUpkeepFor } from './hire.ts';
import { unitDef, warbandDef } from './lookup.ts';
import { statNum } from './saves.ts';

export interface SummaryRow { name: string; n: number; gold: number | null; title?: string }
export interface UnitSummary {
  heroes: SummaryRow[];
  dramatis: SummaryRow[];
  hired: SummaryRow[];
  henchmen: SummaryRow[];
  vehicles: SummaryRow[];
  totalSpent: number;
}

/** The roster at a glance: warriors per type (a promoted henchman as
    "Hero <type>" under Heroes, the leader first), hires, vehicles. */
export function unitSummary(ctx: Ctx): UnitSummary {
  const s = ctx.s;
  const units = warbandDef(ctx)?.units ?? [];
  const counts: Record<string, { id: string; name: string; promo: boolean; n: number }> = {};
  const order: string[] = [];
  for (const m of s.models) {
    const d = unitDef(ctx, m.uid_def);
    if (!d) continue;
    const promo = !!m.promoted && d.t === 'hen' && !d.vehicle;
    const key = (promo ? 'promo:' : '') + d.id;
    if (!(key in counts)) { counts[key] = { id: d.id, name: promo ? ('Hero ' + d.name) : d.name, promo, n: 0 }; order.push(key); }
    counts[key]!.n += (d.t === 'hen' && !promo ? (Number(m.qty) || 1) : 1);
  }
  const udef = (k: string) => units.find((u) => u.id === counts[k]!.id);
  const listIdx = (k: string) => { const i = units.findIndex((u) => u.id === counts[k]!.id); return i < 0 ? 999 : i; };
  const isLead = (k: string) => { const d = udef(k); return !!(d && /\bLeader:/.test(d.sp || '')); };
  const heroK = order.filter((k) => { const d = udef(k); return d && !d.vehicle && (d.t === 'hero' || counts[k]!.promo); })
    .sort((a, b) => ((isLead(a) ? 0 : 1) - (isLead(b) ? 0 : 1)) || ((counts[a]!.promo ? 1 : 0) - (counts[b]!.promo ? 1 : 0)) || (listIdx(a) - listIdx(b)));
  const henK = order.filter((k) => { const d = udef(k); return d && d.t === 'hen' && !d.vehicle && !counts[k]!.promo; }).sort((a, b) => listIdx(a) - listIdx(b));
  const vehK = order.filter((k) => { const d = udef(k); return d && d.vehicle; }).sort((a, b) => listIdx(a) - listIdx(b));
  const goldOf = (k: string) => s.models.filter((m) => m.uid_def === counts[k]!.id && (!!m.promoted) === counts[k]!.promo).reduce((a, m) => a + modelTotalCost(ctx, m), 0);
  const row = (k: string): SummaryRow => ({ name: counts[k]!.name, n: counts[k]!.n, gold: goldOf(k) });
  const prof = (e: HireEntry) => { const p = e.profile ?? {}; return [p.M, p.WS, p.BS, p.S, p.T, p.W, p.I, p.A, p.Ld].join('/'); };
  const hired = (s.hired ?? []).flatMap((h) => {
    const hs = ctx.data.HIREDSWORDS[h.key];
    if (!hs) return [];
    return [{ name: h.name ? h.name + ' (' + hs.name + ')' : hs.name, n: 1, gold: hsHireCost(ctx, h.key), title: `${hs.name} (${hs.grade}) — ${prof(hs)} · Hire ${hs.hire}, Upkeep ${hsUpkeepFor(ctx, h.key)}, Rating +${hs.rating}` }];
  });
  const dramatis = (s.dp ?? []).flatMap((d) => {
    const dp = ctx.data.DRAMATIS[d.key];
    if (!dp) return [];
    return [{ name: d.name ? d.name : dp.name, n: 1, gold: dpHireCost(ctx, d.key), title: `${dp.name} (${dp.grade}) — ${prof(dp)} · Rating +${dp.rating}` }];
  });
  return { heroes: heroK.map(row), dramatis, hired, henchmen: henK.map(row), vehicles: vehK.map(row), totalSpent: totalSpent(ctx) };
}

/** The warband picker: grouped by grade, alphabetical within (leading
    articles ignored). */
export function warbandPickerGroups(data: GameData): { grade: string; label: string; warbands: { key: string; name: string }[] }[] {
  const groups: [string, string][] = [['core', 'Core — official'], ['1a', 'Grade 1a — official supplements'],
    ['1b', 'Grade 1b — official magazines'], ['1c', 'Grade 1c — semi-official'], ['2a', 'Grade 2a — fan-made, reliable']];
  const sortName = (n: string) => String(n).replace(/^(the|der|die|das)\s+/i, '').toLowerCase();
  return groups.map(([grade, label]) => ({
    grade, label,
    warbands: Object.entries(data.WARBANDS).filter(([, wb]) => ((wb.grade as string) || 'core') === grade)
      .sort((a, b) => sortName(a[1].name).localeCompare(sortName(b[1].name)))
      .map(([key, wb]) => ({ key, name: wb.name })),
  })).filter((g) => g.warbands.length);
}

/* ---- finding a warband to start (wish #116) ---- */

const GRADES = ['core', '1a', '1b', '1c', '2a'];
const sortName = (n: string) => String(n).replace(/^(the|der|die|das)\s+/i, '').toLowerCase();

/** What the picker knows of a warband: where it stands, how it is made, what it starts with. */
export interface WarbandFact {
  key: string; name: string; grade: string; race: string;
  /** The starting gold, lowest and highest over its variants. */
  gold: number; goldMax: number;
  /** The fewest and the most models. */
  min: number; max: number;
  /** The most Heroes it may start with: what its hero units allow together, six at the most. */
  heroes: number;
  /** A big creature among its units (Kroxigor, Minotaur …). */
  large: boolean;
}

export function warbandFacts(data: GameData): WarbandFact[] {
  return Object.entries(data.WARBANDS).map(([key, wb]) => {
    const golds = [Number(wb.gold) || 0, ...(wb.subtypes ?? []).map((x) => Number(x.gold ?? wb.gold) || 0)];
    const heroes = wb.units.filter((u) => u.t === 'hero').reduce((n, u) => n + (u.max ?? 6), 0);
    return {
      key, name: wb.name, grade: (wb.grade as string) || 'core', race: String(wb.siteRace ?? ''),
      gold: Math.min(...golds), goldMax: Math.max(...golds), min: Number(wb.min) || 0, max: Number(wb.max) || 0,
      heroes: Math.min(6, heroes), large: wb.units.some((u) => !!u.large),
    };
  });
}

export interface WarbandFilter {
  q?: string; race?: string; grade?: string; heroes?: number | ''; large?: '' | 'with' | 'without';
  goldFrom?: number | ''; goldTo?: number | ''; sizeFrom?: number | ''; sizeTo?: number | '';
}

const given = (v: number | '' | undefined): v is number => typeof v === 'number' && !Number.isNaN(v);

/** The warbands that pass every part of the filter that is set; the order stays. */
export function filterWarbands(list: WarbandFact[], f: WarbandFilter): WarbandFact[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return list.filter((w) => {
    if (q && !w.name.toLowerCase().includes(q)) return false;
    if (f.race && w.race !== f.race) return false;
    if (f.grade && w.grade !== f.grade) return false;
    if (given(f.heroes) && w.heroes !== f.heroes) return false;
    if (f.large === 'with' && !w.large) return false;
    if (f.large === 'without' && w.large) return false;
    // the gold lies in a range when the variants differ: it passes where the range meets the wish
    if (given(f.goldFrom) && w.goldMax < f.goldFrom) return false;
    if (given(f.goldTo) && w.gold > f.goldTo) return false;
    if (given(f.sizeFrom) && w.max < f.sizeFrom) return false;
    if (given(f.sizeTo) && w.max > f.sizeTo) return false;
    return true;
  });
}

export type WarbandSort = 'grade' | 'name' | 'gold-asc' | 'gold-desc' | 'size-desc' | 'heroes-desc';

/** A sorted copy: by grade (the picker's own order), name, gold, most models or Heroes; ties by name. */
export function sortWarbands(list: WarbandFact[], by: WarbandSort): WarbandFact[] {
  const name = (a: WarbandFact, b: WarbandFact) => sortName(a.name).localeCompare(sortName(b.name));
  const cmp: Record<WarbandSort, (a: WarbandFact, b: WarbandFact) => number> = {
    grade: (a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade),
    name: () => 0,
    'gold-asc': (a, b) => a.gold - b.gold,
    'gold-desc': (a, b) => b.goldMax - a.goldMax,
    'size-desc': (a, b) => b.max - a.max,
    'heroes-desc': (a, b) => b.heroes - a.heroes,
  };
  return [...list].sort((a, b) => cmp[by](a, b) || name(a, b));
}

/** Does this Hired Sword or Dramatis Persona cast: a spell list of his own, or his rules name a Wizard, Prayers or Funerary Rites (wish #120)? */
export function hireIsCaster(e: HireEntry): boolean {
  return !!e.magic || /<b>\s*(?:Master\s+)?(?:Wizard|Prayers|Funerary Rites)\b/i.test(String(e.sp ?? ''));
}

/* ---- filtering the Hired Sword and Dramatis Personae lists ---- */

export interface HireFilter { q?: string; stat?: string; op?: '>=' | '>' | '=' | '<=' | '<'; val?: string | number }

export function passNameFilter(entry: { name?: string }, f: HireFilter | null | undefined): boolean {
  const q = String((f && f.q) || '').trim().toLowerCase();
  if (!q) return true;
  return String(entry.name || '').toLowerCase().includes(q);
}

/** Name filter, then a characteristic compared (either profile of a pair). */
export function passStatFilter(entry: HireEntry, f: HireFilter): boolean {
  if (!passNameFilter(entry, f)) return false;
  if (!f.stat || f.val === '') return true;
  const want = Number(f.val);
  if (isNaN(want)) return true;
  const vals: Record<string, unknown>[] = [entry.profile as Record<string, unknown>];
  const p2 = entry.profile2 as { p?: Record<string, unknown> } | undefined;
  if (p2 && p2.p) vals.push(p2.p);
  return vals.some((p) => {
    const n = statNum(p && p[f.stat as string]);
    if (n == null) return false;
    switch (f.op) {
      case '>=': return n >= want;
      case '>': return n > want;
      case '=': return n === want;
      case '<=': return n <= want;
      case '<': return n < want;
    }
    return true;
  });
}

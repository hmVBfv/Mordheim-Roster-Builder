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

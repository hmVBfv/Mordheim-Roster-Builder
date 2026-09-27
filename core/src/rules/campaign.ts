/* Reading a warband's campaign: districts it holds, the post-battle sequence,
   wyrdstone prices, stage snapshots and the per-warrior analysis (legacy
   app.js districtName … pbExploreDice, WYRD_PRICE … wyrdPrice, snapRows …
   stageSnapshots, characterTimeline … campaignAnalysis). The actions are in
   warband/campaign.ts. The shared campaign file is not part of this. */
import type { Casualty, CampaignState, DistrictHold, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { casualtyText, wbName } from './casualties.ts';
import { isHeroModel } from './costs.ts';
import { unitDef } from './lookup.ts';

const camp = (ctx: Ctx): CampaignState => ctx.s.campaign ?? {};

export function districtName(ctx: Ctx, id: string | null | undefined): string {
  const d = ctx.data.DISTRICTS.find((x) => x.id === id);
  return d ? d.name : (id || '');
}

/** What this warband holds at a district as stored ('none' if nothing). */
export function districtState(ctx: Ctx, id: string): DistrictHold {
  return camp(ctx).districts?.[id] || 'none';
}

/* ---- the post-battle sequence ---- */

/** Deep links to the relevant section on mordheimer.net. */
export const PB_LINK = {
  injuries: 'https://mordheimer.net/docs/campaigns#serious-injuries',
  experience: 'https://mordheimer.net/docs/tools#2-allocate-experience',
  exploration: 'https://mordheimer.net/docs/campaigns/income#exploration-chart',
  wyrdstone: 'https://mordheimer.net/docs/tools#4-sell-wyrdstone',
  veterans: 'https://mordheimer.net/docs/tools#5-check-available-veterans',
  rare: 'https://mordheimer.net/docs/tools#6-make-rarity-rolls-and-buy-rare-items',
  dramatis: 'https://mordheimer.net/docs/tools#7-look-for-dramatis-personae',
  recruits: 'https://mordheimer.net/docs/tools#8-hire-new-recruits--buy-common-items',
  equipment: 'https://mordheimer.net/docs/tools#9-reallocate-equipment',
} as const;

/** The rulebook's steps in their fixed order: [key, title, link]. */
export const PB_STEPS: readonly (readonly [string, string, string])[] = [
  ['injuries', 'Injuries', PB_LINK.injuries],
  ['experience', 'Experience', PB_LINK.experience],
  ['exploration', 'Exploration', PB_LINK.exploration],
  ['wyrdstone', 'Sell wyrdstone', PB_LINK.wyrdstone],
  ['veterans', 'Available veterans', PB_LINK.veterans],
  ['rare', 'Rare items', PB_LINK.rare],
  ['dramatis', 'Dramatis Personae', PB_LINK.dramatis],
  ['recruits', 'Recruits & common items', PB_LINK.recruits],
  ['equipment', 'Reallocate equipment', PB_LINK.equipment],
];
export const PB_ORDER: readonly string[] = PB_STEPS.map((s) => s[0]);

export interface WyrdSale { done: boolean; shards: number; gc: number; size: number }
export interface PostBattleState { done: Record<string, boolean>; wyrd: WyrdSale | null; [key: string]: unknown }

/** The round the sequence belongs to: the latest battle's, else the current stage. */
export function pbRound(ctx: Ctx): number {
  const c = camp(ctx);
  const rs = (c.battles ?? []).map((b) => Number(b.round) || 0);
  const latest = rs.length ? Math.max(...rs) : 0;
  return Math.max(latest, Number(c.round) || 0);
}

/** Progress of one round's sequence (empty if not started). */
export function postbattleState(ctx: Ctx, round?: number | null): PostBattleState {
  const r = round == null ? pbRound(ctx) : round;
  const st = (camp(ctx).postbattle as Record<string, PostBattleState> | undefined)?.[r];
  return st ? { ...st, done: st.done ?? {} } : { done: {}, wyrd: null };
}

export function pbStepDone(ctx: Ctx, step: string, round?: number | null): boolean {
  return !!postbattleState(ctx, round).done[step];
}

/** Steps completed from the top without a gap — the one after is active. */
export function pbActiveStep(ctx: Ctx, round?: number | null): number {
  const d = postbattleState(ctx, round).done;
  let i = 0;
  while (i < PB_ORDER.length && d[PB_ORDER[i] as string]) i++;
  return i;
}

/** Did we win a battle this round? Our side (key 'me'), else the old single outcome. */
export function pbWonThisRound(ctx: Ctx, round?: number | null): boolean {
  const r = round == null ? pbRound(ctx) : round;
  return (camp(ctx).battles ?? []).filter((b) => Number(b.round) === r).some((b) => {
    const sides = b.sides as { key?: string; outcome?: string }[] | undefined;
    if (Array.isArray(sides) && sides.length) { const me = sides.find((s) => s.key === 'me'); if (me) return /victor/i.test(me.outcome || ''); }
    return /victor/i.test((b.outcome as string) || '');
  });
}

/** Our warriors taken out of action this round (whatever the injury roll said). */
export function pbHeroesOOA(ctx: Ctx, round?: number | null): Set<number> {
  const r = round == null ? pbRound(ctx) : round;
  const s = new Set<number>();
  for (const x of camp(ctx).casualties ?? []) if (x.round === r && x.victim && x.victim.uid != null) s.add(x.victim.uid);
  return s;
}

/** The Heroes who may search for wyrdstone, by name. */
export function pbSearchingHeroes(ctx: Ctx, round?: number | null): string[] {
  const ooa = pbHeroesOOA(ctx, round);
  return ctx.s.models.filter((m) => isHeroModel(ctx, m) && !ooa.has(m.uid)).map((m) => (m.name || unitDef(ctx, m.uid_def)?.name) as string);
}

/** Exploration dice from the roster: one per searching Hero, one for a win,
    at most six (dice from skills and equipment come on top). */
export function pbExploreDice(ctx: Ctx, round?: number | null): { survivors: number; winDie: number; base: number; capped: number } {
  const survivors = pbSearchingHeroes(ctx, round).length;
  const winDie = pbWonThisRound(ctx, round) ? 1 : 0;
  const base = survivors + winDie;
  return { survivors, winDie, base, capped: Math.min(6, base) };
}

/* ---- wyrdstone (mordheimer, Income) ----
   The TOTAL gold for selling that many shards at once (1..8, the last row
   covering 8 or more), by warband size band. */
export const WYRD_PRICE: readonly (readonly number[])[] = [
  [45, 40, 35, 30, 30, 25],
  [60, 55, 50, 45, 40, 35],
  [75, 70, 65, 60, 55, 50],
  [90, 80, 70, 65, 60, 55],
  [110, 100, 90, 80, 70, 65],
  [120, 110, 100, 90, 80, 70],
  [145, 130, 120, 110, 100, 90],
  [155, 140, 130, 120, 110, 100],
];
export const WYRD_BANDS: readonly (readonly [number, string])[] = [[3, '1–3'], [6, '4–6'], [9, '7–9'], [12, '10–12'], [15, '13–15'], [99, '16+']];

export function wyrdSizeBand(n: unknown): number {
  const v = Number(n) || 0;
  for (let i = 0; i < WYRD_BANDS.length; i++) if (v <= (WYRD_BANDS[i] as readonly [number, string])[0]) return i;
  return WYRD_BANDS.length - 1;
}

/** Models the warband fields, Hired Swords included: mouths to feed. */
export function warbandSize(ctx: Ctx): number {
  let n = ctx.s.models.reduce((s, m) => { const d = unitDef(ctx, m.uid_def); return s + ((d && d.t === 'hen') ? (Number(m.qty) || 1) : 1); }, 0);
  n += (ctx.s.hired ?? []).length + (ctx.s.dp ?? []).length;
  return n;
}

export function wyrdPrice(ctx: Ctx, shards: unknown, size?: number | null): number {
  const n = Math.max(1, Math.min(8, Number(shards) || 1));
  const band = wyrdSizeBand(size == null ? warbandSize(ctx) : size);
  return (WYRD_PRICE[n - 1] as readonly number[])[band] as number;
}

/* ---- stage snapshots ---- */

export interface StageTotals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface StageSnapshot { round: number; at: string; state: WarbandState; totals: StageTotals }

export function stageSnapshots(ctx: Ctx): Record<string, StageSnapshot> {
  const s = camp(ctx).snapshots;
  return (s && typeof s === 'object' ? s : {}) as Record<string, StageSnapshot>;
}

export interface SnapRow {
  uid: number; uid_def: string; name: string; grade: 'hero' | 'hench'; qty: number; exp: number;
  adv: Record<string, unknown>; skills: string[]; spells: string[]; inj: string[];
  eq: Record<string, unknown>; rare: string[]; names: string[]; alive: boolean;
}

/** One row per warrior of a snapshot, living and fallen; reads the earlier
    flat snapshot format too. */
export function snapRows(ctx: Ctx, snapshot: StageSnapshot | SnapRow[] | null | undefined): SnapRow[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot)) return snapshot;
  const st = snapshot.state || ({} as WarbandState);
  const row = (m: Model, alive: boolean): SnapRow => ({
    uid: m.uid, uid_def: m.uid_def,
    name: m.name || unitDef(ctx, m.uid_def)?.name || '?',
    grade: (m.promoted || unitDef(ctx, m.uid_def)?.t === 'hero') ? 'hero' : 'hench',
    qty: Number(m.qty) || 1, exp: Number(m.exp) || 0,
    adv: Object.assign({}, m.adv || {}), skills: [...(m.skills || [])],
    spells: (m.spells || []).map((x) => (x as { name?: string }).name || (x as unknown as string)), inj: (m.inj || []).map((j) => (j.name || j.code) as string),
    eq: Object.assign({}, m.eq || {}), rare: Object.keys(m.rare || {}),
    names: (m.names || []).slice(),
    alive,
  });
  const rows = (st.models || []).map((m) => row(m, true));
  for (const e of st.fallen || []) if (e && e.m) rows.push(row(e.m, false));
  return rows;
}

export interface StageDiff {
  from: number; to: number;
  joined: { uid: number; name: string; grade: string }[];
  died: { uid: number; name: string; grade: string }[];
  left: { uid: number; name: string }[];
  changed: Record<string, unknown>[];
}

/** What changed between two stages: who joined, died or left, and who gained
    experience, characteristics, skills, spells, injuries, gear or men. */
export function diffStages(ctx: Ctx, a: number, b: number): StageDiff {
  const snaps = stageSnapshots(ctx);
  const A = snapRows(ctx, snaps[String(a)]), B = snapRows(ctx, snaps[String(b)]);
  const byUid = (list: SnapRow[]) => { const m: Record<string, SnapRow> = {}; list.forEach((x) => { m[x.uid] = x; }); return m; };
  const ma = byUid(A), mb = byUid(B);
  const out: StageDiff = { from: Number(a), to: Number(b), joined: [], died: [], left: [], changed: [] };
  B.forEach((x) => {
    const prev = ma[x.uid];
    if (!prev) { out.joined.push({ uid: x.uid, name: x.name, grade: x.grade }); return; }
    if (prev.alive && !x.alive) out.died.push({ uid: x.uid, name: x.name, grade: x.grade });
    const ch: Record<string, unknown> = { uid: x.uid, name: x.name };
    let any = false;
    if (x.exp !== prev.exp) { ch.exp = { from: prev.exp, to: x.exp, gained: x.exp - prev.exp }; any = true; }
    const stats: Record<string, number> = {};
    Object.keys(Object.assign({}, prev.adv, x.adv)).forEach((k) => {
      const d = (Number(x.adv[k]) || 0) - (Number(prev.adv[k]) || 0); if (d) stats[k] = d;
    });
    if (Object.keys(stats).length) { ch.stats = stats; any = true; }
    const newSk = (x.skills || []).filter((v) => !(prev.skills || []).includes(v));
    if (newSk.length) { ch.skills = newSk; any = true; }
    const newSp = (x.spells || []).filter((v) => !(prev.spells || []).includes(v));
    if (newSp.length) { ch.spells = newSp; any = true; }
    const newInj = (x.inj || []).filter((v) => !(prev.inj || []).includes(v));
    if (newInj.length) { ch.injuries = newInj; any = true; }
    const newEq = Object.keys(x.eq || {}).filter((k) => (Number(x.eq[k]) || 0) > (Number((prev.eq || {})[k]) || 0));
    if (newEq.length) { ch.equipment = newEq; any = true; }
    const newRare = (x.rare || []).filter((v) => !(prev.rare || []).includes(v));
    if (newRare.length) { ch.rare = newRare; any = true; }
    if (x.qty !== prev.qty) { ch.qty = { from: prev.qty, to: x.qty }; any = true; }
    if (any) out.changed.push(ch);
  });
  A.forEach((x) => { if (!mb[x.uid]) out.left.push({ uid: x.uid, name: x.name }); });
  return out;
}

/** Who was there from the very beginning (the Setup snapshot). */
export function foundingMembers(ctx: Ctx): { uid: number; name: string; grade: string }[] {
  return snapRows(ctx, stageSnapshots(ctx)['0']).map((x) => ({ uid: x.uid, name: x.name, grade: x.grade }));
}

/** Districts held at a given stage. */
export function districtsAt(ctx: Ctx, round: number): { id: string; name: string; state: string }[] {
  const sn = stageSnapshots(ctx)[String(round)];
  const d = (sn && sn.state && sn.state.campaign && sn.state.campaign.districts) || {};
  return Object.keys(d).filter((k) => d[k] && d[k] !== 'none').map((k) => ({ id: k, name: districtName(ctx, k), state: d[k] as string }));
}

/** The totals of a stage as they stood then (never recomputed). */
export function totalsAt(ctx: Ctx, round: number): StageTotals | null {
  const sn = stageSnapshots(ctx)[String(round)];
  return (sn && sn.totals) || null;
}

/* ---- analysis ---- */

export interface CharacterTimeline {
  uid: number; name: string; alive: boolean; joined: number | null; died: number | null;
  kills: number; outOfActionsInflicted: number; killsByGrade: { hero: number; hench: number };
  goldDestroyed: number; injuries: number;
  curve: { round: number; exp: number; advances: number; skills: number; alive: boolean }[];
  events: Record<string, unknown>[];
}

/** Everything that ever happened to one warrior, in order. */
export function characterTimeline(ctx: Ctx, uidIn: unknown): CharacterTimeline {
  const c = camp(ctx);
  const uid = Number(uidIn);
  const events = (c.log ?? []).filter((e) => e.data && e.data.uid === uid)
    .map((e) => ({ round: e.round, type: e.type, text: e.text, data: e.data }));
  const cas = (c.casualties ?? []) as Casualty[];
  const kills = cas.filter((r) => r.attacker.uid === uid)
    .map((r) => ({ round: r.round, type: 'kill', victim: r.victim, result: r.result, text: casualtyText(ctx, r) }));
  const suffered = cas.filter((r) => r.victim.uid === uid)
    .map((r) => ({ round: r.round, type: 'suffered', by: r.attacker, result: r.result, text: casualtyText(ctx, r) }));
  const snaps = stageSnapshots(ctx);
  const curve = Object.keys(snaps).map(Number).sort((a, b) => a - b)
    .map((rd) => {
      const row = snapRows(ctx, snaps[String(rd)]).find((x) => x.uid === uid);
      return row ? {
        round: rd, exp: row.exp,
        advances: Object.values(row.adv || {}).reduce((x: number, y) => x + (Number(y) || 0), 0),
        skills: (row.skills || []).length, alive: row.alive,
      } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const all = ([] as { round: number; [key: string]: unknown }[]).concat(events, kills, suffered).sort((a, b) => (a.round - b.round));
  const live = ctx.s.models.find((m) => m.uid === uid);
  const fallen = (ctx.s.fallen ?? []).find((e) => e.m && e.m.uid === uid);
  const first = all.length ? (all[0] as { round: number }).round : null;
  const deathEv = events.filter((e) => e.type === 'death').map((e) => e.round);
  const deathCas = suffered.filter((x) => x.result === 'dead').map((x) => x.round);
  const last = (deathEv.concat(deathCas).sort((a, b) => a - b))[0];
  const died = last == null ? null : last;
  const killed = kills.filter((k) => k.result === 'dead');
  return {
    uid,
    name: (live && (live.name || unitDef(ctx, live.uid_def)?.name)) || (fallen && (fallen.m.name || unitDef(ctx, fallen.m.uid_def)?.name)) || 'unknown',
    alive: !!live, joined: first, died,
    kills: killed.length,
    outOfActionsInflicted: kills.length,
    killsByGrade: { hero: killed.filter((k) => k.victim.grade === 'hero').length, hench: killed.filter((k) => k.victim.grade === 'hench').length },
    goldDestroyed: killed.reduce((a, k) => a + (Number(k.victim.value) || 0), 0),
    injuries: suffered.filter((x) => x.result === 'injured').length,
    curve, events: all,
  };
}

/** Every warrior the campaign has seen, living or fallen. */
export function characterRoster(ctx: Ctx): CharacterTimeline[] {
  const seen = new Map<unknown, boolean>();
  ctx.s.models.forEach((m) => seen.set(m.uid, true));
  (ctx.s.fallen ?? []).forEach((e) => { if (e.m) seen.set(e.m.uid, true); });
  (camp(ctx).log ?? []).forEach((e) => { if (e.data && e.data.uid != null) seen.set(e.data.uid, true); });
  return [...seen.keys()].map((uid) => characterTimeline(ctx, uid));
}

/** Campaign-wide figures. */
export function campaignAnalysis(ctx: Ctx): Record<string, unknown> {
  const c = camp(ctx);
  const chars = characterRoster(ctx);
  const cas = (c.casualties ?? []) as Casualty[];
  const battles = c.battles ?? [];
  return {
    warband: ctx.s.name || wbName(ctx, ctx.s.wb), warbandType: wbName(ctx, ctx.s.wb), stage: c.round,
    battles: battles.length,
    wins: battles.filter((b) => /victor/i.test((b.outcome as string) || '')).length,
    losses: battles.filter((b) => /defeat/i.test((b.outcome as string) || '')).length,
    warriorsEverFielded: chars.length,
    fallen: (ctx.s.fallen ?? []).length,
    killsInflicted: cas.filter((r) => r.attacker.uid != null && r.result === 'dead').length,
    goldDestroyed: cas.filter((r) => r.attacker.uid != null && r.result === 'dead').reduce((a, r) => a + (Number(r.victim.value) || 0), 0),
    goldLost: cas.filter((r) => r.victim.uid != null && r.result === 'dead').reduce((a, r) => a + (Number(r.victim.value) || 0), 0),
    characters: chars.map((x) => ({
      name: x.name, alive: x.alive, joined: x.joined, died: x.died,
      kills: x.kills, killsByGrade: x.killsByGrade, goldDestroyed: x.goldDestroyed,
      injuries: x.injuries, curve: x.curve,
    })),
  };
}


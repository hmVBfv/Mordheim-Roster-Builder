/* Stages of a campaign: closing one (sit-outs served, snapshot, next round)
   and reading the snapshots back (legacy app.js snapshotStage, recordSitOuts,
   advanceRound, stageSnapshots, snapRows, diffStages, foundingMembers,
   districtsAt, totalsAt). */
import type { CampaignState, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { roundLabel } from '../rules/casualties.ts';
import { goldCurrent, totalHeroes, totalModels, totalRating, totalSpent } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { campState, logEvent, logEventAt } from '../warband/log.ts';
import { update, type WarbandDraft } from '../warband/update.ts';
import { districtName } from './territory.ts';

const camp = (ctx: Ctx): CampaignState => ctx.s.campaign ?? {};
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ---- stage snapshots ---- */

export interface StageTotals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface StageSnapshot { round: number; at: string; state: WarbandState; totals: StageTotals }

/** The totals of a warband as they stand now, as a stage snapshot freezes
    them – and, on the campaign server, a tag (ADR 0003). */
export function stageTotals(ctx: Ctx): StageTotals {
  return {
    rating: totalRating(ctx), spent: totalSpent(ctx), models: totalModels(ctx),
    heroes: totalHeroes(ctx), gold: goldCurrent(ctx), fallen: (ctx.s.fallen ?? []).length,
  };
}

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

/* ---- stages ---- */

/** Screen state (keys starting with `_`) has no place in a historical record. */
function stripTransient(o: unknown): unknown {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) { o.forEach(stripTransient); return o; }
  const r = o as Record<string, unknown>;
  for (const k of Object.keys(r)) { if (k.charAt(0) === '_') delete r[k]; else stripTransient(r[k]); }
  return o;
}

/** Freezes the warband as it stands at the close of a stage: the whole state
    (without the campaign records, which live once, centrally) and the totals
    as computed now — never recomputed later, so a changed data file cannot
    rewrite history. `today` is the date to stamp (YYYY-MM-DD). */
function snapshotStageOn(d: WarbandDraft, c: Ctx, round: unknown, today: string): StageSnapshot {
  const camp = campState(d);
  if (!camp.snapshots || typeof camp.snapshots !== 'object') camp.snapshots = {};
  const st = copy(d) as WarbandState;
  st.campaign = { on: !!camp.on, round: Number(round) || 0, districts: copy(camp.districts || {}) };
  stripTransient(st);
  const snap: StageSnapshot = {
    round: Number(round) || 0,
    at: today,
    state: st,
    totals: stageTotals(c),
  };
  (camp.snapshots as Record<string, unknown>)[String(round)] = snap;
  return snap;
}

export function snapshotStage(ctx: Ctx, round: number, today: string): WarbandState {
  return update(ctx, (d, c) => { snapshotStageOn(d, c, round, today); });
}

/** Warriors who sat the battle out are recorded, and the game they missed is
    served. Nothing happens when Setup closes: no battle was played. */
function recordSitOutsOn(d: WarbandDraft, c: Ctx, round: unknown): void {
  const camp = campState(d);
  if (!camp.on) return;
  if ((Number(round) || 0) < 1) return;
  for (const m of d.models as Model[]) {
    const n = Number(m.miss) || 0;
    if (n <= 0) continue;
    const who = m.name || unitDef(c, m.uid_def)?.name;
    const why = m.missWhy || (m.inj || []).map((j) => (j.name || j.code) as string).filter((x) => /old battle wound/i.test(x))[0];
    logEventAt(d, round, 'missed', `${who} sat out the battle${why ? ` (${why})` : ''}.`, { uid: m.uid, name: who, uid_def: m.uid_def, remaining: n - 1 });
    m.miss = n - 1;
    if (m.miss <= 0) delete m.missWhy;
  }
}

/** Closes the current stage: sit-outs are served, the stage is
    snapshotted, and the campaign moves on to the next. */
export function advanceRound(ctx: Ctx, today: string): WarbandState {
  return update(ctx, (d, c) => {
    const camp = campState(d);
    recordSitOutsOn(d, c, camp.round);
    snapshotStageOn(d, c, camp.round, today);
    camp.round = (Number(camp.round) || 0) + 1;
    logEvent(d, 'round', `Campaign moved to “${roundLabel(camp.round)}”.`);
  });
}

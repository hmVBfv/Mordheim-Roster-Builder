/* A warband's campaign: the chronicle, stages and their snapshots, battles,
   footholds, the post-battle sequence and selling wyrdstone (legacy app.js
   addLogNote … advanceRound, addBattle … removeBattle, claimFoothold,
   loseFoothold, pbSetStepDone, pbSellWyrd, pbClearWyrd). Every action returns
   a new state. The shared campaign file is not part of this. */
import type { CampaignState, LogEntry, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { roundLabel, wbName } from '../rules/casualties.ts';
import { districtName, PB_ORDER, pbRound, warbandSize, wyrdPrice, type PostBattleState, type StageSnapshot } from '../rules/campaign.ts';
import { goldCurrent, goldTreasury, totalHeroes, totalModels, totalRating, totalSpent } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { campState, logEvent, logEventAt, nextLogId } from './log.ts';
import { update, type WarbandDraft } from './update.ts';

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ---- the chronicle ---- */

/** A note written by hand into the chronicle (current stage unless given). */
export function addLogNote(ctx: Ctx, text: string, round?: number | null): WarbandState {
  return update(ctx, (d) => {
    const c = campState(d);
    const e: LogEntry = { id: nextLogId(d), round: round == null ? (c.round ?? 0) : Number(round) || 0, type: 'note', text: String(text || ''), auto: false };
    (c.log as LogEntry[]).push(e);
  });
}

/** Corrects the text of an entry; it is marked as edited. */
export function editLogText(ctx: Ctx, id: number, text: string): WarbandState {
  if (!(ctx.s.campaign?.log ?? []).some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => {
    const e = (campState(d).log as LogEntry[]).find((x) => x.id === Number(id)) as LogEntry;
    e.text = String(text || '');
    e.edited = true;
  });
}

/** Deletes an entry. The interface asks first. */
export function removeLogEntry(ctx: Ctx, id: number): WarbandState {
  const i = (ctx.s.campaign?.log ?? []).findIndex((x) => x.id === Number(id));
  if (i < 0) return ctx.s;
  return update(ctx, (d) => { (campState(d).log as LogEntry[]).splice(i, 1); });
}

/** Sets the current stage (0 = Setup, n = after the n-th battle). */
export function setRound(ctx: Ctx, n: unknown): WarbandState {
  const v = Math.max(0, Number(n) || 0);
  return update(ctx, (d) => {
    const c = campState(d);
    if (v !== c.round) c.round = v;
  });
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
    totals: {
      rating: totalRating(c), spent: totalSpent(c), models: totalModels(c),
      heroes: totalHeroes(c), gold: goldCurrent(c), fallen: (d.fallen ?? []).length,
    },
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

/* ---- battles ---- */

export interface BattleSide { key?: string; name?: string; wb?: string; outcome?: string; [key: string]: unknown }
export interface BattleInput {
  round?: number | null;
  sides?: BattleSide[];
  opponents?: { name?: string; wb?: string }[];
  district?: string;
  outcome?: string;
  notes?: string;
}

/** Records a battle (with every side's outcome) and its chronicle entry. */
export function addBattle(ctx: Ctx, b: BattleInput = {}): WarbandState {
  return update(ctx, (d, c) => {
    const camp = campState(d);
    const bat = {
      id: nextLogId(d), round: b.round == null ? (camp.round ?? 0) : Number(b.round) || 0,
      sides: Array.isArray(b.sides) ? copy(b.sides.filter((x) => x && (x.name || x.wb))) : [],
      opponents: Array.isArray(b.opponents) ? copy(b.opponents.filter((o) => o && (o.name || o.wb))) : [],
      district: b.district || '', outcome: b.outcome || '', notes: b.notes || '',
    };
    (camp.battles as { id: number }[]).push(bat);
    const who = bat.opponents.length ? bat.opponents.map((o) => o.name || wbName(c, o.wb)).join(', ') : 'an unnamed foe';
    logEventAt(d, bat.round, 'battle', `Battle ${bat.round}: fought ${who}${bat.district ? ` at ${districtName(c, bat.district)}` : ''}${bat.outcome ? ` — ${bat.outcome}` : ''}.`, { battleId: bat.id });
  });
}

/** Changes fields of a battle record (its chronicle entry stays as it was). */
export function editBattle(ctx: Ctx, id: number, patch: Partial<BattleInput> & Record<string, unknown>): WarbandState {
  if (!patch || !(ctx.s.campaign?.battles ?? []).some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => {
    const b = (campState(d).battles as { id: number }[]).find((x) => x.id === Number(id)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) b[k] = v === undefined ? undefined : copy(v);
  });
}

/** Deletes a battle and its chronicle entries. The interface asks first. */
export function removeBattle(ctx: Ctx, id: number): WarbandState {
  const i = (ctx.s.campaign?.battles ?? []).findIndex((x) => x.id === Number(id));
  if (i < 0) return ctx.s;
  return update(ctx, (d) => {
    const camp = campState(d);
    const bid = (camp.battles as { id: number }[])[i]!.id;
    (camp.battles as unknown[]).splice(i, 1);
    camp.log = (camp.log ?? []).filter((e) => !(e.data && e.data.battleId === bid));
  });
}

/* ---- footholds ---- */

function districtsOf(d: WarbandDraft): Record<string, string> {
  if (!d.campaign) d.campaign = { districts: {} };
  if (!d.campaign.districts) d.campaign.districts = {};
  return d.campaign.districts as Record<string, string>;
}

/** Winning a battle at a district gains a foothold there. */
export function claimFoothold(ctx: Ctx, districtId: string): WarbandState {
  if (!districtId) return ctx.s;
  const cur = ctx.s.campaign?.districts?.[districtId];
  if (cur === 'foothold' || cur === 'control') return ctx.s;
  return update(ctx, (d, c) => {
    districtsOf(d)[districtId] = 'foothold';
    logEvent(d, 'district', `Gained a foothold at ${districtName(c, districtId)}.`, { district: districtId });
  });
}

/** The defeated warband loses its foothold there. */
export function loseFoothold(ctx: Ctx, districtId: string): WarbandState {
  if (!districtId) return ctx.s;
  const cur = ctx.s.campaign?.districts?.[districtId];
  if (!cur || cur === 'none') return ctx.s;
  return update(ctx, (d, c) => {
    districtsOf(d)[districtId] = 'none';
    logEvent(d, 'district', `Lost the foothold at ${districtName(c, districtId)}.`, { district: districtId });
  });
}

/* ---- the post-battle sequence ---- */

function postbattleOn(d: WarbandDraft, c: Ctx, round?: number | null): PostBattleState {
  const camp = campState(d) as CampaignState & { postbattle?: Record<string, PostBattleState> };
  if (!camp.postbattle) camp.postbattle = {};
  const r = round == null ? pbRound(c) : round;
  if (!camp.postbattle[r]) camp.postbattle[r] = { done: {}, wyrd: null };
  const s = camp.postbattle[r] as PostBattleState;
  if (!s.done) s.done = {};
  return s;
}

/** Ticks a step off (only when every step before it is done) or back (only
    when nothing after it is done), so the order holds both ways. */
export function setPostBattleStep(ctx: Ctx, step: string, on: boolean, round?: number | null): WarbandState {
  const idx = PB_ORDER.indexOf(step);
  if (idx < 0) return ctx.s;
  const r = round == null ? pbRound(ctx) : round;
  const done = ((ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.done) ?? {};
  if (on) { for (let k = 0; k < idx; k++) if (!done[PB_ORDER[k] as string]) return ctx.s; }
  else { for (let k = idx + 1; k < PB_ORDER.length; k++) if (done[PB_ORDER[k] as string]) return ctx.s; }
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    if (on) st.done[step] = true;
    else delete st.done[step];
  });
}

/** Sells wyrdstone once per sequence: the gold goes to the treasury, the
    shards leave the stash, and the sale is recorded so it can be undone. */
export function sellWyrdstone(ctx: Ctx, round: number | null | undefined, shards: unknown): WarbandState {
  const r = round == null ? pbRound(ctx) : round;
  const sold = (ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.wyrd;
  if (sold && sold.done) return ctx.s;
  const have = Number((ctx.s.stash || {}).wyrd) || 0;
  const n = Math.max(1, Math.min(have, Number(shards) || 0));
  if (have < 1 || n < 1) return ctx.s;
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    const size = warbandSize(c);
    const gc = wyrdPrice(c, n, size);
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = goldTreasury(c) + gc;
    d.stash.wyrd = have - n;
    st.wyrd = { done: true, shards: n, gc, size };
    logEvent(d, 'income', `Sold ${n} wyrdstone shard${n === 1 ? '' : 's'} for ${gc} gc.`, { round });
  });
}

/** Takes a sale back: the gold leaves the treasury, the shards return. */
export function undoWyrdstoneSale(ctx: Ctx, round?: number | null): WarbandState {
  const r = round == null ? pbRound(ctx) : round;
  const w = (ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.wyrd;
  if (!w || !w.done) return ctx.s;
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = Math.max(0, goldTreasury(c) - (Number(w.gc) || 0));
    d.stash.wyrd = (Number(d.stash.wyrd) || 0) + (Number(w.shards) || 0);
    st.wyrd = null;
  });
}

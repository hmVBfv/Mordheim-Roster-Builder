/* What the campaign record says about each warrior and the warband as a
   whole (legacy app.js characterTimeline, characterRoster, campaignAnalysis). */
import type { Casualty, CampaignState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { casualtyText, wbName } from '../rules/casualties.ts';
import { unitDef } from '../rules/lookup.ts';
import { snapRows, stageSnapshots } from './stages.ts';

const camp = (ctx: Ctx): CampaignState => ctx.s.campaign ?? {};

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

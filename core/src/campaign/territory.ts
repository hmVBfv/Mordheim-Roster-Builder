/* Districts: what a warband holds, footholds gained and lost, and control
   across the campaign file (legacy app.js districtName, districtState,
   claimFoothold, loseFoothold, cfFootholdsAt … cfClearDistrict,
   applyBattleTerritory, districtStatus). */
import { produce } from 'immer';
import type { CampaignState, DistrictHold, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { wbName } from '../rules/casualties.ts';
import { logEvent } from '../warband/log.ts';
import { update, type WarbandDraft } from '../warband/update.ts';
import type { CampaignFile, CampaignFileWarband } from './file.ts';

const camp = (ctx: Ctx): CampaignState => ctx.s.campaign ?? {};

export function districtName(ctx: Ctx, id: string | null | undefined): string {
  const d = ctx.data.DISTRICTS.find((x) => x.id === id);
  return d ? d.name : (id || '');
}

/** What this warband holds at a district as stored ('none' if nothing). */
export function districtState(ctx: Ctx, id: string): DistrictHold {
  return camp(ctx).districts?.[id] || 'none';
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

/* ---- control across the campaign ----
   Control is not something a warband is given: it controls a location when
   it is the ONLY one in the campaign holding a foothold there. So it can only
   be answered with the campaign file open, knowing every warband's claims.
   A warband on its own keeps a 'control' set by hand as a manual override. */

export interface FootholdHolder { id: number | null; name: string; wb: string | null; mine?: true }

/** Everybody holding a foothold at a district: our warband (its live state,
    newer than its copy in the file) and every other warband in the file. */
export function cfFootholdsAt(ctx: Ctx, cf: CampaignFile | null, districtId: string): FootholdHolder[] {
  const out: FootholdHolder[] = [];
  const mineName = ctx.s.name || wbName(ctx, ctx.s.wb);
  const isMine = (w: CampaignFileWarband) => (w.name || '').toLowerCase() === mineName.toLowerCase() && w.wb === ctx.s.wb;
  const own = (camp(ctx).districts || {})[districtId];
  if (own === 'foothold' || own === 'control') out.push({ id: null, name: mineName, wb: ctx.s.wb, mine: true });
  if (cf) for (const w of cf.warbands) {
    if (isMine(w)) continue;
    const d = (((w.roster || {}) as WarbandState).campaign || {}).districts || {};
    if (d[districtId] === 'foothold' || d[districtId] === 'control') out.push({ id: w.id, name: w.name, wb: w.wb });
  }
  return out;
}

/** Who controls a district: exactly one holder and no other. */
export function cfControlAt(ctx: Ctx, cf: CampaignFile | null, districtId: string): FootholdHolder | null {
  const held = cfFootholdsAt(ctx, cf, districtId);
  return held.length === 1 ? held[0] as FootholdHolder : null;
}

/** Every contested or controlled district of the campaign, by name. */
export function cfTerritory(ctx: Ctx, cf: CampaignFile | null): { id: string; name: string; holders: FootholdHolder[]; control: FootholdHolder | null }[] {
  if (!cf) return [];
  const ids = new Set<string>();
  const own = camp(ctx).districts || {};
  Object.keys(own).forEach((k) => { const v = own[k]; if (v && v !== 'none') ids.add(k); });
  cf.warbands.forEach((w) => {
    const d = (((w.roster || {}) as WarbandState).campaign || {}).districts || {};
    Object.keys(d).forEach((k) => { if (d[k] && d[k] !== 'none') ids.add(k); });
  });
  return [...ids].map((id) => {
    const held = cfFootholdsAt(ctx, cf, id);
    return { id, name: districtName(ctx, id), holders: held, control: held.length === 1 ? held[0] as FootholdHolder : null };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** What our warband holds, with control worked out from the campaign file
    when one is open. */
export function districtStatus(ctx: Ctx, cf: CampaignFile | null, id: string): DistrictHold {
  const raw = (camp(ctx).districts || {})[id] || 'none';
  if (raw === 'none') return 'none';
  if (!cf) return raw;
  const ctl = cfControlAt(ctx, cf, id);
  return (ctl && ctl.mine) ? 'control' : 'foothold';
}

/** Sets another warband's foothold in the campaign file (the campaign
    master's copy of its roster). */
export function cfSetFoothold(cf: CampaignFile | null, cfId: unknown, districtId: string, val: DistrictHold): CampaignFile | null {
  if (!cf || !districtId) return cf;
  const i = cf.warbands.findIndex((x) => x.id === Number(cfId));
  if (i < 0 || !cf.warbands[i]!.roster) return cf;
  return produce(cf, (d) => {
    const r = d.warbands[i]!.roster;
    r.campaign = r.campaign || {};
    r.campaign.districts = r.campaign.districts || {};
    if (val === 'none') delete r.campaign.districts[districtId];
    else r.campaign.districts[districtId] = val;
  });
}

export interface WarbandAndFile { s: WarbandState; cf: CampaignFile | null }

/** One battle's outcomes applied to the map for every side at once: winners
    gain a foothold, the defeated (or routed) lose theirs. */
export function applyBattleTerritory(ctx: Ctx, cf: CampaignFile | null, sides: { key?: string; outcome?: string }[] | null | undefined, districtId: string): WarbandAndFile {
  let s = ctx.s, file = cf;
  if (!districtId || !Array.isArray(sides)) return { s, cf: file };
  for (const x of sides) {
    const won = /victor/i.test(x.outcome || ''), lost = /defeat|routed/i.test(x.outcome || '');
    if (!won && !lost) continue;
    if (x.key === 'me') s = won ? claimFoothold(ctxOf(ctx.data, s), districtId) : loseFoothold(ctxOf(ctx.data, s), districtId);
    else if (x.key && String(x.key).startsWith('cf')) file = cfSetFoothold(file, String(x.key).slice(2), districtId, won ? 'foothold' : 'none');
  }
  return { s, cf: file };
}

/** A hand correction to the map: give a foothold to, or take it from, any
    warband (cfId null = ours). */
export function cfToggleFoothold(ctx: Ctx, cf: CampaignFile | null, districtId: string, cfId: unknown, on: boolean): WarbandAndFile {
  if (cfId == null || cfId === 'null') return { s: on ? claimFoothold(ctx, districtId) : loseFoothold(ctx, districtId), cf };
  return { s: ctx.s, cf: cfSetFoothold(cf, cfId, districtId, on ? 'foothold' : 'none') };
}

/** Nobody holds this district any more. The interface asks first. */
export function cfClearDistrict(ctx: Ctx, cf: CampaignFile | null, districtId: string): WarbandAndFile {
  const s = loseFoothold(ctx, districtId);
  let file = cf;
  if (file) for (const w of file.warbands) file = cfSetFoothold(file, w.id, districtId, 'none');
  return { s, cf: file };
}

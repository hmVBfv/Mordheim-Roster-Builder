/* Districts: what a warband holds, footholds gained and lost (legacy app.js
   districtName, districtState, claimFoothold, loseFoothold). */
import type { CampaignState, DistrictHold, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { logEvent } from '../warband/log.ts';
import { update, type WarbandDraft } from '../warband/update.ts';

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

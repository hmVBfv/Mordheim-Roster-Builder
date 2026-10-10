/* The campaign server's campaigns (phase 4a1; server/src/routes-campaigns.ts).
   A campaign is read from the server; the last answer is kept on the device,
   so the overview still shows offline what it showed last. */
import { api } from '../account/api.ts';
import type { BattleSummary, FrozenChange, Outcome } from '../battle/api.ts';
import { db } from '../db/db.ts';
import { asker, ownerId, ownKey } from '../account/owner.ts';

export type CampaignRole = 'leader' | 'player' | 'viewer';
export interface Totals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface Tag {
  id: string; kind: 'start' | 'after_battle' | 'sat_out'; rev: number; round: number; battleId: string | null; totals: Totals; createdBy: string; createdAt: string;
  /** What changed, frozen with the mark (phase 4a4): in the warband's own read only. */
  changes?: FrozenChange[];
}
export interface CampaignSummary { id: string; name: string; round: number; role: CampaignRole; members: number; warbands: number; createdAt: string }
export interface Member { userId: string; displayName: string; username: string; role: CampaignRole; joinedAt: string; canLead?: boolean }
export interface Enrolment {
  id: string; warbandId: string; playerId: string; player: string; status: 'pending' | 'active'; fromRound: number | null;
  createdAt: string; confirmedAt: string | null; name: string; wbType: string; wbName: string; headRev: number; updatedAt: string; tag: Tag | null;
  /** Phase 4a4, from its newest version: the house rules (keys) in which it differs from the campaign's, the districts it holds. */
  houseDiffers?: string[];
  districts?: { id: string; name: string; hold: string }[];
}
export interface CampaignView {
  campaign: { id: string; name: string; round: number; houseRules: unknown; createdAt: string; updatedAt: string };
  role: CampaignRole;
  members: Member[];
  enrolments: Enrolment[];
  /** Phase 4a2; absent in a view kept from before it. */
  battles?: BattleSummary[];
}
export interface CampaignWarband {
  warband: { id: string; name: string; wbType: string; headRev: number; campaignId: string | null };
  player: { id: string; displayName: string };
  status: 'pending' | 'active';
  head: { rev: number; data: unknown; createdAt: string };
  draft: { data: unknown; updatedAt: string } | null;
  tags: Tag[];
}

const listKey = (userId: string) => `campaigns:${userId}:list`;
/** Where this account keeps a campaign's overview on the device (account/owner.ts). */
export const campaignKey = (id: string) => ownKey('campaign:', id);
const viewKey = campaignKey;

/** The stage a campaign is in, as the Roster Builder names it (core roundLabel): the founding, then after each round's battles. */
export const roundName = (round: number) => (round > 0 ? `After battle ${round}` : 'Setup');
export const ROLE_NAMES: Record<CampaignRole, string> = { leader: 'Leader', player: 'Player', viewer: 'Viewer' };

export async function listCampaigns(userId: string): Promise<CampaignSummary[]> {
  const r = await api<{ campaigns: CampaignSummary[] }>('/campaigns', { as: userId });
  // kept only while that account is still the one here
  if (ownerId() === userId) await db.meta.put({ key: listKey(userId), value: r.campaigns });
  return r.campaigns;
}
export async function cachedCampaigns(userId: string): Promise<CampaignSummary[] | null> {
  return ((await db.meta.get(listKey(userId)))?.value as CampaignSummary[] | undefined) ?? null;
}

/** Keeps a campaign's view for the account that asked – take it before the request (account/owner.ts, asker). */
const keep = (a = asker()) => async (v: CampaignView): Promise<CampaignView> => {
  await a.keep('campaign:', v.campaign.id, v);
  return v;
};
export const getCampaign = (id: string) => api<CampaignView>(`/campaigns/${id}`).then(keep());
export async function cachedCampaign(id: string): Promise<CampaignView | null> {
  return ((await db.meta.get(viewKey(id)))?.value as CampaignView | undefined) ?? null;
}
/** Forgets a campaign the user is no longer part of. */
export const forgetCampaign = (id: string) => db.meta.delete(viewKey(id));

export const startCampaign = (name: string) => api<CampaignView>('/campaigns', { body: { name } }).then(keep());
export const renameCampaign = (id: string, name: string) => api<CampaignView>(`/campaigns/${id}`, { method: 'PATCH', body: { name } }).then(keep());
export const setMember = (id: string, userId: string, role: CampaignRole) => api<CampaignView>(`/campaigns/${id}/members/${userId}`, { method: 'PUT', body: { role } }).then(keep());
export const removeMember = (id: string, userId: string) => api<CampaignView | { left: true }>(`/campaigns/${id}/members/${userId}`, { method: 'DELETE' });
export const confirmEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}/confirm`, { body: {} }).then(keep());
export const declineEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}/decline`, { body: {} }).then(keep());
export const withdrawEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}`, { method: 'DELETE' }).then(keep());
/** The campaign's house rules (a leader): for every warband in it. */
export const setHouseRules = (id: string, rules: Record<string, unknown>) => api<CampaignView>(`/campaigns/${id}/house-rules`, { method: 'PUT', body: { rules } }).then(keep());
/** Moves the campaign on (a leader), once the battles of the next round are closed; who fought none sat it out. */
export const advanceRound = (id: string) => api<CampaignView>(`/campaigns/${id}/rounds/advance`, { body: {} }).then(keep());
export const readWarband = (id: string, wid: string) => api<CampaignWarband>(`/campaigns/${id}/warbands/${wid}`);

/** A battle of the campaign's history (phase 4a5): played before the app, recorded afterwards by a leader. `outcomes`: who fought, and how it ended for them ('' not known). */
export interface PastBattle { round: number; title: string; district: string; playedOn: string | null; outcomes: Record<string, Outcome> }
/** Records a battle of the history, or corrects it (the same id) – while the campaign has no battle of its own. */
export const putPastBattle = (id: string, bid: string, b: PastBattle) => api<CampaignView>(`/campaigns/${id}/history/${bid}`, { method: 'PUT', body: b }).then(keep());
export const removePastBattle = (id: string, bid: string) => api<CampaignView>(`/campaigns/${id}/history/${bid}`, { method: 'DELETE' }).then(keep());

/** "12 June 2026" from "2026-06-12" (the day a battle of the history was played). */
export function dayName(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, day ?? 1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** The campaign's history: its battles before the app, the round it ends with, the warbands that fought in it; open while no battle of the app is there. */
export function historyOf(view: Pick<CampaignView, 'battles'>): { battles: BattleSummary[]; round: number; warbandIds: string[]; open: boolean } {
  const battles = (view.battles ?? []).filter((b) => b.takenOver);
  return {
    battles,
    round: battles.reduce((m, b) => Math.max(m, b.round), 0),
    warbandIds: [...new Set(battles.flatMap((b) => b.warbandIds ?? []))],
    open: !(view.battles ?? []).some((b) => !b.takenOver),
  };
}

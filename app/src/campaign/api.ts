/* The campaign server's campaigns (phase 4a1; server/src/routes-campaigns.ts).
   A campaign is read from the server; the last answer is kept on the device,
   so the overview still shows offline what it showed last. */
import { api } from '../account/api.ts';
import { db } from '../db/db.ts';

export type CampaignRole = 'leader' | 'player' | 'viewer';
export interface Totals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface Tag { id: string; kind: 'start' | 'after_battle' | 'sat_out'; rev: number; round: number; battleId: string | null; totals: Totals; createdBy: string; createdAt: string }
export interface CampaignSummary { id: string; name: string; round: number; role: CampaignRole; members: number; warbands: number; createdAt: string }
export interface Member { userId: string; displayName: string; username: string; role: CampaignRole; joinedAt: string; canLead?: boolean }
export interface Enrolment {
  id: string; warbandId: string; playerId: string; player: string; status: 'pending' | 'active'; fromRound: number | null;
  createdAt: string; confirmedAt: string | null; name: string; wbType: string; wbName: string; headRev: number; updatedAt: string; tag: Tag | null;
}
export interface CampaignView {
  campaign: { id: string; name: string; round: number; houseRules: unknown; createdAt: string; updatedAt: string };
  role: CampaignRole;
  members: Member[];
  enrolments: Enrolment[];
}
export interface CampaignWarband {
  warband: { id: string; name: string; wbType: string; headRev: number; campaignId: string | null };
  player: { id: string; displayName: string };
  status: 'pending' | 'active';
  head: { rev: number; data: unknown; createdAt: string };
  draft: { data: unknown; updatedAt: string } | null;
  tags: Tag[];
}

const listKey = (userId: string) => `campaigns:${userId}`;
const viewKey = (id: string) => `campaign:${id}`;

/** Round 0 is the founding of the warbands. */
export const roundName = (round: number) => (round > 0 ? `Round ${round}` : 'Setup');
export const ROLE_NAMES: Record<CampaignRole, string> = { leader: 'Leader', player: 'Player', viewer: 'Viewer' };

export async function listCampaigns(userId: string): Promise<CampaignSummary[]> {
  const r = await api<{ campaigns: CampaignSummary[] }>('/campaigns');
  await db.meta.put({ key: listKey(userId), value: r.campaigns });
  return r.campaigns;
}
export async function cachedCampaigns(userId: string): Promise<CampaignSummary[] | null> {
  return ((await db.meta.get(listKey(userId)))?.value as CampaignSummary[] | undefined) ?? null;
}

async function keep(v: CampaignView): Promise<CampaignView> {
  await db.meta.put({ key: viewKey(v.campaign.id), value: v });
  return v;
}
export const getCampaign = (id: string) => api<CampaignView>(`/campaigns/${id}`).then(keep);
export async function cachedCampaign(id: string): Promise<CampaignView | null> {
  return ((await db.meta.get(viewKey(id)))?.value as CampaignView | undefined) ?? null;
}
/** Forgets a campaign the user is no longer part of. */
export const forgetCampaign = (id: string) => db.meta.delete(viewKey(id));

export const startCampaign = (name: string) => api<CampaignView>('/campaigns', { body: { name } }).then(keep);
export const renameCampaign = (id: string, name: string) => api<CampaignView>(`/campaigns/${id}`, { method: 'PATCH', body: { name } }).then(keep);
export const setMember = (id: string, userId: string, role: CampaignRole) => api<CampaignView>(`/campaigns/${id}/members/${userId}`, { method: 'PUT', body: { role } }).then(keep);
export const removeMember = (id: string, userId: string) => api<CampaignView | { left: true }>(`/campaigns/${id}/members/${userId}`, { method: 'DELETE' });
export const confirmEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}/confirm`, { body: {} }).then(keep);
export const declineEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}/decline`, { body: {} }).then(keep);
export const withdrawEnrolment = (id: string, eid: string) => api<CampaignView>(`/campaigns/${id}/enrolments/${eid}`, { method: 'DELETE' }).then(keep);
export const readWarband = (id: string, wid: string) => api<CampaignWarband>(`/campaigns/${id}/warbands/${wid}`);

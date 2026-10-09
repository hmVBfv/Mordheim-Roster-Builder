/* Entering a warband in a campaign (phase 4a1): always a copy (concept.md
   4.1) – the player's warband stays as it is, free; the copy is a new
   warband of theirs, entered in the campaign, waiting for a leader unless
   they lead it. The copy is kept on this device at once (the sync would
   bring it a moment later). The copy plays by the campaign's house rules
   (phase 4a4): it takes them over as the House rules screen would. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave } from '../sync/engine.ts';
import { currentUserId } from '../sync/local.ts';
import { adoptHouse } from '../roster/house.ts';
import { applyEdit } from '../roster/useEditor.ts';
import { campaignKey, getCampaign, type CampaignView } from './api.ts';

/** A warband made on this device goes to the account first, so the campaign's copy can name it as its source. */
async function onServer(data: GameData, rec: StoredWarband): Promise<StoredWarband> {
  if (rec.serverRev !== undefined || !rec.ownerId) return rec;
  const sent = rec.updatedAt;
  try {
    await api('/warbands', { body: { id: rec.id, data: core.writeSave(core.ctxOf(data, rec.state), __APP_VERSION__), source: rec.origin === 'copy' ? 'save' : (rec.origin ?? 'save'), appVersion: __APP_VERSION__ } });
  } catch (e) {
    // the sync sent it a moment ago: the same warband, already there
    if (!(e instanceof ApiError && e.code === 'exists')) throw e;
    const there = await api<{ warband: { headRev: number } }>(`/warbands/${rec.id}`).catch(() => null);
    if (!there) return rec;
    await db.warbands.update(rec.id, { serverRev: there.warband.headRev });
    return { ...rec, serverRev: there.warband.headRev };
  }
  await db.warbands.update(rec.id, { serverRev: 1, syncedAt: sent, draftSeq: null });
  return { ...rec, serverRev: 1 };
}

interface Entered { enrolmentId: string; warband: { id: string; createdAt: string; campaignId: string | null }; head: { rev: number; data: unknown }; campaign: CampaignView }

/** The warband as it enters: under the campaign's house rules. */
async function underCampaignRules(data: GameData, campaignId: string, s: core.WarbandState): Promise<core.WarbandState> {
  const view = ((await db.meta.get(campaignKey(campaignId)))?.value as CampaignView | undefined) ?? await getCampaign(campaignId);
  const rules = view.campaign.houseRules;
  if (!core.houseDifferences(rules, s.house).length) return s;
  return applyEdit(data, s, (c) => adoptHouse(c, rules), 'House rules of the campaign', { gold: 'keep' });
}

export async function enterWarband(data: GameData, campaignId: string, from: StoredWarband): Promise<{ id: string; campaign: CampaignView }> {
  const rec = await onServer(data, from);
  const entering = await underCampaignRules(data, campaignId, rec.state);
  const r = await api<Entered>(`/campaigns/${campaignId}/enrolments`, {
    body: {
      warbandId: newId(), data: core.writeSave(core.ctxOf(data, entering), __APP_VERSION__), appVersion: __APP_VERSION__,
      ...(rec.serverRev !== undefined ? { copiedFrom: { id: rec.id, rev: rec.serverRev } } : {}),
    },
  });
  const state = readSave(data, r.head.data) ?? structuredClone(entering);
  const stamp = new Date().toISOString();
  await db.warbands.put({
    id: r.warband.id, name: rec.name, wb: rec.wb, wbName: rec.wbName, state, format: core.FORMAT,
    createdAt: r.warband.createdAt, updatedAt: stamp, syncedAt: stamp, ownerId: currentUserId(), serverRev: r.head.rev, draftSeq: null,
    origin: 'copy', ...(rec.serverRev !== undefined ? { copiedFrom: { id: rec.id, rev: rec.serverRev } } : {}), campaignId: r.warband.campaignId,
  });
  await db.meta.put({ key: campaignKey(campaignId), value: r.campaign });
  return { id: r.warband.id, campaign: r.campaign };
}

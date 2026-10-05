/* Entering a warband in a campaign (phase 4a1): always a copy (concept.md
   4.1) – the player's warband stays as it is, free; the copy is a new
   warband of theirs, entered in the campaign, waiting for a leader unless
   they lead it. The copy is kept on this device at once (the sync would
   bring it a moment later). */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { api } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave } from '../sync/engine.ts';
import { currentUserId } from '../sync/local.ts';
import type { CampaignView } from './api.ts';

interface Entered { enrolmentId: string; warband: { id: string; createdAt: string; campaignId: string | null }; head: { rev: number; data: unknown }; campaign: CampaignView }

export async function enterWarband(data: GameData, campaignId: string, rec: StoredWarband): Promise<{ id: string; campaign: CampaignView }> {
  const r = await api<Entered>(`/campaigns/${campaignId}/enrolments`, {
    body: {
      warbandId: newId(), data: core.writeSave(core.ctxOf(data, rec.state), __APP_VERSION__), appVersion: __APP_VERSION__,
      ...(rec.serverRev !== undefined ? { copiedFrom: { id: rec.id, rev: rec.serverRev } } : {}),
    },
  });
  const state = readSave(data, r.head.data) ?? structuredClone(rec.state);
  const stamp = new Date().toISOString();
  await db.warbands.put({
    id: r.warband.id, name: rec.name, wb: rec.wb, wbName: rec.wbName, state, format: core.FORMAT,
    createdAt: r.warband.createdAt, updatedAt: stamp, syncedAt: stamp, ownerId: currentUserId(), serverRev: r.head.rev, draftSeq: null,
    origin: 'copy', ...(rec.serverRev !== undefined ? { copiedFrom: { id: rec.id, rev: rec.serverRev } } : {}), campaignId: r.warband.campaignId,
  });
  await db.meta.put({ key: `campaign:${campaignId}`, value: r.campaign });
  return { id: r.warband.id, campaign: r.campaign };
}

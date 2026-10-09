/* A campaign's house rules as this device knows them (phase 4a4), and its
   history (4a5): from its overview as last seen here, asked anew once when
   a screen needs them. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db/db.ts';
import { getCampaign, historyOf, setHouseRules, type CampaignView } from './api.ts';

export interface CampaignRules {
  id: string; name: string; rules: Record<string, unknown>; lead: boolean;
  /** Phase 4a5: the campaign's history – the round it ends with, the warbands that fought in it. */
  history: { round: number; warbandIds: string[] };
}

/** undefined while it is looked up; null when this device does not know the campaign. */
export function useCampaignRules(id: string | null | undefined): CampaignRules | null | undefined {
  useEffect(() => { if (id) getCampaign(id).catch(() => undefined); }, [id]);
  return useLiveQuery(async () => {
    if (!id) return null;
    const v = (await db.meta.get(`campaign:${id}`))?.value as CampaignView | undefined;
    if (!v) return null;
    const h = historyOf(v);
    return { id, name: v.campaign.name, rules: (v.campaign.houseRules ?? {}) as Record<string, unknown>, lead: v.role === 'leader', history: { round: h.round, warbandIds: h.warbandIds } };
  }, [id]);
}

export { setHouseRules };

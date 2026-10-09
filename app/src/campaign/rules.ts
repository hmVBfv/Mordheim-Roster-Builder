/* A campaign's house rules as this device knows them (phase 4a4): from its
   overview as last seen here, asked anew once when a screen needs them. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db/db.ts';
import { getCampaign, setHouseRules, type CampaignView } from './api.ts';

export interface CampaignRules { id: string; name: string; rules: Record<string, unknown>; lead: boolean }

/** undefined while it is looked up; null when this device does not know the campaign. */
export function useCampaignRules(id: string | null | undefined): CampaignRules | null | undefined {
  useEffect(() => { if (id) getCampaign(id).catch(() => undefined); }, [id]);
  return useLiveQuery(async () => {
    if (!id) return null;
    const v = (await db.meta.get(`campaign:${id}`))?.value as CampaignView | undefined;
    return v ? { id, name: v.campaign.name, rules: (v.campaign.houseRules ?? {}) as Record<string, unknown>, lead: v.role === 'leader' } : null;
  }, [id]);
}

export { setHouseRules };

/* A campaign's name as this device last saw it (its overview, or the list
   of campaigns) – for places that only name it: a warband's list entry,
   its roster, the form of a new warband for it. Small on purpose: the
   warband lists load it with the app shell. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.ts';
import { ownerId, ownKey } from '../account/owner.ts';

export function useCampaignName(id: string | null | undefined): string | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    const v = (await db.meta.get(ownKey('campaign:', id)))?.value as { campaign?: { name?: string } } | undefined;
    if (v?.campaign?.name) return v.campaign.name;
    // the list of this account's campaigns, not another account's on the same device
    const list = (await db.meta.get(`campaigns:${ownerId()}:list`))?.value as { id: string; name: string }[] | undefined;
    return list?.find((x) => x.id === id)?.name ?? null;
  }, [id]) ?? null;
}

/* A campaign's name as this device last saw it (its overview, or the list
   of campaigns) – for places that only name it: a warband's list entry,
   its roster, the form of a new warband for it. Small on purpose: the
   warband lists load it with the app shell. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.ts';

export function useCampaignName(id: string | null | undefined): string | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    const v = (await db.meta.get(`campaign:${id}`))?.value as { campaign?: { name?: string } } | undefined;
    if (v?.campaign?.name) return v.campaign.name;
    for (const row of await db.meta.where('key').startsWith('campaigns:').toArray()) {
      const c = (row.value as { id: string; name: string }[]).find((x) => x.id === id);
      if (c) return c.name;
    }
    return null;
  }, [id]) ?? null;
}

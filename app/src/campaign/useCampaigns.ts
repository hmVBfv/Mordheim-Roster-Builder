/* The campaigns the signed-in player is part of, as the Campaign tab has
   them: what the device remembered first, then the server's list, and again
   whenever anything in any campaign changes. `null` until one of the two has
   answered – "none yet" must not flash up before the list has come. */
import { useEffect, useState } from 'react';
import { useOnAnyCampaign } from '../live/live.ts';
import { cachedCampaigns, listCampaigns, type CampaignSummary } from './api.ts';

export function useCampaigns(userId: string | undefined): CampaignSummary[] | null {
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const [tick, setTick] = useState(0);
  useOnAnyCampaign(() => setTick((t) => t + 1));
  useEffect(() => {
    if (!userId) return;
    let live = true;
    // the server's list wins over a remembered one that arrives after it
    void cachedCampaigns(userId).then((c) => { if (live && c) setList((l) => l ?? c); });
    listCampaigns(userId).then((c) => { if (live) setList(c); }).catch(() => undefined);
    return () => { live = false; };
  }, [userId, tick]);
  return userId ? list : null;
}

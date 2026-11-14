/* The numbers of every mark of a campaign's warbands, read when the page opens and again when somebody in the campaign changes something. */
import { useEffect, useState } from 'react';
import { readStatistics, type WarbandStatistics } from '../campaign/api.ts';
import { useOnCampaign } from '../live/live.ts';

export function useStatistics(campaignId: string | null | undefined): { list: WarbandStatistics[]; loaded: boolean } {
  // what was read says whose it is: another campaign's numbers are never shown for this one
  const [got, setGot] = useState<{ id: string; list: WarbandStatistics[] } | null>(null);
  const load = () => { if (campaignId) readStatistics(campaignId).then((r) => setGot({ id: campaignId, list: r.statistics })).catch(() => undefined); };
  useEffect(load, [campaignId]);
  useOnCampaign(campaignId ?? '', load);
  const ok = got && got.id === campaignId;
  return { list: ok ? got.list : [], loaded: !!ok };
}

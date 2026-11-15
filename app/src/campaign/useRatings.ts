/* The ratings of a campaign's warbands over their marks, read when the page opens and again when somebody in the campaign changes something. */
import { useEffect, useState } from 'react';
import { useOnCampaign } from '../live/live.ts';
import { readRatings, type WarbandRatings } from './api.ts';

export function useRatings(campaignId: string | null | undefined): WarbandRatings[] {
  // what was read says whose it is: another campaign's lines are never shown for this one
  const [got, setGot] = useState<{ id: string; list: WarbandRatings[] } | null>(null);
  const load = () => { if (campaignId) readRatings(campaignId).then((r) => setGot({ id: campaignId, list: r.ratings })).catch(() => undefined); };
  useEffect(load, [campaignId]);
  useOnCampaign(campaignId ?? '', load);
  return got && got.id === campaignId ? got.list : [];
}

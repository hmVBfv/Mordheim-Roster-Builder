/* Experience per warrior and the dead by unit at every mark, read when the page opens and again when somebody in the campaign changes something. */
import { useEffect, useState } from 'react';
import { readWarriorStats, type WarbandWarriors } from '../campaign/api.ts';
import { useOnCampaign } from '../live/live.ts';

export function useWarriors(campaignId: string | null | undefined): { list: WarbandWarriors[]; loaded: boolean } {
  const [got, setGot] = useState<{ id: string; list: WarbandWarriors[] } | null>(null);
  const load = () => { if (campaignId) readWarriorStats(campaignId).then((r) => setGot({ id: campaignId, list: r.warbands })).catch(() => undefined); };
  useEffect(load, [campaignId]);
  useOnCampaign(campaignId ?? '', load);
  const ok = got && got.id === campaignId;
  return { list: ok ? got.list : [], loaded: !!ok };
}

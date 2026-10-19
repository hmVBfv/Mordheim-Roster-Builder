/* The entries under Warbands and Campaign in the side navigation (Rob,
   19.10.2026: "aufklappbare Unterreiter"): one's newest warbands and a new
   one; one's campaigns in play, and under the campaign one is in, its
   sections (campaign/tabs.ts). From tablet width on only – a phone keeps its
   five entries at the bottom and the campaign its tabs on top. */
import { useEffect, useState } from 'react';
import { useMatch } from 'react-router';
import { useSession } from '../account/session.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { cachedCampaign, cachedCampaigns, listCampaigns, type CampaignSummary } from '../campaign/api.ts';
import { campaignTabs } from '../campaign/tabs.ts';
import { FLAVOUR } from '../flavour.ts';
import { useOnAnyCampaign } from '../live/live.ts';
import { useWarbands } from '../sync/local.ts';

export interface NavChild { to: string; label: string; end?: boolean; children?: NavChild[] }

/** How many warbands stand under Warbands; the rest are a click on Warbands away. */
export const WARBANDS_IN_NAV = 6;

const SIDE_NAV = '(min-width: 900px)';
const sideQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(SIDE_NAV) : null);

/** Whether the screen is wide enough for the side navigation (the same width as Shell.module.css). */
export function useSideNav(): boolean {
  const [wide, setWide] = useState(() => !!sideQuery()?.matches);
  useEffect(() => {
    const q = sideQuery();
    if (!q) return;
    const follow = () => setWide(q.matches);
    q.addEventListener('change', follow);
    return () => q.removeEventListener('change', follow);
  }, []);
  return wide;
}

/** Campaigns one plays (archived ones left out), as the list on the Campaign tab has them. */
function useCampaignsInPlay(enabled: boolean): CampaignSummary[] {
  const session = useSession();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const userId = enabled && FLAVOUR === 'campaign' ? user?.id : undefined;
  const [list, setList] = useState<CampaignSummary[]>([]);
  const [tick, setTick] = useState(0);
  useOnAnyCampaign(() => setTick((t) => t + 1));
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void cachedCampaigns(userId).then((c) => { if (live && c) setList((l) => (l.length ? l : c)); });
    listCampaigns(userId).then((c) => { if (live) setList(c); }).catch(() => undefined);
    return () => { live = false; };
  }, [userId, tick]);
  return userId ? list.filter((c) => !(c as CampaignSummary & { archived?: boolean }).archived) : [];
}

export function useNavChildren(enabled: boolean): { warbands: NavChild[]; campaign: NavChild[] } {
  const session = useSession();
  const totp = session.status === 'in' && session.user.totp;
  const warbands = useWarbands(WARBANDS_IN_NAV) ?? [];
  const campaigns = useCampaignsInPlay(enabled);
  const here = useMatch('/campaign/:id/*')?.params.id;
  // the campaign open on the screen, as the device keeps it: its name and one's role in it, even when
  // it is archived or the list has not come yet (its sections must be reachable from the side)
  const open = useLiveQuery(() => (enabled && here ? cachedCampaign(here) : Promise.resolve(null)), [enabled, here]);
  if (!enabled) return { warbands: [], campaign: [] };
  const entries = campaigns.map((c) => ({ id: c.id, name: c.name, role: c.role }));
  if (here && open && !entries.some((c) => c.id === here)) entries.push({ id: here, name: open.campaign.name, role: open.role });
  return {
    warbands: [
      ...warbands.map((w) => ({ to: `/warbands/${w.id}`, label: w.name || w.wbName })),
      { to: '/warbands/new', label: '+ New warband' },
    ],
    campaign: entries.map((c) => ({
      to: `/campaign/${c.id}`, label: c.name,
      ...(c.id === here ? { children: campaignTabs(c.id, open?.role ?? c.role, !!totp) } : {}),
    })),
  };
}

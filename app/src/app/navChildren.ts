/* The entries under Warbands and Campaign in the side navigation (Rob,
   19.10.2026: "aufklappbare Unterreiter"): one's newest warbands and a new
   one; one's campaigns in play, and under the campaign one is in, its
   sections (campaign/tabs.ts). From tablet width on only – a phone keeps its
   five entries at the bottom and the campaign its tabs on top. */
import { useEffect, useState } from 'react';
import { useMatch } from 'react-router';
import { ACCOUNT_TABS } from '../account/accountTabs.ts';
import { TABS } from '../account/adminTabs.ts';
import { LIBRARY_TABS } from '../library/tabs.ts';
import { useSession } from '../account/session.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { cachedCampaign, type CampaignSummary } from '../campaign/api.ts';
import { campaignTabs } from '../campaign/tabs.ts';
import { useCampaigns } from '../campaign/useCampaigns.ts';
import { FLAVOUR } from '../flavour.ts';
import { useWarbandGroups } from '../routes/useWarbandGroups.ts';
import { useWarbands } from '../sync/local.ts';

export interface NavChild { to: string; label: string; end?: boolean; children?: NavChild[]; /** A place to jump to inside a page, not a page of its own: never marked as the one one is on. */ jump?: boolean }

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
  const all = useCampaigns(enabled && FLAVOUR === 'campaign' ? user?.id : undefined);
  return (all ?? []).filter((c) => !c.archived);
}

export function useNavChildren(enabled: boolean): { warbands: NavChild[]; campaign: NavChild[]; admin: NavChild[]; library: NavChild[]; account: NavChild[] } {
  const session = useSession();
  const totp = session.status === 'in' && session.user.totp;
  const all = useWarbands();
  const warbands = (all ?? []).slice(0, WARBANDS_IN_NAV);
  // the groups of one's own warbands (a signed-in person's), as the device kept them
  const groups = useWarbandGroups(enabled && FLAVOUR === 'campaign' && session.status === 'in').groups;
  const campaigns = useCampaignsInPlay(enabled);
  const here = useMatch('/campaign/:id/*')?.params.id;
  // the campaign open on the screen, as the device keeps it: its name and one's role in it, even when
  // it is archived or the list has not come yet (its sections must be reachable from the side)
  const open = useLiveQuery(() => (enabled && here ? cachedCampaign(here) : Promise.resolve(null)), [enabled, here]);
  if (!enabled) return { warbands: [], campaign: [], admin: [], library: [], account: [] };
  const entries = campaigns.map((c) => ({ id: c.id, name: c.name, role: c.role }));
  if (here && open && !entries.some((c) => c.id === here)) entries.push({ id: here, name: open.campaign.name, role: open.role });
  return {
    warbands: [
      ...warbands.map((w) => ({ to: `/warbands/${w.id}`, label: w.name || w.wbName })),
      { to: '/warbands/new', label: '+ New warband' },
      // the kinds apart and the groups, as places in the list to jump to (#91; only where there are any)
      ...((all ?? []).some((w) => w.state.planner) ? [{ to: '/warbands?show=planners', label: 'Planners', jump: true }] : []),
      ...((all ?? []).some((w) => !w.state.planner && w.campaignId) ? [{ to: '/warbands?show=campaigns', label: 'In campaigns', jump: true }] : []),
      ...groups.map((g) => ({ to: `/warbands?show=group-${g.id}`, label: g.name, jump: true })),
    ],
    admin: TABS.map((t) => ({ to: `/admin/${t.key}`, label: t.label })),
    library: FLAVOUR === 'campaign' && session.status === 'in' ? LIBRARY_TABS.map((t) => ({ to: `/library/${t.key}`, label: t.label })) : [],
    // the player's own reports are for the signed-in; the settings alone are no group
    account: FLAVOUR === 'campaign' && session.status === 'in' ? ACCOUNT_TABS.map((t) => ({ to: t.to, label: t.label, end: t.end })) : [],
    campaign: entries.map((c) => ({
      to: `/campaign/${c.id}`, label: c.name,
      ...(c.id === here ? { children: campaignTabs(c.id, open?.role ?? c.role, !!totp) } : {}),
    })),
  };
}

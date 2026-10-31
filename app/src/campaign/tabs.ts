/* The sections of a campaign, in one place: the tabs on top of the campaign
   on a phone, and the campaign's entries in the side navigation from tablet
   width on (docs/ui.md §2). Who sees which follows the rules of the screens
   themselves: Questions not for viewers, Background and Manage for leaders
   (with or without the authenticator, ADR 0030). */
import type { CampaignRole } from './api.ts';

export interface CampaignTab { to: string; label: string; end?: boolean }

export function campaignTabs(id: string, role: CampaignRole): CampaignTab[] {
  const at = (t: string) => `/campaign/${id}${t}`;
  const lead = role === 'leader';
  return [
    { to: at(''), label: 'Overview', end: true },
    { to: at('/warbands'), label: 'Warbands' },
    { to: at('/notes'), label: 'Notes' },
    { to: at('/timeline'), label: 'Timeline' },
    { to: at('/chronicle'), label: 'Chronicle' },
    { to: at('/world'), label: 'World' },
    ...(role !== 'viewer' ? [{ to: at('/questions'), label: 'Questions' }] : []),
    ...(lead ? [{ to: at('/background'), label: 'Background ⚑' }] : []),
    ...(lead ? [{ to: at('/manage'), label: 'Manage' }] : []),
  ];
}

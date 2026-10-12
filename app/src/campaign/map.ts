/* Who holds which district (phase 4a4), worked out from the campaign's overview. Kept apart from the screen, so the AI pack reads it too. */
import type { CampaignView } from './api.ts';

/** Who holds which district (phase 4a4): a sole foothold is control, as the Roster Builder's campaign file worked it out. */
export function campaignMap(view: CampaignView): { id: string; name: string; holders: string[] }[] {
  const by = new Map<string, { id: string; name: string; holders: string[] }>();
  for (const e of view.enrolments.filter((x) => x.status === 'active')) {
    for (const d of e.districts ?? []) {
      const cur = by.get(d.id) ?? { id: d.id, name: d.name, holders: [] };
      cur.holders.push(e.name || e.wbName);
      by.set(d.id, cur);
    }
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

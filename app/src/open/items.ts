/* What waits for a player in a campaign (phase 4b3a; concept.md 4.6 "Aufgaben"):
   a question asked of them, a closed battle to mark in the aftermath, an
   interlude to write. Pure: the screens hand in what they have (the
   campaign's view, the questions, the player's own warbands on this device)
   and get the lines for "Open for you". No explanation list here – a change
   that lacks its words says so in the aftermath itself and blocks nothing. */
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import type { StoredWarband } from '../db/db.ts';
import { openFor, type Question } from '../questions/api.ts';

export interface OpenItem {
  key: string;
  campaignId: string;
  campaign: string;
  to: string;
  title: string;
  detail: string;
  chip: string;
}

/** The closed battles one of the user's warbands fought and has not marked yet – not those of the history, played before the app (4a5). */
export function openAftermaths(view: CampaignView, me: string): { battleId: string; warbandId: string; label: string }[] {
  const mine = view.enrolments.filter((e) => e.playerId === me && e.status === 'active');
  return (view.battles ?? []).filter((b) => b.status === 'closed' && !b.takenOver).flatMap((b) => mine
    .filter((e) => (b.warbandIds ?? []).includes(e.warbandId) && !(b.marked ?? []).includes(e.warbandId))
    .map((e) => ({ battleId: b.id, warbandId: e.warbandId, label: `${battleTitle(b)} · ${e.name || e.wbName}` })));
}

/** The battles being fought that one of the user's warbands is in, with no version confirmed for it yet (not those of the history). */
export function openConfirmations(view: CampaignView, me: string): { battleId: string; warbandId: string; label: string }[] {
  const mine = view.enrolments.filter((e) => e.playerId === me && e.status === 'active');
  return (view.battles ?? []).filter((b) => b.status === 'open' && !b.takenOver).flatMap((b) => mine
    .filter((e) => (b.warbandIds ?? []).includes(e.warbandId) && !(b.confirmed ?? []).includes(e.warbandId))
    .map((e) => ({ battleId: b.id, warbandId: e.warbandId, label: `${battleTitle(b)} · ${e.name || e.wbName}` })));
}

const gist = (text: string, max = 90) => {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** The interlude after the campaign's latest round, when the warband has played it and nothing is written yet. */
function interludes(view: CampaignView, me: string, local: readonly Pick<StoredWarband, 'id' | 'name' | 'state'>[]): OpenItem[] {
  const round = view.campaign.round;
  if (round < 1) return [];
  const mine = view.enrolments.filter((e) => e.playerId === me && e.status === 'active');
  return mine.flatMap((e) => {
    const rec = local.find((w) => w.id === e.warbandId);
    if (!rec) return [];
    const st = rec.state as { campaign?: { round?: unknown }; story?: { interludes?: Record<string, unknown> } };
    const played = Number(st.campaign?.round) || 0;
    const text = st.story?.interludes?.[String(round)];
    if (played < round || (typeof text === 'string' && text.trim())) return [];
    return [{
      key: `interlude:${e.warbandId}:${round}`, campaignId: view.campaign.id, campaign: view.campaign.name, to: `/warbands/${e.warbandId}/story`,
      title: `Interlude ${round}`, detail: e.name || e.wbName || rec.name, chip: 'to write',
    }];
  });
}

/** Every line "Open for you" has for this campaign, in the order they are likely to matter. */
export function openItems(view: CampaignView, me: string, questions: readonly Question[], local: readonly Pick<StoredWarband, 'id' | 'name' | 'state'>[]): OpenItem[] {
  if (view.role === 'viewer') return [];
  const base = { campaignId: view.campaign.id, campaign: view.campaign.name };
  const asked = openFor([...questions], me).map((q): OpenItem => ({
    ...base, key: `question:${q.id}`, to: `/campaign/${view.campaign.id}/questions`, title: `Question from ${q.askedByName}`, detail: gist(q.text), chip: 'to answer',
  }));
  const confirms = openConfirmations(view, me).map((o): OpenItem => ({
    ...base, key: `confirm:${o.battleId}:${o.warbandId}`, to: `/campaign/${view.campaign.id}/battles/${o.battleId}`, title: 'Confirm your version', detail: o.label, chip: 'to confirm',
  }));
  const marks = openAftermaths(view, me).map((o): OpenItem => ({
    ...base, key: `aftermath:${o.battleId}:${o.warbandId}`, to: `/warbands/${o.warbandId}/aftermath/${o.battleId}`, title: 'Aftermath', detail: o.label, chip: 'to mark',
  }));
  return [...asked, ...confirms, ...marks, ...interludes(view, me, local)];
}

/* A campaign's scenarios on the server (phase 4b3c; server/src/routes-scenarios.ts):
   a leaders' own scenario – its rules and the values of the NPCs in it, in
   the text form of the Tabletop Simulator export. A draft is read by leaders
   (with the authenticator) alone; a leader releases it by assigning it to a
   battle, and from then on every member reads it. The last answer is kept on
   the device (under the account's own key), so the scenarios still show
   without a connection; writing needs the connection. A write answers with
   the one scenario; the list is fetched again after it. The NPCs of a scenario
   come with it (ADR 0022): the players read them with every part the leader
   hid as a "?", a leader reads all of it. */
import { scenarioNpcCard, type ScenarioNpc } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export interface Scenario {
  id: string; title: string; body: string; npcStatlines: string; /** the NPCs of the scenario, in the order they were put in */ npcs: ScenarioNpc[]; visibility: 'leader' | 'public'; playedInBattle: string | null;
  releasedAt: string | null; releasedBy: string | null; edited: boolean; createdAt: string; updatedAt: string; seq: number;
}
export interface ScenarioList { scenarios: Scenario[]; seq: number }

/** The limits the server holds to (server/src/scenarios.ts). */
export const LIMITS = { title: 200, body: 20_000, statlines: 10_000 } as const;

/** The most NPCs a scenario holds (server/src/scenarios.ts). */
export const MAX_NPCS = 30;

const key = (cid: string) => ownKey('scenarios:', cid);

/** A list kept before the NPCs existed has none. */
const withNpcs = (l: ScenarioList): ScenarioList => ({ ...l, scenarios: l.scenarios.map((s) => ({ ...s, npcs: s.npcs ?? [] })) });

export async function cachedScenarios(cid: string): Promise<ScenarioList | null> {
  const kept = (await db.meta.get(key(cid)))?.value as ScenarioList | undefined;
  return kept ? withNpcs(kept) : null;
}

export const getScenarios = (cid: string, who = asker()) => api<ScenarioList>(`/campaigns/${cid}/scenarios`).then(async (l) => { await who.keep('scenarios:', cid, l); return withNpcs(l); });

export interface ScenarioBody { title: string; body: string; npcStatlines: string; npcs: ScenarioNpc[] }
/** Writes a scenario under the device's id; `baseSeq` is the stand it was edited from (0 for a new one). The list comes back fresh. */
export const putScenario = (cid: string, id: string, body: ScenarioBody, baseSeq: number) =>
  api(`/campaigns/${cid}/scenarios/${id}`, { method: 'PUT', body: { ...body, baseSeq } }).then(() => getScenarios(cid));
/** Releases a draft by assigning it to a battle: from then on every member reads it, and that is not undone. */
export const releaseScenario = (cid: string, id: string, battleId: string) =>
  api(`/campaigns/${cid}/scenarios/${id}/release`, { method: 'POST', body: { battleId } }).then(() => getScenarios(cid));
/** Takes a draft out; a released scenario stays. */
export const removeScenario = (cid: string, id: string) =>
  api(`/campaigns/${cid}/scenarios/${id}`, { method: 'DELETE' }).then(() => getScenarios(cid));

/** The scenario as it stands now, when another leader changed it first (the server's 409 `stale`). */
export function staleScenario(e: unknown): Scenario | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Scenario } | undefined)?.current ?? null) : null;
}

/** The server's reason when a change to a released scenario would alter or re-hide what the players read (409 `frozen`). */
export const frozenProblem = (e: unknown): string | null =>
  e instanceof ApiError && e.status === 409 && e.code === 'frozen' ? (e.problem ?? 'That part has been shown to the players.') : null;

/** The statlines of the NPCs in a scenario, headed by its title – the text to paste into the Tabletop Simulator table: the free text first, then
    each NPC as the players read it (a hidden part a "?"), name and description one after the other. */
export function ttsText(s: Scenario): string {
  const free = s.npcStatlines.trim();
  const cards = s.npcs.map((n) => scenarioNpcCard(n)).map((c) => `${c.name}\n${c.text}`);
  const parts = [...(free ? [free] : []), ...cards];
  return parts.length ? `${s.title}\n${parts.join('\n\n')}\n` : '';
}

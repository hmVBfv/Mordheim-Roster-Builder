/* A campaign's scenarios on the server (phase 4b3c; server/src/routes-scenarios.ts):
   a leaders' own scenario – its rules and the values of the NPCs in it, in
   the text form of the Tabletop Simulator export. A draft is read by leaders
   (with the authenticator) alone; a leader releases it by assigning it to a
   battle, and from then on every member reads it. The last answer is kept on
   the device (under the account's own key), so the scenarios still show
   without a connection; writing needs the connection. A write answers with
   the one scenario; the list is fetched again after it. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export interface Scenario {
  id: string; title: string; body: string; npcStatlines: string; visibility: 'leader' | 'public'; playedInBattle: string | null;
  releasedAt: string | null; releasedBy: string | null; edited: boolean; createdAt: string; updatedAt: string; seq: number;
}
export interface ScenarioList { scenarios: Scenario[]; seq: number }

/** The limits the server holds to (server/src/scenarios.ts). */
export const LIMITS = { title: 200, body: 20_000, statlines: 10_000 } as const;

const key = (cid: string) => ownKey('scenarios:', cid);

export async function cachedScenarios(cid: string): Promise<ScenarioList | null> {
  return ((await db.meta.get(key(cid)))?.value as ScenarioList | undefined) ?? null;
}

export const getScenarios = (cid: string, who = asker()) => api<ScenarioList>(`/campaigns/${cid}/scenarios`).then(async (l) => { await who.keep('scenarios:', cid, l); return l; });

export interface ScenarioBody { title: string; body: string; npcStatlines: string }
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

/** The statlines of the NPCs in a scenario, headed by its title – the text to paste into the Tabletop Simulator table. */
export const ttsText = (s: Scenario) => (s.npcStatlines.trim() ? `${s.title}\n${s.npcStatlines.trim()}\n` : '');

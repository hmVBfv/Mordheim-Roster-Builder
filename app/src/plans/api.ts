/* The leaders' plans for battles on the server (server/src/routes-plans.ts):
   the red thread of a battle, by its number. Leaders' own – read and written
   by leaders with the authenticator; for everyone else there is no such
   thing. The last list is kept on the device (under the account's own key);
   writing needs the connection. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

/** The limit the server holds to (server/src/plans.ts). */
export const MAX_PLAN = 20_000;

export interface Plan { round: number; text: string; updatedBy: string | null; updatedAt: string | null; seq: number }

const key = (cid: string) => ownKey('plans:', cid);

export async function cachedPlans(cid: string): Promise<Plan[] | null> {
  return ((await db.meta.get(key(cid)))?.value as Plan[] | undefined) ?? null;
}

export async function getPlans(cid: string): Promise<Plan[]> {
  const who = asker();
  const r = await api<{ plans: Plan[] }>(`/campaigns/${cid}/plans`);
  await who.keep('plans:', cid, r.plans);
  return r.plans;
}

/** Writes the plan for battle `round` from the stand the device saw (`baseSeq`; 0 for a new one); an empty text takes it out. */
export async function putPlan(cid: string, round: number, text: string, baseSeq: number): Promise<Plan> {
  const who = asker();
  const r = await api<{ plan: Plan }>(`/campaigns/${cid}/plans/${round}`, { method: 'PUT', body: { text, baseSeq } });
  const cur = (await cachedPlans(cid)) ?? [];
  const next = [...cur.filter((p) => p.round !== round), ...(r.plan.text ? [r.plan] : [])].sort((a, b) => a.round - b.round);
  await who.keep('plans:', cid, next);
  return r.plan;
}

/** The plan as it stands now, when another leader changed it first (the server's 409 `stale`). */
export function stalePlan(e: unknown): Plan | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Plan } | undefined)?.current ?? null) : null;
}

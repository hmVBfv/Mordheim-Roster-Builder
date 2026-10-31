/* The leaders' plan for a battle (concept.md 4.10): the red thread a leader
   wants the battle and its chapter to follow, kept by the battle's number so
   it can be written before the battle is set up. Leaders' own – read and
   written by the campaign's leaders; for everyone else
   it does not exist. An empty text takes the plan out. The log says that it
   changed, never what it says. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

export const MAX_PLAN = 20_000;

export const PlanBody = z.object({
  text: z.string().max(MAX_PLAN),
  /** The `seq` the device edited from; 0 while there is no plan for this battle. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type PlanInput = z.infer<typeof PlanBody>;

export interface Plan { round: number; text: string; updatedBy: string | null; updatedAt: string | null; seq: number }

type Row = { round: number; text: string; updated_at: string; seq: number; by: string };
const toPlan = (r: Row): Plan => ({ round: r.round, text: r.text, updatedBy: r.by, updatedAt: r.updated_at, seq: r.seq });
const SELECT = 'SELECT p.round, p.text, p.updated_at, p.seq, u.display_name AS by FROM battle_plans p JOIN users u ON u.id = p.updated_by';

export function listPlans(db: DB, campaignId: string): Plan[] {
  return (db.prepare(`${SELECT} WHERE p.campaign_id = ? ORDER BY p.round`).all(campaignId) as Row[]).map(toPlan);
}

export function getPlan(db: DB, campaignId: string, round: number): Plan {
  const r = db.prepare(`${SELECT} WHERE p.campaign_id = ? AND p.round = ?`).get(campaignId, round) as Row | undefined;
  return r ? toPlan(r) : { round, text: '', updatedBy: null, updatedAt: null, seq: 0 };
}

export type Put = { ok: true; plan: Plan } | { ok: false; status: 409; error: 'stale'; current: Plan };

/** Writes the plan for a battle from the stand the device saw; the same text again changes nothing, an empty one takes it out. */
export function putPlan(db: DB, campaignId: string, round: number, input: PlanInput, by: string, now: Date): Put {
  return db.transaction((): Put => {
    const cur = getPlan(db, campaignId, round);
    const text = input.text.trim() ? input.text : '';
    if (cur.text === text) return { ok: true, plan: cur };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: cur };
    const seq = audit(db, { actorId: by, action: text ? 'plan.edit' : 'plan.remove', targetType: 'campaign', targetId: campaignId, campaignId, visibility: 'leader', payload: { round } }, now);
    if (!text) {
      db.prepare('DELETE FROM battle_plans WHERE campaign_id = ? AND round = ?').run(campaignId, round);
      return { ok: true, plan: { round, text: '', updatedBy: null, updatedAt: null, seq } };
    }
    db.prepare(`INSERT INTO battle_plans (campaign_id, round, text, updated_by, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (campaign_id, round) DO UPDATE SET text = excluded.text, updated_by = excluded.updated_by, updated_at = excluded.updated_at, seq = excluded.seq`)
      .run(campaignId, round, text, by, now.toISOString(), seq);
    return { ok: true, plan: getPlan(db, campaignId, round) };
  })();
}

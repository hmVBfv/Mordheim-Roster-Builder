/* The leaders' plans for battles (docs/architecture.md "Endpunkte"): the red
   thread of a battle, by its number. Leaders' own: read and written by the
   campaign's leaders with the authenticator; the campaign's other members get
   a 403 and an outsider a 404. Every route names its action, `can()` decides
   before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { listPlans, PlanBody, putPlan } from './plans.ts';
import { can, type Action } from './policy.ts';

export interface PlanDeps { db: DB | null; now: () => Date }

export function registerPlanRoutes(app: FastifyInstance, deps: PlanDeps): void {
  const db = () => deps.db as DB;

  const target = (req: FastifyRequest, reply: FastifyReply, action: Action): { c: CampaignRow; role: CampaignRole } | null => {
    const c = campaignById(db(), (req.params as { id: string }).id);
    const role = c ? roleIn(db(), c.id, req.actor!.id) : null;
    if (!c || !role) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    if (!can(req.actor, action, { role })) {
      void reply.code(403).send({ error: 'forbidden' });
      return null;
    }
    return { c, role };
  };

  app.get('/api/v1/campaigns/:id/plans', { config: { action: 'plans.read' } }, async (req, reply) => {
    const t = target(req, reply, 'plans.read');
    if (!t) return reply;
    return { plans: listPlans(db(), t.c.id) };
  });

  app.put('/api/v1/campaigns/:id/plans/:round', {
    config: { action: 'plans.write' },
    schema: { params: { type: 'object', properties: { id: { type: 'string' }, round: { type: 'integer', minimum: 1, maximum: 999 } }, required: ['id', 'round'] }, body: { type: 'object' } },
  }, async (req, reply) => {
    const t = target(req, reply, 'plans.write');
    if (!t) return reply;
    const parsed = PlanBody.safeParse(req.body);
    if (!parsed.success) {
      const why = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a plan (${why})` });
    }
    const r = putPlan(db(), t.c.id, (req.params as { round: number }).round, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, current: r.current });
    return { plan: r.plan };
  });
}

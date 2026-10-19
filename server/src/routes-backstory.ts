/* The campaign's backstory (docs/architecture.md "Endpunkte"): what came
   before the app, in sections. Every member reads it; a leader with the
   authenticator replaces it. An outsider is told the campaign does not exist
   (404), a member without the right gets a 403. Every route names its
   action, `can()` decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { BackstoryBody, getBackstory, putBackstory } from './backstory.ts';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';

export interface BackstoryDeps { db: DB | null; now: () => Date }

export function registerBackstoryRoutes(app: FastifyInstance, deps: BackstoryDeps): void {
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

  app.get('/api/v1/campaigns/:id/backstory', { config: { action: 'backstory.read' } }, async (req, reply) => {
    const t = target(req, reply, 'backstory.read');
    if (!t) return reply;
    return { backstory: getBackstory(db(), t.c.id) };
  });

  app.put('/api/v1/campaigns/:id/backstory', { config: { action: 'backstory.write' }, schema: { body: { type: 'object' } }, bodyLimit: 1_048_576 }, async (req, reply) => {
    const t = target(req, reply, 'backstory.write');
    if (!t) return reply;
    const parsed = BackstoryBody.safeParse(req.body);
    if (!parsed.success) {
      const why = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a backstory (${why})` });
    }
    const r = putBackstory(db(), t.c.id, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, current: r.current });
    return { backstory: r.backstory };
  });
}

/* The campaign's style guide (phase 4b4a; docs/architecture.md "Endpunkte"):
   the writing instructions of the AI pack. Leaders' own: read and written by
   the campaign's leaders; for anybody else the
   campaign's members get a 403 and an outsider a 404. Every route names its
   action, `can()` decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';
import { getStyle, putStyle, StyleBody } from './style.ts';

export interface StyleDeps { db: DB | null; now: () => Date }

export function registerStyleRoutes(app: FastifyInstance, deps: StyleDeps): void {
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

  app.get('/api/v1/campaigns/:id/style', { config: { action: 'style.read' } }, async (req, reply) => {
    const t = target(req, reply, 'style.read');
    if (!t) return reply;
    return { style: getStyle(db(), t.c.id) };
  });

  app.put('/api/v1/campaigns/:id/style', { config: { action: 'style.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'style.write');
    if (!t) return reply;
    const parsed = StyleBody.safeParse(req.body);
    if (!parsed.success) {
      const why = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a style guide (${why})` });
    }
    const r = putStyle(db(), t.c.id, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, current: r.current });
    return { style: r.style };
  });
}

/* The timeline (phase 4a3, part 2; docs/architecture.md "Endpunkte"): what
   the app needs to put the story together beyond notes and pictures – the
   protocol of every battle, the marks, the places blocks were moved to –
   and moving a block. What each may see is decided in timeline.ts for the
   one who asks (ADR 0011). */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action, type Actor } from './policy.ts';
import { campaignEntries, campaignMarks, campaignOutcomes, ITEM_TYPES, listPositions, moveBlock, type ItemType } from './timeline.ts';

export interface TimelineDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function registerTimelineRoutes(app: FastifyInstance, deps: TimelineDeps): void {
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
  const viewer = (a: Actor, role: CampaignRole) => ({ id: a.id, leader: can(a, 'campaign.manage', { role }) });

  app.get('/api/v1/campaigns/:id/timeline', { config: { action: 'campaign.read' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    return { positions: listPositions(db(), t.c.id, viewer(req.actor!, t.role)), entries: campaignEntries(db(), t.c.id), outcomes: campaignOutcomes(db(), t.c.id), marks: campaignMarks(db(), t.c.id) };
  });

  app.put('/api/v1/campaigns/:id/timeline/:type/:itemId', {
    config: { action: 'notes.write' },
    schema: { body: { type: 'object', additionalProperties: false, required: ['segment', 'pos'], properties: { segment: { type: 'string', maxLength: 64 }, pos: { type: 'string', maxLength: 64 } } } },
  }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const p = req.params as { type: string; itemId: string };
    const itemId = p.itemId.toLowerCase();
    if (!(ITEM_TYPES as readonly string[]).includes(p.type) || !UUID.test(itemId)) return reply.code(400).send({ error: 'invalid', problem: 'no such block' });
    const r = moveBlock(db(), t.c.id, p.type as ItemType, itemId, req.body as { segment: string; pos: string }, viewer(req.actor!, t.role), deps.now());
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return { position: r.position };
  });
}

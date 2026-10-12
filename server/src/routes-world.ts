/* The campaign world (phase 4b3b; docs/architecture.md "Endpunkte"):
   factions, NPCs and the reputation log. Every member reads all of it – it is
   mechanics (ADR 0002) – and only the campaign's leaders, with the
   authenticator, write. Every route names its action, `can()` decides before
   the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';
import { addReputation, FactionBody, listWorld, NpcBody, putFaction, putNpc, removeFaction, removeNpc, removeReputation, ReputationBody, worldSeq } from './world.ts';

export interface WorldDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerWorldRoutes(app: FastifyInstance, deps: WorldDeps): void {
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
  const world = (cid: string) => ({ ...listWorld(db(), cid), seq: worldSeq(db(), cid) });
  /** The id in the path is the device's: a UUID, lower case. */
  const deviceId = (req: FastifyRequest, reply: FastifyReply, name: string, what: string): string | null => {
    const id = (req.params as Record<string, string>)[name]!.toLowerCase();
    if (!UUID.test(id)) {
      void reply.code(400).send({ error: 'invalid', problem: `${what} is named by its device id` });
      return null;
    }
    return id;
  };

  app.get('/api/v1/campaigns/:id/world', { config: { action: 'world.read' } }, async (req, reply) => {
    const t = target(req, reply, 'world.read');
    if (!t) return reply;
    return world(t.c.id);
  });

  app.put('/api/v1/campaigns/:id/world/factions/:fid', { config: { action: 'world.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'fid', 'a faction');
    if (!id) return reply;
    const parsed = FactionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a faction') });
    const r = putFaction(db(), t.c.id, id, parsed.data, { id: req.actor!.id }, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return world(t.c.id);
  });

  app.delete('/api/v1/campaigns/:id/world/factions/:fid', { config: { action: 'world.write' } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'fid', 'a faction');
    if (!id) return reply;
    const r = removeFaction(db(), t.c.id, id, { id: req.actor!.id }, deps.now());
    if (r === 'unknown') return reply.code(404).send({ error: 'not_found' });
    return { ...world(t.c.id), removed: r === 'ok' };
  });

  app.put('/api/v1/campaigns/:id/world/npcs/:nid', { config: { action: 'world.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'nid', 'an NPC');
    if (!id) return reply;
    const parsed = NpcBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'an NPC') });
    const r = putNpc(db(), t.c.id, id, { ...parsed.data, factionId: parsed.data.factionId?.toLowerCase() ?? null }, { id: req.actor!.id }, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return world(t.c.id);
  });

  app.delete('/api/v1/campaigns/:id/world/npcs/:nid', { config: { action: 'world.write' } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'nid', 'an NPC');
    if (!id) return reply;
    const r = removeNpc(db(), t.c.id, id, { id: req.actor!.id }, deps.now());
    if (r === 'unknown') return reply.code(404).send({ error: 'not_found' });
    return { ...world(t.c.id), removed: r === 'ok' };
  });

  app.put('/api/v1/campaigns/:id/world/reputation/:rid', { config: { action: 'world.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'rid', 'a reputation event');
    if (!id) return reply;
    const parsed = ReputationBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a reputation event') });
    const d = parsed.data;
    const r = addReputation(db(), t.c.id, id, { ...d, warbandId: d.warbandId.toLowerCase(), factionId: d.factionId.toLowerCase(), battleId: d.battleId?.toLowerCase() ?? null }, { id: req.actor!.id }, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return world(t.c.id);
  });

  app.delete('/api/v1/campaigns/:id/world/reputation/:rid', { config: { action: 'world.write' } }, async (req, reply) => {
    const t = target(req, reply, 'world.write');
    if (!t) return reply;
    const id = deviceId(req, reply, 'rid', 'a reputation event');
    if (!id) return reply;
    const r = removeReputation(db(), t.c.id, id, { id: req.actor!.id }, deps.now());
    if (r === 'unknown') return reply.code(404).send({ error: 'not_found' });
    return { ...world(t.c.id), removed: r === 'ok' };
  });
}

/* Hidden NPC warbands of a campaign (wish #79; docs/architecture.md "Endpunkte"): the game master's reference and Tabletop
   Simulator data. Leaders only, with the authenticator (ADR 0010, ADR 0011): a player, a viewer, an admin outside the campaign
   – for none of them is there anything to read or to write; an outsider is told the campaign does not exist. Every route names
   its action, `can()` decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { listNpcWarbands, npcWarbandById, NpcWarbandBody, npcWarbandSeq, oneNpcWarband, putNpcWarband, removeNpcWarband } from './npc-warbands.ts';
import { can, type Action } from './policy.ts';

export interface NpcWarbandDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function registerNpcWarbandRoutes(app: FastifyInstance, deps: NpcWarbandDeps): void {
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

  app.get('/api/v1/campaigns/:id/npc-warbands', { config: { action: 'npcwarband.read' } }, async (req, reply) => {
    const t = target(req, reply, 'npcwarband.read');
    if (!t) return reply;
    return { warbands: listNpcWarbands(db(), t.c.id), seq: npcWarbandSeq(db(), t.c.id) };
  });

  app.get('/api/v1/campaigns/:id/npc-warbands/:wid', { config: { action: 'npcwarband.read' } }, async (req, reply) => {
    const t = target(req, reply, 'npcwarband.read');
    if (!t) return reply;
    const wid = (req.params as { wid: string }).wid.toLowerCase();
    const row = npcWarbandById(db(), wid);
    const warband = row && row.campaign_id === t.c.id ? oneNpcWarband(db(), wid) : null;
    if (!warband) return reply.code(404).send({ error: 'not_found' });
    return { warband };
  });

  app.put('/api/v1/campaigns/:id/npc-warbands/:wid', { config: { action: 'npcwarband.write' }, bodyLimit: 1_048_576, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'npcwarband.write');
    if (!t) return reply;
    const wid = (req.params as { wid: string }).wid.toLowerCase();
    if (!UUID.test(wid)) return reply.code(400).send({ error: 'invalid', problem: 'an NPC warband is named by its device id' });
    const parsed = NpcWarbandBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid', problem: `not an NPC warband (${parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})` });
    }
    const r = putNpcWarband(db(), t.c.id, wid, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}), ...(r.current ? { current: r.current } : {}) });
    return { warband: r.warband, seq: npcWarbandSeq(db(), t.c.id) };
  });

  app.delete('/api/v1/campaigns/:id/npc-warbands/:wid', { config: { action: 'npcwarband.write' } }, async (req, reply) => {
    const t = target(req, reply, 'npcwarband.write');
    if (!t) return reply;
    if (!removeNpcWarband(db(), t.c.id, (req.params as { wid: string }).wid.toLowerCase(), req.actor!.id, deps.now())) return reply.code(404).send({ error: 'not_found' });
    return { removed: true, seq: npcWarbandSeq(db(), t.c.id) };
  });
}

/* The background of a campaign (phase 4b1; docs/architecture.md
   "Endpunkte"): the leaders' side of the story. Leaders only, with the
   authenticator (ADR 0010, ADR 0011): a player, a viewer, an admin outside
   the campaign – for none of them is there anything to read or to write; an
   outsider is told the campaign does not exist. Every route names its
   action, `can()` decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { backgroundSeq, entryById, EntryBody, listEntries, oneEntry, putEntry, removeEntry, revealEntry, RevealBody, revealsOf, revisionsOf } from './background.ts';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';

export interface BackgroundDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerBackgroundRoutes(app: FastifyInstance, deps: BackgroundDeps): void {
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

  app.get('/api/v1/campaigns/:id/background', {
    config: { action: 'background.read' },
    schema: { querystring: { type: 'object', properties: { since: { type: 'integer', minimum: 0 } } } },
  }, async (req, reply) => {
    const t = target(req, reply, 'background.read');
    if (!t) return reply;
    const seq = backgroundSeq(db(), t.c.id);
    const since = (req.query as { since?: number }).since;
    // exactly the number the device has: a higher one comes from a server restored to an earlier state
    if (since !== undefined && since === seq) return { unchanged: true, seq };
    return { entries: listEntries(db(), t.c.id), seq };
  });

  /** One entry with its earlier wordings and its reveals. */
  app.get('/api/v1/campaigns/:id/background/:eid', { config: { action: 'background.read' } }, async (req, reply) => {
    const t = target(req, reply, 'background.read');
    if (!t) return reply;
    const eid = (req.params as { eid: string }).eid.toLowerCase();
    const row = entryById(db(), eid);
    const entry = row && row.campaign_id === t.c.id ? oneEntry(db(), eid) : null;
    if (!entry) return reply.code(404).send({ error: 'not_found' });
    return { entry, revisions: revisionsOf(db(), eid), reveals: revealsOf(db(), eid) };
  });

  app.put('/api/v1/campaigns/:id/background/:eid', { config: { action: 'background.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'background.write');
    if (!t) return reply;
    const eid = (req.params as { eid: string }).eid.toLowerCase();
    if (!UUID.test(eid)) return reply.code(400).send({ error: 'invalid', problem: 'an entry is named by its device id' });
    const parsed = EntryBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'an entry') });
    const b = parsed.data;
    const r = putEntry(db(), t.c.id, eid, { ...b, battleId: b.battleId?.toLowerCase() ?? null, revealFromBattle: b.revealFromBattle?.toLowerCase() ?? null }, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}), ...(r.current ? { current: r.current } : {}) });
    return { entry: r.entry, seq: backgroundSeq(db(), t.c.id) };
  });

  app.delete('/api/v1/campaigns/:id/background/:eid', { config: { action: 'background.write' } }, async (req, reply) => {
    const t = target(req, reply, 'background.write');
    if (!t) return reply;
    if (!removeEntry(db(), t.c.id, (req.params as { eid: string }).eid.toLowerCase(), req.actor!.id, deps.now())) return reply.code(404).send({ error: 'not_found' });
    return { removed: true, seq: backgroundSeq(db(), t.c.id) };
  });

  /** Reveals to everyone: a public note from the words given, placed in the story; the entry's level goes up. */
  app.post('/api/v1/campaigns/:id/background/:eid/reveal', { config: { action: 'background.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'background.write');
    if (!t) return reply;
    const parsed = RevealBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a reveal') });
    const b = parsed.data;
    const r = revealEntry(db(), t.c.id, (req.params as { eid: string }).eid.toLowerCase(), { ...b, noteId: b.noteId.toLowerCase(), battleId: b.battleId?.toLowerCase() ?? null }, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return { entry: r.entry, note: r.noteId, seq: backgroundSeq(db(), t.c.id) };
  });
}

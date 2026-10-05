/* Notes of a campaign (phase 4a3; docs/architecture.md "Endpunkte"). Every
   member reads – what each may see is decided in notes.ts for the one who
   asks (ADR 0011); leaders and players write (concept.md 3), each their
   own, under the device's id. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { deleteNote, listNotes, NoteBody, noteById, notesSeq, oneNote, putNote } from './notes.ts';
import { can, type Action, type Actor } from './policy.ts';

export interface NoteDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function registerNoteRoutes(app: FastifyInstance, deps: NoteDeps): void {
  const db = () => deps.db as DB;
  const now = deps.now;

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
  /** Leaders see the leaders' notes – with the authenticator, like everything a leader does. */
  const viewer = (a: Actor, role: CampaignRole) => ({ id: a.id, leader: can(a, 'campaign.manage', { role }) });

  app.get('/api/v1/campaigns/:id/notes', {
    config: { action: 'campaign.read' },
    schema: { querystring: { type: 'object', properties: { since: { type: 'integer', minimum: 0 } } } },
  }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    const seq = notesSeq(db(), t.c.id);
    const since = (req.query as { since?: number }).since;
    if (since !== undefined && since >= seq) return { unchanged: true, seq };
    return { notes: listNotes(db(), t.c.id, viewer(req.actor!, t.role)), seq };
  });

  app.put('/api/v1/campaigns/:id/notes/:nid', {
    config: { action: 'notes.write' },
    schema: { body: { type: 'object' } },
  }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const nid = (req.params as { nid: string }).nid.toLowerCase();
    if (!UUID.test(nid)) return reply.code(400).send({ error: 'invalid', problem: 'a note is named by its device id' });
    const parsed = NoteBody.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a note (${first})` });
    }
    const v = viewer(req.actor!, t.role);
    const r = putNote(db(), t.c.id, nid, { ...parsed.data, battleId: parsed.data.battleId?.toLowerCase() ?? null, protocolEntryId: parsed.data.protocolEntryId?.toLowerCase() ?? null }, v, now());
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return { note: oneNote(db(), nid, v), seq: notesSeq(db(), t.c.id) };
  });

  app.delete('/api/v1/campaigns/:id/notes/:nid', { config: { action: 'notes.write' } }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const n = noteById(db(), (req.params as { nid: string }).nid.toLowerCase());
    const v = viewer(req.actor!, t.role);
    // a note one may not see does not exist
    if (!n || n.campaign_id !== t.c.id || !oneNote(db(), n.id, v)) return reply.code(404).send({ error: 'not_found' });
    const r = deleteNote(db(), n, v, now());
    if (r === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
    return { removed: r === 'ok', seq: notesSeq(db(), t.c.id) };
  });
}

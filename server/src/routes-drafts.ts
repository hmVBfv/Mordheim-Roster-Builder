/* Chapters as drafts (phase 4b5b; docs/architecture.md "Endpunkte"): the
   text of a chapter not yet published. Leaders' own: read, written and
   published by the campaign's leaders; for the other
   members of the campaign it is a 403, for an outsider a 404, and what a
   draft says is in no other answer. Every route names its action, `can()`
   decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import { chapterById, chapterOf, summaryOf } from './chapters.ts';
import { discardDraft, DraftBody, draftsSeq, listDrafts, oneDraft, publishDraft, PublishBody, putDraft } from './chapter-drafts.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';

export interface DraftDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerDraftRoutes(app: FastifyInstance, deps: DraftDeps): void {
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
  const deviceId = (req: FastifyRequest, reply: FastifyReply): string | null => {
    const id = (req.params as { did: string }).did.toLowerCase();
    if (!UUID.test(id)) {
      void reply.code(400).send({ error: 'invalid', problem: 'a draft is named by its device id' });
      return null;
    }
    return id;
  };

  app.get('/api/v1/campaigns/:id/chapter-drafts', { config: { action: 'drafts.read' } }, async (req, reply) => {
    const t = target(req, reply, 'drafts.read');
    if (!t) return reply;
    return { drafts: listDrafts(db(), t.c.id), seq: draftsSeq(db(), t.c.id) };
  });

  app.put('/api/v1/campaigns/:id/chapter-drafts/:did', { config: { action: 'drafts.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'drafts.write');
    if (!t) return reply;
    const did = deviceId(req, reply);
    if (!did) return reply;
    const parsed = DraftBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a chapter draft') });
    const r = putDraft(db(), t.c.id, did, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}), ...(r.error === 'stale' ? { current: oneDraft(db(), did) } : {}) });
    return { draft: oneDraft(db(), did), seq: draftsSeq(db(), t.c.id) };
  });

  app.post('/api/v1/campaigns/:id/chapter-drafts/:did/publish', { config: { action: 'drafts.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'drafts.write');
    if (!t) return reply;
    const did = deviceId(req, reply);
    if (!did) return reply;
    const parsed = PublishBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a publication') });
    const r = publishDraft(db(), t.c.id, did, parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return { chapter: summaryOf(chapterOf(chapterById(db(), r.chapterId)!)), seq: draftsSeq(db(), t.c.id) };
  });

  app.delete('/api/v1/campaigns/:id/chapter-drafts/:did', { config: { action: 'drafts.write' } }, async (req, reply) => {
    const t = target(req, reply, 'drafts.write');
    if (!t) return reply;
    const did = deviceId(req, reply);
    if (!did) return reply;
    const r = discardDraft(db(), t.c.id, did, req.actor!.id, deps.now());
    if (r === 'unknown') return reply.code(404).send({ error: 'not_found' });
    if (r === 'published') return reply.code(409).send({ error: 'published' });
    return { removed: r === 'ok', seq: draftsSeq(db(), t.c.id) };
  });
}

/* Pictures of a campaign (phase 4a3, part 2; docs/architecture.md
   "Endpunkte"). Every member reads – what each may see is decided in
   attachments.ts for the one who asks (ADR 0011); leaders and players send
   pictures, each their own, under the device's id: first what it is, then
   its bytes (PNG, JPEG or WebP, at most 5 MB, checked by its first bytes).
   The bytes go out with a fixed type, never sniffed, never as a page. */
import { createReadStream, existsSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AttachmentBody, attachmentById, attachmentsSeq, CAMPAIGN_QUOTA, deleteAttachment, fileOf, listAttachments, MAX_BYTES, MIMES, oneAttachment, putAttachment, storeFile, visibleTo,
} from './attachments.ts';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action, type Actor } from './policy.ts';

export interface AttachmentDeps { db: DB | null; now: () => Date; uploadDir: string | null; quota?: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function registerAttachmentRoutes(app: FastifyInstance, deps: AttachmentDeps): void {
  const db = () => deps.db as DB;
  const now = deps.now;

  // a picture's bytes arrive as they are: only on the route that takes them (the schema of every other route wants an object)
  app.addContentTypeParser(Object.keys(MIMES), { parseAs: 'buffer', bodyLimit: MAX_BYTES }, (_req, body, done) => done(null, body));

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
  /** The picture the route names, if the one who asks may see it; otherwise there is none. */
  const picture = (req: FastifyRequest, reply: FastifyReply, c: CampaignRow, role: CampaignRole) => {
    const aid = (req.params as { aid: string }).aid.toLowerCase();
    const a = UUID.test(aid) ? attachmentById(db(), aid) : undefined;
    if (!a || a.campaign_id !== c.id || !visibleTo(a, viewer(req.actor!, role))) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    return a;
  };

  app.get('/api/v1/campaigns/:id/attachments', {
    config: { action: 'campaign.read' },
    schema: { querystring: { type: 'object', properties: { since: { type: 'integer', minimum: 0 } } } },
  }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    const seq = attachmentsSeq(db(), t.c.id, viewer(req.actor!, t.role));
    const since = (req.query as { since?: number }).since;
    if (since !== undefined && since >= seq) return { unchanged: true, seq };
    return { attachments: listAttachments(db(), t.c.id, viewer(req.actor!, t.role)), seq };
  });

  app.get('/api/v1/campaigns/:id/attachments/:aid/file', { config: { action: 'campaign.read' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    const a = picture(req, reply, t.c, t.role);
    if (!a) return reply;
    const file = deps.uploadDir && a.stored_at ? fileOf(deps.uploadDir, a) : null;
    if (!file || !existsSync(file)) return reply.code(404).send({ error: 'not_found' });
    // the same id never stands for other bytes: it may be kept, by this browser only
    return reply.type(a.mime).header('Cache-Control', 'private, max-age=31536000, immutable').header('Content-Disposition', 'inline')
      .header('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox").send(createReadStream(file));
  });

  app.put('/api/v1/campaigns/:id/attachments/:aid', { config: { action: 'notes.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const aid = (req.params as { aid: string }).aid.toLowerCase();
    if (!UUID.test(aid)) return reply.code(400).send({ error: 'invalid', problem: 'a picture is named by its device id' });
    const parsed = AttachmentBody.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a picture (${first})` });
    }
    const r = putAttachment(db(), t.c.id, aid, { ...parsed.data, battleId: parsed.data.battleId?.toLowerCase() ?? null }, viewer(req.actor!, t.role), now(), deps.quota ?? CAMPAIGN_QUOTA);
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return { attachment: oneAttachment(db(), aid), seq: attachmentsSeq(db(), t.c.id, viewer(req.actor!, t.role)) };
  });

  app.put('/api/v1/campaigns/:id/attachments/:aid/file', { config: { action: 'notes.write' }, bodyLimit: MAX_BYTES }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const a = picture(req, reply, t.c, t.role);
    if (!a) return reply;
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'invalid', problem: 'the picture’s bytes, as image/png, image/jpeg or image/webp' });
    if (!deps.uploadDir) return reply.code(503).send({ error: 'unavailable' });
    const r = storeFile(db(), deps.uploadDir, a, req.body, String(req.headers['content-type'] ?? '').split(';')[0]!.trim(), req.actor!.id, now(), deps.quota ?? CAMPAIGN_QUOTA);
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return { attachment: oneAttachment(db(), a.id), seq: attachmentsSeq(db(), t.c.id, viewer(req.actor!, t.role)) };
  });

  app.delete('/api/v1/campaigns/:id/attachments/:aid', { config: { action: 'notes.write' } }, async (req, reply) => {
    const t = target(req, reply, 'notes.write');
    if (!t) return reply;
    const a = picture(req, reply, t.c, t.role);
    if (!a) return reply;
    const r = deleteAttachment(db(), deps.uploadDir ?? '', a, viewer(req.actor!, t.role), now());
    if (r === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
    return { removed: true, seq: attachmentsSeq(db(), t.c.id, viewer(req.actor!, t.role)) };
  });
}

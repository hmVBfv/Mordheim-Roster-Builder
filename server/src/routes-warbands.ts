/* Warbands on the server (phase 3h; docs/architecture.md "Endpunkte" and
   section 6). The client computes, the server stores (ADR 0005): a save
   arrives as the app wrote it, is checked against core/format's schema and
   kept as a version. Every route names its action; for one warband the
   handler loads it and asks can() with it as the target – someone else's
   warband, or one that does not exist, is the same 404. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DB } from './db.ts';
import { getMeta } from './db.ts';
import { can, type Action } from './policy.ts';
import {
  ACCOUNT_FULL, addVersion, checkSave, createWarband, currentSize, draftOfUser, weightOf, dropDraft, fitsAccount, listVersions, listWarbands, metaOf, saveDraft, setArchived,
  SOURCES, syncFor, versionOf, warbandById, type Source, type WarbandRow,
} from './warbands.ts';

export interface WarbandDeps {
  db: DB | null;
  now: () => Date;
}

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const str = (maxLength: number) => ({ type: 'string', maxLength }) as const;
const int = { type: 'integer', minimum: 0 } as const;
const body = (props: Record<string, unknown>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });

export function registerWarbandRoutes(app: FastifyInstance, deps: WarbandDeps): void {
  // only called once app.ts has let the request through, which needs the database
  const db = () => deps.db as DB;
  const now = deps.now;

  /** The warband the route names, if the actor may do `action` with it; otherwise a 404 is sent. */
  const target = (req: FastifyRequest, reply: FastifyReply, action: Action): WarbandRow | null => {
    const w = warbandById(db(), (req.params as { id: string }).id);
    if (!w || !can(req.actor, action, { ownerId: w.owner_id })) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    return w;
  };
  const refuse = (reply: FastifyReply, c: { status: number; error: string; problem: string }) => reply.code(c.status).send({ error: c.error, problem: c.problem });

  app.get('/api/v1/warbands', { config: { action: 'warbands.list' } }, async (req) => {
    const archived = (req.query as { archived?: string }).archived === '1';
    return { warbands: listWarbands(db(), req.actor!.id, archived) };
  });

  app.post('/api/v1/warbands', {
    config: { action: 'warbands.create' },
    schema: body({
      id: { type: 'string', pattern: UUID }, data: { type: 'object' }, source: { type: 'string', enum: ['save', 'import', 'copy'] },
      copiedFrom: { type: 'object', additionalProperties: false, required: ['id', 'rev'], properties: { id: { type: 'string', pattern: UUID }, rev: { type: 'integer', minimum: 1 } } },
      note: str(200), appVersion: str(64),
    }, ['id', 'data', 'source']),
  }, async (req, reply) => {
    const a = req.actor!;
    const b = req.body as { id: string; data: unknown; source: Source; copiedFrom?: { id: string; rev: number }; note?: string; appVersion?: string };
    const c = checkSave(b.data);
    if (!c.ok) return refuse(reply, c);
    const id = b.id.toLowerCase();
    const existing = warbandById(db(), id);
    if (existing) {
      // the same warband sent twice (the outbox after a lost answer): fine; anything else is not
      const first = existing.owner_id === a.id ? versionOf(db(), id, 1) : null;
      if (first && JSON.stringify(first.data) === c.json) return { warband: metaOf(existing), rev: 1 };
      return reply.code(409).send({ error: 'exists' });
    }
    if (b.source === 'copy') {
      const from = b.copiedFrom ? warbandById(db(), b.copiedFrom.id.toLowerCase()) : undefined;
      if (!from || !can(a, 'warband.read', { ownerId: from.owner_id }) || !versionOf(db(), from.id, b.copiedFrom!.rev)) {
        return reply.code(400).send({ error: 'invalid', problem: 'a copy names a warband and version of your own' });
      }
    }
    if (!fitsAccount(db(), a.id, weightOf(c.json))) return reply.code(413).send(ACCOUNT_FULL);
    const w = createWarband(db(), {
      id, ownerId: a.id, data: c.data, json: c.json, source: b.source, note: b.note ?? '', appVersion: b.appVersion ?? '',
      copiedFrom: b.source === 'copy' && b.copiedFrom ? { id: b.copiedFrom.id.toLowerCase(), rev: b.copiedFrom.rev } : null,
    }, now());
    return reply.code(201).send({ warband: metaOf(w), rev: 1 });
  });

  app.get('/api/v1/warbands/:id', { config: { action: 'warband.read' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.read');
    if (!w) return reply;
    return { warband: metaOf(w), head: versionOf(db(), w.id, w.head_rev), draft: draftOfUser(db(), w.id, req.actor!.id) };
  });

  app.get('/api/v1/warbands/:id/versions', { config: { action: 'warband.read' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.read');
    if (!w) return reply;
    return { versions: listVersions(db(), w.id) };
  });

  app.get('/api/v1/warbands/:id/versions/:rev', { config: { action: 'warband.read' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.read');
    if (!w) return reply;
    const v = versionOf(db(), w.id, Number((req.params as { rev: string }).rev));
    if (!v) return reply.code(404).send({ error: 'not_found' });
    return { version: v };
  });

  app.post('/api/v1/warbands/:id/versions', {
    config: { action: 'warband.write' },
    schema: body({ baseRev: { type: 'integer', minimum: 1 }, data: { type: 'object' }, source: { type: 'string', enum: SOURCES.filter((s) => s !== 'copy' && s !== 'migration') }, note: str(200), appVersion: str(64) }, ['baseRev', 'data']),
  }, async (req, reply) => {
    const w = target(req, reply, 'warband.write');
    if (!w) return reply;
    if (w.archived_at) return reply.code(409).send({ error: 'archived' });
    const b = req.body as { baseRev: number; data: unknown; source?: Source; note?: string; appVersion?: string };
    const c = checkSave(b.data);
    if (!c.ok) return refuse(reply, c);
    if (!fitsAccount(db(), req.actor!.id, weightOf(c.json), { warbandId: w.id, head: true })) return reply.code(413).send(ACCOUNT_FULL);
    const r = addVersion(db(), { id: w.id, userId: req.actor!.id, baseRev: b.baseRev, data: c.data, json: c.json, source: b.source ?? 'save', note: b.note ?? '', appVersion: b.appVersion ?? '' }, now());
    // someone saved in between: the app offers the newer state or a copy (ADR 0003)
    if (!r.ok) return reply.code(409).send({ error: 'stale', headRev: r.head });
    return reply.code(201).send({ warband: metaOf(r.warband), rev: r.rev });
  });

  app.put('/api/v1/warbands/:id/autosave', {
    config: { action: 'warband.write' },
    schema: body({ baseRev: { type: 'integer', minimum: 1 }, data: { type: 'object' }, device: str(80), afterSeq: { type: ['integer', 'null'], minimum: 0 }, force: { type: 'boolean' } }, ['baseRev', 'data']),
  }, async (req, reply) => {
    const w = target(req, reply, 'warband.write');
    if (!w) return reply;
    if (w.archived_at) return reply.code(409).send({ error: 'archived' });
    const b = req.body as { baseRev: number; data: unknown; device?: string; afterSeq?: number | null; force?: boolean };
    if (b.baseRev > w.head_rev) return reply.code(400).send({ error: 'invalid', problem: 'no such version to build on' });
    const c = checkSave(b.data);
    if (!c.ok) return refuse(reply, c);
    if (!fitsAccount(db(), req.actor!.id, weightOf(c.json), { warbandId: w.id, head: false })) return reply.code(413).send(ACCOUNT_FULL);
    const r = saveDraft(db(), { id: w.id, userId: req.actor!.id, baseRev: b.baseRev, json: c.json, device: b.device ?? '', afterSeq: b.afterSeq ?? null, force: !!b.force }, now());
    // another device of the same user drafted meanwhile: the app asks which to keep
    if (!r.ok) return reply.code(409).send({ error: 'draft_conflict', draft: r.draft });
    return { seq: r.seq };
  });

  app.delete('/api/v1/warbands/:id/autosave', { config: { action: 'warband.write' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.write');
    if (!w) return reply;
    return { dropped: dropDraft(db(), w.id, req.actor!.id, now()) };
  });

  app.delete('/api/v1/warbands/:id', { config: { action: 'warband.write' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.write');
    if (!w) return reply;
    if (w.archived_at) return { warband: metaOf(w) };
    // entered in a campaign: it leaves the campaign first (concept.md 4.1)
    if (w.campaign_id) return reply.code(409).send({ error: 'enrolled' });
    return { warband: metaOf(setArchived(db(), w.id, req.actor!.id, true, now())) };
  });

  app.post('/api/v1/warbands/:id/unarchive', { config: { action: 'warband.write' } }, async (req, reply) => {
    const w = target(req, reply, 'warband.write');
    if (!w) return reply;
    if (!w.archived_at) return { warband: metaOf(w) };
    if (!fitsAccount(db(), req.actor!.id, currentSize(db(), w.id, req.actor!.id))) return reply.code(413).send(ACCOUNT_FULL);
    return { warband: metaOf(setArchived(db(), w.id, req.actor!.id, false, now())) };
  });

  app.get('/api/v1/sync', {
    config: { action: 'warbands.list' },
    schema: { querystring: { type: 'object', properties: { cursor: int } } },
  }, async (req) => {
    const cursor = (req.query as { cursor?: number }).cursor ?? 0;
    return syncFor(db(), req.actor!.id, cursor, getMeta(db(), 'epoch'));
  });
}

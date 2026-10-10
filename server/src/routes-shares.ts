/* Sharing a warband (Rob, 05.10.2026): a copy straight to another user, or
   a short code. Every route names its action; for one share the handler asks
   can() with its recipient (answering) or its sender (revoking) as the
   target – anyone else is told it does not exist. A code is short, so wrong
   ones are braked per user. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';
import {
  codeBraked, createShare, declineShare, isOpen, listPeople, listShares, revokeShare, shareByCode, shareById, showCode, takeShare, wrongCode,
  type ShareRow,
} from './shares.ts';
import { userById } from './accounts.ts';
import { ACCOUNT_FULL, checkSave, fitsAccount, metaOf, versionOf, warbandById } from './warbands.ts';

export interface ShareDeps { db: DB | null; now: () => Date }

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const body = (props: Record<string, unknown>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });

export function registerShareRoutes(app: FastifyInstance, deps: ShareDeps): void {
  const db = () => deps.db as DB;
  const now = deps.now;

  /** The share the route names, if the actor may do `action` with it (`who`: whose it must be). */
  const target = (req: FastifyRequest, reply: FastifyReply, action: Action, who: (r: ShareRow) => string | null): ShareRow | null => {
    const r = shareById(db(), (req.params as { id: string }).id);
    const owner = r ? who(r) : null;
    if (!r || !owner || !can(req.actor, action, { ownerId: owner })) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    return r;
  };

  /** What the recipient's device needs to show the new warband at once. */
  const taken = (reply: FastifyReply, r: ShareRow, userId: string, warbandId: string) => {
    if (warbandById(db(), warbandId)) return reply.code(409).send({ error: 'exists' });
    if (!fitsAccount(db(), userId, r.data.length)) return reply.code(413).send(ACCOUNT_FULL);
    const w = takeShare(db(), r, userId, warbandId, now());
    return reply.code(201).send({ warband: metaOf(w), head: versionOf(db(), w.id, 1) });
  };

  const braked = (req: FastifyRequest, reply: FastifyReply) => {
    if (!codeBraked(db(), req.actor!.id, now())) return false;
    void reply.code(429).send({ error: 'too_many_attempts', retryAfter: 900 });
    return true;
  };

  app.get('/api/v1/people', { config: { action: 'people.list' } }, async (req) => ({ people: listPeople(db(), req.actor!.id) }));

  app.get('/api/v1/shares', { config: { action: 'shares.read' } }, async (req) => listShares(db(), req.actor!.id, now()));

  app.post('/api/v1/shares', {
    config: { action: 'shares.create' },
    schema: body({ data: { type: 'object' }, to: { type: 'string', pattern: UUID }, warbandId: { type: 'string', pattern: UUID } }, ['data']),
  }, async (req, reply) => {
    const a = req.actor!;
    const b = req.body as { data: unknown; to?: string; warbandId?: string };
    const c = checkSave(b.data);
    if (!c.ok) return reply.code(c.status).send({ error: c.error, problem: c.problem });
    if (b.to) {
      const to = userById(db(), b.to);
      if (!to || to.disabled_at || to.id === a.id) return reply.code(400).send({ error: 'invalid', problem: 'no such player to send it to' });
    }
    // which of one's own warbands it came from (for one's own list only)
    const from = b.warbandId ? warbandById(db(), b.warbandId.toLowerCase()) : undefined;
    const s = createShare(db(), {
      from: a.id, to: b.to ?? null, warbandId: from && from.owner_id === a.id ? from.id : null,
      name: typeof c.data.name === 'string' && c.data.name ? c.data.name : String(c.data.wb), wbType: String(c.data.wb), json: c.json,
    }, now());
    return reply.code(201).send({ id: s.id, code: s.code ? showCode(s.code) : null, expiresAt: s.expiresAt });
  });

  app.post('/api/v1/shares/peek', {
    config: { action: 'shares.create' },
    schema: body({ code: { type: 'string', maxLength: 20 } }, ['code']),
  }, async (req, reply) => {
    if (braked(req, reply)) return reply;
    const r = shareByCode(db(), (req.body as { code: string }).code, now());
    if (!r) {
      wrongCode(db(), req.actor!.id, req.ip, now());
      return reply.code(404).send({ error: 'unknown_share_code' });
    }
    return { name: r.name, wbType: r.wb_type, from: userById(db(), r.from_user)?.display_name ?? '', expiresAt: r.expires_at };
  });

  app.post('/api/v1/shares/redeem', {
    config: { action: 'shares.create' },
    schema: body({ code: { type: 'string', maxLength: 20 }, warbandId: { type: 'string', pattern: UUID } }, ['code', 'warbandId']),
  }, async (req, reply) => {
    if (braked(req, reply)) return reply;
    const b = req.body as { code: string; warbandId: string };
    const r = shareByCode(db(), b.code, now());
    if (!r) {
      wrongCode(db(), req.actor!.id, req.ip, now());
      return reply.code(404).send({ error: 'unknown_share_code' });
    }
    return taken(reply, r, req.actor!.id, b.warbandId.toLowerCase());
  });

  app.post('/api/v1/shares/:id/accept', {
    config: { action: 'share.answer' },
    schema: body({ warbandId: { type: 'string', pattern: UUID } }, ['warbandId']),
  }, async (req, reply) => {
    const r = target(req, reply, 'share.answer', (s) => s.to_user);
    if (!r) return reply;
    if (!isOpen(r, now())) return reply.code(409).send({ error: 'gone' });
    return taken(reply, r, req.actor!.id, (req.body as { warbandId: string }).warbandId.toLowerCase());
  });

  app.post('/api/v1/shares/:id/decline', { config: { action: 'share.answer' } }, async (req, reply) => {
    const r = target(req, reply, 'share.answer', (s) => s.to_user);
    if (!r) return reply;
    if (!isOpen(r, now())) return reply.code(409).send({ error: 'gone' });
    declineShare(db(), r, req.actor!.id, now());
    return { ok: true };
  });

  app.delete('/api/v1/shares/:id', { config: { action: 'share.revoke' } }, async (req, reply) => {
    const r = target(req, reply, 'share.revoke', (s) => s.from_user);
    if (!r) return reply;
    revokeShare(db(), r, req.actor!.id, now());
    return { ok: true };
  });
}

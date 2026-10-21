/* The Library (ADR 0023): GET the owner's entries (with `?since=seq` only what is newer), PUT one under the
   device's id, DELETE one. Every route works on the caller's own entries: what belongs to someone else does not
   exist here (404), the admin included. */
import type { FastifyInstance } from 'fastify';
import type { DB } from './db.ts';
import { checkItem, KINDS, listItems, ownerOf, putItem, removeItem, type Kind } from './library.ts';
import { can } from './policy.ts';

export interface LibraryDeps { db: DB | null; now: () => Date }

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export function registerLibraryRoutes(app: FastifyInstance, deps: LibraryDeps): void {
  const db = () => deps.db as DB;

  app.get('/api/v1/library', {
    config: { action: 'library.read' },
    schema: { querystring: { type: 'object', properties: { since: { type: 'integer', minimum: 0 } } } },
  }, async (req) => listItems(db(), req.actor!.id, (req.query as { since?: number }).since ?? 0));

  app.put('/api/v1/library/:id', {
    config: { action: 'library.write' },
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', pattern: UUID } } },
      body: {
        type: 'object', additionalProperties: false, required: ['kind', 'name', 'body'],
        properties: { kind: { type: 'string', enum: [...KINDS] }, name: { type: 'string', maxLength: 200 }, body: { type: 'object' }, baseSeq: { type: 'integer', minimum: 0 } },
      },
    },
  }, async (req, reply) => {
    const b = req.body as { kind: Kind; name: string; body: unknown; baseSeq?: number };
    const c = checkItem(b.kind, b.name, b.body);
    if (!c.ok) return reply.code(400).send({ error: 'invalid', problem: c.problem });
    const id = (req.params as { id: string }).id.toLowerCase();
    const r = putItem(db(), req.actor!.id, { id, kind: b.kind, name: c.name, body: c.body, ...(b.baseSeq !== undefined ? { baseSeq: b.baseSeq } : {}) }, deps.now());
    if (!r.ok) return reply.code(r.status).send(r.item ? { error: r.error, item: r.item } : { error: r.error });
    return reply.code(r.created ? 201 : 200).send({ item: r.item });
  });

  app.delete('/api/v1/library/:id', {
    config: { action: 'library.remove' },
    schema: { params: { type: 'object', properties: { id: { type: 'string', pattern: UUID } } } },
  }, async (req, reply) => {
    const id = (req.params as { id: string }).id.toLowerCase();
    // someone else's entry does not exist for the caller
    const owner = ownerOf(db(), id);
    if (!owner || !can(req.actor, 'library.remove', { ownerId: owner })) return reply.code(404).send({ error: 'not_found' });
    removeItem(db(), owner, id, deps.now());
    return { removed: true };
  });
}

/* Problem reports (phase 4c1; docs/architecture.md "Endpunkte"): anyone
   signed in sends one and reads their own; the admin reads and sorts all of
   them. What each may see is decided in bugs.ts. Every route names its
   action, `can()` decides before the handler runs. */
import type { FastifyInstance } from 'fastify';
import { bugByRef, listBugs, myBugs, oneBug, oneOfMine, patchBug, PatchBody, reportBug, ReportBody, STATUSES } from './bugs.ts';
import type { DB } from './db.ts';
import type { Notify } from './notify.ts';

export interface BugDeps { db: DB | null; now: () => Date; notify?: Notify | null }

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerBugRoutes(app: FastifyInstance, deps: BugDeps): void {
  const db = () => deps.db as DB;

  /** Sending a report; the same id with the same words again answers with the first one (200, not 201). */
  app.post('/api/v1/bugs', { config: { action: 'bugs.report' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a report') });
    const r = reportBug(db(), req.actor!.id, parsed.data, deps.now(), req.actor!.isAdmin);
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    // a message on Rob's phone: that there is one and its kind, never its words; not for the admin's own, and never in the report's way
    if (r.created && !req.actor!.isAdmin && deps.notify) {
      try { deps.notify({ title: 'Mordheim: new report', message: `A new ${parsed.data.kind} report is in.` }); } catch { /* the report is saved */ }
    }
    return reply.code(r.created ? 201 : 200).send({ bug: oneOfMine(r.bug) });
  });

  /** The reporter's own reports with their status. */
  app.get('/api/v1/bugs/mine', { config: { action: 'bugs.mine' } }, async (req) => ({ bugs: myBugs(db(), req.actor!.id) }));

  /** The admin's list: `?status=open` (default), `all`, or one status; `?limit=` up to 200. */
  app.get('/api/v1/bugs', { config: { action: 'bugs.read' } }, async (req, reply) => {
    const q = req.query as { status?: string; limit?: string };
    const status = q.status ?? 'open';
    if (status !== 'open' && status !== 'all' && !(STATUSES as readonly string[]).includes(status)) return reply.code(400).send({ error: 'invalid', problem: 'status is open, all or one status' });
    const n = q.limit === undefined ? 100 : Number(q.limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) return reply.code(400).send({ error: 'invalid', problem: 'limit is 1 to 200' });
    return { bugs: listBugs(db(), { status: status as 'open', limit: n }) };
  });

  /** One report, by its number ("7") or its id. */
  app.get('/api/v1/bugs/:id', { config: { action: 'bugs.read' } }, async (req, reply) => {
    const row = bugByRef(db(), (req.params as { id: string }).id);
    const bug = row ? oneBug(db(), row.id) : null;
    if (!bug) return reply.code(404).send({ error: 'not_found' });
    return { bug };
  });

  app.patch('/api/v1/bugs/:id', { config: { action: 'bugs.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const row = bugByRef(db(), (req.params as { id: string }).id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a change') });
    const r = patchBug(db(), row.id, parsed.data, req.actor!.id, deps.now(), req.actor!.token ? 'bug-token' : null);
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return { bug: r.bug };
  });
}

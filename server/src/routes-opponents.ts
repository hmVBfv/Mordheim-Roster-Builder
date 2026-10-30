/* Opponents (docs/architecture.md "Endpunkte"): groups of profiles and the
   campaign's own skills. Leaders' own: read and written by the campaign's
   leaders; the campaign's other members get a 403, an
   outsider a 404. Every route names its action, `can()` decides before the
   handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { GroupBody, listOpponents, putGroup, putSkill, removeOpponent, SkillBody } from './opponents.ts';
import { can, type Action } from './policy.ts';

export interface OpponentDeps { db: DB | null; now: () => Date }

const ID = { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' } as const;

export function registerOpponentRoutes(app: FastifyInstance, deps: OpponentDeps): void {
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
  const problem = (issues: { path: PropertyKey[]; message: string }[], what: string) =>
    ({ error: 'invalid', problem: `not ${what} (${issues.slice(0, 2).map((i) => `${i.path.map(String).join('.') || '(top)'}: ${i.message}`).join('; ')})` });

  app.get('/api/v1/campaigns/:id/opponents', { config: { action: 'opponents.read' } }, async (req, reply) => {
    const t = target(req, reply, 'opponents.read');
    if (!t) return reply;
    return listOpponents(db(), t.c.id);
  });

  app.put('/api/v1/campaigns/:id/opponents/groups/:gid', {
    config: { action: 'opponents.write' }, bodyLimit: 1_048_576,
    schema: { params: { type: 'object', properties: { id: { type: 'string' }, gid: ID }, required: ['id', 'gid'] }, body: { type: 'object' } },
  }, async (req, reply) => {
    const t = target(req, reply, 'opponents.write');
    if (!t) return reply;
    const parsed = GroupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(problem(parsed.error.issues, 'a group of opponents'));
    const r = putGroup(db(), t.c.id, (req.params as { gid: string }).gid.toLowerCase(), parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.current ? { current: r.current } : {}) });
    return { group: r.group };
  });

  app.delete('/api/v1/campaigns/:id/opponents/groups/:gid', {
    config: { action: 'opponents.write' },
    schema: { params: { type: 'object', properties: { id: { type: 'string' }, gid: ID }, required: ['id', 'gid'] } },
  }, async (req, reply) => {
    const t = target(req, reply, 'opponents.write');
    if (!t) return reply;
    const r = removeOpponent(db(), t.c.id, 'opponent_groups', (req.params as { gid: string }).gid.toLowerCase(), req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error });
    return { removed: true, seq: r.seq };
  });

  app.put('/api/v1/campaigns/:id/opponents/skills/:sid', {
    config: { action: 'opponents.write' },
    schema: { params: { type: 'object', properties: { id: { type: 'string' }, sid: ID }, required: ['id', 'sid'] }, body: { type: 'object' } },
  }, async (req, reply) => {
    const t = target(req, reply, 'opponents.write');
    if (!t) return reply;
    const parsed = SkillBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(problem(parsed.error.issues, 'a skill'));
    const r = putSkill(db(), t.c.id, (req.params as { sid: string }).sid.toLowerCase(), parsed.data, req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.current ? { current: r.current } : {}) });
    return { skill: r.skill };
  });

  app.delete('/api/v1/campaigns/:id/opponents/skills/:sid', {
    config: { action: 'opponents.write' },
    schema: { params: { type: 'object', properties: { id: { type: 'string' }, sid: ID }, required: ['id', 'sid'] } },
  }, async (req, reply) => {
    const t = target(req, reply, 'opponents.write');
    if (!t) return reply;
    const r = removeOpponent(db(), t.c.id, 'opponent_skills', (req.params as { sid: string }).sid.toLowerCase(), req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error });
    return { removed: true, seq: r.seq };
  });
}

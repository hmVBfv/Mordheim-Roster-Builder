/* Scenarios (phase 4b3c; docs/architecture.md "Endpunkte"): a leaders' own
   scenario, hidden until a leader releases it to a battle. Every member
   reads – what each sees is decided in scenarios.ts for the one who asks
   (ADR 0011); writing and releasing are for leaders.
   Every route names its action, `can()` decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action, type Actor } from './policy.ts';
import { listScenarios, oneScenario, putScenario, ReleaseBody, releaseScenario, removeScenario, ScenarioBody, scenariosSeq } from './scenarios.ts';

export interface ScenarioDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerScenarioRoutes(app: FastifyInstance, deps: ScenarioDeps): void {
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
  /** Leaders read the drafts too – with the authenticator, like everything a leader does. */
  const viewer = (a: Actor, role: CampaignRole) => ({ id: a.id, leader: can(a, 'campaign.manage', { role }) });
  const deviceId = (req: FastifyRequest, reply: FastifyReply): string | null => {
    const id = (req.params as { sid: string }).sid.toLowerCase();
    if (!UUID.test(id)) {
      void reply.code(400).send({ error: 'invalid', problem: 'a scenario is named by its device id' });
      return null;
    }
    return id;
  };

  app.get('/api/v1/campaigns/:id/scenarios', { config: { action: 'scenarios.read' } }, async (req, reply) => {
    const t = target(req, reply, 'scenarios.read');
    if (!t) return reply;
    const v = viewer(req.actor!, t.role);
    return { scenarios: listScenarios(db(), t.c.id, v), seq: scenariosSeq(db(), t.c.id, v) };
  });

  app.put('/api/v1/campaigns/:id/scenarios/:sid', { config: { action: 'scenarios.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'scenarios.write');
    if (!t) return reply;
    const sid = deviceId(req, reply);
    if (!sid) return reply;
    const parsed = ScenarioBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a scenario') });
    const r = putScenario(db(), t.c.id, sid, parsed.data, req.actor!.id, deps.now());
    const v = viewer(req.actor!, t.role);
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}), ...(r.error === 'stale' ? { current: oneScenario(db(), sid, v) } : {}) });
    return { scenario: oneScenario(db(), sid, v), seq: scenariosSeq(db(), t.c.id, v) };
  });

  app.post('/api/v1/campaigns/:id/scenarios/:sid/release', { config: { action: 'scenarios.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'scenarios.write');
    if (!t) return reply;
    const sid = deviceId(req, reply);
    if (!sid) return reply;
    const parsed = ReleaseBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a release') });
    const r = releaseScenario(db(), t.c.id, sid, parsed.data.battleId.toLowerCase(), req.actor!.id, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    const v = viewer(req.actor!, t.role);
    return { scenario: oneScenario(db(), sid, v), seq: scenariosSeq(db(), t.c.id, v) };
  });

  app.delete('/api/v1/campaigns/:id/scenarios/:sid', { config: { action: 'scenarios.write' } }, async (req, reply) => {
    const t = target(req, reply, 'scenarios.write');
    if (!t) return reply;
    const sid = deviceId(req, reply);
    if (!sid) return reply;
    const r = removeScenario(db(), t.c.id, sid, req.actor!.id, deps.now());
    if (r === 'unknown') return reply.code(404).send({ error: 'not_found' });
    if (r === 'released') return reply.code(409).send({ error: 'released' });
    return { removed: r === 'ok', seq: scenariosSeq(db(), t.c.id, viewer(req.actor!, t.role)) };
  });
}

/* Campaigns on the server (phase 4a; docs/architecture.md "Endpunkte"):
   starting one, its members and roles, entering warbands, and reading what
   the campaign shows its members. Every route names its action; the handler
   loads the campaign and asks can() with the actor's role in it – outside
   the campaign it does not exist (404), a member without the right gets a
   403. The admin has no special access (concept.md 3). */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { userById } from './accounts.ts';
import {
  campaignById, campaignView, confirmEnrolment, createCampaign, endEnrolment, enrol, enrolmentById, HouseRulesBody, listCampaigns, openEnrolment,
  removeMember, renameCampaign, roleIn, ROLES, setHouseRules, setMember, tagsOf, type CampaignRole, type CampaignRow,
} from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';
import { totalsOf } from './rules.ts';
import { advanceRound, changesOf } from './aftermath.ts';
import { battleById } from './battles.ts';
import { PastBattleBody, putPastBattle, removePastBattle } from './history.ts';
import { ACCOUNT_FULL, checkSave, draftOfUser, fitsAccount, metaOf, versionOf, warbandById, weightOf } from './warbands.ts';

export interface CampaignDeps { db: DB | null; now: () => Date }

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const body = (props: Record<string, unknown>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });
const NAME = { type: 'string', minLength: 1, maxLength: 80 } as const;

export function registerCampaignRoutes(app: FastifyInstance, deps: CampaignDeps): void {
  const db = () => deps.db as DB;
  const now = deps.now;

  /** The campaign the route names and the actor's role in it, if the actor may do `action` there; otherwise the refusal is sent. */
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
  const view = (c: CampaignRow, role: CampaignRole) => campaignView(db(), campaignById(db(), c.id) ?? c, role);
  const trimmed = (s: string) => s.trim().replace(/\s+/g, ' ');

  app.get('/api/v1/campaigns', { config: { action: 'campaigns.list' } }, async (req) => ({ campaigns: listCampaigns(db(), req.actor!.id) }));

  app.post('/api/v1/campaigns', { config: { action: 'campaigns.create' }, schema: body({ name: NAME }, ['name']) }, async (req, reply) => {
    const name = trimmed((req.body as { name: string }).name);
    if (!name) return reply.code(400).send({ error: 'invalid', problem: 'a campaign needs a name' });
    const c = createCampaign(db(), { name, by: req.actor!.id }, now());
    return reply.code(201).send(view(c, 'leader'));
  });

  app.get('/api/v1/campaigns/:id', { config: { action: 'campaign.read' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    return view(t.c, t.role);
  });

  app.patch('/api/v1/campaigns/:id', { config: { action: 'campaign.manage' }, schema: body({ name: NAME }, ['name']) }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const name = trimmed((req.body as { name: string }).name);
    if (!name) return reply.code(400).send({ error: 'invalid', problem: 'a campaign needs a name' });
    if (name !== t.c.name) renameCampaign(db(), t.c, name, req.actor!.id, now());
    return view(t.c, t.role);
  });

  /** The campaign's house rules (a leader): for every warband in it; a warband whose own differ is marked for everyone. */
  app.put('/api/v1/campaigns/:id/house-rules', { config: { action: 'campaign.manage' }, schema: body({ rules: { type: 'object' } }, ['rules']) }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const parsed = HouseRulesBody.safeParse((req.body as { rules: unknown }).rules);
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not house rules (${first})` });
    }
    setHouseRules(db(), t.c, parsed.data, req.actor!.id, now());
    return view(t.c, t.role);
  });

  app.put('/api/v1/campaigns/:id/members/:userId', {
    config: { action: 'campaign.manage' },
    schema: body({ role: { type: 'string', enum: [...ROLES] } }, ['role']),
  }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const u = userById(db(), (req.params as { userId: string }).userId);
    if (!u || u.disabled_at) return reply.code(400).send({ error: 'invalid', problem: 'no such player' });
    if (!setMember(db(), t.c.id, u.id, (req.body as { role: CampaignRole }).role, req.actor!.id, now())) return reply.code(409).send({ error: 'last_leader' });
    // a leader who stepped down sees the campaign as what they are now
    return view(t.c, roleIn(db(), t.c.id, req.actor!.id) ?? t.role);
  });

  app.delete('/api/v1/campaigns/:id/members/:userId', { config: { action: 'campaign.manage' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const userId = (req.params as { userId: string }).userId;
    if (!removeMember(db(), t.c.id, userId, req.actor!.id, now())) return reply.code(409).send({ error: 'last_leader' });
    const role = roleIn(db(), t.c.id, req.actor!.id);
    return role ? view(t.c, role) : { left: true };
  });

  app.post('/api/v1/campaigns/:id/enrolments', {
    config: { action: 'campaign.enrol' },
    schema: body({
      warbandId: { type: 'string', pattern: UUID }, data: { type: 'object' },
      copiedFrom: { type: 'object', additionalProperties: false, required: ['id', 'rev'], properties: { id: { type: 'string', pattern: UUID }, rev: { type: 'integer', minimum: 1 } } },
      appVersion: { type: 'string', maxLength: 64 },
    }, ['warbandId', 'data']),
  }, async (req, reply) => {
    const t = target(req, reply, 'campaign.enrol');
    if (!t) return reply;
    const a = req.actor!;
    const b = req.body as { warbandId: string; data: unknown; copiedFrom?: { id: string; rev: number }; appVersion?: string };
    const c = checkSave(b.data);
    if (!c.ok) return reply.code(c.status).send({ error: c.error, problem: c.problem });
    // its start is marked with totals the rules compute: they must be able to read it
    if (!totalsOf(c.data)) return reply.code(400).send({ error: 'invalid', problem: 'the rules cannot read this warband' });
    const id = b.warbandId.toLowerCase();
    if (warbandById(db(), id)) return reply.code(409).send({ error: 'exists' });
    if (!fitsAccount(db(), a.id, weightOf(c.json))) return reply.code(413).send(ACCOUNT_FULL);
    // the copy names its source only if that is one of the player's own
    const from = b.copiedFrom ? warbandById(db(), b.copiedFrom.id.toLowerCase()) : undefined;
    const copiedFrom = from && can(a, 'warband.read', { ownerId: from.owner_id }) && versionOf(db(), from.id, b.copiedFrom!.rev) ? { id: from.id, rev: b.copiedFrom!.rev } : null;
    const r = enrol(db(), { campaign: t.c, playerId: a.id, warbandId: id, data: c.data, json: c.json, copiedFrom, appVersion: b.appVersion ?? '' }, now());
    // a leader's own warband needs no one else's word
    if (can(a, 'campaign.manage', { role: t.role })) confirmEnrolment(db(), t.c, r.enrolment, a.id, now());
    return reply.code(201).send({ enrolmentId: r.enrolment.id, warband: metaOf(warbandById(db(), id)!), head: versionOf(db(), id, 1), campaign: view(t.c, t.role) });
  });

  /** An open enrolment of this campaign, named by the route. */
  const openOne = (req: FastifyRequest, reply: FastifyReply, c: CampaignRow) => {
    const e = enrolmentById(db(), (req.params as { eid: string }).eid);
    if (!e || e.campaign_id !== c.id || (e.status !== 'pending' && e.status !== 'active')) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    return e;
  };

  app.post('/api/v1/campaigns/:id/enrolments/:eid/confirm', { config: { action: 'campaign.manage' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const e = openOne(req, reply, t.c);
    if (!e) return reply;
    if (e.status === 'pending') {
      const done = confirmEnrolment(db(), t.c, e, req.actor!.id, now());
      if (!done.ok) return reply.code(409).send({ error: 'unreadable' });
    }
    return view(t.c, t.role);
  });

  app.post('/api/v1/campaigns/:id/enrolments/:eid/decline', { config: { action: 'campaign.manage' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const e = openOne(req, reply, t.c);
    if (!e) return reply;
    if (e.status !== 'pending') return reply.code(409).send({ error: 'confirmed' });
    endEnrolment(db(), e, 'declined', req.actor!.id, now());
    return view(t.c, t.role);
  });

  /** Withdrawing one's warband; a leader may take out anyone's. */
  app.delete('/api/v1/campaigns/:id/enrolments/:eid', { config: { action: 'campaign.enrol' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.enrol');
    if (!t) return reply;
    const e = openOne(req, reply, t.c);
    if (!e) return reply;
    if (e.player_id !== req.actor!.id && !can(req.actor, 'campaign.manage', { role: t.role })) return reply.code(403).send({ error: 'forbidden' });
    endEnrolment(db(), e, e.status === 'pending' && e.player_id !== req.actor!.id ? 'declined' : 'left', req.actor!.id, now());
    return view(t.c, t.role);
  });

  /** A warband entered in the campaign, as its members see it: the latest version, the player's work since (mechanics are open, ADR 0002), and its tags here. */
  app.get('/api/v1/campaigns/:id/warbands/:wid', { config: { action: 'campaign.warband.read' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.warband.read');
    if (!t) return reply;
    const e = openEnrolment(db(), t.c.id, (req.params as { wid: string }).wid);
    const w = e ? warbandById(db(), e.warband_id) : undefined;
    if (!e || !w) return reply.code(404).send({ error: 'not_found' });
    const draft = draftOfUser(db(), w.id, w.owner_id);
    return {
      // the warband it was copied from is its owner's own: nobody else learns its id (security review AUTHZ-5)
      warband: { ...metaOf(w), copiedFrom: w.owner_id === req.actor!.id ? metaOf(w).copiedFrom : null },
      player: { id: e.player_id, displayName: userById(db(), e.player_id)?.display_name ?? '' },
      status: e.status,
      head: versionOf(db(), w.id, w.head_rev),
      draft: draft && draft.baseRev === w.head_rev ? { data: draft.data, updatedAt: draft.updatedAt } : null,
      // each mark with what changed since the one before, frozen (phase 4a4)
      tags: tagsOf(db(), w.id, t.c.id).map((g) => ({ ...g, changes: changesOf(db(), g.id) })),
    };
  });

  /** A battle of the campaign's history (phase 4a5), recorded or corrected by a leader while the campaign has no battle of its own. */
  app.put('/api/v1/campaigns/:id/history/:bid', { config: { action: 'campaign.manage' }, schema: { params: { type: 'object', properties: { bid: { type: 'string', pattern: UUID } } }, body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const parsed = PastBattleBody.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: 'invalid', problem: `not a battle of the history (${first})` });
    }
    const r = putPastBattle(db(), t.c, (req.params as { bid: string }).bid.toLowerCase(), parsed.data, req.actor!.id, now());
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return view(t.c, t.role);
  });

  /** A battle taken out of the history again (a leader), while nothing refers to it. */
  app.delete('/api/v1/campaigns/:id/history/:bid', { config: { action: 'campaign.manage' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const b = battleById(db(), (req.params as { bid: string }).bid.toLowerCase());
    if (!b || b.campaign_id !== t.c.id) return reply.code(404).send({ error: 'not_found' });
    const r = removePastBattle(db(), t.c, b, req.actor!.id, now());
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return view(t.c, t.role);
  });

  /** The campaign moves on to the next round, once its battles are closed; who fought none sat it out. */
  app.post('/api/v1/campaigns/:id/rounds/advance', { config: { action: 'campaign.manage' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.manage');
    if (!t) return reply;
    const r = advanceRound(db(), t.c, req.actor!.id, now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, problem: r.problem });
    return view(t.c, t.role);
  });
}

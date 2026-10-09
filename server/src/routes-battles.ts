/* Battles of a campaign (phase 4a2; docs/architecture.md "Endpunkte"):
   setting one up, the protocol a leader writes at the table, and the
   players' corrections. Every member reads all of it (ADR 0002). Entries
   and corrections carry the device's id, so what was gathered offline and
   sent twice is there once (ADR 0010). Outside the campaign nothing of it
   exists (404); a member without the right gets a 403. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  battleById, battleView, checkEntry, createBattle, decideProposal, deleteEntry, listBattles, OUTCOMES, participantIds, ProposalPayload, proposalById,
  putEntry, putProposal, updateBattle, type BattleRow, type Outcome,
} from './battles.ts';
import { campaignById, openEnrolment, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { can, type Action } from './policy.ts';
import { gameData } from './rules.ts';
import { closeBattle, markAfterBattle, marksOf } from './aftermath.ts';
import { snapshot } from './backup.ts';
import { warbandById } from './warbands.ts';

export interface BattleDeps {
  db: DB | null; now: () => Date;
  /** Where the snapshot after each battle goes (docs/operations.md); null: none (some tests). */
  dataDir?: string | null;
  log?: { warn: (o: object, msg: string) => void };
}

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const id = { type: 'string', pattern: UUID } as const;
const body = (props: Record<string, unknown>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });
const TEXT = (max: number) => ({ type: 'string', maxLength: max }) as const;
const TURN = { type: 'integer', minimum: 1, maximum: 99 } as const;

export function registerBattleRoutes(app: FastifyInstance, deps: BattleDeps): void {
  const db = () => deps.db as DB;
  const now = deps.now;

  /** The campaign and, where the route names one, its battle – if the actor may do `action` there; otherwise the refusal is sent. */
  const target = (req: FastifyRequest, reply: FastifyReply, action: Action): { c: CampaignRow; role: CampaignRole; b: BattleRow | null } | null => {
    const params = req.params as { id: string; bid?: string };
    const c = campaignById(db(), params.id);
    const role = c ? roleIn(db(), c.id, req.actor!.id) : null;
    const b = c && params.bid ? battleById(db(), params.bid.toLowerCase()) : null;
    if (!c || !role || (params.bid && (!b || b.campaign_id !== c.id))) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    if (!can(req.actor, action, { role })) {
      void reply.code(403).send({ error: 'forbidden' });
      return null;
    }
    return { c, role, b: b ?? null };
  };
  const closed = (reply: FastifyReply) => reply.code(409).send({ error: 'closed' });
  /** Warbands entered and confirmed in the campaign, or the problem. */
  const fighters = (c: CampaignRow, ids: string[]): string[] | string => {
    const out = [...new Set(ids.map((x) => x.toLowerCase()))];
    if (!out.length) return 'a battle needs a warband that fought it';
    for (const w of out) if (openEnrolment(db(), c.id, w)?.status !== 'active') return 'only warbands entered and confirmed in the campaign fight its battles';
    return out;
  };
  const districtOk = (d: string | undefined) => !d || gameData().DISTRICTS.some((x) => x.id === d);
  /** The battle as members see it, with each warband's mark after it (phase 4a4). */
  const view = (b: BattleRow) => ({ ...battleView(db(), b), marks: marksOf(db(), b.id) });

  app.get('/api/v1/campaigns/:id/battles', { config: { action: 'campaign.read' } }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    return { battles: listBattles(db(), t.c.id) };
  });

  app.post('/api/v1/campaigns/:id/battles', {
    config: { action: 'battle.write' },
    schema: body({ id, round: { type: 'integer', minimum: 1, maximum: 999 }, title: TEXT(120), scenario: TEXT(120), district: TEXT(40), warbandIds: { type: 'array', items: id, maxItems: 16 } }, ['id', 'warbandIds']),
  }, async (req, reply) => {
    const t = target(req, reply, 'battle.write');
    if (!t) return reply;
    const b = req.body as { id: string; round?: number; title?: string; scenario?: string; district?: string; warbandIds: string[] };
    const bid = b.id.toLowerCase();
    const there = battleById(db(), bid);
    // the same battle sent twice (an answer lost on the way): it is there
    if (there) return there.campaign_id === t.c.id ? view(there) : reply.code(409).send({ error: 'exists' });
    const ws = fighters(t.c, b.warbandIds);
    if (typeof ws === 'string') return reply.code(400).send({ error: 'invalid', problem: ws });
    if (!districtOk(b.district)) return reply.code(400).send({ error: 'invalid', problem: 'no such district' });
    const made = createBattle(db(), {
      id: bid, campaignId: t.c.id, round: b.round ?? t.c.round + 1, title: (b.title ?? '').trim(), scenario: (b.scenario ?? '').trim(), district: b.district ?? '', warbandIds: ws, by: req.actor!.id,
    }, now());
    return reply.code(201).send(view(made));
  });

  app.get('/api/v1/campaigns/:id/battles/:bid', {
    config: { action: 'campaign.read' },
    schema: { querystring: { type: 'object', properties: { since: { type: 'integer', minimum: 0 } } } },
  }, async (req, reply) => {
    const t = target(req, reply, 'campaign.read');
    if (!t) return reply;
    const since = (req.query as { since?: number }).since;
    // a device that has seen this state learns only that nothing changed
    if (since !== undefined && since >= t.b!.seq) return { unchanged: true, seq: t.b!.seq };
    return view(t.b!);
  });

  app.patch('/api/v1/campaigns/:id/battles/:bid', {
    config: { action: 'battle.write' },
    schema: body({
      title: TEXT(120), scenario: TEXT(120), district: TEXT(40), turn: TURN, warbandIds: { type: 'array', items: id, maxItems: 16 },
      outcomes: { type: 'object', additionalProperties: { type: 'string', enum: [...OUTCOMES] }, maxProperties: 16 },
    }, []),
  }, async (req, reply) => {
    const t = target(req, reply, 'battle.write');
    if (!t) return reply;
    if (t.b!.status === 'closed') return closed(reply);
    const p = req.body as { title?: string; scenario?: string; district?: string; turn?: number; warbandIds?: string[]; outcomes?: Record<string, Outcome> };
    let warbandIds: string[] | undefined;
    if (p.warbandIds) {
      const ws = fighters(t.c, p.warbandIds);
      if (typeof ws === 'string') return reply.code(400).send({ error: 'invalid', problem: ws });
      warbandIds = ws;
    }
    const fought = new Set(warbandIds ?? participantIds(db(), t.b!.id));
    if (p.outcomes && Object.keys(p.outcomes).some((w) => !fought.has(w.toLowerCase()))) return reply.code(400).send({ error: 'invalid', problem: 'an outcome for a warband that did not fight' });
    if (!districtOk(p.district)) return reply.code(400).send({ error: 'invalid', problem: 'no such district' });
    updateBattle(db(), t.b!, {
      ...(p.title !== undefined ? { title: p.title.trim() } : {}), ...(p.scenario !== undefined ? { scenario: p.scenario.trim() } : {}),
      ...(p.district !== undefined ? { district: p.district } : {}), ...(p.turn !== undefined ? { turn: p.turn } : {}),
      ...(warbandIds ? { warbandIds } : {}),
      ...(p.outcomes ? { outcomes: Object.fromEntries(Object.entries(p.outcomes).map(([w, o]) => [w.toLowerCase(), o])) } : {}),
    }, req.actor!.id, now());
    return view(battleById(db(), t.b!.id)!);
  });

  app.put('/api/v1/campaigns/:id/battles/:bid/protocol/:eid', {
    config: { action: 'battle.write' },
    schema: body({ turn: TURN, kind: { type: 'string', enum: ['casualty', 'event'] }, payload: { type: 'object' } }, ['turn', 'kind', 'payload']),
  }, async (req, reply) => {
    const t = target(req, reply, 'battle.write');
    if (!t) return reply;
    const eid = (req.params as { eid: string }).eid.toLowerCase();
    if (!new RegExp(UUID).test(eid)) return reply.code(400).send({ error: 'invalid', problem: 'an entry is named by its device id' });
    if (t.b!.status === 'closed') return closed(reply);
    const e = req.body as { turn: number; kind: 'casualty' | 'event'; payload: unknown };
    const c = checkEntry(e.kind, e.payload, participantIds(db(), t.b!.id));
    if (!c.ok) return reply.code(400).send({ error: 'invalid', problem: c.problem });
    const r = putEntry(db(), t.b!, { id: eid, turn: e.turn, kind: e.kind, payload: c.payload, by: req.actor!.id }, now());
    if (!r.ok) return reply.code(409).send({ error: r.error === 'deleted' ? 'removed' : 'exists' });
    return { entry: r.entry, seq: battleById(db(), t.b!.id)!.seq };
  });

  app.delete('/api/v1/campaigns/:id/battles/:bid/protocol/:eid', { config: { action: 'battle.write' } }, async (req, reply) => {
    const t = target(req, reply, 'battle.write');
    if (!t) return reply;
    if (t.b!.status === 'closed') return closed(reply);
    const removed = deleteEntry(db(), t.b!, (req.params as { eid: string }).eid.toLowerCase(), req.actor!.id, now());
    return { removed, seq: battleById(db(), t.b!.id)!.seq };
  });

  app.put('/api/v1/campaigns/:id/battles/:bid/proposals/:pid', {
    config: { action: 'battle.propose' },
    schema: body({ entryId: { type: ['string', 'null'], pattern: UUID }, text: TEXT(1000), change: { type: 'object' } }, ['text']),
  }, async (req, reply) => {
    const t = target(req, reply, 'battle.propose');
    if (!t) return reply;
    const pid = (req.params as { pid: string }).pid.toLowerCase();
    if (!new RegExp(UUID).test(pid)) return reply.code(400).send({ error: 'invalid', problem: 'a proposal is named by its device id' });
    if (t.b!.status === 'closed') return closed(reply);
    const b = req.body as { entryId?: string | null; text: string; change?: unknown };
    const parsed = ProposalPayload.safeParse({ text: b.text, ...(b.change !== undefined ? { change: b.change } : {}) });
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: 'a correction needs its text' });
    if (parsed.data.change && !b.entryId) return reply.code(400).send({ error: 'invalid', problem: 'a change is for one entry' });
    if (parsed.data.change) {
      const c = checkEntry(parsed.data.change.kind, parsed.data.change.payload, participantIds(db(), t.b!.id));
      if (!c.ok) return reply.code(400).send({ error: 'invalid', problem: c.problem });
    }
    const r = putProposal(db(), t.b!, { id: pid, entryId: b.entryId?.toLowerCase() ?? null, payload: parsed.data, by: req.actor!.id }, now());
    if (!r.ok) return reply.code(r.error === 'no_entry' ? 400 : 409).send(r.error === 'no_entry' ? { error: 'invalid', problem: 'no such entry in this battle' } : { error: r.error === 'decided' ? 'decided' : 'exists' });
    return { ok: true, seq: battleById(db(), t.b!.id)!.seq };
  });

  /** Closing: the protocol is fixed, sealed notes open, and the database is snapshotted (data-model.md: after every battle). */
  app.post('/api/v1/campaigns/:id/battles/:bid/close', { config: { action: 'battle.write' } }, async (req, reply) => {
    const t = target(req, reply, 'battle.write');
    if (!t) return reply;
    if (t.b!.status === 'closed') return view(t.b!);
    closeBattle(db(), t.b!, req.actor!.id, now());
    if (deps.dataDir) {
      try {
        snapshot(db(), deps.dataDir, `battle-${t.b!.round}`, now);
      } catch (e) {
        // the battle is closed either way; the nightly snapshot follows
        deps.log?.warn({ event: 'snapshot_failed', battle: t.b!.id, err: String(e) }, 'snapshot after the battle failed');
      }
    }
    return view(battleById(db(), t.b!.id)!);
  });

  /** Marking one's warband "after battle N" (concept.md 4.2): its player, once the battle is closed. */
  app.post('/api/v1/campaigns/:id/battles/:bid/marks', {
    config: { action: 'battle.mark' },
    schema: body({ warbandId: id, rev: { type: 'integer', minimum: 1 } }, ['warbandId', 'rev']),
  }, async (req, reply) => {
    const t = target(req, reply, 'battle.mark');
    if (!t) return reply;
    const b = req.body as { warbandId: string; rev: number };
    const w = warbandById(db(), b.warbandId.toLowerCase());
    if (!w || w.owner_id !== req.actor!.id) return reply.code(403).send({ error: 'forbidden' });
    const r = markAfterBattle(db(), t.c, t.b!, w.id, b.rev, req.actor!.id, now());
    if (!r.ok) return reply.code(r.status).send(r.problem ? { error: r.error, problem: r.problem } : { error: r.error });
    return { tag: r.tag, changes: r.changes };
  });

  for (const verdict of ['accept', 'reject'] as const) {
    app.post(`/api/v1/campaigns/:id/battles/:bid/proposals/:pid/${verdict}`, { config: { action: 'battle.write' } }, async (req, reply) => {
      const t = target(req, reply, 'battle.write');
      if (!t) return reply;
      const p = proposalById(db(), (req.params as { pid: string }).pid.toLowerCase());
      if (!p || p.battle_id !== t.b!.id) return reply.code(404).send({ error: 'not_found' });
      if (t.b!.status === 'closed') return closed(reply);
      const r = decideProposal(db(), t.b!, p, verdict === 'accept', req.actor!.id, now());
      if (!r.ok) return reply.code(r.error === 'decided' ? 409 : 400).send(r.error === 'decided' ? { error: 'decided' } : { error: 'invalid', problem: r.problem });
      return view(battleById(db(), t.b!.id)!);
    });
  }
}

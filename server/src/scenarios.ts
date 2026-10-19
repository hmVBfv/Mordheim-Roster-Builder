/* Scenarios in the database (phase 4b3c; concept.md 4.9, ADR 0002, ADR 0011):
   a leaders' own scenario – rules and the values of the NPCs in it – hidden
   until it is played. A draft is read by the campaign's leaders (with the
   authenticator) alone; for everyone else it does not exist, not even as a
   line, and its removal moves nobody else's number. A leader releases it by
   assigning it to a battle of the campaign; from then on every member reads
   it, and that is not undone. Released, it may still be corrected – the
   earlier wording is kept – but not taken out. The log carries ids, never
   the words. Filtered on the server only. */
import { HIDABLE, normalizeHidden, redactNpc, releasedChangeProblem, revealedBy, type ScenarioNpc } from '@mordheim/core';
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';
import { NpcProfileBody } from './opponents.ts';

const iso = (d: Date) => d.toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** More than a campaign needs; a ceiling against a runaway client. */
export const MAX_SCENARIOS = 200;
export const MAX_REVISIONS = 50;
export const MAX_BODY = 20_000;
export const MAX_STATLINES = 10_000;
export const MAX_NPCS = 30;

/** An NPC of the scenario: the values of an NPC (the world's shape), a name of its own, and the parts hidden from the players. */
export const ScenarioNpcBody = z.object({
  ...NpcProfileBody.shape,
  id: z.string().regex(UUID),
  name: z.string().trim().min(1).max(120),
  hidden: z.array(z.enum(HIDABLE)).max(HIDABLE.length).default([]),
}).strict();

export const ScenarioBody = z.object({
  title: z.string().trim().min(1).max(200),
  /** The rules of the scenario. */
  body: z.string().max(MAX_BODY).default(''),
  /** The values of the NPCs in it, in the text form of the TTS export. */
  npcStatlines: z.string().max(MAX_STATLINES).default(''),
  /** The NPCs of it, with the parts hidden from the players (ADR 0022). */
  npcs: z.array(ScenarioNpcBody).max(MAX_NPCS).default([]).refine((l) => new Set(l.map((n) => n.id.toLowerCase())).size === l.length, { message: 'an NPC twice' }),
  /** The `seq` the device edited from; 0 for a new scenario. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type ScenarioInput = z.infer<typeof ScenarioBody>;

export const ReleaseBody = z.object({ battleId: z.string().regex(UUID) }).strict();
export type ReleaseInput = z.infer<typeof ReleaseBody>;

interface Row {
  id: string; campaign_id: string; title: string; body: string; npc_statlines: string; npcs: string; visibility: 'leader' | 'public'; played_in_battle: string | null;
  released_at: string | null; released_by: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number;
}

export interface Scenario {
  id: string; title: string; body: string; npcStatlines: string; npcs: ScenarioNpc[]; visibility: 'leader' | 'public'; playedInBattle: string | null;
  releasedAt: string | null; releasedBy: string | null; edited: boolean; createdAt: string; updatedAt: string; seq: number;
}

export interface Viewer { id: string; leader: boolean }

export const scenarioById = (db: DB, id: string) => db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id) as Row | undefined;

const SELECT = `SELECT s.*, r.display_name AS released_by_name, (SELECT count(*) FROM scenario_revisions v WHERE v.scenario_id = s.id) AS revisions
  FROM scenarios s LEFT JOIN users r ON r.id = s.released_by`;
type Joined = Row & { released_by_name: string | null; revisions: number };

const npcsOf = (s: Row) => JSON.parse(s.npcs) as ScenarioNpc[];

/** A scenario as the one who asks may see it: a draft only a leader sees; the NPCs of a played one with every hidden part a "?" for everyone who is not a leader (ADR 0022). */
function shown(s: Joined, v: Viewer): Scenario | null {
  if (s.deleted_at) return null;
  if (s.visibility === 'leader' && !v.leader) return null;
  return {
    id: s.id, title: s.title, body: s.body, npcStatlines: s.npc_statlines, npcs: v.leader ? npcsOf(s) : npcsOf(s).map(redactNpc), visibility: s.visibility, playedInBattle: s.played_in_battle,
    releasedAt: s.released_at, releasedBy: s.released_by_name, edited: s.revisions > 0, createdAt: s.created_at, updatedAt: s.updated_at, seq: s.seq,
  };
}

/** The scenarios the viewer may see: drafts first (leaders), then the released ones, the latest released first. */
export function listScenarios(db: DB, campaignId: string, v: Viewer): Scenario[] {
  const rows = db.prepare(`${SELECT} WHERE s.campaign_id = ? AND s.deleted_at IS NULL AND (? = 1 OR s.visibility = 'public')`).all(campaignId, v.leader ? 1 : 0) as Joined[];
  const out = rows.map((s) => shown(s, v)).filter((s): s is Scenario => s !== null);
  const drafts = out.filter((s) => s.visibility === 'leader').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.seq - a.seq);
  const played = out.filter((s) => s.visibility === 'public').sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '') || b.seq - a.seq);
  return [...drafts, ...played];
}

export function oneScenario(db: DB, id: string, v: Viewer): Scenario | null {
  const s = db.prepare(`${SELECT} WHERE s.id = ?`).get(id) as Joined | undefined;
  return s ? shown(s, v) : null;
}

/** The newest change among the scenarios this viewer may see: a leader's number moves with every draft, a removal included; everybody else's only with the released ones. */
export const scenariosSeq = (db: DB, campaignId: string, v: Viewer) => (db.prepare(
  "SELECT coalesce(max(seq), 0) AS n FROM scenarios WHERE campaign_id = ? AND (? = 1 OR visibility = 'public')",
).get(campaignId, v.leader ? 1 : 0) as { n: number }).n;

const snapshotOf = (s: Row) => JSON.stringify({ title: s.title, body: s.body, npcStatlines: s.npc_statlines, npcs: npcsOf(s) });

function keepRevision(db: DB, s: Row, by: string, now: Date): void {
  db.prepare('INSERT INTO scenario_revisions (scenario_id, snapshot, edited_by, edited_at) VALUES (?, ?, ?, ?)').run(s.id, snapshotOf(s), by, iso(now));
  db.prepare('DELETE FROM scenario_revisions WHERE scenario_id = ? AND rowid NOT IN (SELECT rowid FROM scenario_revisions WHERE scenario_id = ? ORDER BY rowid DESC LIMIT ?)')
    .run(s.id, s.id, MAX_REVISIONS);
}

/** What a leader may have seen of a scenario earlier: its wordings, newest first. For the checks of the tests and the backups – the app shows only that it was edited. */
export function revisionsOf(db: DB, id: string): { title: string; body: string; npcStatlines: string; npcs: ScenarioNpc[]; editedAt: string }[] {
  return (db.prepare('SELECT snapshot, edited_at FROM scenario_revisions WHERE scenario_id = ? ORDER BY rowid DESC').all(id) as { snapshot: string; edited_at: string }[])
    .map((r) => ({ npcs: [], ...(JSON.parse(r.snapshot) as { title: string; body: string; npcStatlines: string; npcs?: ScenarioNpc[] }), editedAt: r.edited_at }));
}

export type Put =
  | { ok: true; row: Row }
  | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };

/** Writes a scenario under the device's id: made as a draft, changed after (also once released) – the earlier wording kept. Another leader's change in between: 409 `stale`; a change of what was hidden after the release: 409 `frozen`. */
export function putScenario(db: DB, campaignId: string, id: string, input: ScenarioInput, by: string, now: Date): Put {
  // the ids as written in lower case, the hidden parts once each in the order of the form: what is stored and compared
  const npcs = JSON.stringify(input.npcs.map((n) => ({ ...n, id: n.id.toLowerCase(), hidden: normalizeHidden(n.hidden) })));
  return db.transaction((): Put => {
    const cur = scenarioById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (!cur) {
      const n = (db.prepare('SELECT count(*) AS n FROM scenarios WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (n >= MAX_SCENARIOS) return { ok: false, status: 409, error: 'full', problem: `a campaign holds at most ${MAX_SCENARIOS} scenarios` };
      const seq = audit(db, { actorId: by, action: 'scenario.create', targetType: 'scenario', targetId: id, campaignId, visibility: 'leader' }, now);
      db.prepare(`INSERT INTO scenarios (id, campaign_id, title, body, npc_statlines, npcs, visibility, created_by, updated_by, created_at, updated_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, 'leader', ?, ?, ?, ?, ?)`).run(id, campaignId, input.title, input.body, input.npcStatlines, npcs, by, by, iso(now), iso(now), seq);
      return { ok: true, row: scenarioById(db, id)! };
    }
    if (cur.title === input.title && cur.body === input.body && cur.npc_statlines === input.npcStatlines && cur.npcs === npcs) return { ok: true, row: cur };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale' };
    // once the players have read it, what was hidden may be revealed – never changed (ADR 0022)
    const before = npcsOf(cur), after = JSON.parse(npcs) as ScenarioNpc[];
    if (cur.visibility === 'public') {
      const frozen = releasedChangeProblem(before, after);
      if (frozen) return { ok: false, status: 409, error: 'frozen', problem: frozen };
    }
    keepRevision(db, cur, by, now);
    // a reveal is logged as where it happened (which NPC, which parts), never as the value
    if (cur.visibility === 'public') {
      for (const r of revealedBy(before, after)) audit(db, { actorId: by, action: 'scenario.reveal', targetType: 'scenario', targetId: id, campaignId, visibility: 'public', payload: { npc: r.npc, parts: r.parts } }, now);
    }
    const seq = audit(db, { actorId: by, action: 'scenario.edit', targetType: 'scenario', targetId: id, campaignId, visibility: cur.visibility }, now);
    db.prepare('UPDATE scenarios SET title = ?, body = ?, npc_statlines = ?, npcs = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.title, input.body, input.npcStatlines, npcs, by, iso(now), seq, id);
    return { ok: true, row: scenarioById(db, id)! };
  })();
}

/** Releases a scenario by assigning it to a battle of the campaign: every member reads it from then on, and that is not undone. Sent twice for the same battle, released once. */
export function releaseScenario(db: DB, campaignId: string, id: string, battleId: string, by: string, now: Date): Put {
  return db.transaction((): Put => {
    const cur = scenarioById(db, id);
    if (!cur || cur.campaign_id !== campaignId || cur.deleted_at) return { ok: false, status: 404, error: 'not_found' };
    const battle = battleById(db, battleId);
    if (!battle || battle.campaign_id !== campaignId) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    if (cur.visibility === 'public') return cur.played_in_battle === battleId ? { ok: true, row: cur } : { ok: false, status: 409, error: 'released' };
    const seq = audit(db, { actorId: by, action: 'scenario.release', targetType: 'scenario', targetId: id, campaignId, visibility: 'public', payload: { battle: battleId } }, now);
    db.prepare("UPDATE scenarios SET visibility = 'public', played_in_battle = ?, released_at = ?, released_by = ?, updated_at = ?, seq = ? WHERE id = ?").run(battleId, iso(now), by, iso(now), seq, id);
    return { ok: true, row: scenarioById(db, id)! };
  })();
}

/** Takes a draft out (a tombstone; its earlier wordings stay). A released scenario is part of the story and stays. */
export function removeScenario(db: DB, campaignId: string, id: string, by: string, now: Date): 'ok' | 'gone' | 'unknown' | 'released' {
  return db.transaction(() => {
    const cur = scenarioById(db, id);
    if (!cur || cur.campaign_id !== campaignId) return 'unknown';
    if (cur.deleted_at) return 'gone';
    if (cur.visibility === 'public') return 'released';
    keepRevision(db, cur, by, now);
    const seq = audit(db, { actorId: by, action: 'scenario.remove', targetType: 'scenario', targetId: id, campaignId, visibility: 'leader' }, now);
    db.prepare('UPDATE scenarios SET deleted_at = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), by, iso(now), seq, id);
    return 'ok';
  })();
}

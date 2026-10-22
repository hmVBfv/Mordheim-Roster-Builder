/* Battles in the database (phase 4a2; concept.md 4.5, ADR 0010): a battle
   of a campaign with the warbands that fought it, its protocol – written by
   a leader only – and the players' corrections of it. Plain functions;
   who may is asked in the routes. Every change takes a seq from the audit
   log (visibility public: mechanics are open, ADR 0002) and gives it to
   the battle, so a device that has seen the battle asks only for news. */
import { existsSync, rmSync } from 'node:fs';
import { z } from 'zod';
import { audit } from './accounts.ts';
import { fileOf, type AttachmentRow } from './attachments.ts';
import type { DB } from './db.ts';
import { gameData } from './rules.ts';

export const OUTCOMES = ['', 'victory', 'defeat', 'draw', 'routed'] as const;
export type Outcome = (typeof OUTCOMES)[number];

const iso = (d: Date) => d.toISOString();

export interface BattleRow {
  id: string; campaign_id: string; round: number; title: string; scenario_id: string; district: string; played_at: string | null;
  status: 'open' | 'closed'; turn: number; result: string; created_by: string; created_at: string; updated_at: string; closed_at: string | null; seq: number;
  /** Phase 4a5: 1 for a battle of the history (before the app), recorded afterwards. */
  taken_over: number;
}
interface EntryRow { id: string; battle_id: string; turn: number; kind: 'casualty' | 'event'; payload: string; author_id: string; created_at: string; updated_at: string; status: string; deleted_at: string | null }
export interface ProposalRow {
  id: string; campaign_id: string; battle_id: string; target_type: 'battle' | 'protocol_entry'; target_id: string; author_id: string;
  payload: string; status: 'open' | 'accepted' | 'rejected'; decided_by: string | null; decided_at: string | null; created_at: string;
}

/* ---- what a protocol entry and a proposal may say ---- */

/** One side of a casualty: a warrior of a warband that fought (uid, and for a henchman the man), one of its Fallen, someone outside the roster, or the surroundings. */
const Side = z.object({
  warbandId: z.string().max(64).optional(),
  uid: z.number().int().nonnegative().nullable().optional(),
  idx: z.number().int().nonnegative().optional(),
  fallenIdx: z.number().int().nonnegative().optional(),
  name: z.string().trim().min(1).max(120),
  grade: z.enum(['hero', 'hench']).optional(),
  wb: z.string().max(40).optional(),
  env: z.literal(true).optional(),
}).strict();
export const CasualtyPayload = z.object({ victim: Side, attacker: Side.nullable(), note: z.string().max(500).default('') }).strict();
export const EventPayload = z.object({ text: z.string().trim().min(1).max(1000) }).strict();
export type CasualtyPayloadT = z.infer<typeof CasualtyPayload>;

export const ProposalPayload = z.object({
  text: z.string().trim().min(1).max(1000),
  /** The entry as it should read, for an entry; accepting applies it. */
  change: z.object({ turn: z.number().int().min(1).max(99).optional(), kind: z.enum(['casualty', 'event']), payload: z.unknown() }).strict().optional(),
}).strict();

export function checkEntry(kind: 'casualty' | 'event', payload: unknown, participants: string[]): { ok: true; payload: unknown } | { ok: false; problem: string } {
  const r = kind === 'casualty' ? CasualtyPayload.safeParse(payload) : EventPayload.safeParse(payload);
  if (!r.success) return { ok: false, problem: `not a ${kind} (${r.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})` };
  if (kind === 'casualty') {
    const c = r.data as CasualtyPayloadT;
    for (const s of [c.victim, c.attacker]) if (s?.warbandId && !participants.includes(s.warbandId)) return { ok: false, problem: 'a warband named there did not fight this battle' };
  }
  return { ok: true, payload: r.data };
}

/* ---- what leaves the server ---- */

/** `warbandIds`: who fought; `marked`: whose warband is marked after it (phase 4a4); `takenOver`: a battle of the history, played before the app,
    and `playedAt` the day it was played (phase 4a5; for a battle of the app, when it was set up). */
export interface BattleSummary {
  id: string; round: number; title: string; status: 'open' | 'closed'; turn: number; warbands: string[]; warbandIds: string[]; marked: string[];
  /** whose version for this battle is confirmed (before it was fought) */
  confirmed: string[]; createdAt: string; closedAt: string | null;
  takenOver: boolean; playedAt: string | null;
}
/** `revBefore`: the version that goes in – confirmed when `confirmedAt` is set, otherwise only the head when the battle was set up; `beforeTotals` are frozen with the confirmation; `headRev`: the warband's newest version now. */
export interface Participant {
  warbandId: string; name: string; wbType: string; wbName: string; playerId: string; player: string; outcome: Outcome; revBefore: number | null;
  confirmedAt: string | null; confirmedBy: string | null; beforeTotals: unknown; headRev: number;
}
export interface Entry { id: string; turn: number; kind: 'casualty' | 'event'; payload: unknown; author: string; createdAt: string; updatedAt: string }
export interface Proposal { id: string; targetType: 'battle' | 'protocol_entry'; targetId: string; authorId: string; author: string; payload: unknown; status: 'open' | 'accepted' | 'rejected'; decidedBy: string | null; createdAt: string }
export interface BattleView {
  battle: {
    id: string; campaignId: string; round: number; title: string; scenario: string; district: string; status: 'open' | 'closed'; turn: number; createdAt: string; updatedAt: string; closedAt: string | null;
    takenOver: boolean; playedAt: string | null;
  };
  seq: number;
  participants: Participant[];
  entries: Entry[];
  proposals: Proposal[];
}

/* ---- reading ---- */

export const battleById = (db: DB, id: string) => db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as BattleRow | undefined;
export const proposalById = (db: DB, id: string) => db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as ProposalRow | undefined;
const entryById = (db: DB, id: string) => db.prepare('SELECT * FROM protocol_entries WHERE id = ?').get(id) as EntryRow | undefined;

export const participantIds = (db: DB, battleId: string) => (db.prepare('SELECT warband_id FROM battle_participants WHERE battle_id = ?').all(battleId) as { warband_id: string }[]).map((r) => r.warband_id);

export function listBattles(db: DB, campaignId: string): BattleSummary[] {
  const rows = db.prepare('SELECT * FROM battles WHERE campaign_id = ? ORDER BY round, created_at').all(campaignId) as BattleRow[];
  const names = db.prepare('SELECT w.id, w.name FROM battle_participants p JOIN warbands w ON w.id = p.warband_id WHERE p.battle_id = ? ORDER BY w.name COLLATE NOCASE');
  const marked = db.prepare("SELECT warband_id FROM tags WHERE battle_id = ? AND kind = 'after_battle' AND superseded_by IS NULL ORDER BY created_at");
  const confirmed = db.prepare('SELECT warband_id FROM battle_participants WHERE battle_id = ? AND before_confirmed_at IS NOT NULL ORDER BY warband_id');
  return rows.map((b) => {
    const ws = names.all(b.id) as { id: string; name: string }[];
    return {
      id: b.id, round: b.round, title: b.title, status: b.status, turn: b.turn, warbands: ws.map((r) => r.name), warbandIds: ws.map((r) => r.id),
      marked: (marked.all(b.id) as { warband_id: string }[]).map((r) => r.warband_id),
      confirmed: (confirmed.all(b.id) as { warband_id: string }[]).map((r) => r.warband_id), createdAt: b.created_at, closedAt: b.closed_at,
      takenOver: !!b.taken_over, playedAt: b.played_at,
    };
  });
}

export function battleView(db: DB, b: BattleRow): BattleView {
  const participants = (db.prepare(`SELECT p.*, w.name, w.wb_type, w.owner_id, w.head_rev, u.display_name, c.display_name AS confirmer FROM battle_participants p
    JOIN warbands w ON w.id = p.warband_id JOIN users u ON u.id = w.owner_id LEFT JOIN users c ON c.id = p.before_confirmed_by
    WHERE p.battle_id = ? ORDER BY w.name COLLATE NOCASE`).all(b.id) as
    { warband_id: string; rev_before: number | null; outcome: Outcome; name: string; wb_type: string; owner_id: string; display_name: string;
      head_rev: number; before_confirmed_at: string | null; confirmer: string | null; before_totals: string | null }[])
    .map((p) => ({
      warbandId: p.warband_id, name: p.name, wbType: p.wb_type, wbName: gameData().WARBANDS[p.wb_type]?.name ?? p.wb_type, playerId: p.owner_id, player: p.display_name,
      outcome: p.outcome, revBefore: p.rev_before, confirmedAt: p.before_confirmed_at, confirmedBy: p.confirmer,
      beforeTotals: p.before_totals ? (JSON.parse(p.before_totals) as unknown) : null, headRev: p.head_rev,
    }));
  const entries = (db.prepare(`SELECT e.*, u.display_name AS author FROM protocol_entries e JOIN users u ON u.id = e.author_id
    WHERE e.battle_id = ? AND e.deleted_at IS NULL ORDER BY e.turn, e.created_at`).all(b.id) as (EntryRow & { author: string })[])
    .map((e) => ({ id: e.id, turn: e.turn, kind: e.kind, payload: JSON.parse(e.payload) as unknown, author: e.author, createdAt: e.created_at, updatedAt: e.updated_at }));
  const proposals = (db.prepare(`SELECT p.*, u.display_name AS author, d.display_name AS decider FROM proposals p JOIN users u ON u.id = p.author_id
    LEFT JOIN users d ON d.id = p.decided_by WHERE p.battle_id = ? ORDER BY p.created_at`).all(b.id) as (ProposalRow & { author: string; decider: string | null })[])
    .map((p) => ({ id: p.id, targetType: p.target_type, targetId: p.target_id, authorId: p.author_id, author: p.author, payload: JSON.parse(p.payload) as unknown, status: p.status, decidedBy: p.decider, createdAt: p.created_at }));
  return {
    battle: { id: b.id, campaignId: b.campaign_id, round: b.round, title: b.title, scenario: b.scenario_id, district: b.district, status: b.status, turn: b.turn, createdAt: b.created_at, updatedAt: b.updated_at, closedAt: b.closed_at, takenOver: !!b.taken_over, playedAt: b.played_at },
    seq: b.seq, participants, entries, proposals,
  };
}

/* ---- writing; each in one transaction, each with its audit entry ---- */

const log = (db: DB, actorId: string, action: string, b: { id: string; campaign_id: string }, payload: unknown, now: Date) => {
  const seq = audit(db, { actorId, action, targetType: 'battle', targetId: b.id, campaignId: b.campaign_id, visibility: 'public', payload }, now);
  db.prepare('UPDATE battles SET seq = ?, updated_at = ? WHERE id = ?').run(seq, iso(now), b.id);
  return seq;
};

export interface NewBattle { id: string; campaignId: string; round: number; title: string; scenario: string; district: string; warbandIds: string[]; by: string }

export function createBattle(db: DB, n: NewBattle, now: Date): BattleRow {
  return db.transaction(() => {
    db.prepare(`INSERT INTO battles (id, campaign_id, round, title, scenario_id, district, played_at, created_by, created_at, updated_at, seq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(n.id, n.campaignId, n.round, n.title, n.scenario, n.district, iso(now), n.by, iso(now), iso(now));
    setParticipants(db, n.id, n.warbandIds);
    log(db, n.by, 'battle.create', { id: n.id, campaign_id: n.campaignId }, { round: n.round, title: n.title, warbands: n.warbandIds }, now);
    db.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').run(iso(now), n.campaignId);
    return battleById(db, n.id)!;
  })();
}

export type RemovedBattle = { ok: true } | { ok: false; status: 409; error: 'closed' | 'history' | 'in_use' | 'waits'; problem: string };

/** Where a battle's own blocks of the story are placed: the segment is `b<id>:before`, `b<id>:course` … */
const SEGMENT_OF = (battleId: string) => `b${battleId}:%`;


/** What a leader may have taken out together with the battle (`withContent`): see {@link purgeBattleContent}. */
export interface RemoveOptions { withContent?: boolean; uploadDir?: string | null }

/**
 * The leader's hard removal (Rob, 22.10.2026, reports #34 and #35): a battle that was not finished and is
 * taken out was never played, so what was written for it was never written. Its notes, pictures, questions,
 * background entries and reputation events go with it, whoever wrote them and however they were shared:
 * the rows stay as tombstones (the devices that have them hear that they are gone) but their words, earlier
 * wordings and picture bytes do not. The log records who, and how many – never what they said. Scenarios
 * released for it are only let go of; the blocks of the timeline placed on it are removed.
 * Returns the pictures whose files are to be deleted once the transaction is through.
 */
export function purgeBattleContent(db: DB, b: BattleRow, by: string, now: Date): AttachmentRow[] {
  const at = iso(now);
  const tomb = (table: string, id: string, vis: 'public' | 'sealed' | 'leader', scrub: string): void => {
    const seq = audit(db, { actorId: by, action: `battle.purge_${table}`, targetType: table, targetId: id, campaignId: b.campaign_id, visibility: vis, payload: { battle: b.id } }, now);
    db.prepare(`UPDATE ${table} SET ${scrub}, seq = ? WHERE id = ?`).run(seq, id);
  };
  for (const n of db.prepare('SELECT id, visibility FROM notes WHERE battle_id = ? AND deleted_at IS NULL').all(b.id) as { id: string; visibility: 'public' | 'sealed' | 'leader' }[]) {
    tomb('notes', n.id, n.visibility, `text = '', mentions = '[]', deleted_at = '${at}'`);
  }
  // earlier wordings go too, also of notes taken out before
  db.prepare("UPDATE notes SET text = '', mentions = '[]' WHERE battle_id = ? AND deleted_at IS NOT NULL").run(b.id);
  db.prepare('DELETE FROM note_revisions WHERE note_id IN (SELECT id FROM notes WHERE battle_id = ?)').run(b.id);
  const files = db.prepare('SELECT * FROM attachments WHERE battle_id = ? AND deleted_at IS NULL').all(b.id) as AttachmentRow[];
  for (const a of files) tomb('attachments', a.id, a.visibility as 'public' | 'leader', `caption = '', deleted_at = '${at}'`);
  db.prepare("UPDATE attachments SET caption = '' WHERE battle_id = ?").run(b.id);
  for (const q of db.prepare("SELECT id FROM questions WHERE battle_id = ? AND status != 'withdrawn'").all(b.id) as { id: string }[]) {
    tomb('questions', q.id, 'leader', `text = '', status = 'withdrawn'`);
  }
  db.prepare("UPDATE questions SET text = '' WHERE battle_id = ?").run(b.id);
  for (const e of db.prepare('SELECT id FROM background_entries WHERE battle_id = ? AND deleted_at IS NULL').all(b.id) as { id: string }[]) {
    tomb('background_entries', e.id, 'leader', `deleted_at = '${at}'`);
  }
  // the words of every entry of the battle, also of one taken out before
  db.prepare("UPDATE background_entries SET title = '', truth = '', players_know = '', hint_limits = '', refs = '[]' WHERE battle_id = ?").run(b.id);
  db.prepare('DELETE FROM background_revisions WHERE entry_id IN (SELECT id FROM background_entries WHERE battle_id = ?)').run(b.id);
  for (const r of db.prepare('SELECT id FROM reputation_events WHERE battle_id = ? AND deleted_at IS NULL').all(b.id) as { id: string }[]) {
    tomb('reputation_events', r.id, 'public', `deleted_at = '${at}'`);
  }
  db.prepare("UPDATE reputation_events SET reason = '' WHERE battle_id = ?").run(b.id);
  db.prepare('DELETE FROM timeline_positions WHERE campaign_id = ? AND segment LIKE ?').run(b.campaign_id, SEGMENT_OF(b.id));
  db.prepare('UPDATE scenarios SET played_in_battle = NULL WHERE played_in_battle = ?').run(b.id);
  return files;
}


/** Something that waits for the battle: a note sealed until it, or an entry revealed from it, would stay sealed for good or be shown at once. */
export function waitsFor(db: DB, b: BattleRow): boolean {
  return !!db.prepare(`
    SELECT 1 FROM notes WHERE sealed_until_battle = ? AND battle_id IS NOT ?
    UNION ALL SELECT 1 FROM background_entries WHERE reveal_from_battle = ? AND deleted_at IS NULL
    LIMIT 1`).get(b.id, b.id, b.id);
}
export const WAITS: { error: 'waits'; problem: string } = { error: 'waits', problem: 'a note stays sealed until, or a background entry is revealed from, this battle: change those first' };

/** What was taken out itself keeps its row (a grave) but lets go of the battle, so the battle row can go. */
export function letGoOfBattle(db: DB, b: BattleRow): void {
  for (const table of ['notes', 'attachments', 'questions', 'background_entries', 'reputation_events', 'background_reveals', 'scenarios']) {
    const col = table === 'scenarios' ? 'played_in_battle' : 'battle_id';
    db.prepare(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = ?`).run(b.id);
  }
  // (only notes taken out are left here, see `waitsFor`: they stay hidden, as leader's)
  db.prepare("UPDATE notes SET visibility = 'leader', sealed_until_battle = NULL WHERE sealed_until_battle = ?").run(b.id);
  db.prepare('UPDATE background_entries SET reveal_from_battle = NULL WHERE reveal_from_battle = ?').run(b.id);
}

/** Deletes the bytes of pictures that were purged (after the transaction: a file cannot be rolled back). */
export function dropFiles(uploadDir: string | null | undefined, files: AttachmentRow[]): void {
  if (!uploadDir) return;
  // the rows are gone already: a file that cannot be removed must not turn the answer into an error
  for (const a of files) { try { const f = fileOf(uploadDir, a); if (existsSync(f)) rmSync(f, { force: true }); } catch { /* left for the sweep of orphans */ } }
}

/**
 * Takes an open battle out (a battle made by mistake): its protocol, corrections and fighters go with it.
 * While something of the campaign hangs on it – a note, a picture, a question, a background entry, a
 * reputation event, a released scenario or a block of the timeline – it stays; what was taken out itself
 * lets go of it. The warbands' versions are not touched. The id stays used (`removed_battles`).
 */
export function removeOpenBattle(db: DB, b: BattleRow, by: string, now: Date, opts: RemoveOptions = {}): RemovedBattle {
  let files: AttachmentRow[] = [];
  const r = db.transaction((): RemovedBattle => {
    if (b.taken_over) return { ok: false, status: 409, error: 'history', problem: 'a battle of the history is taken out of the history' };
    if (b.status !== 'open') return { ok: false, status: 409, error: 'closed', problem: 'a closed battle stays: it is part of the story and of the marks' };
    if (waitsFor(db, b)) return { ok: false, status: 409, ...WAITS };
    if (opts.withContent) files = purgeBattleContent(db, b, by, now);
    const live = db.prepare(`
      SELECT 1 FROM notes WHERE battle_id = ? AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM attachments WHERE battle_id = ? AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM questions WHERE battle_id = ? AND status != 'withdrawn'
      UNION ALL SELECT 1 FROM background_entries WHERE battle_id = ? AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM reputation_events WHERE battle_id = ? AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM scenarios WHERE played_in_battle = ? AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM timeline_positions WHERE campaign_id = ? AND segment LIKE ?
      LIMIT 1`).get(b.id, b.id, b.id, b.id, b.id, b.id, b.campaign_id, SEGMENT_OF(b.id));
    if (live) return { ok: false, status: 409, error: 'in_use', problem: 'notes, pictures or other things of the campaign belong to this battle' };
    letGoOfBattle(db, b);
    db.prepare('DELETE FROM proposals WHERE battle_id = ?').run(b.id);
    db.prepare('DELETE FROM protocol_entries WHERE battle_id = ?').run(b.id);
    db.prepare('DELETE FROM battle_participants WHERE battle_id = ?').run(b.id);
    db.prepare('DELETE FROM battles WHERE id = ?').run(b.id);
    db.prepare('INSERT INTO removed_battles (id, campaign_id, removed_by, removed_at) VALUES (?, ?, ?, ?)').run(b.id, b.campaign_id, by, iso(now));
    audit(db, { actorId: by, action: 'battle.remove', targetType: 'battle', targetId: b.id, campaignId: b.campaign_id, visibility: 'public', payload: { round: b.round, title: b.title } }, now);
    db.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').run(iso(now), b.campaign_id);
    return { ok: true };
  })();
  if (r.ok) dropFiles(opts.uploadDir, files);
  return r;
}

/** Whether a battle with this id was taken out: it is not made a second time. */
export const wasRemoved = (db: DB, battleId: string): boolean => !!db.prepare('SELECT 1 FROM removed_battles WHERE id = ?').get(battleId);

/** The warbands that fought: new ones start from their latest version; outcomes of those staying are kept. */
function setParticipants(db: DB, battleId: string, warbandIds: string[]): void {
  const keep = new Set(warbandIds);
  for (const id of participantIds(db, battleId)) if (!keep.has(id)) db.prepare('DELETE FROM battle_participants WHERE battle_id = ? AND warband_id = ?').run(battleId, id);
  for (const id of warbandIds) {
    db.prepare(`INSERT INTO battle_participants (battle_id, warband_id, rev_before) VALUES (?, ?, (SELECT head_rev FROM warbands WHERE id = ?))
      ON CONFLICT (battle_id, warband_id) DO NOTHING`).run(battleId, id, id);
  }
}

export interface BattlePatch { title?: string; scenario?: string; district?: string; turn?: number; warbandIds?: string[]; outcomes?: Record<string, Outcome> }

export function updateBattle(db: DB, b: BattleRow, p: BattlePatch, by: string, now: Date): void {
  db.transaction(() => {
    const set = (col: string, v: unknown) => db.prepare(`UPDATE battles SET ${col} = ? WHERE id = ?`).run(v, b.id);
    if (p.title !== undefined) set('title', p.title);
    if (p.scenario !== undefined) set('scenario_id', p.scenario);
    if (p.district !== undefined) set('district', p.district);
    if (p.turn !== undefined) set('turn', p.turn);
    if (p.warbandIds) setParticipants(db, b.id, p.warbandIds);
    for (const [w, o] of Object.entries(p.outcomes ?? {})) db.prepare('UPDATE battle_participants SET outcome = ? WHERE battle_id = ? AND warband_id = ?').run(o, b.id, w);
    log(db, by, p.turn !== undefined && Object.keys(p).length === 1 ? 'battle.turn' : 'battle.update', b, p, now);
  })();
}

export type PutEntry = { ok: true; entry: Entry } | { ok: false; error: 'elsewhere' | 'deleted' };

/** Writes an entry under the device's id: made the first time, corrected after. */
export function putEntry(db: DB, b: BattleRow, e: { id: string; turn: number; kind: 'casualty' | 'event'; payload: unknown; by: string }, now: Date): PutEntry {
  return db.transaction((): PutEntry => {
    const cur = entryById(db, e.id);
    if (cur && cur.battle_id !== b.id) return { ok: false, error: 'elsewhere' };
    if (cur?.deleted_at) return { ok: false, error: 'deleted' };
    const json = JSON.stringify(e.payload);
    if (!cur) {
      db.prepare('INSERT INTO protocol_entries (id, battle_id, turn, kind, payload, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(e.id, b.id, e.turn, e.kind, json, e.by, iso(now), iso(now));
      log(db, e.by, 'protocol.add', b, { entry: e.id, kind: e.kind, turn: e.turn }, now);
    } else if (cur.turn !== e.turn || cur.kind !== e.kind || cur.payload !== json) {
      db.prepare('UPDATE protocol_entries SET turn = ?, kind = ?, payload = ?, updated_at = ? WHERE id = ?').run(e.turn, e.kind, json, iso(now), e.id);
      log(db, e.by, 'protocol.correct', b, { entry: e.id, before: { turn: cur.turn, kind: cur.kind, payload: JSON.parse(cur.payload) as unknown } }, now);
    }
    return { ok: true, entry: battleView(db, battleById(db, b.id)!).entries.find((x) => x.id === e.id)! };
  })();
}

/** Takes an entry out; true when there was one to take out. */
export function deleteEntry(db: DB, b: BattleRow, id: string, by: string, now: Date): boolean {
  return db.transaction(() => {
    const cur = entryById(db, id);
    if (!cur || cur.battle_id !== b.id || cur.deleted_at) return false;
    db.prepare('UPDATE protocol_entries SET deleted_at = ? WHERE id = ?').run(iso(now), id);
    log(db, by, 'protocol.remove', b, { entry: id }, now);
    return true;
  })();
}

export type PutProposal = { ok: true } | { ok: false; error: 'elsewhere' | 'decided' | 'no_entry' };

/** A correction under the device's id; its author may reword it while it is open. */
export function putProposal(db: DB, b: BattleRow, p: { id: string; entryId: string | null; payload: unknown; by: string }, now: Date): PutProposal {
  return db.transaction((): PutProposal => {
    const cur = proposalById(db, p.id);
    if (cur && (cur.battle_id !== b.id || cur.author_id !== p.by)) return { ok: false, error: 'elsewhere' };
    if (cur && cur.status !== 'open') return { ok: false, error: 'decided' };
    if (p.entryId) {
      const e = entryById(db, p.entryId);
      if (!e || e.battle_id !== b.id || e.deleted_at) return { ok: false, error: 'no_entry' };
    }
    const json = JSON.stringify(p.payload);
    if (cur) {
      if (cur.payload === json) return { ok: true };
      db.prepare('UPDATE proposals SET payload = ? WHERE id = ?').run(json, p.id);
    } else {
      db.prepare('INSERT INTO proposals (id, campaign_id, battle_id, target_type, target_id, author_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, b.campaign_id, b.id, p.entryId ? 'protocol_entry' : 'battle', p.entryId ?? b.id, p.by, json, iso(now));
    }
    log(db, p.by, cur ? 'proposal.reword' : 'proposal.create', b, { proposal: p.id }, now);
    return { ok: true };
  })();
}

export type Decided = { ok: true } | { ok: false; error: 'decided' | 'invalid'; problem?: string };

/** A leader decides; accepting a proposal with a change corrects its entry. */
export function decideProposal(db: DB, b: BattleRow, p: ProposalRow, accept: boolean, by: string, now: Date): Decided {
  return db.transaction((): Decided => {
    if (p.status !== 'open') return { ok: false, error: 'decided' };
    const payload = JSON.parse(p.payload) as { change?: { turn?: number; kind: 'casualty' | 'event'; payload: unknown } };
    if (accept && payload.change && p.target_type === 'protocol_entry') {
      const e = entryById(db, p.target_id);
      const c = checkEntry(payload.change.kind, payload.change.payload, participantIds(db, b.id));
      if (!c.ok) return { ok: false, error: 'invalid', problem: c.problem };
      if (e && !e.deleted_at) {
        const r = putEntry(db, b, { id: e.id, turn: payload.change.turn ?? e.turn, kind: payload.change.kind, payload: c.payload, by }, now);
        if (!r.ok) return { ok: false, error: 'invalid', problem: 'the entry is gone' };
      }
    }
    db.prepare('UPDATE proposals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?').run(accept ? 'accepted' : 'rejected', by, iso(now), p.id);
    log(db, by, accept ? 'proposal.accept' : 'proposal.reject', b, { proposal: p.id }, now);
    return { ok: true };
  })();
}

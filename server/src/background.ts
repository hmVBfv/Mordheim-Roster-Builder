/* The background in the database (phase 4b1; concept.md 4.8, ADR 0002,
   ADR 0011): the leaders' side of the story – threads with the truth behind
   them and how much of it the story may show, people, places, planned
   scenarios, notes for the game master. Only the campaign's leaders (with
   the authenticator) read or write it; nothing of it is sent to a player,
   a viewer or an admin outside the campaign, and the log never carries a
   word of it – only that something changed (visibility "leader").

   The one way out is a reveal: the leader writes a public note, it is placed
   in the story, and the entry's level is raised. Only what the leader writes
   there becomes public; the truth stays where it is. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';
import { putNote } from './notes.ts';
import { checkPlace, moveBlock } from './timeline.ts';

const iso = (d: Date) => d.toISOString();

export const KINDS = ['thread', 'figure', 'place', 'scenario', 'gm_note'] as const;
export const STATUSES = ['planned', 'active', 'resolved'] as const;
export const LEVELS = ['hidden', 'hint', 'revealed'] as const;
export type Level = (typeof LEVELS)[number];
/** More than a campaign needs; a ceiling against a runaway client. */
export const MAX_ENTRIES = 500;
export const MAX_REVISIONS = 50;
export const MAX_TEXT = 20_000;

const Ref = z.object({
  kind: z.enum(['battle', 'entry', 'warrior', 'note', 'text']),
  id: z.string().max(64).default(''),
  label: z.string().trim().min(1).max(120),
}).strict();
export type BackgroundRef = z.infer<typeof Ref>;

export const EntryBody = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(1).max(200),
  truth: z.string().max(MAX_TEXT).default(''),
  playersKnow: z.string().max(MAX_TEXT).default(''),
  status: z.enum(STATUSES).default('planned'),
  reveal: z.enum(LEVELS).default('hidden'),
  hintLimits: z.string().max(1000).default(''),
  revealFromBattle: z.string().max(64).nullable().default(null),
  refs: z.array(Ref).max(30).default([]),
  battleId: z.string().max(64).nullable().default(null),
  /** The `seq` of the entry the device edited from; 0 for a new entry. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type EntryInput = z.infer<typeof EntryBody>;

export const RevealBody = z.object({
  /** The public note's id, from the device: sent twice, revealed once. */
  noteId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  text: z.string().trim().min(1).max(MAX_TEXT),
  lang: z.enum(['', 'de', 'en']).default(''),
  battleId: z.string().max(64).nullable().default(null),
  place: z.object({ segment: z.string().max(64), pos: z.string().max(64) }).strict().nullable().default(null),
  level: z.enum(['hint', 'revealed']),
}).strict();
export type RevealInput = z.infer<typeof RevealBody>;

interface EntryRow {
  id: string; campaign_id: string; kind: (typeof KINDS)[number]; title: string; truth: string; players_know: string; status: (typeof STATUSES)[number];
  reveal: Level; hint_limits: string; reveal_from_battle: string | null; refs: string; battle_id: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number;
}

export interface LastReveal { by: string; at: string; noteId: string; battleId: string | null; level: 'hint' | 'revealed' }
export interface BackgroundEntry {
  id: string; kind: (typeof KINDS)[number]; title: string; truth: string; playersKnow: string; status: (typeof STATUSES)[number]; reveal: Level;
  hintLimits: string; revealFromBattle: string | null; refs: BackgroundRef[]; battleId: string | null;
  updatedBy: string; createdAt: string; updatedAt: string; seq: number; lastReveal: LastReveal | null;
}
export interface Revision { snapshot: Record<string, unknown>; editedBy: string; editedAt: string }

export const entryById = (db: DB, id: string) => db.prepare('SELECT * FROM background_entries WHERE id = ?').get(id) as EntryRow | undefined;

const SELECT = `SELECT e.*, u.display_name AS updater FROM background_entries e JOIN users u ON u.id = e.updated_by`;

function lastReveal(db: DB, entryId: string): LastReveal | null {
  const r = db.prepare(`SELECT r.note_id, r.battle_id, r.level, r.revealed_at, u.display_name AS who FROM background_reveals r JOIN users u ON u.id = r.revealed_by
    WHERE r.entry_id = ? ORDER BY r.revealed_at DESC, r.rowid DESC LIMIT 1`).get(entryId) as { note_id: string; battle_id: string | null; level: 'hint' | 'revealed'; revealed_at: string; who: string } | undefined;
  return r ? { by: r.who, at: r.revealed_at, noteId: r.note_id, battleId: r.battle_id, level: r.level } : null;
}

function viewOf(db: DB, r: EntryRow & { updater: string }): BackgroundEntry {
  return {
    id: r.id, kind: r.kind, title: r.title, truth: r.truth, playersKnow: r.players_know, status: r.status, reveal: r.reveal, hintLimits: r.hint_limits,
    revealFromBattle: r.reveal_from_battle, refs: JSON.parse(r.refs) as BackgroundRef[], battleId: r.battle_id,
    updatedBy: r.updater, createdAt: r.created_at, updatedAt: r.updated_at, seq: r.seq, lastReveal: lastReveal(db, r.id),
  };
}

/** The campaign's entries, newest change first; a taken-out one is not listed. */
export function listEntries(db: DB, campaignId: string): BackgroundEntry[] {
  return (db.prepare(`${SELECT} WHERE e.campaign_id = ? AND e.deleted_at IS NULL ORDER BY e.updated_at DESC, e.rowid DESC`).all(campaignId) as (EntryRow & { updater: string })[])
    .map((r) => viewOf(db, r));
}

export function oneEntry(db: DB, id: string): BackgroundEntry | null {
  const r = db.prepare(`${SELECT} WHERE e.id = ? AND e.deleted_at IS NULL`).get(id) as (EntryRow & { updater: string }) | undefined;
  return r ? viewOf(db, r) : null;
}

/** The newest change of the campaign's background, a taken-out entry included (its removal moves the number). */
export const backgroundSeq = (db: DB, campaignId: string) =>
  (db.prepare('SELECT coalesce(max(seq), 0) AS n FROM background_entries WHERE campaign_id = ?').get(campaignId) as { n: number }).n;

export function revisionsOf(db: DB, entryId: string): Revision[] {
  return (db.prepare(`SELECT r.snapshot, r.edited_at, u.display_name AS who FROM background_revisions r JOIN users u ON u.id = r.edited_by
    WHERE r.entry_id = ? ORDER BY r.rowid DESC`).all(entryId) as { snapshot: string; edited_at: string; who: string }[])
    .map((r) => ({ snapshot: JSON.parse(r.snapshot) as Record<string, unknown>, editedBy: r.who, editedAt: r.edited_at }));
}

export function revealsOf(db: DB, entryId: string) {
  return (db.prepare(`SELECT r.note_id, r.battle_id, r.level, r.revealed_at, u.display_name AS who FROM background_reveals r JOIN users u ON u.id = r.revealed_by
    WHERE r.entry_id = ? ORDER BY r.revealed_at DESC, r.rowid DESC`).all(entryId) as { note_id: string; battle_id: string | null; level: string; revealed_at: string; who: string }[])
    .map((r) => ({ noteId: r.note_id, battleId: r.battle_id, level: r.level, at: r.revealed_at, by: r.who }));
}

/** What an entry said before a change. */
const snapshotOf = (r: EntryRow) => JSON.stringify({
  kind: r.kind, title: r.title, truth: r.truth, playersKnow: r.players_know, status: r.status, reveal: r.reveal, hintLimits: r.hint_limits,
  revealFromBattle: r.reveal_from_battle, refs: JSON.parse(r.refs) as unknown, battleId: r.battle_id,
});

function keepRevision(db: DB, r: EntryRow, by: string, now: Date): void {
  db.prepare('INSERT INTO background_revisions (entry_id, snapshot, edited_by, edited_at) VALUES (?, ?, ?, ?)').run(r.id, snapshotOf(r), by, iso(now));
  db.prepare(`DELETE FROM background_revisions WHERE entry_id = ? AND rowid NOT IN (SELECT rowid FROM background_revisions WHERE entry_id = ? ORDER BY rowid DESC LIMIT ?)`)
    .run(r.id, r.id, MAX_REVISIONS);
}

const inCampaign = (db: DB, campaignId: string, battleId: string | null) => battleId === null || battleById(db, battleId)?.campaign_id === campaignId;

export type PutEntry =
  | { ok: true; entry: BackgroundEntry }
  | { ok: false; status: 400 | 409; error: string; problem?: string; current?: BackgroundEntry };

/** Writes an entry under the device's id: made the first time, changed after – the earlier wording kept. Another leader's change in between: 409 `stale`. */
export function putEntry(db: DB, campaignId: string, id: string, input: EntryInput, by: string, now: Date): PutEntry {
  return db.transaction((): PutEntry => {
    const cur = entryById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (!inCampaign(db, campaignId, input.battleId) || !inCampaign(db, campaignId, input.revealFromBattle)) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    const refs = JSON.stringify(input.refs);
    if (!cur) {
      const n = (db.prepare('SELECT count(*) AS n FROM background_entries WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (n >= MAX_ENTRIES) return { ok: false, status: 409, error: 'full', problem: `a campaign's background holds at most ${MAX_ENTRIES} entries` };
      const seq = audit(db, { actorId: by, action: 'background.create', targetType: 'background', targetId: id, campaignId, visibility: 'leader', payload: { kind: input.kind } }, now);
      db.prepare(`INSERT INTO background_entries (id, campaign_id, kind, title, truth, players_know, status, reveal, hint_limits, reveal_from_battle, refs, battle_id, created_by, updated_by, created_at, updated_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, campaignId, input.kind, input.title, input.truth, input.playersKnow, input.status, input.reveal, input.hintLimits, input.reveal === 'revealed' ? input.revealFromBattle : null, refs, input.battleId, by, by, iso(now), iso(now), seq);
      return { ok: true, entry: oneEntry(db, id)! };
    }
    const from = input.reveal === 'revealed' ? input.revealFromBattle : null;
    const same = cur.kind === input.kind && cur.title === input.title && cur.truth === input.truth && cur.players_know === input.playersKnow && cur.status === input.status
      && cur.reveal === input.reveal && cur.hint_limits === input.hintLimits && cur.reveal_from_battle === from && cur.refs === refs && cur.battle_id === input.battleId;
    if (same) return { ok: true, entry: oneEntry(db, id)! };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: oneEntry(db, id)! };
    keepRevision(db, cur, by, now);
    const seq = audit(db, { actorId: by, action: 'background.edit', targetType: 'background', targetId: id, campaignId, visibility: 'leader', payload: { kind: input.kind } }, now);
    db.prepare(`UPDATE background_entries SET kind = ?, title = ?, truth = ?, players_know = ?, status = ?, reveal = ?, hint_limits = ?, reveal_from_battle = ?, refs = ?, battle_id = ?,
      updated_by = ?, updated_at = ?, seq = ? WHERE id = ?`)
      .run(input.kind, input.title, input.truth, input.playersKnow, input.status, input.reveal, input.hintLimits, from, refs, input.battleId, by, iso(now), seq, id);
    return { ok: true, entry: oneEntry(db, id)! };
  })();
}

/** Takes an entry out (a tombstone; its earlier wordings stay). */
export function removeEntry(db: DB, campaignId: string, id: string, by: string, now: Date): boolean {
  return db.transaction(() => {
    const cur = entryById(db, id);
    if (!cur || cur.campaign_id !== campaignId || cur.deleted_at) return false;
    keepRevision(db, cur, by, now);
    const seq = audit(db, { actorId: by, action: 'background.remove', targetType: 'background', targetId: id, campaignId, visibility: 'leader', payload: { kind: cur.kind } }, now);
    db.prepare('UPDATE background_entries SET deleted_at = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), by, iso(now), seq, id);
    return true;
  })();
}

export type Revealed =
  | { ok: true; entry: BackgroundEntry; noteId: string }
  | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };

/** Reveals to everyone: the words the leader wrote become a public note, placed in the story; the entry's level is raised and what the players know grows by those words. The truth is not touched. Sent twice, revealed once. */
export function revealEntry(db: DB, campaignId: string, id: string, input: RevealInput, by: string, now: Date): Revealed {
  return db.transaction((): Revealed => {
    const cur = entryById(db, id);
    if (!cur || cur.campaign_id !== campaignId || cur.deleted_at) return { ok: false, status: 404, error: 'not_found' };
    const done = db.prepare('SELECT entry_id FROM background_reveals WHERE note_id = ?').get(input.noteId) as { entry_id: string } | undefined;
    if (done) return done.entry_id === id ? { ok: true, entry: oneEntry(db, id)!, noteId: input.noteId } : { ok: false, status: 409, error: 'exists' };
    if (!inCampaign(db, campaignId, input.battleId)) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    if (input.place) {
      const bad = checkPlace(db, campaignId, input.place);
      if (bad) return { ok: false, status: 400, error: 'invalid', problem: bad };
    }
    const note = putNote(db, campaignId, input.noteId, { battleId: input.battleId, turn: null, kind: 'general', text: input.text, lang: input.lang, visibility: 'public', mentions: [], protocolEntryId: null }, { id: by, leader: true }, now);
    if (!note.ok) return { ok: false, status: note.status === 403 ? 409 : note.status, error: note.error, ...(note.problem ? { problem: note.problem } : {}) };
    if (input.place) {
      const moved = moveBlock(db, campaignId, 'note', input.noteId, input.place, { id: by, leader: true }, now);
      if (!moved.ok) throw new Error(`reveal: the placed note could not be moved (${moved.error})`);
    }
    keepRevision(db, cur, by, now);
    const know = cur.players_know ? `${cur.players_know}\n\n${input.text}` : input.text;
    const seq = audit(db, { actorId: by, action: 'background.reveal', targetType: 'background', targetId: id, campaignId, visibility: 'leader', payload: { kind: cur.kind, level: input.level, note: input.noteId } }, now);
    db.prepare(`UPDATE background_entries SET players_know = ?, reveal = ?, reveal_from_battle = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?`)
      .run(know.length > MAX_TEXT ? input.text : know, input.level, input.level === 'revealed' ? input.battleId : null, by, iso(now), seq, id);
    db.prepare('INSERT INTO background_reveals (note_id, entry_id, battle_id, level, revealed_by, revealed_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.noteId, id, input.battleId, input.level, by, iso(now));
    return { ok: true, entry: oneEntry(db, id)!, noteId: input.noteId };
  })();
}

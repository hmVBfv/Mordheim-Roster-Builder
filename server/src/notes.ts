/* Notes in the database (phase 4a3; concept.md 4.6, ADR 0010, ADR 0011):
   one author each, written by everybody at the same time, with the
   device's id. What a note shows is decided here, for the one who asks:
   a sealed note is the author's alone – for everyone else, the leader and
   the admin included, a placeholder without its words – until the battle
   it is sealed for is closed; a leader's note never reaches a player at
   all. Filtered on the server only. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';

export const KINDS = ['general', 'scene', 'quote', 'dice', 'hook'] as const;
export const VISIBILITIES = ['public', 'sealed', 'leader'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

const iso = (d: Date) => d.toISOString();

const Mention = z.object({ warbandId: z.string().max(64), uid: z.number().int().nonnegative(), name: z.string().trim().min(1).max(120) }).strict();
/** docs/security.md: a note is at most 20 KB. */
export const NoteBody = z.object({
  battleId: z.string().max(64).nullable().default(null),
  turn: z.number().int().min(1).max(99).nullable().default(null),
  kind: z.enum(KINDS).default('general'),
  text: z.string().trim().min(1).max(20_000),
  lang: z.enum(['', 'de', 'en']).default(''),
  visibility: z.enum(VISIBILITIES).default('public'),
  mentions: z.array(Mention).max(20).default([]),
  protocolEntryId: z.string().max(64).nullable().default(null),
}).strict();
export type NoteInput = z.infer<typeof NoteBody>;

export interface NoteRow {
  id: string; campaign_id: string; battle_id: string | null; turn: number | null; author_id: string; kind: string; text: string; lang: string;
  visibility: Visibility; sealed_until_battle: string | null; mentions: string; protocol_entry_id: string | null;
  created_at: string; updated_at: string; deleted_at: string | null; seq: number;
}

/** A note as the one who asks may see it. A sealed one not yet open carries no words, no kind, no names – for anyone but its author. */
export type Note =
  | { id: string; battleId: string | null; turn: number | null; authorId: string; author: string; kind: string; text: string; lang: string; visibility: Visibility; sealedUntil: string | null; opened: boolean; mentions: unknown; protocolEntryId: string | null; createdAt: string; updatedAt: string; edited: boolean }
  | { id: string; battleId: string | null; authorId: string; author: string; visibility: 'sealed'; sealedUntil: string; sealed: true; createdAt: string };

export interface Viewer { id: string; leader: boolean }

export const noteById = (db: DB, id: string) => db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined;

/** Sealed, and the battle it waits for is not closed yet. */
function stillSealed(db: DB, n: NoteRow): boolean {
  if (n.visibility !== 'sealed' || !n.sealed_until_battle) return false;
  return battleById(db, n.sealed_until_battle)?.status !== 'closed';
}

export function noteFor(db: DB, n: NoteRow & { author: string; revisions: number }, v: Viewer): Note | null {
  if (n.deleted_at) return null;
  if (n.visibility === 'leader' && !v.leader && n.author_id !== v.id) return null;
  if (stillSealed(db, n) && n.author_id !== v.id) {
    return { id: n.id, battleId: n.battle_id, authorId: n.author_id, author: n.author, visibility: 'sealed', sealedUntil: n.sealed_until_battle!, sealed: true, createdAt: n.created_at };
  }
  return {
    id: n.id, battleId: n.battle_id, turn: n.turn, authorId: n.author_id, author: n.author, kind: n.kind, text: n.text, lang: n.lang, visibility: n.visibility,
    sealedUntil: n.sealed_until_battle, opened: n.visibility === 'sealed' && !stillSealed(db, n), mentions: JSON.parse(n.mentions) as unknown, protocolEntryId: n.protocol_entry_id,
    createdAt: n.created_at, updatedAt: n.updated_at, edited: n.revisions > 0,
  };
}

const SELECT = `SELECT n.*, u.display_name AS author, (SELECT count(*) FROM note_revisions r WHERE r.note_id = n.id) AS revisions
  FROM notes n JOIN users u ON u.id = n.author_id`;

/** Every note of the campaign the viewer may see (placeholders for sealed ones), in the order they were written. */
export function listNotes(db: DB, campaignId: string, v: Viewer): Note[] {
  const rows = db.prepare(`${SELECT} WHERE n.campaign_id = ? AND n.deleted_at IS NULL ORDER BY n.created_at`).all(campaignId) as (NoteRow & { author: string; revisions: number })[];
  return rows.map((n) => noteFor(db, n, v)).filter((n): n is Note => n !== null);
}

export function oneNote(db: DB, id: string, v: Viewer): Note | null {
  const n = db.prepare(`${SELECT} WHERE n.id = ?`).get(id) as (NoteRow & { author: string; revisions: number }) | undefined;
  return n ? noteFor(db, n, v) : null;
}

/** The newest change to any note of the campaign. */
/** The newest change among the notes this viewer may see (a placeholder counts): a leaders' note moves nothing for a player (security review AUTHZ-3). */
export const notesSeq = (db: DB, campaignId: string, v: Viewer) => (db.prepare("SELECT coalesce(max(seq), 0) AS n FROM notes WHERE campaign_id = ? AND (visibility != 'leader' OR ? OR author_id = ?)")
  .get(campaignId, v.leader ? 1 : 0, v.id) as { n: number }).n;

const auditVisibility = (v: Visibility) => (v === 'public' ? 'public' : v);

export type PutNote = { ok: true; note: NoteRow } | { ok: false; status: 400 | 403 | 409; error: string; problem?: string };

/** Writes a note under the device's id: made the first time, changed after – by its author, or (its words only) by a leader, logged with the earlier wording. */
export function putNote(db: DB, campaignId: string, id: string, input: NoteInput, by: { id: string; leader: boolean }, now: Date): PutNote {
  return db.transaction((): PutNote => {
    const cur = noteById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    const battle = input.battleId ? battleById(db, input.battleId) : undefined;
    if (input.battleId && (!battle || battle.campaign_id !== campaignId)) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    if (input.visibility === 'sealed' && (!battle || battle.status === 'closed') && cur?.visibility !== 'sealed') {
      return { ok: false, status: 400, error: 'invalid', problem: 'a note is sealed until a battle that is still open' };
    }
    if (input.visibility === 'leader' && !by.leader) return { ok: false, status: 403, error: 'forbidden' };
    if (input.protocolEntryId) {
      const e = db.prepare('SELECT battle_id FROM protocol_entries WHERE id = ? AND deleted_at IS NULL').get(input.protocolEntryId) as { battle_id: string } | undefined;
      if (!e || e.battle_id !== input.battleId) return { ok: false, status: 400, error: 'invalid', problem: 'no such protocol entry in this battle' };
    }
    const mentions = JSON.stringify(input.mentions);
    if (!cur) {
      const seq = audit(db, { actorId: by.id, action: 'note.create', targetType: 'note', targetId: id, campaignId, visibility: auditVisibility(input.visibility), payload: input.visibility === 'sealed' ? { battle: input.battleId } : { kind: input.kind, battle: input.battleId } }, now);
      db.prepare(`INSERT INTO notes (id, campaign_id, battle_id, turn, author_id, kind, text, lang, visibility, sealed_until_battle, mentions, protocol_entry_id, created_at, updated_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, campaignId, input.battleId, input.turn, by.id, input.kind, input.text, input.lang, input.visibility,
        input.visibility === 'sealed' ? input.battleId : null, mentions, input.protocolEntryId, iso(now), iso(now), seq);
      return { ok: true, note: noteById(db, id)! };
    }
    const own = cur.author_id === by.id;
    // a leader may correct another's words (logged) – never a sealed note before it opens, never who may read it
    if (!own && (!by.leader || stillSealed(db, cur) || (cur.visibility === 'leader' && !by.leader))) return { ok: false, status: 403, error: 'forbidden' };
    const visibility = own ? input.visibility : cur.visibility;
    const sealedUntil = visibility === 'sealed' ? (own && cur.visibility !== 'sealed' ? input.battleId : cur.sealed_until_battle) : null;
    // a note opened with its battle stays open
    if (cur.visibility === 'sealed' && !stillSealed(db, cur) && visibility !== cur.visibility) return { ok: false, status: 409, error: 'opened' };
    const same = cur.text === input.text && cur.kind === input.kind && cur.lang === input.lang && cur.visibility === visibility && cur.mentions === mentions
      && cur.battle_id === input.battleId && cur.turn === input.turn && cur.protocol_entry_id === input.protocolEntryId;
    if (same) return { ok: true, note: cur };
    if (cur.text !== input.text) db.prepare('INSERT INTO note_revisions (note_id, text, edited_by, edited_at) VALUES (?, ?, ?, ?)').run(id, cur.text, by.id, iso(now));
    const seq = audit(db, { actorId: by.id, action: own ? 'note.edit' : 'note.edit_other', targetType: 'note', targetId: id, campaignId, visibility: auditVisibility(visibility), payload: { author: cur.author_id } }, now);
    db.prepare(`UPDATE notes SET battle_id = ?, turn = ?, kind = ?, text = ?, lang = ?, visibility = ?, sealed_until_battle = ?, mentions = ?, protocol_entry_id = ?, updated_at = ?, seq = ? WHERE id = ?`)
      .run(input.battleId, input.turn, input.kind, input.text, input.lang, visibility, sealedUntil, mentions, input.protocolEntryId, iso(now), seq, id);
    return { ok: true, note: noteById(db, id)! };
  })();
}

/** Takes a note out (a tombstone): its author, or a leader – not a sealed one before it opens. */
export function deleteNote(db: DB, n: NoteRow, by: { id: string; leader: boolean }, now: Date): 'ok' | 'forbidden' | 'gone' {
  return db.transaction(() => {
    if (n.deleted_at) return 'gone';
    if (n.author_id !== by.id && (!by.leader || stillSealed(db, n))) return 'forbidden';
    const seq = audit(db, { actorId: by.id, action: n.author_id === by.id ? 'note.remove' : 'note.remove_other', targetType: 'note', targetId: n.id, campaignId: n.campaign_id, visibility: auditVisibility(n.visibility), payload: { author: n.author_id } }, now);
    db.prepare('UPDATE notes SET deleted_at = ?, seq = ? WHERE id = ?').run(iso(now), seq, n.id);
    return 'ok';
  })();
}

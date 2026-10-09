/* The timeline's order on the server (phase 4a3, part 2; concept.md 4.7,
   docs/data-model.md section 5). The timeline itself is put together in
   the app from what each member may see; the server keeps only where a
   moved block stands in the story, and gives what the app does not have
   yet: every battle's protocol, and the marks of the warbands. A position
   is only given to who may see its block (ADR 0011): a leaders' note's
   place never reaches a player. Each one moves their own blocks, a leader
   all of them; every move is logged. A published chapter (4a5) is a block
   too: public, placed by a leader. */
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';
import { attachmentById, visibleTo, type Viewer } from './attachments.ts';
import { noteById } from './notes.ts';

const iso = (d: Date) => d.toISOString();

export const ITEM_TYPES = ['note', 'picture', 'entry', 'chapter'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export interface Position { itemType: ItemType; itemId: string; segment: string; pos: string; movedBy: string; movedAt: string }
interface PositionRow { campaign_id: string; item_type: ItemType; item_id: string; segment: string; pos: string; turn: number | null; moved_by: string; moved_at: string; seq: number }

/** A segment of the story: before the campaign, a battle's before / course / aftermath, the interlude after a round. */
const SEGMENT = /^(pre|b([0-9a-f-]{36}):(before|battle|after)|i(\d{1,3}))$/;
const POS = /^[0-9]{1,64}$/;

interface NoteLike { author_id: string; visibility: string; deleted_at: string | null; campaign_id: string; sealed_until_battle: string | null }

/** The block behind a position, with who sent it and whether the viewer may see it at all. */
function blockOf(db: DB, campaignId: string, type: ItemType, id: string, v: Viewer): { owner: string | null; visibility: string; sealed: boolean } | null {
  if (type === 'note') {
    const n = noteById(db, id) as NoteLike | undefined;
    if (!n || n.deleted_at || n.campaign_id !== campaignId) return null;
    if (n.visibility === 'leader' && !v.leader && n.author_id !== v.id) return null;
    const sealed = n.visibility === 'sealed' && battleById(db, n.sealed_until_battle ?? '')?.status !== 'closed';
    return { owner: n.author_id, visibility: n.visibility, sealed };
  }
  if (type === 'picture') {
    const a = attachmentById(db, id);
    if (!a || a.campaign_id !== campaignId || !visibleTo(a, v)) return null;
    return { owner: a.uploader_id, visibility: a.visibility, sealed: false };
  }
  if (type === 'chapter') {
    // a published chapter (4a5): everyone reads it, a leader places it
    const c = db.prepare('SELECT campaign_id, deleted_at FROM chapters WHERE id = ?').get(id) as { campaign_id: string; deleted_at: string | null } | undefined;
    return c && !c.deleted_at && c.campaign_id === campaignId ? { owner: null, visibility: 'public', sealed: false } : null;
  }
  const e = db.prepare('SELECT e.*, b.campaign_id FROM protocol_entries e JOIN battles b ON b.id = e.battle_id WHERE e.id = ?').get(id) as { campaign_id: string; deleted_at: string | null } | undefined;
  if (!e || e.deleted_at || e.campaign_id !== campaignId) return null;
  // the protocol is the leaders' (ADR 0010): only they move it
  return { owner: null, visibility: 'public', sealed: false };
}

/** Every position of the campaign whose block the viewer may see. */
export function listPositions(db: DB, campaignId: string, v: Viewer): Position[] {
  const rows = db.prepare('SELECT * FROM timeline_positions WHERE campaign_id = ?').all(campaignId) as PositionRow[];
  return rows.filter((r) => blockOf(db, campaignId, r.item_type, r.item_id, v))
    .map((r) => ({ itemType: r.item_type, itemId: r.item_id, segment: r.segment, pos: r.pos, movedBy: r.moved_by, movedAt: r.moved_at }));
}

/** The protocol of every battle of the campaign, for the timeline: everyone in the campaign reads it. */
export function campaignEntries(db: DB, campaignId: string) {
  return (db.prepare(`SELECT e.*, u.display_name AS author FROM protocol_entries e JOIN battles b ON b.id = e.battle_id JOIN users u ON u.id = e.author_id
    WHERE b.campaign_id = ? AND e.deleted_at IS NULL ORDER BY e.turn, e.created_at`).all(campaignId) as
    { id: string; battle_id: string; turn: number; kind: string; payload: string; author: string; created_at: string }[])
    .map((e) => ({ id: e.id, battleId: e.battle_id, turn: e.turn, kind: e.kind, payload: JSON.parse(e.payload) as unknown, author: e.author, createdAt: e.created_at }));
}

/** Who fought each battle of the campaign, and how it ended for them. */
export function campaignOutcomes(db: DB, campaignId: string) {
  return (db.prepare(`SELECT p.battle_id, p.warband_id, w.name, p.outcome FROM battle_participants p JOIN battles b ON b.id = p.battle_id JOIN warbands w ON w.id = p.warband_id
    WHERE b.campaign_id = ? ORDER BY w.name COLLATE NOCASE`).all(campaignId) as { battle_id: string; warband_id: string; name: string; outcome: string }[])
    .map((p) => ({ battleId: p.battle_id, warbandId: p.warband_id, name: p.name, outcome: p.outcome }));
}

/** The marks of the campaign's warbands that stand, with how many changes each froze. */
export function campaignMarks(db: DB, campaignId: string) {
  return (db.prepare(`SELECT t.id, t.warband_id, t.kind, t.round, t.battle_id, t.rev, t.created_at, w.name,
      (SELECT count(*) FROM changes x WHERE x.tag_id = t.id) AS n, (SELECT count(*) FROM changes x WHERE x.tag_id = t.id AND x.unexplained = 1) AS u
    FROM tags t JOIN warbands w ON w.id = t.warband_id WHERE t.campaign_id = ? AND t.superseded_by IS NULL ORDER BY t.round, t.created_at`).all(campaignId) as
    { id: string; warband_id: string; kind: string; round: number; battle_id: string | null; rev: number; created_at: string; name: string; n: number; u: number }[])
    .map((t) => ({ id: t.id, warbandId: t.warband_id, warband: t.name, kind: t.kind, round: t.round, battleId: t.battle_id, rev: t.rev, changes: t.n, unexplained: t.u, createdAt: t.created_at }));
}

/** Why a place is not one in this campaign's story, or null when it is. */
export function checkPlace(db: DB, campaignId: string, to: { segment: string; pos: string }): string | null {
  const m = SEGMENT.exec(to.segment);
  if (!m || !POS.test(to.pos) || to.pos.endsWith('0')) return 'no such place in the story';
  if (m[2] && battleById(db, m[2])?.campaign_id !== campaignId) return 'no such battle in this campaign';
  return null;
}

export type Moved = { ok: true; position: Position } | { ok: false; status: 400 | 403 | 404; error: string; problem?: string };

/** Moves a block to a place in the story – its own sender, or a leader; a sealed note only once it is open; the protocol only a leader. */
export function moveBlock(db: DB, campaignId: string, type: ItemType, id: string, to: { segment: string; pos: string }, by: Viewer, now: Date): Moved {
  return db.transaction((): Moved => {
    const block = blockOf(db, campaignId, type, id, by);
    if (!block) return { ok: false, status: 404, error: 'not_found' };
    const own = block.owner === by.id;
    if ((!own && !by.leader) || (block.sealed && !own)) return { ok: false, status: 403, error: 'forbidden' };
    const bad = checkPlace(db, campaignId, to);
    if (bad) return { ok: false, status: 400, error: 'invalid', problem: bad };
    const seq = audit(db, { actorId: by.id, action: 'timeline.move', targetType: type, targetId: id, campaignId, visibility: block.visibility === 'leader' ? 'leader' : block.visibility === 'sealed' ? 'sealed' : 'public', payload: { segment: to.segment } }, now);
    db.prepare(`INSERT INTO timeline_positions (campaign_id, item_type, item_id, segment, pos, moved_by, moved_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (item_type, item_id) DO UPDATE SET segment = excluded.segment, pos = excluded.pos, moved_by = excluded.moved_by, moved_at = excluded.moved_at, seq = excluded.seq`)
      .run(campaignId, type, id, to.segment, to.pos, by.id, iso(now), seq);
    return { ok: true, position: { itemType: type, itemId: id, segment: to.segment, pos: to.pos, movedBy: by.id, movedAt: iso(now) } };
  })();
}

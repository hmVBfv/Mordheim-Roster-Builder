/* Hidden NPC warbands in the database (wish #79, Rob, 26.10.2026; ADR 0027): warbands the game master keeps in a campaign as
   reference and Tabletop Simulator data. Only the campaign's leaders (with the authenticator) read or write them; nothing of
   them is sent to a player, a viewer or an admin outside the campaign, and the log never carries a word of one – only that
   something changed (visibility "leader"). The warband is a planner, as the app writes it; the server keeps it as it is. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';
import { nameTaken } from './names.ts';

const iso = (d: Date) => d.toISOString();

/** More than a game master needs; a ceiling against a runaway client. */
export const MAX_NPC_WARBANDS = 50;
/** The save of a warband of this size is well under it. */
export const MAX_SAVE = 600_000;

const Summary = z.object({
  /** What the warband owns, in gold at list prices. */
  value: z.number().int().min(0).max(1_000_000),
  /** The experience its advances would need. */
  exp: z.number().int().min(0).max(100_000),
  rating: z.number().int().min(0).max(100_000),
  models: z.number().int().min(0).max(1000),
  /** The name of its kind of warband, for the list. */
  kind: z.string().trim().max(120).default(''),
}).strict();
export type NpcSummary = z.infer<typeof Summary>;

export const NpcWarbandBody = z.object({
  name: z.string().trim().min(1).max(120),
  /** The save the app writes (`planner: true`). */
  save: z.record(z.string(), z.unknown()),
  summary: Summary,
  /** The `seq` of the warband the device edited from; 0 for a new one. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type NpcWarbandInput = z.infer<typeof NpcWarbandBody>;

interface Row {
  id: string; campaign_id: string; name: string; save: string; summary: string; created_by: string; updated_by: string;
  created_at: string; updated_at: string; deleted_at: string | null; seq: number;
}
export interface NpcWarbandListed { id: string; name: string; summary: NpcSummary; updatedBy: string; createdAt: string; updatedAt: string; seq: number }
export interface NpcWarband extends NpcWarbandListed { save: Record<string, unknown> }

const SELECT = `SELECT w.*, u.display_name AS updater FROM npc_warbands w JOIN users u ON u.id = w.updated_by`;
type Joined = Row & { updater: string };

const listed = (r: Joined): NpcWarbandListed => ({
  id: r.id, name: r.name, summary: JSON.parse(r.summary) as NpcSummary, updatedBy: r.updater, createdAt: r.created_at, updatedAt: r.updated_at, seq: r.seq,
});

export const npcWarbandById = (db: DB, id: string) => db.prepare('SELECT * FROM npc_warbands WHERE id = ?').get(id) as Row | undefined;

/** The campaign's NPC warbands, newest change first, without their saves; a taken-out one is not listed. */
export function listNpcWarbands(db: DB, campaignId: string): NpcWarbandListed[] {
  return (db.prepare(`${SELECT} WHERE w.campaign_id = ? AND w.deleted_at IS NULL ORDER BY w.updated_at DESC, w.rowid DESC`).all(campaignId) as Joined[]).map(listed);
}

export function oneNpcWarband(db: DB, id: string): NpcWarband | null {
  const r = db.prepare(`${SELECT} WHERE w.id = ? AND w.deleted_at IS NULL`).get(id) as Joined | undefined;
  return r ? { ...listed(r), save: JSON.parse(r.save) as Record<string, unknown> } : null;
}

/** The newest change among the campaign's NPC warbands, a taken-out one included (its removal moves the number). */
export const npcWarbandSeq = (db: DB, campaignId: string) =>
  (db.prepare('SELECT coalesce(max(seq), 0) AS n FROM npc_warbands WHERE campaign_id = ?').get(campaignId) as { n: number }).n;

export type PutNpcWarband =
  | { ok: true; warband: NpcWarband }
  | { ok: false; status: 400 | 409; error: string; problem?: string; current?: NpcWarband };

/** Writes a warband under the device's id: made the first time, changed after. Another leader's change in between: 409 `stale`. */
export function putNpcWarband(db: DB, campaignId: string, id: string, input: NpcWarbandInput, by: string, now: Date): PutNpcWarband {
  const save = JSON.stringify(input.save);
  if (input.save.planner !== true) return { ok: false, status: 400, error: 'invalid', problem: 'an NPC warband is a planner' };
  if (save.length > MAX_SAVE) return { ok: false, status: 400, error: 'invalid', problem: 'that warband is too big' };
  return db.transaction((): PutNpcWarband => {
    const cur = npcWarbandById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (nameTaken(db, 'npc_warbands', campaignId, ['name'], [input.name], id)) return { ok: false, status: 400, error: 'invalid', problem: 'an NPC warband of this name exists already' };
    const summary = JSON.stringify(input.summary);
    if (!cur) {
      const n = (db.prepare('SELECT count(*) AS n FROM npc_warbands WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (n >= MAX_NPC_WARBANDS) return { ok: false, status: 409, error: 'full', problem: `a campaign keeps at most ${MAX_NPC_WARBANDS} NPC warbands` };
      const seq = audit(db, { actorId: by, action: 'npcwarband.create', targetType: 'npc_warband', targetId: id, campaignId, visibility: 'leader', payload: {} }, now);
      db.prepare(`INSERT INTO npc_warbands (id, campaign_id, name, save, summary, created_by, updated_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, campaignId, input.name, save, summary, by, by, iso(now), iso(now), seq);
      return { ok: true, warband: oneNpcWarband(db, id)! };
    }
    if (cur.name === input.name && cur.save === save && cur.summary === summary) return { ok: true, warband: oneNpcWarband(db, id)! };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: oneNpcWarband(db, id)! };
    const seq = audit(db, { actorId: by, action: 'npcwarband.edit', targetType: 'npc_warband', targetId: id, campaignId, visibility: 'leader', payload: {} }, now);
    db.prepare('UPDATE npc_warbands SET name = ?, save = ?, summary = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.name, save, summary, by, iso(now), seq, id);
    return { ok: true, warband: oneNpcWarband(db, id)! };
  })();
}

/** Takes a warband out: a tombstone that lets go of its name and its save. */
export function removeNpcWarband(db: DB, campaignId: string, id: string, by: string, now: Date): boolean {
  return db.transaction(() => {
    const cur = npcWarbandById(db, id);
    if (!cur || cur.campaign_id !== campaignId || cur.deleted_at) return false;
    const seq = audit(db, { actorId: by, action: 'npcwarband.remove', targetType: 'npc_warband', targetId: id, campaignId, visibility: 'leader', payload: {} }, now);
    db.prepare("UPDATE npc_warbands SET name = '', save = '{}', summary = '{}', deleted_at = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?").run(iso(now), by, iso(now), seq, id);
    return true;
  })();
}

/* Names that stand for one thing are not given twice (report #65, Rob, 24.10.2026): a campaign's name among the campaigns of one
   person, and in a campaign its battles, scenarios, factions, NPCs and background entries. Two names are the same when they differ
   only in case or in spaces. The same row written again under its own id is no clash. */
import type { DB } from './db.ts';

export const nameKey = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

type Table = 'scenarios' | 'factions' | 'npcs' | 'background_entries' | 'npc_warbands';

/** Is another live row of the campaign named like one of `names` (in any of the columns `cols`)? Empty names never clash. */
export function nameTaken(db: DB, table: Table, campaignId: string, cols: string[], names: string[], exceptId: string): boolean {
  const wanted = new Set(names.map(nameKey).filter(Boolean));
  if (!wanted.size) return false;
  const rows = db.prepare(`SELECT ${cols.join(', ')} FROM ${table} WHERE campaign_id = ? AND deleted_at IS NULL AND id != ?`).all(campaignId, exceptId) as Record<string, string>[];
  return rows.some((r) => cols.some((c) => wanted.has(nameKey(String(r[c] ?? '')))));
}

/** Is a campaign of this name among those the user belongs to (the one `exceptId` aside)? */
export function campaignNameTaken(db: DB, userId: string, name: string, exceptId: string): boolean {
  const rows = db.prepare(`SELECT c.name FROM campaigns c JOIN members m ON m.campaign_id = c.id AND m.user_id = ? AND m.left_at IS NULL
    WHERE c.deleted_at IS NULL AND c.archived_at IS NULL AND c.id != ?`).all(userId, exceptId) as { name: string }[];
  const k = nameKey(name);
  return rows.some((r) => nameKey(r.name) === k);
}

/** Is another battle of the campaign called the same? A battle is "Battle 3" or "Battle 3 · title": the same round and title. */
export function battleNameTaken(db: DB, campaignId: string, round: number, title: string, exceptId: string): boolean {
  const rows = db.prepare('SELECT title FROM battles WHERE campaign_id = ? AND round = ? AND id != ?').all(campaignId, round, exceptId) as { title: string }[];
  const k = nameKey(title);
  return rows.some((r) => nameKey(r.title) === k);
}

export const battleName = (round: number, title: string): string => `Battle ${round}${title.trim() ? ` · ${title.trim()}` : ''}`;

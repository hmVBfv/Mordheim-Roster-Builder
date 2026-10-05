/* Warbands in the database (phase 3h; ADR 0003, docs/data-model.md
   "Warbands"): a warband with its append-only versions and one draft
   (autosave) per user. Plain functions over the database; who may (the
   owner) is asked in the routes through can(). Every change takes a seq
   from the audit log, which drives GET /sync. */
import { warbandSaveSchema } from '@mordheim/core/format';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

/** docs/security.md: a warband version is at most 2 MB. */
export const MAX_VERSION_BYTES = 2 * 1024 * 1024;
export const SOURCES = ['save', 'import', 'copy', 'restore', 'migration'] as const;
export type Source = (typeof SOURCES)[number];

const iso = (d: Date) => d.toISOString();

export interface WarbandRow {
  id: string; owner_id: string; name: string; wb_type: string; head_rev: number;
  copied_from: string | null; copied_rev: number | null;
  created_at: string; updated_at: string; archived_at: string | null; seq: number;
}
interface VersionRow { warband_id: string; rev: number; data: string; format: number; app_version: string; source: Source; created_by: string; created_at: string; note: string }
interface AutosaveRow { warband_id: string; user_id: string; base_rev: number; data: string; device: string; updated_at: string; seq: number }

/* ---- what leaves the server ---- */

export interface WarbandMeta {
  id: string; name: string; wbType: string; headRev: number;
  copiedFrom: { id: string; rev: number } | null;
  createdAt: string; updatedAt: string; archivedAt: string | null;
}
export interface Version { rev: number; format: number; appVersion: string; source: Source; createdBy: string | null; createdAt: string; note: string; bytes: number }
export interface Draft { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number }

export const metaOf = (w: WarbandRow): WarbandMeta => ({
  id: w.id, name: w.name, wbType: w.wb_type, headRev: w.head_rev,
  copiedFrom: w.copied_from ? { id: w.copied_from, rev: w.copied_rev ?? 1 } : null,
  createdAt: w.created_at, updatedAt: w.updated_at, archivedAt: w.archived_at,
});
const draftOf = (a: AutosaveRow): Draft => ({ baseRev: a.base_rev, data: JSON.parse(a.data) as unknown, device: a.device, updatedAt: a.updated_at, seq: a.seq });

/* ---- the save itself ---- */

/** Keys starting with "_" are the app's own state and never stored (CLAUDE.md). */
export function stripTransient(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripTransient);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) out[k] = stripTransient(x);
    return out;
  }
  return v;
}

export type Checked = { ok: true; data: Record<string, unknown>; json: string } | { ok: false; status: 400 | 413; error: string; problem: string };

/** A save the server will keep: shaped as core/format describes it (the
    same tolerant schema the app loads with), at most 2 MB. The server does
    not compute: what the save says, it keeps (ADR 0005). */
export function checkSave(raw: unknown): Checked {
  const data = stripTransient(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, status: 400, error: 'invalid', problem: 'not a warband save' };
  const r = warbandSaveSchema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ');
    return { ok: false, status: 400, error: 'invalid', problem: `not a warband save (${first})` };
  }
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json) > MAX_VERSION_BYTES) return { ok: false, status: 413, error: 'too_large', problem: 'a warband may be at most 2 MB' };
  return { ok: true, data: data as Record<string, unknown>, json };
}

const nameOf = (d: Record<string, unknown>) => (typeof d.name === 'string' ? d.name.slice(0, 120) : '');
const formatOf = (d: Record<string, unknown>) => (Number.isInteger(d.format) ? (d.format as number) : 0);

/* ---- reading ---- */

export const warbandById = (db: DB, id: string) => db.prepare('SELECT * FROM warbands WHERE id = ?').get(id) as WarbandRow | undefined;

export function listWarbands(db: DB, ownerId: string, archived = false): WarbandMeta[] {
  const rows = db.prepare(`SELECT * FROM warbands WHERE owner_id = ? AND archived_at IS ${archived ? 'NOT ' : ''}NULL ORDER BY updated_at DESC`).all(ownerId) as WarbandRow[];
  return rows.map(metaOf);
}

export function listVersions(db: DB, warbandId: string): Version[] {
  const rows = db.prepare(`SELECT v.rev, v.format, v.app_version, v.source, v.created_at, v.note, length(v.data) AS bytes, u.username
    FROM warband_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.warband_id = ? ORDER BY v.rev DESC`).all(warbandId) as
    { rev: number; format: number; app_version: string; source: Source; created_at: string; note: string; bytes: number; username: string | null }[];
  return rows.map((r) => ({ rev: r.rev, format: r.format, appVersion: r.app_version, source: r.source, createdBy: r.username, createdAt: r.created_at, note: r.note, bytes: r.bytes }));
}

export function versionOf(db: DB, warbandId: string, rev: number): (Version & { data: unknown }) | null {
  const v = db.prepare('SELECT v.*, u.username FROM warband_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.warband_id = ? AND v.rev = ?').get(warbandId, rev) as (VersionRow & { username: string | null }) | undefined;
  if (!v) return null;
  return { rev: v.rev, format: v.format, appVersion: v.app_version, source: v.source, createdBy: v.username, createdAt: v.created_at, note: v.note, bytes: v.data.length, data: JSON.parse(v.data) as unknown };
}

export function draftOfUser(db: DB, warbandId: string, userId: string): Draft | null {
  const a = db.prepare('SELECT * FROM warband_autosaves WHERE warband_id = ? AND user_id = ?').get(warbandId, userId) as AutosaveRow | undefined;
  return a ? draftOf(a) : null;
}

/* ---- writing; each in one transaction, each with its audit entry ---- */

export interface NewWarband { id: string; ownerId: string; data: Record<string, unknown>; json: string; source: Source; note: string; appVersion: string; copiedFrom: { id: string; rev: number } | null }

/** A new warband with its first version. */
export function createWarband(db: DB, w: NewWarband, now: Date): WarbandRow {
  return db.transaction(() => {
    const seq = audit(db, { actorId: w.ownerId, action: 'warband.create', targetType: 'warband', targetId: w.id, payload: { source: w.source, copiedFrom: w.copiedFrom } }, now);
    db.prepare(`INSERT INTO warbands (id, owner_id, name, wb_type, head_rev, copied_from, copied_rev, created_at, updated_at, seq)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`).run(w.id, w.ownerId, nameOf(w.data), String(w.data.wb), w.copiedFrom?.id ?? null, w.copiedFrom?.rev ?? null, iso(now), iso(now), seq);
    db.prepare('INSERT INTO warband_versions (warband_id, rev, data, format, app_version, source, created_by, created_at, note) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)')
      .run(w.id, w.json, formatOf(w.data), w.appVersion, w.source, w.ownerId, iso(now), w.note);
    return warbandById(db, w.id)!;
  })();
}

export type Saved = { ok: true; warband: WarbandRow; rev: number } | { ok: false; head: number };

/** A new version on top of `baseRev`; refused (stale) when someone saved in between (ADR 0003: never overwrite). */
export function addVersion(db: DB, w: { id: string; userId: string; baseRev: number; data: Record<string, unknown>; json: string; source: Source; note: string; appVersion: string }, now: Date): Saved {
  return db.transaction((): Saved => {
    const cur = warbandById(db, w.id)!;
    if (cur.head_rev !== w.baseRev) return { ok: false, head: cur.head_rev };
    const rev = cur.head_rev + 1;
    db.prepare('INSERT INTO warband_versions (warband_id, rev, data, format, app_version, source, created_by, created_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(w.id, rev, w.json, formatOf(w.data), w.appVersion, w.source, w.userId, iso(now), w.note);
    const seq = audit(db, { actorId: w.userId, action: 'warband.version', targetType: 'warband', targetId: w.id, payload: { rev, source: w.source } }, now);
    db.prepare('UPDATE warbands SET head_rev = ?, name = ?, wb_type = ?, updated_at = ?, seq = ? WHERE id = ?').run(rev, nameOf(w.data), String(w.data.wb), iso(now), seq, w.id);
    // the draft is now the version
    db.prepare('DELETE FROM warband_autosaves WHERE warband_id = ? AND user_id = ?').run(w.id, w.userId);
    return { ok: true, warband: warbandById(db, w.id)!, rev };
  })();
}

export type DraftSaved = { ok: true; seq: number } | { ok: false; draft: Draft };

/** The draft: refused when another device of the same user wrote one the
    caller has not seen (`afterSeq`), unless `force`. Only the latest audit
    entry of a draft is kept – drafts are not changes worth a line each. */
export function saveDraft(db: DB, d: { id: string; userId: string; baseRev: number; json: string; device: string; afterSeq: number | null; force: boolean }, now: Date): DraftSaved {
  return db.transaction((): DraftSaved => {
    const cur = db.prepare('SELECT * FROM warband_autosaves WHERE warband_id = ? AND user_id = ?').get(d.id, d.userId) as AutosaveRow | undefined;
    if (cur && !d.force && cur.seq !== d.afterSeq) return { ok: false, draft: draftOf(cur) };
    if (cur) db.prepare("DELETE FROM audit_log WHERE seq = ? AND action = 'warband.autosave'").run(cur.seq);
    const seq = audit(db, { actorId: d.userId, action: 'warband.autosave', targetType: 'warband', targetId: d.id, payload: { baseRev: d.baseRev } }, now);
    db.prepare(`INSERT INTO warband_autosaves (warband_id, user_id, base_rev, data, device, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (warband_id, user_id) DO UPDATE SET base_rev = excluded.base_rev, data = excluded.data, device = excluded.device, updated_at = excluded.updated_at, seq = excluded.seq`)
      .run(d.id, d.userId, d.baseRev, d.json, d.device.slice(0, 80), iso(now), seq);
    return { ok: true, seq };
  })();
}

/** Throws the draft away; true when there was one. */
export function dropDraft(db: DB, id: string, userId: string, now: Date): boolean {
  return db.transaction(() => {
    const cur = db.prepare('SELECT seq FROM warband_autosaves WHERE warband_id = ? AND user_id = ?').get(id, userId) as { seq: number } | undefined;
    if (!cur) return false;
    db.prepare('DELETE FROM warband_autosaves WHERE warband_id = ? AND user_id = ?').run(id, userId);
    db.prepare("DELETE FROM audit_log WHERE seq = ? AND action = 'warband.autosave'").run(cur.seq);
    // a new seq, so other devices learn that the draft is gone
    const seq = audit(db, { actorId: userId, action: 'warband.draft_drop', targetType: 'warband', targetId: id }, now);
    db.prepare('UPDATE warbands SET seq = ? WHERE id = ?').run(seq, id);
    return true;
  })();
}

/** Removes (archived: true) or brings back a warband; versions stay. */
export function setArchived(db: DB, id: string, userId: string, archived: boolean, now: Date): WarbandRow {
  return db.transaction(() => {
    const seq = audit(db, { actorId: userId, action: archived ? 'warband.archive' : 'warband.unarchive', targetType: 'warband', targetId: id }, now);
    db.prepare('UPDATE warbands SET archived_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(archived ? iso(now) : null, iso(now), seq, id);
    return warbandById(db, id)!;
  })();
}

/* ---- sync (docs/architecture.md section 6) ---- */

export interface SyncAnswer {
  epoch: string | null;
  /** Pass it back as ?cursor= next time. */
  cursor: number;
  /** Changed warbands with their latest version (archived ones without), and the user's draft. */
  warbands: (WarbandMeta & { head: (Version & { data: unknown }) | null; draft: Draft | null })[];
}

/** What changed for this user since `cursor`: one consistent read. */
export function syncFor(db: DB, userId: string, cursor: number, epoch: string | null): SyncAnswer {
  return db.transaction((): SyncAnswer => {
    const top = (db.prepare('SELECT coalesce(max(seq), 0) AS n FROM audit_log').get() as { n: number }).n;
    const rows = db.prepare(`SELECT DISTINCT w.* FROM warbands w
      LEFT JOIN warband_autosaves a ON a.warband_id = w.id AND a.user_id = ?
      WHERE w.owner_id = ? AND (w.seq > ? OR a.seq > ?) ORDER BY w.seq`).all(userId, userId, cursor, cursor) as WarbandRow[];
    return {
      epoch,
      cursor: top,
      warbands: rows.map((w) => ({
        ...metaOf(w),
        head: w.archived_at ? null : versionOf(db, w.id, w.head_rev),
        draft: w.archived_at ? null : draftOfUser(db, w.id, userId),
      })),
    };
  })();
}

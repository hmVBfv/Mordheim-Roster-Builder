/* Sharing a warband (Rob, 05.10.2026): a copy straight to another user, or
   a short code to enter. The recipient's copy is a warband of their own; the
   sender's warband never becomes visible to anyone (ADR 0011). The share
   keeps the warband as it was when shared. */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';
import { createWarband, type WarbandRow } from './warbands.ts';

export const SHARE_DAYS = 7;
/** A share code: 8 characters without the ones easily confused (0/O, 1/I/L). */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 8;
/** Wrong codes allowed per user in 15 minutes. */
export const CODE_TRIES = 10;

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString();

export function newCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
/** "k7m2-q9xd", " K7M2 Q9XD " → "K7M2Q9XD". */
export const normalCode = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, '');
export const showCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
const hashCode = (c: string) => createHash('sha256').update(`share:${normalCode(c)}`).digest('base64url');

export interface ShareRow {
  id: string; from_user: string; to_user: string | null; code_hash: string | null; warband_id: string | null;
  name: string; wb_type: string; data: string; created_at: string; expires_at: string;
  answered_at: string | null; accepted: number | null; uses: number; revoked_at: string | null;
}

export interface ShareSummary {
  id: string; name: string; wbType: string; from: string; to: string | null; code: boolean;
  createdAt: string; expiresAt: string; answeredAt: string | null; accepted: boolean | null; uses: number; revokedAt: string | null;
}

const summary = (r: ShareRow & { from_name: string; to_name: string | null }): ShareSummary => ({
  id: r.id, name: r.name, wbType: r.wb_type, from: r.from_name, to: r.to_name, code: !!r.code_hash,
  createdAt: r.created_at, expiresAt: r.expires_at, answeredAt: r.answered_at, accepted: r.accepted === null ? null : !!r.accepted,
  uses: r.uses, revokedAt: r.revoked_at,
});

const SELECT = `SELECT s.*, f.display_name AS from_name, t.display_name AS to_name FROM warband_shares s
  JOIN users f ON f.id = s.from_user LEFT JOIN users t ON t.id = s.to_user`;

export const shareById = (db: DB, id: string) => db.prepare('SELECT * FROM warband_shares WHERE id = ?').get(id) as ShareRow | undefined;

/** A share that can still be taken. */
const open = (r: ShareRow, now: Date) => !r.revoked_at && r.expires_at > iso(now) && (r.code_hash !== null || r.answered_at === null);

export function shareByCode(db: DB, code: string, now: Date): ShareRow | null {
  const r = db.prepare('SELECT * FROM warband_shares WHERE code_hash = ?').get(hashCode(code)) as ShareRow | undefined;
  return r && open(r, now) ? r : null;
}

/** A share that can no longer be taken keeps no warband: answered, taken back, or past its end. */
const DROP = "UPDATE warband_shares SET data = '' WHERE id = ?";
export function sweepShares(db: DB, now: Date): void {
  db.prepare("UPDATE warband_shares SET data = '' WHERE expires_at <= ? AND data != ''").run(iso(now));
}

export function createShare(db: DB, s: { from: string; to: string | null; warbandId: string | null; name: string; wbType: string; json: string }, now: Date): { id: string; code: string | null; expiresAt: string } {
  const id = randomUUID();
  const code = s.to ? null : newCode();
  const expiresAt = iso(new Date(now.getTime() + SHARE_DAYS * DAY));
  db.transaction(() => {
    sweepShares(db, now);
    db.prepare(`INSERT INTO warband_shares (id, from_user, to_user, code_hash, warband_id, name, wb_type, data, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, s.from, s.to, code ? hashCode(code) : null, s.warbandId, s.name.slice(0, 120), s.wbType, s.json, iso(now), expiresAt);
    audit(db, { actorId: s.from, action: s.to ? 'share.send' : 'share.code', targetType: s.to ? 'user' : 'share', targetId: s.to ?? id, payload: { share: id } }, now);
  })();
  return { id, code, expiresAt };
}

export function listShares(db: DB, userId: string, now: Date): { incoming: ShareSummary[]; outgoing: ShareSummary[] } {
  sweepShares(db, now);
  const incoming = (db.prepare(`${SELECT} WHERE s.to_user = ? AND s.answered_at IS NULL AND s.revoked_at IS NULL AND s.expires_at > ? ORDER BY s.created_at DESC`).all(userId, iso(now)) as (ShareRow & { from_name: string; to_name: string | null })[]).map(summary);
  const outgoing = (db.prepare(`${SELECT} WHERE s.from_user = ? ORDER BY s.created_at DESC LIMIT 50`).all(userId) as (ShareRow & { from_name: string; to_name: string | null })[]).map(summary);
  return { incoming, outgoing };
}

/** The recipient takes the share: a warband of their own with the given (device) id. */
export function takeShare(db: DB, r: ShareRow, userId: string, warbandId: string, now: Date): WarbandRow {
  return db.transaction(() => {
    const data = JSON.parse(r.data) as Record<string, unknown>;
    const w = createWarband(db, { id: warbandId, ownerId: userId, data, json: r.data, source: 'import', note: `shared by ${(db.prepare('SELECT display_name FROM users WHERE id = ?').get(r.from_user) as { display_name: string }).display_name}`, appVersion: '', copiedFrom: null }, now);
    if (r.code_hash) db.prepare('UPDATE warband_shares SET uses = uses + 1 WHERE id = ?').run(r.id);
    else db.prepare("UPDATE warband_shares SET answered_at = ?, accepted = 1, uses = 1, data = '' WHERE id = ?").run(iso(now), r.id);
    audit(db, { actorId: userId, action: 'share.take', targetType: 'share', targetId: r.id, payload: { warband: warbandId } }, now);
    return w;
  })();
}

export function declineShare(db: DB, r: ShareRow, userId: string, now: Date): void {
  db.prepare("UPDATE warband_shares SET answered_at = ?, accepted = 0, data = '' WHERE id = ?").run(iso(now), r.id);
  audit(db, { actorId: userId, action: 'share.decline', targetType: 'share', targetId: r.id }, now);
}

export function revokeShare(db: DB, r: ShareRow, userId: string, now: Date): void {
  db.prepare('UPDATE warband_shares SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(iso(now), r.id);
  db.prepare(DROP).run(r.id);
  audit(db, { actorId: userId, action: 'share.revoke', targetType: 'share', targetId: r.id }, now);
}

export const isOpen = open;

/* ---- the brake on codes ---- */

export function codeBraked(db: DB, userId: string, now: Date): boolean {
  const since = iso(new Date(now.getTime() - 15 * 60 * 1000));
  const n = (db.prepare('SELECT count(*) AS n FROM code_attempts WHERE user_id = ? AND at > ?').get(userId, since) as { n: number }).n;
  return n >= CODE_TRIES;
}

export function wrongCode(db: DB, userId: string, ip: string, now: Date): void {
  db.prepare('INSERT INTO code_attempts (user_id, ip, at) VALUES (?, ?, ?)').run(userId, ip, iso(now));
  db.prepare('DELETE FROM code_attempts WHERE at < ?').run(iso(new Date(now.getTime() - DAY)));
}

/** Other signed-up users to send a copy to: names only, never anything else. */
export function listPeople(db: DB, userId: string): { id: string; username: string; displayName: string }[] {
  return (db.prepare('SELECT id, username, display_name FROM users WHERE id != ? AND disabled_at IS NULL ORDER BY display_name COLLATE NOCASE').all(userId) as { id: string; username: string; display_name: string }[])
    .map((u) => ({ id: u.id, username: u.username, displayName: u.display_name }));
}

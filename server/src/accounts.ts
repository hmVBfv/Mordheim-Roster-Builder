/* Accounts in the database (docs/data-model.md, "Nutzer und Anmeldung"):
   users, sessions, one-time links, sign-in attempts and the audit log. Only
   hashes of tokens are stored; a token itself exists once, in the answer
   that hands it out. Plain functions over the database; the rules (who may,
   when) live in policy.ts and the routes. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { DB } from './db.ts';

export const SESSION_DAYS = 90;
/** How long the authenticator's code may take after the password. */
export const TOTP_STAGE_MINUTES = 5;
export const INVITE_DAYS = 7;
export const RESET_HOURS = 24;
/** Sign-in attempts are kept this long – for the brake and the admin's view. */
export const ATTEMPT_DAYS = 180;

const DAY = 24 * 60 * 60 * 1000;

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('base64url');
const iso = (d: Date) => d.toISOString();
const after = (now: Date, ms: number) => new Date(now.getTime() + ms).toISOString();

/* ---- users ---- */

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  pw_hash: string;
  is_admin: number;
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
  totp_enabled_at: string | null;
  totp_last_step: number;
  totp_recovery: string | null;
  created_at: string;
  disabled_at: string | null;
}

export function createUser(db: DB, u: { username: string; displayName: string; pwHash: string; isAdmin: boolean }, now: Date): string {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, username, display_name, pw_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, u.username, u.displayName, u.pwHash, u.isAdmin ? 1 : 0, iso(now));
  return id;
}

export const userById = (db: DB, id: string) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
export const userByName = (db: DB, name: string) => db.prepare('SELECT * FROM users WHERE username = ?').get(name) as UserRow | undefined;

export function setPassword(db: DB, id: string, pwHash: string): void {
  db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(pwHash, id);
}

/** A username: 3–32 letters, digits, dot, dash or underscore. */
export function usernameProblem(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) return 'a username is needed';
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(name)) return '3 to 32 letters, digits, dots, dashes or underscores';
  return '';
}

export interface UserSummary {
  id: string; username: string; displayName: string; isAdmin: boolean; totp: boolean;
  createdAt: string; disabledAt: string | null; lastSeenAt: string | null; sessions: number;
}

export function listUsers(db: DB, now: Date): UserSummary[] {
  const rows = db.prepare(`
    SELECT u.*, (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen,
           (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > ? AND s.stage = 'full') AS open_sessions
    FROM users u ORDER BY u.username`).all(iso(now)) as (UserRow & { last_seen: string | null; open_sessions: number })[];
  return rows.map((u) => ({
    id: u.id, username: u.username, displayName: u.display_name, isAdmin: !!u.is_admin, totp: !!u.totp_enabled_at,
    createdAt: u.created_at, disabledAt: u.disabled_at, lastSeenAt: u.last_seen, sessions: u.open_sessions,
  }));
}

/* ---- sessions ---- */

export interface SessionRow {
  id: string; user_id: string; token_hash: string; stage: 'totp' | 'full'; device_label: string; ip: string;
  created_at: string; last_seen_at: string; expires_at: string; revoked_at: string | null;
}

export function createSession(db: DB, s: { userId: string; stage: 'totp' | 'full'; device: string; ip: string }, now: Date): { id: string; token: string } {
  const id = randomUUID();
  const token = newToken();
  const ttl = s.stage === 'full' ? SESSION_DAYS * DAY : TOTP_STAGE_MINUTES * 60 * 1000;
  db.prepare('INSERT INTO sessions (id, user_id, token_hash, stage, device_label, ip, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, s.userId, hashToken(token), s.stage, s.device.slice(0, 80), s.ip, iso(now), iso(now), after(now, ttl));
  return { id, token };
}

/** The session behind a token, with its user – if it is open and the user may sign in. */
export function sessionByToken(db: DB, token: string, now: Date): { session: SessionRow; user: UserRow } | null {
  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token)) as SessionRow | undefined;
  if (!session || session.revoked_at || session.expires_at <= iso(now)) return null;
  const user = userById(db, session.user_id);
  if (!user || user.disabled_at) return null;
  return { session, user };
}

/** A session in use lives on: at most once an hour its expiry moves to 90 days from now. */
export function touchSession(db: DB, s: SessionRow, ip: string, now: Date): void {
  if (s.stage !== 'full' || now.getTime() - Date.parse(s.last_seen_at) < 60 * 60 * 1000) return;
  db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ?, ip = ? WHERE id = ?').run(iso(now), after(now, SESSION_DAYS * DAY), ip, s.id);
}

/** The code was right: the session is a full one now, with a new token. */
export function promoteSession(db: DB, id: string, now: Date): string {
  const token = newToken();
  db.prepare("UPDATE sessions SET stage = 'full', token_hash = ?, last_seen_at = ?, expires_at = ? WHERE id = ?").run(hashToken(token), iso(now), after(now, SESSION_DAYS * DAY), id);
  return token;
}

export function revokeSession(db: DB, id: string, now: Date): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(iso(now), id);
}

/** Ends every session of a user, except `keep`. Returns how many. */
export function revokeUserSessions(db: DB, userId: string, now: Date, keep?: string): number {
  return db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id IS NOT ?').run(iso(now), userId, keep ?? null).changes;
}

export interface SessionSummary { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean }

export function listSessions(db: DB, userId: string, current: string, now: Date): SessionSummary[] {
  const rows = db.prepare("SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? AND stage = 'full' ORDER BY last_seen_at DESC").all(userId, iso(now)) as SessionRow[];
  return rows.map((s) => ({ id: s.id, device: s.device_label, createdAt: s.created_at, lastSeenAt: s.last_seen_at, current: s.id === current }));
}

/* ---- one-time links ---- */

export interface InviteRow {
  id: string; token_hash: string; kind: 'register' | 'reset'; created_by: string | null; for_user_id: string | null;
  campaign_id: string | null; is_admin: number; note: string; created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null;
}

export function createInvite(db: DB, i: { kind: 'register' | 'reset'; createdBy: string | null; forUserId?: string; isAdmin?: boolean; note?: string }, now: Date): { id: string; token: string } {
  const id = randomUUID();
  const token = newToken();
  const ttl = i.kind === 'register' ? INVITE_DAYS * DAY : RESET_HOURS * 60 * 60 * 1000;
  // a new reset link replaces an older one that was not used
  if (i.kind === 'reset' && i.forUserId) db.prepare("UPDATE invites SET revoked_at = ? WHERE kind = 'reset' AND for_user_id = ? AND used_at IS NULL AND revoked_at IS NULL").run(iso(now), i.forUserId);
  db.prepare('INSERT INTO invites (id, token_hash, kind, created_by, for_user_id, is_admin, note, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, hashToken(token), i.kind, i.createdBy, i.forUserId ?? null, i.isAdmin ? 1 : 0, (i.note ?? '').slice(0, 120), iso(now), after(now, ttl));
  return { id, token };
}

/** The link behind a token, if it may still be used. */
export function inviteByToken(db: DB, token: string, now: Date): InviteRow | null {
  const row = db.prepare('SELECT * FROM invites WHERE token_hash = ?').get(hashToken(token)) as InviteRow | undefined;
  if (!row || row.used_at || row.revoked_at || row.expires_at <= iso(now)) return null;
  return row;
}

export function useInvite(db: DB, id: string, now: Date): void {
  db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(iso(now), id);
}

export function revokeInvite(db: DB, id: string, now: Date): boolean {
  return db.prepare('UPDATE invites SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL').run(iso(now), id).changes > 0;
}

export interface InviteSummary { id: string; kind: 'register' | 'reset'; note: string; forUser: string | null; createdAt: string; expiresAt: string }

export function listOpenInvites(db: DB, now: Date): InviteSummary[] {
  const rows = db.prepare(`SELECT i.*, u.username AS for_name FROM invites i LEFT JOIN users u ON u.id = i.for_user_id
    WHERE i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ? ORDER BY i.created_at DESC`).all(iso(now)) as (InviteRow & { for_name: string | null })[];
  return rows.map((i) => ({ id: i.id, kind: i.kind, note: i.note, forUser: i.for_name, createdAt: i.created_at, expiresAt: i.expires_at }));
}

/* ---- sign-in attempts ---- */

export function recordAttempt(db: DB, a: { username: string; ip: string; ok: boolean; reason?: string }, now: Date): void {
  db.prepare('INSERT INTO login_attempts (username, ip, at, ok, reason) VALUES (?, ?, ?, ?, ?)').run(a.username.slice(0, 64).toLowerCase(), a.ip, iso(now), a.ok ? 1 : 0, a.reason ?? '');
  // keep them half a year; cheap, and the table never grows beyond that
  db.prepare('DELETE FROM login_attempts WHERE at < ?').run(after(now, -ATTEMPT_DAYS * DAY));
}

/** Failed attempts in the last 15 minutes for this account and this address,
    and the latest of them. A try refused by the brake does not count, so
    waiting out the brake always works. */
export function recentFailures(db: DB, username: string, ip: string, now: Date): { user: number; ip: number; last: string | null } {
  const since = after(now, -15 * 60 * 1000);
  const u = db.prepare("SELECT count(*) AS n, max(at) AS last FROM login_attempts WHERE username = ? AND ok = 0 AND reason != 'braked' AND at > ?").get(username.toLowerCase(), since) as { n: number; last: string | null };
  const i = db.prepare("SELECT count(*) AS n, max(at) AS last FROM login_attempts WHERE ip = ? AND ok = 0 AND reason != 'braked' AND at > ?").get(ip, since) as { n: number; last: string | null };
  const last = [u.last, i.last].filter(Boolean).sort().pop() ?? null;
  return { user: u.n, ip: i.n, last };
}

export interface AttemptSummary { id: number; username: string; ip: string; at: string; ok: boolean; reason: string }

export function listAttempts(db: DB, limit: number, beforeId?: number): AttemptSummary[] {
  const rows = db.prepare('SELECT * FROM login_attempts WHERE id < ? ORDER BY id DESC LIMIT ?').all(beforeId ?? Number.MAX_SAFE_INTEGER, limit) as { id: number; username: string; ip: string; at: string; ok: number; reason: string }[];
  return rows.map((r) => ({ id: r.id, username: r.username, ip: r.ip, at: r.at, ok: !!r.ok, reason: r.reason }));
}

/* ---- audit log ---- */

export interface AuditEntry { actorId: string | null; action: string; targetType?: string; targetId?: string; visibility?: 'public' | 'sealed' | 'leader' | 'admin'; payload?: unknown }

export function audit(db: DB, e: AuditEntry, now: Date): number {
  const r = db.prepare('INSERT INTO audit_log (at, actor_id, action, target_type, target_id, visibility, payload) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(iso(now), e.actorId, e.action, e.targetType ?? null, e.targetId ?? null, e.visibility ?? 'admin', e.payload === undefined ? null : JSON.stringify(e.payload));
  return Number(r.lastInsertRowid);
}

export interface AuditSummary { seq: number; at: string; actor: string | null; action: string; targetType: string | null; target: string | null; payload: unknown }

export function listAudit(db: DB, limit: number, beforeSeq?: number): AuditSummary[] {
  const rows = db.prepare(`SELECT a.*, u.username AS actor_name, t.username AS target_name FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_id
    LEFT JOIN users t ON a.target_type = 'user' AND t.id = a.target_id
    WHERE a.seq < ? AND a.action != 'warband.autosave' ORDER BY a.seq DESC LIMIT ?`).all(beforeSeq ?? Number.MAX_SAFE_INTEGER, limit) as {
    seq: number; at: string; actor_name: string | null; action: string; target_type: string | null; target_id: string | null; target_name: string | null; payload: string | null;
  }[];
  return rows.map((r) => ({
    seq: r.seq, at: r.at, actor: r.actor_name, action: r.action, targetType: r.target_type,
    target: r.target_name ?? r.target_id, payload: r.payload ? JSON.parse(r.payload) as unknown : null,
  }));
}

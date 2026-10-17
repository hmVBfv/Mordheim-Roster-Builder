/* The bug token (phase 4c2; ADR 0019, docs/security.md section 7): how a
   cloud session that works on problem reports gets in. It is a credential of
   its own, not a session and not an account: it can do the actions that name
   `token: true` in policy.ts (reading and sorting reports) and nothing else,
   it needs no cookie and no authenticator, it runs out, and it can be
   revoked. Only roster-cli makes one; the token is printed once and only its
   hash is kept (like sessions and links). Plain functions over the database;
   the rule of what it may do lives in policy.ts. */
import { randomUUID } from 'node:crypto';
import { hashToken, newToken } from './accounts.ts';
import type { DB } from './db.ts';
import type { Actor } from './policy.ts';

/** A visible start, so a token that ends up in a file is recognised (and found by a secret scanner). */
export const TOKEN_PREFIX = 'rbt_';
export const DEFAULT_DAYS = 60;
export const MAX_DAYS = 180;
/** At most this many are good at once: a forgotten one is a door left open. */
export const MAX_ACTIVE = 5;

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString();

export type NewToken = { ok: true; id: string; token: string; expiresAt: string } | { ok: false; problem: string };

export function createBugToken(db: DB, o: { label: string; days: number }, now: Date): NewToken {
  if (!Number.isInteger(o.days) || o.days < 1 || o.days > MAX_DAYS) return { ok: false, problem: `days is 1 to ${MAX_DAYS}` };
  return db.transaction((): NewToken => {
    const active = db.prepare('SELECT count(*) AS n FROM bug_tokens WHERE revoked_at IS NULL AND expires_at > ?').get(iso(now)) as { n: number };
    if (active.n >= MAX_ACTIVE) return { ok: false, problem: `${MAX_ACTIVE} tokens are good already – revoke one first (roster-cli bug-token list)` };
    const id = randomUUID();
    const token = TOKEN_PREFIX + newToken();
    const expiresAt = iso(new Date(now.getTime() + o.days * DAY));
    db.prepare('INSERT INTO bug_tokens (id, label, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(id, o.label.slice(0, 60), hashToken(token), iso(now), expiresAt);
    return { ok: true, id, token, expiresAt };
  })();
}

/** The token's "actor": no account behind it, so no rights beyond the actions that name it. */
export function bugTokenActor(db: DB, token: string, now: Date): Actor | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const row = db.prepare('SELECT id, label, expires_at, revoked_at, last_used_at FROM bug_tokens WHERE token_hash = ?').get(hashToken(token)) as
    { id: string; label: string; expires_at: string; revoked_at: string | null; last_used_at: string | null } | undefined;
  if (!row || row.revoked_at || row.expires_at <= iso(now)) return null;
  // "last used" is for the admin's eyes: once a minute is enough
  if (!row.last_used_at || now.getTime() - Date.parse(row.last_used_at) >= 60_000) db.prepare('UPDATE bug_tokens SET last_used_at = ? WHERE id = ?').run(iso(now), row.id);
  return { id: `bug-token:${row.id}`, username: 'bug-token', displayName: row.label || 'bug token', isAdmin: false, totp: false, sessionId: '', pending: false, token: true };
}

export interface TokenSummary { id: string; label: string; createdAt: string; expiresAt: string; lastUsedAt: string | null; state: 'good' | 'expired' | 'revoked' }

export function listBugTokens(db: DB, now: Date): TokenSummary[] {
  const rows = db.prepare('SELECT id, label, created_at, expires_at, revoked_at, last_used_at FROM bug_tokens ORDER BY created_at DESC, id').all() as
    { id: string; label: string; created_at: string; expires_at: string; revoked_at: string | null; last_used_at: string | null }[];
  return rows.map((r) => ({
    id: r.id, label: r.label, createdAt: r.created_at, expiresAt: r.expires_at, lastUsedAt: r.last_used_at,
    state: r.revoked_at ? 'revoked' : r.expires_at <= iso(now) ? 'expired' : 'good',
  }));
}

export type Revoked = { ok: true; id: string; already: boolean } | { ok: false; problem: string };

/** By its id or the start of it (at least 6 characters, and only one may match). */
export function revokeBugToken(db: DB, ref: string, now: Date): Revoked {
  if (!/^[0-9a-f-]{6,36}$/i.test(ref)) return { ok: false, problem: 'give the id from "roster-cli bug-token list" (at least 6 characters)' };
  const rows = db.prepare("SELECT id, revoked_at FROM bug_tokens WHERE id LIKE ? || '%'").all(ref.toLowerCase()) as { id: string; revoked_at: string | null }[];
  if (rows.length === 0) return { ok: false, problem: `no token starts with "${ref}"` };
  if (rows.length > 1) return { ok: false, problem: `more than one token starts with "${ref}" – give more of the id` };
  const row = rows[0]!;
  if (row.revoked_at) return { ok: true, id: row.id, already: true };
  db.prepare('UPDATE bug_tokens SET revoked_at = ? WHERE id = ?').run(iso(now), row.id);
  return { ok: true, id: row.id, already: false };
}

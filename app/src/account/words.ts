/* The admin's logs in words (server: audit() in routes-accounts.ts and
   cli.ts; recordAttempt() reasons). An unknown action shows as it is, so a
   new one is never hidden. */

export interface AuditEntry { seq: number; at: string; actor: string | null; action: string; targetType: string | null; target: string | null; payload: unknown }
export interface Attempt { id: number; username: string; ip: string; device: string; at: string; ok: boolean; reason: string }

const ACTIONS: Record<string, string> = {
  'user.register': 'joined with an invite',
  'user.password_change': 'changed the password',
  'user.password_reset': 'set a new password with a reset link',
  'user.disable': 'disabled the account of',
  'user.enable': 'enabled the account of',
  'invite.create': 'made an invite',
  'invite.revoke': 'revoked an invite',
  'invite.reset': 'made a reset link for',
  'totp.enable': 'turned the authenticator on',
  'totp.disable': 'turned the authenticator off',
  'totp.reset': 'removed the authenticator of',
  'totp.recovery_used': 'signed in with a recovery code',
  'session.revoke': 'signed out a device',
  'sessions.revoke_others': 'signed out everywhere else',
  'sessions.prune': 'idle devices signed out',
  'sessions.revoke_all': 'signed out everywhere:',
};

/** Actions on someone else name them; on oneself the target is left out. */
const ON_SOMEONE = new Set(['user.disable', 'user.enable', 'invite.reset', 'totp.reset', 'sessions.revoke_all']);

/** Targets whose name is in the line already or that are only an id. */
const QUIET_TARGETS = new Set(['user', 'invite', 'session']);
/** Payload keys the line says in its own words. */
const SAID = new Set(['via', 'note', 'admin', 'left', 'signedOut', 'n', 'invite']);
/** A long id as its first eight characters (a number or a name stays whole). */
const shortId = (t: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t) ? t.slice(0, 8) : t);
const clip = (t: string) => (t.length > 60 ? `${t.slice(0, 59)}…` : t);

export function auditLine(e: AuditEntry): { who: string; what: string; detail: string } {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const VIA: Record<string, string> = { 'bug-token': 'Claude (bug token)', 'roster-cli': 'Raspberry Pi (roster-cli)' };
  const who = e.actor ?? (typeof p.via === 'string' ? VIA[p.via] : undefined) ?? 'unknown actor';
  let what = ACTIONS[e.action] ?? e.action;
  if (ON_SOMEONE.has(e.action) && e.targetType === 'user' && e.target) what += ` ${e.target}`;
  const detail: string[] = [];
  if (typeof p.note === 'string' && p.note) detail.push(`“${p.note}”`);
  if (p.admin === true) detail.push('an admin account');
  if (typeof p.left === 'number') detail.push(`${p.left} codes left`);
  if (typeof p.signedOut === 'number' && p.signedOut > 0) detail.push(`${p.signedOut} signed out`);
  if (typeof p.n === 'number') detail.push(`${p.n} device${p.n === 1 ? '' : 's'}`);
  // what the change was about (#71): a user, an invite or a device is in the line already or means nothing as an id
  if (e.targetType && e.target && !QUIET_TARGETS.has(e.targetType)) detail.push(`${e.targetType} ${shortId(e.target)}`);
  // and the facts the entry carries: short values as they are, a list by its length; never a long text
  for (const [k, v] of Object.entries(p)) {
    if (SAID.has(k)) continue;
    const t = Array.isArray(v) ? String(v.length) : typeof v === 'string' ? clip(v) : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
    if (t !== null && t !== '') detail.push(`${k}: ${t}`);
  }
  return { who, what, detail: detail.join(' · ') };
}

const REASONS: Record<string, string> = {
  password: 'wrong password',
  unknown: 'unknown username',
  disabled: 'account disabled',
  code: 'wrong code',
  braked: 'held back by the brake',
};

export function attemptLine(a: Attempt): string {
  if (a.ok) return a.reason === 'registered' ? 'joined' : 'signed in';
  return `failed: ${REASONS[a.reason] ?? (a.reason || 'refused')}`;
}

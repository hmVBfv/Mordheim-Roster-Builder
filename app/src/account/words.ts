/* The admin's logs in words (server: audit() in routes-accounts.ts and
   cli.ts; recordAttempt() reasons). An unknown action shows as it is, so a
   new one is never hidden. */

export interface AuditEntry { seq: number; at: string; actor: string | null; action: string; targetType: string | null; target: string | null; payload: unknown }
export interface Attempt { id: number; username: string; ip: string; at: string; ok: boolean; reason: string }

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
  'sessions.revoke_all': 'signed out everywhere:',
};

/** Actions on someone else name them; on oneself the target is left out. */
const ON_SOMEONE = new Set(['user.disable', 'user.enable', 'invite.reset', 'totp.reset', 'sessions.revoke_all']);

export function auditLine(e: AuditEntry): { who: string; what: string; detail: string } {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const who = e.actor ?? (p.via === 'roster-cli' ? 'roster-cli on the Pi' : 'someone');
  let what = ACTIONS[e.action] ?? e.action;
  if (ON_SOMEONE.has(e.action) && e.targetType === 'user' && e.target) what += ` ${e.target}`;
  const detail: string[] = [];
  if (typeof p.note === 'string' && p.note) detail.push(`“${p.note}”`);
  if (p.admin === true) detail.push('an admin account');
  if (typeof p.left === 'number') detail.push(`${p.left} codes left`);
  if (typeof p.signedOut === 'number' && p.signedOut > 0) detail.push(`${p.signedOut} signed out`);
  if (typeof p.n === 'number') detail.push(`${p.n} device${p.n === 1 ? '' : 's'}`);
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

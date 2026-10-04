/* The leak-test matrix (ADR 0011, docs/security.md): for every action, who
   may call it and which fields each role may see. Every route of an action
   carries a probe – a request that reaches it – and leak-matrix.test.ts
   sends every probe as every role: a role not listed must be turned away
   (401/403 with nothing but the error), an allowed one must get through, and
   a successful answer may carry only the listed top-level fields. On top,
   no answer anywhere may contain a password hash, a token hash or an
   authenticator secret at rest. A route whose action has no row here, or a
   route without a probe, fails the test. Campaign roles (leader, member)
   and visibility join in phase 3h/4a. */
import type { Action } from '../src/policy.ts';

/** anonymous: no cookie; pending: password right, code due; user: signed in;
    admin: signed in, admin, authenticator set up. (An admin without the
    authenticator is checked on its own in leak-matrix.test.ts.) */
export type Role = 'anonymous' | 'pending' | 'user' | 'admin';
export const ROLES: Role[] = ['anonymous', 'pending', 'user', 'admin'];

/** What a probe may refer to: accounts and links made for the test. */
export interface ProbeContext {
  /** An account the admin acts on (not one of the roles' own). */
  victimId: string;
  victimName: string;
  /** A register link that is still good. */
  inviteToken: string;
  /** Another one, for revoking. */
  spareInviteId: string;
  /** The pending role's current authenticator code. */
  code(): string;
  /** The user role's username and password. */
  username: string;
  password: string;
}

export interface Probe {
  method: 'GET' | 'HEAD' | 'POST' | 'DELETE';
  url: string;
  body?: unknown;
}

export interface MatrixRow {
  /** Who may call it at all. */
  allowed: Role[];
  /** Every route that carries this action ("METHOD /pattern"), with a request that reaches it. */
  routes: Record<string, (c: ProbeContext) => Probe>;
  /** Top-level fields of a successful JSON answer, per allowed role; anything else is a leak. */
  fields?: Partial<Record<Role, string[]>>;
}

const signedIn: Role[] = ['user', 'admin'];
const same = (roles: Role[], fields: string[]) => Object.fromEntries(roles.map((r) => [r, fields])) as Partial<Record<Role, string[]>>;

export const MATRIX: Record<Action, MatrixRow> = {
  'health.read': {
    allowed: ROLES,
    routes: { 'GET /api/v1/health': () => ({ method: 'GET', url: '/api/v1/health' }) },
    fields: same(ROLES, ['status', 'version', 'startedAt', 'epoch', 'db', 'migrations']),
  },
  'app.files': {
    allowed: ROLES,
    routes: {
      'GET /*': () => ({ method: 'GET', url: '/index.html' }),
      'HEAD /*': () => ({ method: 'HEAD', url: '/index.html' }),
    },
  },
  'auth.me': {
    allowed: ROLES,
    routes: { 'GET /api/v1/auth/me': () => ({ method: 'GET', url: '/api/v1/auth/me' }) },
    fields: same(ROLES, ['user', 'pending']),
  },
  'auth.login': {
    allowed: ROLES,
    routes: { 'POST /api/v1/auth/login': (c) => ({ method: 'POST', url: '/api/v1/auth/login', body: { username: c.username, password: c.password } }) },
    fields: same(ROLES, ['stage', 'user']),
  },
  'auth.totp': {
    allowed: ['pending'],
    routes: { 'POST /api/v1/auth/totp': (c) => ({ method: 'POST', url: '/api/v1/auth/totp', body: { code: c.code() } }) },
    fields: { pending: ['stage', 'user'] },
  },
  'auth.logout': {
    allowed: signedIn,
    routes: { 'POST /api/v1/auth/logout': () => ({ method: 'POST', url: '/api/v1/auth/logout' }) },
    fields: same(signedIn, ['ok']),
  },
  'auth.sessions.read': {
    allowed: signedIn,
    routes: { 'GET /api/v1/auth/sessions': () => ({ method: 'GET', url: '/api/v1/auth/sessions' }) },
    fields: same(signedIn, ['sessions']),
  },
  'auth.sessions.revoke': {
    allowed: signedIn,
    routes: { 'DELETE /api/v1/auth/sessions/:id': () => ({ method: 'DELETE', url: '/api/v1/auth/sessions/others' }) },
    fields: same(signedIn, ['revoked']),
  },
  'invites.read': {
    allowed: ROLES,
    routes: { 'POST /api/v1/invites/check': (c) => ({ method: 'POST', url: '/api/v1/invites/check', body: { token: c.inviteToken } }) },
    fields: same(ROLES, ['kind', 'expiresAt', 'username']),
  },
  'invites.accept': {
    allowed: ROLES,
    // a used-up link: reaching the route is enough, the flows are in accounts.test.ts
    routes: { 'POST /api/v1/invites/accept': () => ({ method: 'POST', url: '/api/v1/invites/accept', body: { token: 'gone', password: 'x' } }) },
    fields: same(ROLES, ['stage', 'user']),
  },
  'account.password': {
    allowed: signedIn,
    routes: { 'POST /api/v1/account/password': () => ({ method: 'POST', url: '/api/v1/account/password', body: { current: 'not it', next: 'not changed either' } }) },
    fields: same(signedIn, ['ok', 'signedOut']),
  },
  'account.totp': {
    allowed: signedIn,
    routes: {
      'POST /api/v1/account/totp/setup': () => ({ method: 'POST', url: '/api/v1/account/totp/setup', body: {} }),
      'POST /api/v1/account/totp/enable': () => ({ method: 'POST', url: '/api/v1/account/totp/enable', body: { code: '000000' } }),
      'POST /api/v1/account/totp/disable': () => ({ method: 'POST', url: '/api/v1/account/totp/disable', body: { password: 'not it' } }),
    },
    fields: same(signedIn, ['secret', 'uri', 'recoveryCodes', 'ok']),
  },
  'admin.users.read': {
    allowed: ['admin'],
    routes: { 'GET /api/v1/admin/users': () => ({ method: 'GET', url: '/api/v1/admin/users' }) },
    fields: { admin: ['users'] },
  },
  'admin.users.write': {
    allowed: ['admin'],
    routes: { 'POST /api/v1/admin/users/:id/:op': (c) => ({ method: 'POST', url: `/api/v1/admin/users/${c.victimId}/sign-out`, body: {} }) },
    fields: { admin: ['link', 'token', 'ok', 'revoked', 'signedOut'] },
  },
  'admin.invites.read': {
    allowed: ['admin'],
    routes: { 'GET /api/v1/admin/invites': () => ({ method: 'GET', url: '/api/v1/admin/invites' }) },
    fields: { admin: ['invites'] },
  },
  'admin.invites.write': {
    allowed: ['admin'],
    routes: {
      'POST /api/v1/admin/invites': () => ({ method: 'POST', url: '/api/v1/admin/invites', body: { note: 'matrix' } }),
      'DELETE /api/v1/admin/invites/:id': (c) => ({ method: 'DELETE', url: `/api/v1/admin/invites/${c.spareInviteId}` }),
    },
    fields: { admin: ['id', 'link', 'token', 'ok'] },
  },
  'admin.logins.read': {
    allowed: ['admin'],
    routes: { 'GET /api/v1/admin/logins': () => ({ method: 'GET', url: '/api/v1/admin/logins' }) },
    fields: { admin: ['attempts'] },
  },
  'admin.audit.read': {
    allowed: ['admin'],
    routes: { 'GET /api/v1/admin/audit': () => ({ method: 'GET', url: '/api/v1/admin/audit' }) },
    fields: { admin: ['entries'] },
  },
};

/** Keys no answer may carry, at any depth. */
export const SECRET_KEYS = ['pw_hash', 'pwHash', 'token_hash', 'tokenHash', 'totp_secret_enc', 'totp_pending_enc', 'totp_recovery', 'password'];
/** Values no answer may carry: a password hash, an encrypted secret. */
export const SECRET_VALUES = [/^scrypt\$/, /^v1:[\w-]+:[\w-]+:[\w-]+$/];

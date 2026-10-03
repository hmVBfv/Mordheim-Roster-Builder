/* The one place that decides who may do what (docs/security.md, section 4;
   ADR 0011): `can(actor, action, target)`. Every route names its action, a
   hook in app.ts asks `can()` before the handler runs, and a route without an
   action refuses to register – so no endpoint can check rights on its own or
   forget to. Every action also has its row in the leak-test matrix
   (server/test/leak-matrix.ts); the test fails for an action without one.

   Phase 3g brings accounts. The actor is whoever the session cookie names:
   nobody (null), someone between password and authenticator code
   (`pending`), or a signed-in user. An admin – and later a leader – must have
   the authenticator set up (ADR 0008); until then such an account may only
   look after itself. Campaign roles and targets (a warband, a note) join in
   phase 3h/4a. */

export interface Actor {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  /** The authenticator is set up. */
  totp: boolean;
  sessionId: string;
  /** Password right, authenticator code still due. */
  pending: boolean;
}

type Who = 'public' | 'pending' | 'user' | 'admin';

export const ACTIONS = {
  /** GET /api/v1/health – for roster-deploy, the container healthcheck and roster-alive. */
  'health.read': { who: 'public' },
  /** The static files of the app's campaign build – the same for everyone, no data in them. */
  'app.files': { who: 'public' },
  /** Who am I: the signed-in user, or nobody. */
  'auth.me': { who: 'public' },
  'auth.login': { who: 'public' },
  /** The authenticator's code after the password. */
  'auth.totp': { who: 'pending' },
  'auth.logout': { who: 'user' },
  'auth.sessions.read': { who: 'user' },
  'auth.sessions.revoke': { who: 'user' },
  /** A one-time link: whether it is still good, and using it. */
  'invites.read': { who: 'public' },
  'invites.accept': { who: 'public' },
  'account.password': { who: 'user' },
  'account.totp': { who: 'user' },
  'admin.users.read': { who: 'admin' },
  'admin.users.write': { who: 'admin' },
  'admin.invites.read': { who: 'admin' },
  'admin.invites.write': { who: 'admin' },
  /** Who signed in when, from where (Rob, 03.10.2026: log data next to logins). */
  'admin.logins.read': { who: 'admin' },
  'admin.audit.read': { who: 'admin' },
} as const satisfies Record<string, { who: Who }>;

export type Action = keyof typeof ACTIONS;

export const isAction = (a: unknown): a is Action => typeof a === 'string' && Object.hasOwn(ACTIONS, a);

/** Actions an account may use before its required authenticator is set up:
    looking after itself, and leaving. */
const SELF_CARE: ReadonlySet<Action> = new Set(['auth.me', 'auth.logout', 'auth.sessions.read', 'auth.sessions.revoke', 'account.password', 'account.totp']);

/** An admin must have the authenticator (ADR 0008). */
export const mustSetUpTotp = (a: Actor) => a.isAdmin && !a.totp;

/** can(actor, action) – targets join with the campaign data. */
export function can(actor: Actor | null, action: Action): boolean {
  const who: Who = ACTIONS[action].who;
  if (who === 'public') return true;
  if (!actor) return false;
  if (who === 'pending') return actor.pending;
  if (actor.pending) return false;
  if (mustSetUpTotp(actor) && !SELF_CARE.has(action)) return false;
  if (who === 'user') return true;
  return actor.isAdmin;
}

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
   look after itself.

   Phase 3h brings the first target: a warband. An action with `owner`
   needs a signed-in user at the door (the hook in app.ts) and, once the
   handler has loaded the warband, `can(actor, action, warband)` again – only
   its owner gets through; everyone else is told it does not exist (404).
   Not even the admin sees another's warband (concept.md: no special access
   to content).

   Phase 4a brings campaigns. A campaign action names what the actor must be
   in it – a member (leader, player or viewer), a player (leader or player),
   or a leader – and the handler asks `can(actor, action, { role })` with the
   actor's role there. Someone outside the campaign is told it does not exist
   (404); a member without the right gets a 403. A leader must have the
   authenticator set up (ADR 0008), like an admin; so must whoever starts a
   campaign, as its first leader. */

import type { CampaignRole } from './campaigns.ts';

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

/** totp: signed in with the authenticator set up. */
type Who = 'public' | 'pending' | 'user' | 'totp' | 'admin';
type TargetKind = 'owner' | 'member' | 'player' | 'leader';

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
  /** One's own warbands: the list, and what changed since a cursor (GET /sync). */
  'warbands.list': { who: 'user' },
  /** A new warband of one's own (made, imported or copied). */
  'warbands.create': { who: 'user' },
  /** A warband, its versions and draft – its owner only. */
  'warband.read': { who: 'user', target: 'owner' },
  /** A new version, the draft, removing and bringing back – its owner only. */
  'warband.write': { who: 'user', target: 'owner' },
  /** Who else is signed up – names only – to send a copy to (Rob, 05.10.2026). */
  'people.list': { who: 'user' },
  /** One's shares: sent, and waiting to be answered. */
  'shares.read': { who: 'user' },
  /** Sharing a copy (to a player or as a code), and looking up or taking a code. */
  'shares.create': { who: 'user' },
  /** Taking or declining a copy sent to oneself – its recipient only. */
  'share.answer': { who: 'user', target: 'owner' },
  /** Taking back one's share – its sender only. */
  'share.revoke': { who: 'user', target: 'owner' },
  /** One's campaigns. */
  'campaigns.list': { who: 'user' },
  /** Starting a campaign, as its first leader – with the authenticator (ADR 0008). */
  'campaigns.create': { who: 'totp' },
  /** A campaign: its members, the warbands entered and their state – every member (ADR 0002: mechanics open). */
  'campaign.read': { who: 'user', target: 'member' },
  /** A warband entered in the campaign, someone else's included – every member. */
  'campaign.warband.read': { who: 'user', target: 'member' },
  /** Entering a warband of one's own, or withdrawing it – leaders and players. */
  'campaign.enrol': { who: 'user', target: 'player' },
  /** Name, members and roles, confirming warbands – leaders, with the authenticator. */
  'campaign.manage': { who: 'user', target: 'leader' },
  /** Setting up a battle and writing its protocol, deciding corrections – leaders only (ADR 0010). */
  'battle.write': { who: 'user', target: 'leader' },
  /** A correction of the protocol – leaders and players; they see it live and propose (concept.md 4.5). */
  'battle.propose': { who: 'user', target: 'player' },
  /** Marking one's warband "after battle N" – its player (phase 4a4). */
  'battle.mark': { who: 'user', target: 'player' },
  /** Writing one's notes (and a leader correcting another's words) – leaders and players, not viewers. */
  'notes.write': { who: 'user', target: 'player' },
} as const satisfies Record<string, { who: Who; target?: TargetKind }>;

export type Action = keyof typeof ACTIONS;

export const isAction = (a: unknown): a is Action => typeof a === 'string' && Object.hasOwn(ACTIONS, a);

/** Actions an account may use before its required authenticator is set up:
    looking after itself, and leaving. */
const SELF_CARE: ReadonlySet<Action> = new Set(['auth.me', 'auth.logout', 'auth.sessions.read', 'auth.sessions.revoke', 'account.password', 'account.totp']);

/** An admin must have the authenticator (ADR 0008). */
export const mustSetUpTotp = (a: Actor) => a.isAdmin && !a.totp;

/** What an action may be aimed at: something with an owner (a warband, a
    share), or a campaign, given as the actor's role in it (null: none). */
export type Target = { ownerId: string } | { role: CampaignRole | null };

/** can(actor, action[, target]). Without a target an action with one only
    asks who is at the door; the handler asks again with the target. */
export function can(actor: Actor | null, action: Action, target?: Target): boolean {
  const def: { who: Who; target?: TargetKind } = ACTIONS[action];
  if (!canAtDoor(actor, def.who, action)) return false;
  if (!target || !def.target) return true;
  if (def.target === 'owner') return 'ownerId' in target && actor!.id === target.ownerId;
  const role = 'role' in target ? target.role : null;
  if (!role) return false;
  if (def.target === 'member') return true;
  if (def.target === 'player') return role === 'leader' || role === 'player';
  return role === 'leader' && actor!.totp;
}

function canAtDoor(actor: Actor | null, who: Who, action: Action): boolean {
  if (who === 'public') return true;
  if (!actor) return false;
  if (who === 'pending') return actor.pending;
  if (actor.pending) return false;
  if (mustSetUpTotp(actor) && !SELF_CARE.has(action)) return false;
  if (who === 'user') return true;
  if (who === 'totp') return actor.totp;
  return actor.isAdmin;
}

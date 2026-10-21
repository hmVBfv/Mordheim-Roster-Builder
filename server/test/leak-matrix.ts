/* The leak-test matrix (ADR 0011, docs/security.md): for every action, who
   may call it and which fields each role may see. Every route of an action
   carries a probe – a request that reaches it – and leak-matrix.test.ts
   sends every probe as every role: a role not listed must be turned away
   (401/403 with nothing but the error), an allowed one must get through, and
   a successful answer may carry only the listed top-level fields. On top,
   no answer anywhere may contain a password hash, a token hash or an
   authenticator secret at rest. A route whose action has no row here, or a
   route without a probe, fails the test. A warband (phase 3h) belongs to
   the "user" role; for anyone else it does not exist (404 counts as turned
   away). Campaigns (phase 4a): the "user" role is a player in one campaign
   the "admin" role is not part of, and in one the admin leads – so every
   campaign action is tried by a member, a member without the right (403)
   and an outsider (404), the admin included (no special access).
   Visibility of hidden content joins with notes and the background. */
import { randomUUID } from 'node:crypto';
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
  /** A warband of the user role, its current version, and one to remove and bring back. */
  warbandId: string;
  headRev(): number;
  spareWarbandId: string;
  /** A warband save the server accepts. */
  save: Record<string, unknown>;
  /** A copy sent to the user role (to take or decline), one the user role sent (to take back), and a code. */
  incomingShareId: string;
  outgoingShareId: string;
  shareCode: string;
  /** A campaign led by the victim, the user role a player in it, the admin outside; the victim's warband entered in it, and the user role's. */
  campaignId: string;
  enteredWarbandId: string;
  ownEnrolmentId: string;
  /** A campaign the admin leads, the user role a player in it; two of the user role's warbands waiting for the admin. */
  ledCampaignId: string;
  pendingEnrolmentIds: [string, string];
  /** A battle in the victim's campaign; one in the admin's, with a protocol entry and two open corrections of the user role's. */
  battleId: string;
  ledBattleId: string;
  /** A second open battle in the admin's campaign, with nothing on it: the one that is taken out. */
  spareBattleId: string;
  ledEntryId: string;
  ledProposalIds: [string, string];
  /** The user role's warband confirmed in the admin's campaign. */
  ledWarbandId: string;
  /** A note of the user role's in the victim's campaign. */
  ownNoteId: string;
  /** Pictures of the user role's in the victim's campaign: one stored, one waiting for its bytes (phase 4a3). */
  ownPictureId: string;
  pendingPictureId: string;
  /** A campaign the admin leads, the user role a player in it, that the admin's probe deletes (with its name). */
  doomedCampaignId: string;
  doomedCampaignName: string;
  /** A campaign the admin leads with no battle of its own yet, the user role's warband confirmed in it, and a battle of its history (phase 4a5). */
  historyCampaignId: string;
  historyWarbandId: string;
  pastBattleId: string;
  /** A published chapter in the victim's campaign, and one in the admin's (phase 4a5, part 2). */
  chapterId: string;
  ledChapterId: string;
  /** Background entries of the admin's campaign: one to read and reveal, a spare to take out (phase 4b1). */
  ledBackgroundId: string;
  spareBackgroundId: string;
  /** The user role's id, and an open question of the victim's campaign asked of the user role (phase 4b3). */
  userId: string;
  ownQuestionId: string;
  /** The world of the admin's campaign (phase 4b3b): a faction to rate and to put NPCs under, a spare faction, an NPC and a reputation event to take out. */
  ledFactionId: string;
  spareFactionId: string;
  ledNpcId: string;
  ledEventId: string;
  /** Scenarios of the admin's campaign (phase 4b3c): a draft to release, a spare draft to take out. */
  ledScenarioId: string;
  spareScenarioId: string;
  /** Opponents of the admin's campaign: a group and a skill to take out. */
  spareOpponentGroupId: string;
  spareOpponentSkillId: string;
  /** The style guide of the admin's campaign was written once: the seq an edit starts from (phase 4b4a). */
  ledStyleSeq: number;
  /** Chapter drafts of the admin's campaign (phase 4b5b): one to publish, a spare one to throw away. */
  ledDraftId: string;
  spareDraftId: string;
  /** A problem report of the user role's (phase 4c1): the admin reads and sorts it. */
  bugId: string;
}

export interface Probe {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  /** For a body that is not JSON (a picture's bytes). */
  headers?: Record<string, string>;
  /** A stream that does not end by itself: the test reads its first bytes over a real connection and hangs up. */
  stream?: true;
}

/** A real 1×1 PNG: the bytes of a picture probe. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export interface MatrixRow {
  /** Who may call it at all. */
  allowed: Role[];
  /** Every route that carries this action ("METHOD /pattern"), with a request that reaches it. */
  routes: Record<string, (c: ProbeContext) => Probe>;
  /** Top-level fields of a successful JSON answer, per allowed role; anything else is a leak. */
  fields?: Partial<Record<Role, string[]>>;
}

const signedIn: Role[] = ['user', 'admin'];
/** A campaign as its members see it. */
const VIEW = ['campaign', 'role', 'members', 'enrolments', 'battles'];
/** A battle as its campaign's members see it. */
const BATTLE = ['battle', 'seq', 'participants', 'entries', 'proposals', 'unchanged', 'marks'];
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
  'events.read': {
    allowed: signedIn,
    // an answer that is a stream has no fields to list; a refusal is JSON like any other
    routes: { 'GET /api/v1/events': () => ({ method: 'GET', url: '/api/v1/events', stream: true }) },
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
  // each signed-in user lists and syncs only their own
  'warbands.list': {
    allowed: signedIn,
    routes: {
      'GET /api/v1/warbands': () => ({ method: 'GET', url: '/api/v1/warbands' }),
      'GET /api/v1/sync': () => ({ method: 'GET', url: '/api/v1/sync?cursor=0' }),
    },
    fields: same(signedIn, ['warbands', 'epoch', 'cursor']),
  },
  'warbands.create': {
    allowed: signedIn,
    routes: { 'POST /api/v1/warbands': (c) => ({ method: 'POST', url: '/api/v1/warbands', body: { id: randomUUID(), data: c.save, source: 'save' } }) },
    fields: same(signedIn, ['warband', 'rev']),
  },
  'warband.read': {
    allowed: ['user'],
    routes: {
      'GET /api/v1/warbands/:id': (c) => ({ method: 'GET', url: `/api/v1/warbands/${c.warbandId}` }),
      'GET /api/v1/warbands/:id/versions': (c) => ({ method: 'GET', url: `/api/v1/warbands/${c.warbandId}/versions` }),
      'GET /api/v1/warbands/:id/versions/:rev': (c) => ({ method: 'GET', url: `/api/v1/warbands/${c.warbandId}/versions/1` }),
    },
    fields: { user: ['warband', 'head', 'draft', 'versions', 'version'] },
  },
  'warband.write': {
    allowed: ['user'],
    routes: {
      'POST /api/v1/warbands/:id/versions': (c) => ({ method: 'POST', url: `/api/v1/warbands/${c.warbandId}/versions`, body: { baseRev: c.headRev(), data: c.save } }),
      'PUT /api/v1/warbands/:id/autosave': (c) => ({ method: 'PUT', url: `/api/v1/warbands/${c.warbandId}/autosave`, body: { baseRev: c.headRev(), data: c.save, force: true } }),
      'DELETE /api/v1/warbands/:id/autosave': (c) => ({ method: 'DELETE', url: `/api/v1/warbands/${c.warbandId}/autosave` }),
      'DELETE /api/v1/warbands/:id': (c) => ({ method: 'DELETE', url: `/api/v1/warbands/${c.spareWarbandId}` }),
      'POST /api/v1/warbands/:id/unarchive': (c) => ({ method: 'POST', url: `/api/v1/warbands/${c.spareWarbandId}/unarchive`, body: {} }),
    },
    fields: { user: ['warband', 'rev', 'seq', 'dropped'] },
  },
  // sharing (Rob, 05.10.2026): names of the others, and copies only
  'people.list': {
    allowed: signedIn,
    routes: { 'GET /api/v1/people': () => ({ method: 'GET', url: '/api/v1/people' }) },
    fields: same(signedIn, ['people']),
  },
  'shares.read': {
    allowed: signedIn,
    routes: { 'GET /api/v1/shares': () => ({ method: 'GET', url: '/api/v1/shares' }) },
    fields: same(signedIn, ['incoming', 'outgoing']),
  },
  'shares.create': {
    allowed: signedIn,
    routes: {
      'POST /api/v1/shares': (c) => ({ method: 'POST', url: '/api/v1/shares', body: { data: c.save } }),
      'POST /api/v1/shares/peek': (c) => ({ method: 'POST', url: '/api/v1/shares/peek', body: { code: c.shareCode } }),
      'POST /api/v1/shares/redeem': (c) => ({ method: 'POST', url: '/api/v1/shares/redeem', body: { code: c.shareCode, warbandId: randomUUID() } }),
    },
    fields: same(signedIn, ['id', 'code', 'expiresAt', 'name', 'wbType', 'from', 'warband', 'head']),
  },
  'share.answer': {
    allowed: ['user'],
    routes: {
      'POST /api/v1/shares/:id/accept': (c) => ({ method: 'POST', url: `/api/v1/shares/${c.incomingShareId}/accept`, body: { warbandId: randomUUID() } }),
      'POST /api/v1/shares/:id/decline': (c) => ({ method: 'POST', url: `/api/v1/shares/${c.incomingShareId}/decline`, body: {} }),
    },
    fields: { user: ['warband', 'head', 'ok'] },
  },
  'share.revoke': {
    allowed: ['user'],
    routes: { 'DELETE /api/v1/shares/:id': (c) => ({ method: 'DELETE', url: `/api/v1/shares/${c.outgoingShareId}` }) },
    fields: { user: ['ok'] },
  },
  'campaigns.list': {
    allowed: signedIn,
    routes: { 'GET /api/v1/campaigns': () => ({ method: 'GET', url: '/api/v1/campaigns' }) },
    fields: same(signedIn, ['campaigns']),
  },
  'campaigns.create': {
    // the first leader needs the authenticator: the user role has none
    allowed: ['admin'],
    routes: { 'POST /api/v1/campaigns': () => ({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'Probing the Hel Fenn' } }) },
    fields: { admin: VIEW },
  },
  'campaign.read': {
    allowed: ['user'],
    routes: {
      'GET /api/v1/campaigns/:id': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}` }),
      'GET /api/v1/campaigns/:id/battles': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/battles` }),
      'GET /api/v1/campaigns/:id/battles/:bid': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/battles/${c.battleId}` }),
      'GET /api/v1/campaigns/:id/notes': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/notes` }),
      'GET /api/v1/campaigns/:id/attachments': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/attachments` }),
      'GET /api/v1/campaigns/:id/attachments/:aid/file': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/attachments/${c.ownPictureId}/file` }),
      'GET /api/v1/campaigns/:id/timeline': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/timeline` }),
      'GET /api/v1/campaigns/:id/chapters/:chid': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/chapters/${c.chapterId}` }),
    },
    fields: { user: [...VIEW, ...BATTLE, 'notes', 'attachments', 'positions', 'entries', 'outcomes', 'marks', 'chapters', 'chapter'] },
  },
  'campaign.warband.read': {
    allowed: ['user'],
    routes: { 'GET /api/v1/campaigns/:id/warbands/:wid': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/warbands/${c.enteredWarbandId}` }) },
    fields: { user: ['warband', 'player', 'status', 'head', 'draft', 'tags'] },
  },
  'campaign.enrol': {
    allowed: ['user'],
    routes: {
      'POST /api/v1/campaigns/:id/enrolments': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.campaignId}/enrolments`, body: { warbandId: randomUUID(), data: c.save } }),
      'DELETE /api/v1/campaigns/:id/enrolments/:eid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.campaignId}/enrolments/${c.ownEnrolmentId}` }),
    },
    fields: { user: [...VIEW, 'enrolmentId', 'warband', 'head'] },
  },
  'campaign.delete': {
    // the user role is a player there (403), the admin leads it; the admin's probe comes last and deletes it
    allowed: ['admin'],
    routes: { 'DELETE /api/v1/campaigns/:id': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.doomedCampaignId}`, body: { name: c.doomedCampaignName } }) },
    fields: { admin: ['deleted'] },
  },
  'campaign.archive': {
    // every member files it away for themselves; the admin is outside the victim's campaign (404)
    allowed: ['user'],
    routes: { 'PUT /api/v1/campaigns/:id/archive': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/archive`, body: { archived: true } }) },
    fields: { user: ['archived'] },
  },
  'campaign.manage': {
    // the user role is a player there (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'PATCH /api/v1/campaigns/:id': (c) => ({ method: 'PATCH', url: `/api/v1/campaigns/${c.ledCampaignId}`, body: { name: 'The Probed Fenn' } }),
      'PUT /api/v1/campaigns/:id/members/:userId': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/members/${c.victimId}`, body: { role: 'viewer' } }),
      'DELETE /api/v1/campaigns/:id/members/:userId': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/members/${c.victimId}` }),
      'POST /api/v1/campaigns/:id/enrolments/:eid/confirm': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/enrolments/${c.pendingEnrolmentIds[0]}/confirm`, body: {} }),
      'POST /api/v1/campaigns/:id/enrolments/:eid/decline': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/enrolments/${c.pendingEnrolmentIds[1]}/decline`, body: {} }),
      'POST /api/v1/campaigns/:id/rounds/advance': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/rounds/advance`, body: {} }),
      'PUT /api/v1/campaigns/:id/house-rules': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/house-rules`, body: { rules: { freeDagger: true } } }),
      'PUT /api/v1/campaigns/:id/history/:bid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.historyCampaignId}/history/${randomUUID()}`, body: { round: 2, title: 'The probed mill', outcomes: { [c.historyWarbandId]: 'victory' } } }),
      'DELETE /api/v1/campaigns/:id/history/:bid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.historyCampaignId}/history/${c.pastBattleId}` }),
      'PUT /api/v1/campaigns/:id/chapters/:chid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/chapters/${randomUUID()}`, body: { refKey: `probe-${randomUUID().slice(0, 8)}`, kind: 'chapter', de: { title: 'Die Sonde', text: 'Nebel.' }, place: { segment: 'pre', pos: '5' } } }),
      'DELETE /api/v1/campaigns/:id/chapters/:chid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/chapters/${c.ledChapterId}` }),
    },
    fields: { admin: [...VIEW, 'left', 'chapter', 'removed'] },
  },
  'battle.write': {
    // the user role is a player there (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'POST /api/v1/campaigns/:id/battles': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles`, body: { id: randomUUID(), title: 'Probing the ferry', warbandIds: [c.ledWarbandId] } }),
      'PATCH /api/v1/campaigns/:id/battles/:bid': (c) => ({ method: 'PATCH', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}`, body: { turn: 2 } }),
      'DELETE /api/v1/campaigns/:id/battles/:bid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.spareBattleId}` }),
      'PUT /api/v1/campaigns/:id/battles/:bid/protocol/:eid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/protocol/${randomUUID()}`, body: { turn: 2, kind: 'event', payload: { text: 'The ferry drifts.' } } }),
      'DELETE /api/v1/campaigns/:id/battles/:bid/protocol/:eid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/protocol/${c.ledEntryId}` }),
      'POST /api/v1/campaigns/:id/battles/:bid/proposals/:pid/accept': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/proposals/${c.ledProposalIds[0]}/accept`, body: {} }),
      'POST /api/v1/campaigns/:id/battles/:bid/proposals/:pid/reject': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/proposals/${c.ledProposalIds[1]}/reject`, body: {} }),
      'POST /api/v1/campaigns/:id/battles/:bid/close': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/close`, body: {} }),
    },
    fields: { admin: [...BATTLE, 'entry', 'removed'] },
  },
  'battle.mark': {
    // a mark is the player's own: the user role marks its warband in the admin's campaign (still open: refused, but reached)
    allowed: ['user'],
    routes: {
      'POST /api/v1/campaigns/:id/battles/:bid/marks': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/marks`, body: { warbandId: c.ledWarbandId, rev: 1 } }),
    },
    fields: { user: ['tag', 'changes'] },
  },
  'battle.confirm': {
    // the player confirms the version of its warband for a battle of the admin's campaign; the admin, a leader there, may do it for them
    allowed: ['user', 'admin'],
    routes: {
      'POST /api/v1/campaigns/:id/battles/:bid/confirm': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/battles/${c.ledBattleId}/confirm`, body: { warbandId: c.ledWarbandId, rev: 1 } }),
    },
    fields: { user: [...BATTLE], admin: [...BATTLE] },
  },
  'notes.write': {
    allowed: ['user'],
    routes: {
      // first: the note is taken out further down
      'PUT /api/v1/campaigns/:id/timeline/:type/:itemId': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/timeline/note/${c.ownNoteId}`, body: { segment: 'pre', pos: '5' } }),
      'PUT /api/v1/campaigns/:id/notes/:nid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/notes/${randomUUID()}`, body: { battleId: c.battleId, turn: 2, kind: 'quote', text: 'Bolt the doors.' } }),
      'DELETE /api/v1/campaigns/:id/notes/:nid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.campaignId}/notes/${c.ownNoteId}` }),
      'PUT /api/v1/campaigns/:id/attachments/:aid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/attachments/${randomUUID()}`, body: { mime: 'image/png', bytes: PNG.length, width: 1, height: 1, caption: 'Probing the ferry' } }),
      'PUT /api/v1/campaigns/:id/attachments/:aid/file': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/attachments/${c.pendingPictureId}/file`, body: PNG, headers: { 'content-type': 'image/png' } }),
      'DELETE /api/v1/campaigns/:id/attachments/:aid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.campaignId}/attachments/${c.ownPictureId}` }),
    },
    fields: { user: ['note', 'seq', 'removed', 'attachment', 'position'] },
  },
  'questions.read': {
    // the user role is a player in the victim's campaign, the admin outside it
    allowed: ['user'],
    routes: { 'GET /api/v1/campaigns/:id/questions': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/questions` }) },
    fields: { user: ['questions', 'seq'] },
  },
  'questions.write': {
    // the user role is a player in the admin's campaign (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/questions/:qid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/questions/${randomUUID()}`, body: { to: c.userId, text: 'How did the night go?' } }),
    },
    fields: { admin: ['question', 'seq'] },
  },
  'questions.answer': {
    allowed: ['user'],
    routes: {
      'POST /api/v1/campaigns/:id/questions/:qid/answer': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.campaignId}/questions/${c.ownQuestionId}/answer`, body: { noteId: randomUUID(), text: 'We slept in the barn.' } }),
    },
    fields: { user: ['question', 'note', 'seq'] },
  },
  'world.read': {
    // the user role is a player in the victim's campaign, the admin outside it – a viewer would read it too: it is mechanics
    allowed: ['user'],
    routes: { 'GET /api/v1/campaigns/:id/world': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/world` }) },
    fields: { user: ['factions', 'npcs', 'reputation', 'seq'] },
  },
  'world.write': {
    // the user role is a player in the admin's campaign (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/world/factions/:fid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/world/factions/${randomUUID()}`, body: { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' } }),
      'PUT /api/v1/campaigns/:id/world/npcs/:nid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/world/npcs/${randomUUID()}`, body: { factionId: c.ledFactionId, nameEn: 'Old Marek', publicStatus: 'alive' } }),
      'PUT /api/v1/campaigns/:id/world/reputation/:rid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/world/reputation/${randomUUID()}`, body: { warbandId: c.ledWarbandId, factionId: c.ledFactionId, delta: 2, reason: 'Escorted the barge.' } }),
      'DELETE /api/v1/campaigns/:id/world/reputation/:rid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/world/reputation/${c.ledEventId}` }),
      'DELETE /api/v1/campaigns/:id/world/npcs/:nid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/world/npcs/${c.ledNpcId}` }),
      'DELETE /api/v1/campaigns/:id/world/factions/:fid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/world/factions/${c.spareFactionId}` }),
    },
    fields: { admin: ['factions', 'npcs', 'reputation', 'seq', 'removed'] },
  },
  'scenarios.read': {
    // the user role is a player in the victim's campaign, the admin outside it. A player reads the released scenario there and never the draft
    allowed: ['user'],
    routes: { 'GET /api/v1/campaigns/:id/scenarios': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/scenarios` }) },
    fields: { user: ['scenarios', 'seq'] },
  },
  'scenarios.write': {
    // the user role is a player in the admin's campaign (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/scenarios/:sid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/scenarios/${randomUUID()}`, body: { title: 'The ferry at night', body: 'Rules of the night.', npcStatlines: 'Captain Brandt M4 WS4' } }),
      'POST /api/v1/campaigns/:id/scenarios/:sid/release': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/scenarios/${c.ledScenarioId}/release`, body: { battleId: c.ledBattleId } }),
      'DELETE /api/v1/campaigns/:id/scenarios/:sid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/scenarios/${c.spareScenarioId}` }),
    },
    fields: { admin: ['scenario', 'seq', 'removed'] },
  },
  'backstory.read': {
    // the user role is a player in the victim's campaign, the admin outside it – a viewer would read it too: it is the story the players lived
    allowed: ['user'],
    routes: { 'GET /api/v1/campaigns/:id/backstory': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.campaignId}/backstory` }) },
    fields: { user: ['backstory'] },
  },
  'backstory.write': {
    // the user role is a player in the admin's campaign (403), the admin leads it
    allowed: ['admin'],
    routes: { 'PUT /api/v1/campaigns/:id/backstory': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/backstory`, body: { sections: [{ heading: 'Battle 1 – the ferry', battleNo: 1, text: 'Rain over the Stir.' }], baseSeq: 0 } }) },
    fields: { admin: ['backstory'] },
  },
  'plans.read': {
    // the admin leads the campaign (the user role is a player there: 403); the plans of the victim's campaign carry a marker no role may read
    allowed: ['admin'],
    routes: { 'GET /api/v1/campaigns/:id/plans': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/plans` }) },
    fields: { admin: ['plans'] },
  },
  'plans.write': {
    allowed: ['admin'],
    routes: { 'PUT /api/v1/campaigns/:id/plans/:round': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/plans/2`, body: { text: 'The ferry burns.', baseSeq: 0 } }) },
    fields: { admin: ['plan'] },
  },
  'opponents.read': {
    // the admin leads the campaign (the user role is a player there: 403); the opponents of the victim's campaign carry a marker no role may read
    allowed: ['admin'],
    routes: { 'GET /api/v1/campaigns/:id/opponents': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/opponents` }) },
    fields: { admin: ['groups', 'skills', 'seq'] },
  },
  'opponents.write': {
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/opponents/groups/:gid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/opponents/groups/${randomUUID()}`, body: { name: 'The ferrymen', profiles: [{ id: 'p1', name: 'Ferryman', profile: { M: '4', WS: '3' } }], baseSeq: 0 } }),
      'DELETE /api/v1/campaigns/:id/opponents/groups/:gid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/opponents/groups/${c.spareOpponentGroupId}` }),
      'PUT /api/v1/campaigns/:id/opponents/skills/:sid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/opponents/skills/${randomUUID()}`, body: { name: 'Ferryman’s Luck', text: 'Re-roll one dice.', baseSeq: 0 } }),
      'DELETE /api/v1/campaigns/:id/opponents/skills/:sid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/opponents/skills/${c.spareOpponentSkillId}` }),
    },
    fields: { admin: ['group', 'skill', 'removed', 'seq'] },
  },
  'style.read': {
    // the admin leads the campaign (the user role is a player there: 403); the style guide of the victim's campaign carries a marker no role may read
    allowed: ['admin'],
    routes: { 'GET /api/v1/campaigns/:id/style': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/style` }) },
    fields: { admin: ['style'] },
  },
  'style.write': {
    allowed: ['admin'],
    routes: { 'PUT /api/v1/campaigns/:id/style': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/style`, body: { text: 'German, past tense, close third person.', baseSeq: c.ledStyleSeq } }) },
    fields: { admin: ['style'] },
  },
  'drafts.read': {
    // the admin leads the campaign (the user role is a player there: 403); the drafts of the victim's campaign carry a marker no role may read
    allowed: ['admin'],
    routes: { 'GET /api/v1/campaigns/:id/chapter-drafts': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/chapter-drafts` }) },
    fields: { admin: ['drafts', 'seq'] },
  },
  'drafts.write': {
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/chapter-drafts/:did': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/chapter-drafts/${randomUUID()}`, body: { refKey: 'battle-2', kind: 'battle', lang: 'de', title: 'Die Mühle', text: 'Nebel lag über dem Mühlbach.' } }),
      'POST /api/v1/campaigns/:id/chapter-drafts/:did/publish': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/chapter-drafts/${c.ledDraftId}/publish`, body: { at: { segment: 'pre', pos: '5' } } }),
      'DELETE /api/v1/campaigns/:id/chapter-drafts/:did': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/chapter-drafts/${c.spareDraftId}` }),
    },
    fields: { admin: ['draft', 'chapter', 'seq', 'removed'] },
  },
  'background.read': {
    // the user role is a player there (403), the admin leads it
    allowed: ['admin'],
    routes: {
      'GET /api/v1/campaigns/:id/background': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/background` }),
      'GET /api/v1/campaigns/:id/background/:eid': (c) => ({ method: 'GET', url: `/api/v1/campaigns/${c.ledCampaignId}/background/${c.ledBackgroundId}` }),
    },
    fields: { admin: ['entries', 'seq', 'entry', 'revisions', 'reveals'] },
  },
  'background.write': {
    allowed: ['admin'],
    routes: {
      'PUT /api/v1/campaigns/:id/background/:eid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.ledCampaignId}/background/${randomUUID()}`, body: { kind: 'thread', title: 'Probing the ferryman', truth: 'Nothing of this may leave.' } }),
      'POST /api/v1/campaigns/:id/background/:eid/reveal': (c) => ({ method: 'POST', url: `/api/v1/campaigns/${c.ledCampaignId}/background/${c.ledBackgroundId}/reveal`, body: { noteId: randomUUID(), text: 'The ferryman did not come back.', level: 'hint' } }),
      'DELETE /api/v1/campaigns/:id/background/:eid': (c) => ({ method: 'DELETE', url: `/api/v1/campaigns/${c.ledCampaignId}/background/${c.spareBackgroundId}` }),
    },
    fields: { admin: ['entry', 'seq', 'note', 'removed'] },
  },
  'bugs.report': {
    // anyone signed in may send one – the admin too, with the authenticator
    allowed: signedIn,
    routes: {
      'POST /api/v1/bugs': () => ({ method: 'POST', url: '/api/v1/bugs', body: { id: randomUUID(), kind: 'bug', title: 'The roster does not scroll', text: 'It stops at the third hero.' } }),
    },
    fields: same(signedIn, ['bug']),
  },
  'bugs.mine': {
    // each reads only their own; the other reporters' words and copies carry markers no role may read here
    allowed: signedIn,
    routes: { 'GET /api/v1/bugs/mine': () => ({ method: 'GET', url: '/api/v1/bugs/mine' }) },
    fields: same(signedIn, ['bugs']),
  },
  'bugs.read': {
    // the admin reads the list (a summary: no words, no copy) and one report that carries no marker
    allowed: ['admin'],
    routes: {
      'GET /api/v1/bugs': () => ({ method: 'GET', url: '/api/v1/bugs?status=all' }),
      'GET /api/v1/bugs/:id': (c) => ({ method: 'GET', url: `/api/v1/bugs/${c.bugId}` }),
    },
    fields: { admin: ['bugs', 'bug'] },
  },
  'bugs.write': {
    allowed: ['admin'],
    routes: { 'PATCH /api/v1/bugs/:id': (c) => ({ method: 'PATCH', url: `/api/v1/bugs/${c.bugId}`, body: { status: 'confirmed', severity: 'S3' } }) },
    fields: { admin: ['bug'] },
  },
  'battle.propose': {
    allowed: ['user'],
    routes: {
      'PUT /api/v1/campaigns/:id/battles/:bid/proposals/:pid': (c) => ({ method: 'PUT', url: `/api/v1/campaigns/${c.campaignId}/battles/${c.battleId}/proposals/${randomUUID()}`, body: { text: 'Magda was taken out in turn 3, not 4.' } }),
    },
    fields: { user: ['ok', 'seq'] },
  },
};

/** Keys no answer may carry, at any depth. */
export const SECRET_KEYS = ['pw_hash', 'pwHash', 'token_hash', 'tokenHash', 'totp_secret_enc', 'totp_pending_enc', 'totp_recovery', 'password'];
/** Values no answer may carry: a password hash, an encrypted secret. */
export const SECRET_VALUES = [/^scrypt\$/, /^v1:[\w-]+:[\w-]+:[\w-]+$/,
  // a bug token (phase 4c2) is shown once by roster-cli and never by the server
  /^rbt_[\w-]{20,}$/,
  // a sealed note before its battle is closed, and a leaders' note: no role of the matrix may ever read them (ADR 0011)
  /SEALED-SECRET/, /LEADER-SECRET/,
  // the background's truth (phase 4b1): only leaders read it – and the entries the probes read in the admin's own campaign do not carry it
  /BACKGROUND-SECRET/,
  // a question asked of someone else (phase 4b3): no role of the matrix is its addressee
  /QUESTION-SECRET/,
  // a draft scenario of the victim's campaign (phase 4b3c): only its leaders read it, and none of them is a role of the matrix
  /SCENARIO-SECRET/,
  // the hidden parts of an NPC in a played scenario (ADR 0022): the player of the victim's campaign reads a "?" there – the probes of the matrix never read them
  /NPC-HIDDEN-SECRET/,
  // the style guide of the victim's campaign (phase 4b4a): leaders' own, and none of its leaders is a role of the matrix
  /STYLE-SECRET/,
  // a battle plan of the victim's campaign: leaders' own, and none of its leaders is a role of the matrix
  /PLAN-SECRET/,
  // the opponents of the victim's campaign: leaders' own, and none of its leaders is a role of the matrix
  /OPPONENT-SECRET/,
  // a chapter draft of the victim's campaign (phase 4b5b): only its leaders read it, and none of them is a role of the matrix
  /DRAFT-SECRET/,
  // a problem report (phase 4c1): its words reach only its reporter and, in the report's own detail, the admin – the probes read a report without the marker; the list carries no words and no copy of a warband
  /BUG-SECRET/];

/* Every route has its row in the leak-test matrix, every role is turned away
   or let through as the row says, and answers carry only the fields the
   matrix allows – never a hash or a secret (ADR 0011). */
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ACTIONS, type Action } from '../src/policy.ts';
import { confirmEnrolment, createCampaign, enrol, setMember } from '../src/campaigns.ts';
import { createShare } from '../src/shares.ts';
import { createWarband, warbandById } from '../src/warbands.ts';
import { startAccounts } from './accounts-helpers.ts';
import { MATRIX, ROLES, SECRET_KEYS, SECRET_VALUES, type ProbeContext, type Role } from './leak-matrix.ts';
import { startServer } from './helpers.ts';

/** Every key and string value of an answer, at any depth. */
function walk(v: unknown, keys: string[] = [], values: string[] = []): { keys: string[]; values: string[] } {
  if (typeof v === 'string') values.push(v);
  else if (Array.isArray(v)) for (const x of v) walk(x, keys, values);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      keys.push(k);
      walk(x, keys, values);
    }
  }
  return { keys, values };
}

/** A warband save as small as the schema allows. */
const SAVE = { wb: 'reikland', name: 'The Probes', models: [], format: 2 };

const DENIED = ['sign_in', 'forbidden'];

describe('leak-test matrix', () => {
  it('has a row for every action, naming exactly the routes that carry it', async () => {
    const s = await startServer();
    expect(Object.keys(MATRIX).sort()).toEqual(Object.keys(ACTIONS).sort());
    const registered = s.app.registeredRoutes.map((r) => `${r.action}: ${r.method} ${r.url}`).sort();
    const listed = Object.entries(MATRIX).flatMap(([action, row]) => Object.keys(row.routes).map((r) => `${action}: ${r}`)).sort();
    expect(registered).toEqual(listed);
  });

  it('turns away every role the matrix does not list, lets the others through, and shows only the allowed fields', async () => {
    const s = await startAccounts();
    const admin = await s.user('rob', { admin: true, totp: true });
    const player = await s.user('player');
    const victim = await s.user('victim');
    const pendingOne = await s.user('pending', { totp: true });
    const warbandId = randomUUID();
    const spareWarbandId = randomUUID();
    for (const id of [warbandId, spareWarbandId]) createWarband(s.db, { id, ownerId: player.id, data: SAVE, json: JSON.stringify(SAVE), source: 'save', note: '', appVersion: '', copiedFrom: null }, s.clock.now());
    const json = JSON.stringify(SAVE);
    const incoming = createShare(s.db, { from: victim.id, to: player.id, warbandId: null, name: 'Sent', wbType: 'reikland', json }, s.clock.now());
    const outgoing = createShare(s.db, { from: player.id, to: victim.id, warbandId: null, name: 'Sent back', wbType: 'reikland', json }, s.clock.now());
    const code = createShare(s.db, { from: victim.id, to: null, warbandId: null, name: 'By code', wbType: 'reikland', json }, s.clock.now());
    // campaigns: one the victim leads (the player in it, the admin outside), one the admin leads
    const t0 = s.clock.now();
    const entry = (c: ReturnType<typeof createCampaign>, playerId: string) => enrol(s.db, { campaign: c, playerId, warbandId: randomUUID(), data: SAVE, json, copiedFrom: null, appVersion: '' }, t0).enrolment;
    const theirs = createCampaign(s.db, { name: 'The Victim’s Campaign', by: victim.id }, t0);
    setMember(s.db, theirs.id, player.id, 'player', victim.id, t0);
    const entered = entry(theirs, victim.id);
    confirmEnrolment(s.db, theirs, entered, victim.id, t0);
    const own = entry(theirs, player.id);
    const led = createCampaign(s.db, { name: 'The Admin’s Campaign', by: admin.id }, t0);
    setMember(s.db, led.id, player.id, 'player', admin.id, t0);
    setMember(s.db, led.id, victim.id, 'player', admin.id, t0);
    const pending: [string, string] = [entry(led, player.id).id, entry(led, player.id).id];
    const ctx: ProbeContext = {
      victimId: victim.id, victimName: victim.username,
      inviteToken: s.invite().token, spareInviteId: s.invite().id,
      code: () => pendingOne.code(), username: player.username, password: 'correct horse battery',
      warbandId, spareWarbandId, save: SAVE, headRev: () => warbandById(s.db, warbandId)!.head_rev,
      incomingShareId: incoming.id, outgoingShareId: outgoing.id, shareCode: code.code!,
      campaignId: theirs.id, enteredWarbandId: entered.warband_id, ownEnrolmentId: own.id, ledCampaignId: led.id, pendingEnrolmentIds: pending,
    };
    // a fresh session per request: a probe may sign its role out
    const tokenFor: Record<Role, () => string | null> = {
      anonymous: () => null,
      pending: () => pendingOne.session('totp'),
      user: () => player.session(),
      admin: () => admin.session(),
    };
    const problems: string[] = [];
    let probes = 0;
    for (const [action, row] of Object.entries(MATRIX) as [Action, (typeof MATRIX)[Action]][]) {
      for (const [route, probe] of Object.entries(row.routes)) {
        for (const role of ROLES) {
          const p = probe(ctx);
          const res = await s.call({ method: p.method, url: p.url, body: p.body, token: tokenFor[role]() });
          probes++;
          const where = `${role} ${route} (${action})`;
          const json = (res.headers['content-type'] ?? '').startsWith('application/json') && res.body ? (res.json() as Record<string, unknown>) : null;
          // someone else's warband, or a campaign one is not part of, does not exist for them: there a 404 is the refusal
          const owned = !!(ACTIONS[action] as { target?: string }).target;
          const denied = ((res.statusCode === 401 || res.statusCode === 403) && DENIED.includes(String(json?.error)))
            || (owned && res.statusCode === 404 && json?.error === 'not_found');
          if (!row.allowed.includes(role)) {
            if (!denied) problems.push(`${where}: expected to be turned away, got ${res.statusCode} ${res.body.slice(0, 80)}`);
            else if (Object.keys(json!).join() !== 'error') problems.push(`${where}: a refusal says more than the error: ${res.body}`);
            continue;
          }
          if (denied) {
            problems.push(`${where}: turned away (${res.statusCode})`);
            continue;
          }
          if (json) {
            const found = walk(json);
            for (const k of found.keys.filter((k) => SECRET_KEYS.includes(k))) problems.push(`${where}: answer carries "${k}"`);
            for (const v of found.values.filter((v) => SECRET_VALUES.some((re) => re.test(v)))) problems.push(`${where}: answer carries a secret value ${v.slice(0, 12)}…`);
            if (res.statusCode < 300) {
              const allowed = row.fields?.[role];
              if (!allowed) problems.push(`${where}: no fields listed for a JSON answer`);
              else for (const k of Object.keys(json).filter((k) => !allowed.includes(k))) problems.push(`${where}: field "${k}" is not in the matrix`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
    expect(probes).toBe(Object.values(MATRIX).reduce((n, r) => n + Object.keys(r.routes).length, 0) * ROLES.length);
  });

  it('an admin without the authenticator may only look after the own account', async () => {
    const s = await startAccounts();
    const admin = await s.user('rob', { admin: true });
    const token = admin.session();
    expect((await s.call({ url: '/api/v1/admin/users', token })).json()).toEqual({ error: 'forbidden' });
    expect((await s.call({ url: '/api/v1/admin/audit', token })).statusCode).toBe(403);
    expect((await s.call({ url: '/api/v1/admin/invites', body: {}, token })).statusCode).toBe(403);
    const me = (await s.call({ url: '/api/v1/auth/me', token })).json() as { user: { mustSetUpTotp: boolean } };
    expect(me.user.mustSetUpTotp).toBe(true);
    expect((await s.call({ url: '/api/v1/auth/sessions', token })).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/account/totp/setup', body: {}, token })).statusCode).toBe(200);
  });

  it('anonymous: health shows only its allowed fields', async () => {
    const s = await startServer();
    const body = (await (await fetch(`${s.url}/api/v1/health`)).json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([...MATRIX['health.read'].fields!.anonymous!].sort());
  });
});

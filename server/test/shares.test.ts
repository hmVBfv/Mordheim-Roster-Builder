/* Sharing a warband (Rob, 05.10.2026): a copy straight to another player,
   or a short code to enter – always a copy of one's own for the recipient;
   the sender's warband stays private. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CODE_TRIES } from '../src/shares.ts';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = { wb: 'reikland', name: 'The Silver Caravan', models: [{ uid: 1, uid_def: 'captain' }], format: 2 };
const DAY = 24 * 60 * 60 * 1000;

async function world() {
  const s = await startAccounts();
  const users = { kai: await s.user('kai'), ben: await s.user('ben'), rob: await s.user('rob', { admin: true, totp: true }) };
  await s.user('gone');
  s.db.prepare("UPDATE users SET disabled_at = ? WHERE username = 'gone'").run(s.clock.now().toISOString());
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  return { s, users, kai: as(users.kai), ben: as(users.ben), rob: as(users.rob) };
}

describe('the others to send to', () => {
  it('names only, active accounts, not oneself', async () => {
    const { kai, users } = await world();
    const people = (await kai('GET', '/people')).json() as { people: Record<string, unknown>[] };
    expect(people.people).toEqual([
      { id: users.ben.id, username: 'ben', displayName: 'ben' },
      { id: users.rob.id, username: 'rob', displayName: 'rob' },
    ]);
  });
});

describe('a copy straight to a player', () => {
  it('waits for the recipient, who takes it as a warband of their own; the sender’s stays private', async () => {
    const { kai, ben, rob, users } = await world();
    const mine = randomUUID();
    await kai('POST', '/warbands', { id: mine, data: SAVE, source: 'save' });
    const sent = await kai('POST', '/shares', { data: SAVE, to: users.ben.id, warbandId: mine });
    expect(sent.statusCode).toBe(201);
    const id = (sent.json() as { id: string; code: string | null }).id;
    expect((sent.json() as { code: unknown }).code).toBeNull();

    expect((await ben('GET', '/shares')).json()).toMatchObject({ incoming: [{ id, name: 'The Silver Caravan', wbType: 'reikland', from: 'kai', code: false }], outgoing: [] });
    expect(((await rob('GET', '/shares')).json() as { incoming: unknown[] }).incoming).toEqual([]);
    // only the recipient answers
    expect((await rob('POST', `/shares/${id}/accept`, { warbandId: randomUUID() })).statusCode).toBe(404);
    expect((await kai('POST', `/shares/${id}/accept`, { warbandId: randomUUID() })).statusCode).toBe(404);

    const copy = randomUUID();
    const taken = await ben('POST', `/shares/${id}/accept`, { warbandId: copy });
    expect(taken.statusCode).toBe(201);
    expect(taken.json()).toMatchObject({ warband: { id: copy, name: 'The Silver Caravan', headRev: 1 }, head: { rev: 1, data: SAVE, source: 'import', note: 'shared by kai' } });
    expect((await ben('GET', `/warbands/${copy}`)).statusCode).toBe(200);
    // the sender's warband is still the sender's alone
    expect((await ben('GET', `/warbands/${mine}`)).statusCode).toBe(404);
    expect((await ben('POST', `/shares/${id}/accept`, { warbandId: randomUUID() })).json()).toEqual({ error: 'gone' });
    expect((await kai('GET', '/shares')).json()).toMatchObject({ outgoing: [{ id, to: 'ben', accepted: true, uses: 1 }] });
  });

  it('can be declined, or taken back before it is answered; not to oneself or a disabled account', async () => {
    const { s, kai, ben, users } = await world();
    const a = (await kai('POST', '/shares', { data: SAVE, to: users.ben.id })).json() as { id: string };
    expect((await ben('POST', `/shares/${a.id}/decline`)).json()).toEqual({ ok: true });
    expect(((await ben('GET', '/shares')).json() as { incoming: unknown[] }).incoming).toEqual([]);
    const b = (await kai('POST', '/shares', { data: SAVE, to: users.ben.id })).json() as { id: string };
    expect((await ben('DELETE', `/shares/${b.id}`)).statusCode).toBe(404);
    expect((await kai('DELETE', `/shares/${b.id}`)).json()).toEqual({ ok: true });
    expect((await ben('POST', `/shares/${b.id}/accept`, { warbandId: randomUUID() })).json()).toEqual({ error: 'gone' });
    expect((await kai('POST', '/shares', { data: SAVE, to: users.kai.id })).json()).toMatchObject({ error: 'invalid' });
    const gone = s.db.prepare("SELECT id FROM users WHERE username = 'gone'").get() as { id: string };
    expect((await kai('POST', '/shares', { data: SAVE, to: gone.id })).json()).toMatchObject({ error: 'invalid' });
    expect((await kai('POST', '/shares', { data: { name: 'not a save' }, to: users.ben.id })).statusCode).toBe(400);
  });
});

describe('what the server keeps', () => {
  it('the warband only as long as it can be taken: not after an answer, taking back or the end', async () => {
    const { s, kai, ben, users } = await world();
    const kept = () => (s.db.prepare("SELECT data FROM warband_shares WHERE data != '' ").all() as unknown[]).length;
    const a = (await kai('POST', '/shares', { data: SAVE, to: users.ben.id })).json() as { id: string };
    const b = (await kai('POST', '/shares', { data: SAVE, to: users.ben.id })).json() as { id: string };
    const c = (await kai('POST', '/shares', { data: SAVE })).json() as { id: string; code: string };
    await kai('POST', '/shares', { data: SAVE });
    expect(kept()).toBe(4);
    await ben('POST', `/shares/${a.id}/accept`, { warbandId: randomUUID() });
    await ben('POST', `/shares/${b.id}/decline`);
    expect(kept()).toBe(2);
    await ben('POST', '/shares/redeem', { code: c.code, warbandId: randomUUID() });
    expect(kept()).toBe(2);
    await kai('DELETE', `/shares/${c.id}`);
    expect(kept()).toBe(1);
    s.clock.advance(7 * DAY + 1);
    await kai('GET', '/shares');
    expect(kept()).toBe(0);
  });
});

describe('a share code', () => {
  it('short and readable; anyone signed in can look at it and take a copy, for 7 days, until taken back', async () => {
    const { s, kai, ben, rob } = await world();
    const made = (await kai('POST', '/shares', { data: SAVE })).json() as { id: string; code: string; expiresAt: string };
    expect(made.code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    // only the hash is stored
    expect(JSON.stringify(s.db.prepare('SELECT * FROM warband_shares').all())).not.toContain(made.code.replace('-', ''));
    const typed = ` ${made.code.toLowerCase().replace('-', ' ')} `;
    expect((await ben('POST', '/shares/peek', { code: typed })).json()).toEqual({ name: 'The Silver Caravan', wbType: 'reikland', from: 'kai', expiresAt: made.expiresAt });
    const a = await ben('POST', '/shares/redeem', { code: typed, warbandId: randomUUID() });
    expect(a.statusCode).toBe(201);
    // a code serves several (a whole group may take a copy)
    expect((await rob('POST', '/shares/redeem', { code: made.code, warbandId: randomUUID() })).statusCode).toBe(201);
    expect((await kai('GET', '/shares')).json()).toMatchObject({ outgoing: [{ id: made.id, code: true, uses: 2 }] });
    await kai('DELETE', `/shares/${made.id}`);
    expect((await ben('POST', '/shares/peek', { code: made.code })).json()).toEqual({ error: 'unknown_share_code' });

    const later = (await kai('POST', '/shares', { data: SAVE })).json() as { code: string };
    s.clock.advance(7 * DAY + 1);
    expect((await ben('POST', '/shares/redeem', { code: later.code, warbandId: randomUUID() })).json()).toEqual({ error: 'unknown_share_code' });
  });

  it('guessing is braked: after ten wrong codes in 15 minutes, a wait', async () => {
    const { s, kai, ben } = await world();
    const made = (await kai('POST', '/shares', { data: SAVE })).json() as { code: string };
    for (let i = 0; i < CODE_TRIES; i++) expect((await ben('POST', '/shares/peek', { code: `ZZZZ-ZZZ${i}` })).statusCode).toBe(404);
    expect((await ben('POST', '/shares/peek', { code: made.code })).statusCode).toBe(429);
    expect((await ben('POST', '/shares/redeem', { code: made.code, warbandId: randomUUID() })).statusCode).toBe(429);
    // others are not held back
    expect((await kai('POST', '/shares/peek', { code: made.code })).statusCode).toBe(200);
    s.clock.advance(16 * 60 * 1000);
    expect((await ben('POST', '/shares/peek', { code: made.code })).statusCode).toBe(200);
  });

  it('taking a copy under an id already in use is refused', async () => {
    const { kai, ben } = await world();
    const made = (await kai('POST', '/shares', { data: SAVE })).json() as { code: string };
    const id = randomUUID();
    await ben('POST', '/warbands', { id, data: SAVE, source: 'save' });
    expect((await ben('POST', '/shares/redeem', { code: made.code, warbandId: id })).json()).toEqual({ error: 'exists' });
  });
});

/* What a request may make the server do, after the security review of
   09.10.2026 (docs/security-review.md, INPUT-…): a crafted save must not
   loop or fill the memory, and a body without an account stays small. Each
   test was written to fail before its fix. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PASSWORD, startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown> & { models: Record<string, unknown>[] };
const withModel = (over: Record<string, unknown>) => ({ ...SAVE, models: [{ ...SAVE.models[0]!, ...over }, ...SAVE.models.slice(1)] });

describe('counts in a save (INPUT-1)', () => {
  it('a group, gear, an advance or the stash beyond 1000 of one thing is refused – the rules count them one by one', async () => {
    const s = await startAccounts();
    const token = (await s.user('kai')).session();
    const post = (data: unknown) => s.call({ url: '/api/v1/warbands', body: { id: randomUUID(), data, source: 'save' }, token });
    for (const [what, data] of [
      ['qty', withModel({ qty: 1e9 })],
      ['eq', withModel({ eq: { Schwert: 1e9 } })],
      ['adv', withModel({ adv: { WS: 1e15 } })],
      ['adv as text', withModel({ adv: { WS: 'Infinity' } })],
      ['rare', withModel({ rare: { Elfenmantel: { q: 5000 } } })],
      ['stash', { ...SAVE, stash: { gold: 10, items: [{ name: 'Schwert', qty: 1e9 }] } }],
    ] as const) {
      const r = await post(data);
      expect(r.statusCode, what).toBe(400);
      expect(r.json(), what).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/at most 1000/) });
    }
    // what a warband really holds passes, also as the legacy app's text
    expect((await post(withModel({ qty: '5', eq: { Schwert: 2 }, adv: { WS: 1, S: '2' } }))).statusCode).toBe(201);
  });
});

describe('the size of what a request makes the server hold (INPUT-2)', () => {
  it('without an account, a body stays small: 64 KB', async () => {
    const s = await startAccounts();
    await s.user('kai');
    const big = await s.call({ url: '/api/v1/auth/login', body: { username: 'kai', password: PASSWORD, pad: 'x'.repeat(70 * 1024) } });
    expect(big.statusCode).toBe(413);
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'kai', password: PASSWORD } })).statusCode).toBe(200);
  });

  it('a body of many tiny objects is refused before it is parsed – a 3 MB body of {} grew about 45 times in memory', async () => {
    const s = await startAccounts();
    const token = (await s.user('kai')).session();
    const post = (data: unknown) => s.call({ url: '/api/v1/warbands', body: { id: randomUUID(), data, source: 'save' }, token });
    const r = await post({ ...SAVE, pad: Array.from({ length: 60_000 }, () => ({})) });
    expect(r.statusCode).toBe(413);
    // a long campaign stays far below it
    const log = Array.from({ length: 3000 }, (_, i) => ({ id: i + 1, round: 1 + (i % 20), type: 'note', text: `entry ${i}`, data: { uid: 2 } }));
    expect((await post({ ...SAVE, campaign: { on: true, log } })).statusCode).toBe(201);
  });
});

describe('what one account keeps (INPUT-3)', () => {
  it('its current warbands hold at most 16 MB – the sync sends them at once; drafts included; a new version of one replaces it, an archived one counts no more', async () => {
    const s = await startAccounts();
    const token = (await s.user('kai')).session();
    const big = (i: number) => ({ ...SAVE, name: `Big ${i}`, notes: 'x'.repeat(1_950_000) });
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = randomUUID();
      ids.push(id);
      expect((await s.call({ url: '/api/v1/warbands', body: { id, data: big(i), source: 'save' }, token })).statusCode, `warband ${i}`).toBe(201);
    }
    const ninth = await s.call({ url: '/api/v1/warbands', body: { id: randomUUID(), data: big(8), source: 'save' }, token });
    expect(ninth.statusCode).toBe(413);
    expect(ninth.json()).toMatchObject({ error: 'account_full' });
    // a new version of one it has replaces that one; a draft comes on top of it
    expect((await s.call({ url: `/api/v1/warbands/${ids[0]}/versions`, body: { baseRev: 1, data: big(0) }, token })).statusCode).toBe(201);
    expect((await s.call({ method: 'PUT', url: `/api/v1/warbands/${ids[0]}/autosave`, body: { baseRev: 2, data: big(0) }, token })).json()).toMatchObject({ error: 'account_full' });
    expect((await s.call({ method: 'PUT', url: `/api/v1/warbands/${ids[0]}/autosave`, body: { baseRev: 2, data: SAVE }, token })).statusCode).toBe(200);
    // archived, it no longer counts – and comes back only while there is room
    expect((await s.call({ method: 'DELETE', url: `/api/v1/warbands/${ids[1]}`, token })).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/warbands', body: { id: randomUUID(), data: big(8), source: 'save' }, token })).statusCode).toBe(201);
    expect((await s.call({ url: `/api/v1/warbands/${ids[1]}/unarchive`, body: {}, token })).json()).toMatchObject({ error: 'account_full' });
    // the sync answers with all of it
    expect((await s.call({ url: '/api/v1/sync?cursor=0', token })).statusCode).toBe(200);
  });
});


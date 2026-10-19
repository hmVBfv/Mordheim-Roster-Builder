/* The leaders' plan for a battle: the red thread, by the battle's number –
   written before the battle exists, read and written by leaders with the
   authenticator alone. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

type Plan = { round: number; text: string; updatedBy: string | null; updatedAt: string | null; seq: number };

/** Anna leads (authenticator), Ben leads without one, Kai plays, Vic watches, Rob (admin) is outside. */
async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), vic = as(u.vic), rob = as(u.rob);
  const cid = ((await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'The Hel Fenn Campaign' }, token: u.anna.session() })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${cid}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${cid}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.vic.id}`, { role: 'viewer' });
  return { s, cid, anna, ben, kai, vic, rob, url: `/campaigns/${cid}/plans` };
}

describe('the plan for a battle', () => {
  it('is written by its number, before the battle exists, and listed by number', async () => {
    const { anna, url } = await table();
    expect((await anna('GET', url)).json()).toEqual({ plans: [] });
    const r = await anna('PUT', `${url}/3`, { text: 'The ferrymen turn on the Caravan; the Countess stays unseen.', baseSeq: 0 });
    expect(r.statusCode).toBe(200);
    const { plan } = r.json() as { plan: Plan };
    expect(plan).toMatchObject({ round: 3, text: 'The ferrymen turn on the Caravan; the Countess stays unseen.', updatedBy: expect.any(String) });
    await anna('PUT', `${url}/1`, { text: 'Rain.', baseSeq: 0 });
    expect(((await anna('GET', url)).json() as { plans: Plan[] }).plans.map((p) => p.round)).toEqual([1, 3]);
  });

  it('is for leaders with the authenticator alone: a leader without one, players and viewers get a 403, an outsider a 404', async () => {
    const { anna, ben, kai, vic, rob, url } = await table();
    await anna('PUT', `${url}/2`, { text: 'ZEBRA: the ferryman dies.', baseSeq: 0 });
    for (const who of [ben, kai, vic]) {
      const g = await who('GET', url);
      expect(g.statusCode).toBe(403);
      expect(g.body).not.toMatch(/ZEBRA/);
      expect((await who('PUT', `${url}/2`, { text: 'Mine', baseSeq: 1 })).statusCode).toBe(403);
    }
    expect((await rob('GET', url)).statusCode).toBe(404);
    expect((await rob('PUT', `${url}/2`, { text: 'Mine' })).statusCode).toBe(404);
  });

  it('is changed from the stand the device saw; another leader’s change in between is a 409 with the current plan', async () => {
    const { anna, url } = await table();
    const a = ((await anna('PUT', `${url}/2`, { text: 'One.', baseSeq: 0 })).json() as { plan: Plan }).plan;
    const b = ((await anna('PUT', `${url}/2`, { text: 'Two.', baseSeq: a.seq })).json() as { plan: Plan }).plan;
    const stale = await anna('PUT', `${url}/2`, { text: 'Three.', baseSeq: a.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { text: 'Two.', seq: b.seq } });
  });

  it('the same text changes nothing; an empty one takes the plan out; the log never carries the words', async () => {
    const { s, anna, url } = await table();
    const a = ((await anna('PUT', `${url}/2`, { text: 'ZEBRA plan.', baseSeq: 0 })).json() as { plan: Plan }).plan;
    expect(((await anna('PUT', `${url}/2`, { text: 'ZEBRA plan.', baseSeq: 0 })).json() as { plan: Plan }).plan.seq).toBe(a.seq);
    const gone = await anna('PUT', `${url}/2`, { text: '  ', baseSeq: a.seq });
    expect((gone.json() as { plan: Plan }).plan.text).toBe('');
    expect((await anna('GET', url)).json()).toEqual({ plans: [] });
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action LIKE 'plan.%'").all() as { action: string; visibility: string; payload: string }[];
    expect(rows.map((r) => r.action)).toEqual(['plan.edit', 'plan.remove']);
    for (const r of rows) { expect(r.visibility).toBe('leader'); expect(r.payload).not.toMatch(/ZEBRA/); }
  });

  it('refuses a number out of range, too much text and unknown keys', async () => {
    const { anna, url } = await table();
    expect((await anna('PUT', `${url}/0`, { text: 'x', baseSeq: 0 })).statusCode).toBe(400);
    expect((await anna('PUT', `${url}/1000`, { text: 'x', baseSeq: 0 })).statusCode).toBe(400);
    expect((await anna('PUT', `${url}/1`, { text: 'x'.repeat(20_001), baseSeq: 0 })).statusCode).toBe(400);
    expect((await anna('PUT', `${url}/1`, { text: 'x', baseSeq: 0, extra: 1 })).statusCode).toBe(400);
  });
});

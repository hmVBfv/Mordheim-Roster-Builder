/* The campaign's style guide (phase 4b4a): the writing instructions of the AI
   pack. Leaders' own – read and written with the authenticator, for nobody
   else. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

type Style = { text: string; updatedBy: string | null; updatedAt: string | null; seq: number };

/** Anna leads (authenticator), Ben leads without one, Kai and Lea play, Vic watches, Rob (admin) is outside. */
async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), lea: await s.user('lea'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), lea = as(u.lea), vic = as(u.vic), rob = as(u.rob);
  const created = await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'The Hel Fenn Campaign' }, token: u.anna.session() });
  const cid = (created.json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${cid}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${cid}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.lea.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.vic.id}`, { role: 'viewer' });
  return { s, u, cid, anna, ben, kai, lea, vic, rob, url: `/campaigns/${cid}/style` };
}

describe('the style guide', () => {
  it('is empty at first, and a leader with the authenticator writes it; the first write starts from 0', async () => {
    const { anna, url } = await table();
    expect((await anna('GET', url)).json()).toEqual({ style: { text: '', updatedBy: null, updatedAt: null, seq: 0 } });
    const r = await anna('PUT', url, { text: 'German, past tense, close third person. No dice, no game terms.', baseSeq: 0 });
    expect(r.statusCode).toBe(200);
    const { style } = r.json() as { style: Style };
    expect(style).toMatchObject({ text: 'German, past tense, close third person. No dice, no game terms.', updatedBy: expect.any(String) });
    expect(style.seq).toBeGreaterThan(0);
    expect(((await anna('GET', url)).json() as { style: Style }).style).toEqual(style);
  });

  it('is for leaders with the authenticator alone: players, viewers and a leader without one get a 403, an outsider a 404', async () => {
    const { anna, ben, kai, lea, vic, rob, url } = await table();
    await anna('PUT', url, { text: 'ZEBRA: never name the Countess.', baseSeq: 0 });
    for (const who of [ben, kai, lea, vic]) {
      const g = await who('GET', url);
      expect(g.statusCode).toBe(403);
      expect(g.body).not.toMatch(/ZEBRA/);
      expect((await who('PUT', url, { text: 'Me too', baseSeq: 1 })).statusCode).toBe(403);
    }
    expect((await rob('GET', url)).statusCode).toBe(404);
    expect((await rob('PUT', url, { text: 'Me too' })).statusCode).toBe(404);
    expect(((await anna('GET', url)).json() as { style: Style }).style.text).toBe('ZEBRA: never name the Countess.');
  });

  it('is changed from the stand the device saw; another leader’s change in between is a 409 with the current text', async () => {
    const { anna, url } = await table();
    const first = ((await anna('PUT', url, { text: 'One.', baseSeq: 0 })).json() as { style: Style }).style;
    const second = ((await anna('PUT', url, { text: 'Two.', baseSeq: first.seq })).json() as { style: Style }).style;
    expect(second.seq).toBeGreaterThan(first.seq);
    const stale = await anna('PUT', url, { text: 'Three.', baseSeq: first.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { text: 'Two.', seq: second.seq } });
    // a first write that came second
    expect((await anna('PUT', url, { text: 'Zero.', baseSeq: 0 })).statusCode).toBe(409);
    expect(((await anna('GET', url)).json() as { style: Style }).style.text).toBe('Two.');
  });

  it('writing what is there changes nothing; the style may be cleared', async () => {
    const { s, anna, url } = await table();
    const a = ((await anna('PUT', url, { text: 'One.', baseSeq: 0 })).json() as { style: Style }).style;
    const again = await anna('PUT', url, { text: 'One.', baseSeq: 0 });
    expect(again.statusCode).toBe(200);
    expect((again.json() as { style: Style }).style.seq).toBe(a.seq);
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'style.edit'").get()).toEqual({ n: 1 });
    const cleared = await anna('PUT', url, { text: '', baseSeq: a.seq });
    expect(cleared.statusCode).toBe(200);
    expect((cleared.json() as { style: Style }).style.text).toBe('');
  });

  it('keeps to its limits and its shape', async () => {
    const { anna, url } = await table();
    expect((await anna('PUT', url, { text: 'x'.repeat(10_001), baseSeq: 0 })).statusCode).toBe(400);
    expect((await anna('PUT', url, { baseSeq: 0 })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/not a style guide/) });
    expect((await anna('PUT', url, { text: 'x', extra: 1 })).statusCode).toBe(400);
    expect((await anna('PUT', url, { text: 'x'.repeat(10_000), baseSeq: 0 })).statusCode).toBe(200);
  });

  it('is one text per campaign, and the log says that it changed, never what it says', async () => {
    const { s, u, anna, url } = await table();
    const other = ((await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'Summer in Sylvania' }, token: u.anna.session() })).json() as { campaign: { id: string } }).campaign.id;
    await anna('PUT', url, { text: 'ZEBRA text', baseSeq: 0 });
    expect(((await anna('GET', `/campaigns/${other}/style`)).json() as { style: Style }).style.text).toBe('');
    const rows = s.db.prepare("SELECT action, visibility FROM audit_log WHERE action = 'style.edit'").all();
    expect(rows).toEqual([{ action: 'style.edit', visibility: 'leader' }]);
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toMatch(/ZEBRA/);
  });
});

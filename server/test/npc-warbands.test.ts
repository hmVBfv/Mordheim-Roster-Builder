/* Hidden NPC warbands (wish #79, Rob, 26.10.2026): the game master's reference and Tabletop Simulator data. Leaders only,
   with the authenticator; nobody else – a player, a viewer, an admin outside the campaign – reads or learns of one. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_NPC_WARBANDS } from '../src/npc-warbands.ts';
import { startAccounts } from './accounts-helpers.ts';

type Listed = { id: string; name: string; seq: number; summary: { value: number; exp: number; rating: number; models: number; kind: string } };
const SECRET = 'ZEBRA-GUARD: the Count’s own men.';

/** Anna leads (authenticator), Ben leads without one, Kai plays, Vic watches, Rob (admin) is outside. */
async function world() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), vic = as(u.vic), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const base = `/campaigns/${id}/npc-warbands`;
  const body = (name: string, over: Record<string, unknown> = {}) => ({
    name, save: { planner: true, name, note: SECRET }, summary: { value: 120, exp: 4, rating: 20, models: 3, kind: 'Mercenaries' }, baseSeq: 0, ...over,
  });
  const make = async (name = 'The Watch', over: Record<string, unknown> = {}) => {
    const wid = randomUUID();
    const r = await anna('PUT', `${base}/${wid}`, body(name, over));
    return { wid, r, warband: (r.json() as { warband: Listed }).warband };
  };
  return { s, u, id, anna, ben, kai, vic, rob, base, body, make };
}

describe('hidden NPC warbands', () => {
  it('only a leader reads or writes them; an outsider does not even know the campaign', async () => {
    const { anna, kai, vic, rob, base, body, make } = await world();
    const { wid, r } = await make();
    expect(r.statusCode).toBe(200);
    for (const who of [kai, vic]) {
      expect((await who('GET', base)).json()).toEqual({ error: 'forbidden' });
      expect((await who('GET', `${base}/${wid}`)).statusCode).toBe(403);
      expect((await who('PUT', `${base}/${randomUUID()}`, body('Me too'))).statusCode).toBe(403);
      expect((await who('DELETE', `${base}/${wid}`)).statusCode).toBe(403);
    }
    expect((await rob('GET', base)).statusCode).toBe(404);
    expect((await rob('PUT', `${base}/${randomUUID()}`, body('Me too'))).statusCode).toBe(404);
    expect(((await anna('GET', base)).json() as { warbands: Listed[] }).warbands).toMatchObject([{ id: wid, name: 'The Watch', summary: { value: 120, exp: 4, rating: 20 } }]);
  });

  it('the list carries no save; the warband itself does, to a leader', async () => {
    const { anna, base, make } = await world();
    const { wid } = await make();
    expect((await anna('GET', base)).body).not.toMatch(/ZEBRA/);
    expect((await anna('GET', `${base}/${wid}`)).body).toMatch(/ZEBRA-GUARD/);
  });

  it('is made under the device’s id, changed from the seq it was read at, and a second leader who was not up to date is told so', async () => {
    const { anna, base, body, make } = await world();
    const { wid, warband } = await make();
    expect((await anna('PUT', `${base}/${wid}`, body('The Watch'))).statusCode).toBe(200);
    const stale = await anna('PUT', `${base}/${wid}`, body('The Watch', { save: { planner: true, note: 'changed' } }));
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { id: wid } });
    const ok = await anna('PUT', `${base}/${wid}`, body('The Watch', { save: { planner: true, note: 'changed' }, baseSeq: warband.seq }));
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { warband: Listed }).warband.seq).toBeGreaterThan(warband.seq);
  });

  it('is a planner, of a size and a name that fit, and there are only so many', async () => {
    const { anna, base, body, make } = await world();
    expect((await anna('PUT', `${base}/${randomUUID()}`, body('Not a planner', { save: { name: 'x' } }))).statusCode).toBe(400);
    expect((await anna('PUT', `${base}/${randomUUID()}`, body('Too big', { save: { planner: true, pad: 'x'.repeat(700_000) } }))).statusCode).toBe(400);
    await make('The Watch');
    expect((await anna('PUT', `${base}/${randomUUID()}`, body('  the  watch '))).statusCode).toBe(400);
    for (let i = 1; i < MAX_NPC_WARBANDS; i++) expect((await anna('PUT', `${base}/${randomUUID()}`, body(`Band ${i}`))).statusCode).toBe(200);
    expect((await anna('PUT', `${base}/${randomUUID()}`, body('One too many'))).json()).toMatchObject({ error: 'full' });
  });

  it('taking one out lets go of its words and its name; the id stays used', async () => {
    const { s, anna, base, body, make } = await world();
    const { wid } = await make();
    expect((await anna('DELETE', `${base}/${wid}`)).statusCode).toBe(200);
    expect(((await anna('GET', base)).json() as { warbands: Listed[] }).warbands).toEqual([]);
    expect(JSON.stringify(s.db.prepare('SELECT * FROM npc_warbands').all())).not.toMatch(/ZEBRA|Watch/);
    expect((await anna('PUT', `${base}/${wid}`, body('Back'))).json()).toMatchObject({ error: 'removed' });
  });

  it('nothing of them reaches anyone else: not in any list a player reads, not in the admin’s log', async () => {
    const { id, anna, kai, vic, rob, make } = await world();
    await make('ZEBRA-NAME');
    const urls = [`/campaigns/${id}`, `/campaigns/${id}/battles`, `/campaigns/${id}/notes`, `/campaigns/${id}/timeline`, '/campaigns', '/sync'];
    for (const who of [kai, vic]) for (const url of urls) {
      expect((await who('GET', url)).body, url).not.toMatch(/ZEBRA/);
    }
    const audit = (await rob('GET', '/admin/audit?limit=200')).body;
    expect(audit).not.toMatch(/ZEBRA/);
    expect(audit).not.toMatch(/npcwarband\./);
    expect((await anna('GET', `/campaigns/${id}/npc-warbands`)).body).toMatch(/ZEBRA-NAME/);
  });
});

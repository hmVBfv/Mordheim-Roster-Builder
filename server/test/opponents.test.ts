/* Opponents: groups of profiles and the campaign's own skills – leaders with
   the authenticator alone; shape and sizes checked, values as written. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

type Group = { id: string; name: string; note: string; profiles: Record<string, unknown>[]; updatedBy: string; seq: number };
type Skill = { id: string; name: string; text: string; seq: number };

async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'PUT' ? {} : undefined), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), vic = as(u.vic), rob = as(u.rob);
  const cid = ((await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'The Hel Fenn Campaign' }, token: u.anna.session() })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${cid}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${cid}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.vic.id}`, { role: 'viewer' });
  return { s, cid, anna, ben, kai, vic, rob, url: `/campaigns/${cid}/opponents` };
}

const ferryman = { id: 'p1', name: 'Ferryman', type: 'Henchman', count: 3, profile: { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' }, sv: '6+',
  skills: [{ name: 'Step Aside', text: 'A 5+ save in close combat.' }, { name: 'Ferryman’s Luck', text: 'Re-roll one dice.', ref: 'own-1' }], equipment: 'Boat hook, dagger', equipmentTips: [{ name: 'Boat hook', text: 'Reach: strikes first.' }], rules: 'Knows the Stir', note: '', from: { kind: 'unit', key: 'merc/warr', label: 'Warrior (Mercenaries)' } };

describe('groups of opponents', () => {
  it('a leader keeps a group with its profiles as written; it is listed, changed from its stand, and taken out', async () => {
    const { anna, url } = await table();
    expect((await anna('GET', url)).json()).toEqual({ groups: [], skills: [], seq: 0 });
    const gid = randomUUID();
    const r = await anna('PUT', `${url}/groups/${gid}`, { name: 'The ferrymen', note: 'Row warbands into ambushes.', profiles: [ferryman, { id: 'p2', name: 'Captain Brandt', profile: { M: '4', S: '3(4)', A: 'D3' } }], baseSeq: 0 });
    expect(r.statusCode).toBe(200);
    const g = (r.json() as { group: Group }).group;
    expect(g).toMatchObject({ id: gid, name: 'The ferrymen', note: 'Row warbands into ambushes.' });
    expect(g.profiles[0]).toEqual(ferryman);
    expect(g.profiles[1]).toMatchObject({ name: 'Captain Brandt', type: '', count: 1, profile: { S: '3(4)', A: 'D3' }, skills: [], from: null });
    const list = (await anna('GET', url)).json() as { groups: Group[]; seq: number };
    expect(list.groups.map((x) => x.id)).toEqual([gid]);
    expect(list.seq).toBe(g.seq);

    const changed = (await anna('PUT', `${url}/groups/${gid}`, { name: 'The ferrymen of the Stir', profiles: [ferryman], baseSeq: g.seq })).json() as { group: Group };
    expect(changed.group.profiles).toHaveLength(1);
    const stale = await anna('PUT', `${url}/groups/${gid}`, { name: 'Late', profiles: [], baseSeq: g.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { name: 'The ferrymen of the Stir' } });

    const gone = await anna('DELETE', `${url}/groups/${gid}`);
    expect(gone.json()).toMatchObject({ removed: true });
    const after = (await anna('GET', url)).json() as { groups: Group[]; seq: number };
    expect(after.groups).toEqual([]);
    expect(after.seq).toBeGreaterThan(changed.group.seq);
    expect((await anna('DELETE', `${url}/groups/${gid}`)).statusCode).toBe(200);
    expect((await anna('PUT', `${url}/groups/${gid}`, { name: 'Back', profiles: [], baseSeq: 0 })).statusCode).toBe(404);
  });

  it('the campaign’s own skills: written, changed, taken out', async () => {
    const { anna, url } = await table();
    const sid = randomUUID();
    const k = ((await anna('PUT', `${url}/skills/${sid}`, { name: 'Ferryman’s Luck', text: 'Re-roll one dice per game.', baseSeq: 0 })).json() as { skill: Skill }).skill;
    expect(k).toMatchObject({ id: sid, name: 'Ferryman’s Luck', text: 'Re-roll one dice per game.' });
    const k2 = ((await anna('PUT', `${url}/skills/${sid}`, { name: 'Ferryman’s Luck', text: 'Re-roll one dice per battle.', baseSeq: k.seq })).json() as { skill: Skill }).skill;
    expect((await anna('PUT', `${url}/skills/${sid}`, { name: 'X', baseSeq: k.seq })).statusCode).toBe(409);
    expect(((await anna('GET', url)).json() as { skills: Skill[] }).skills).toEqual([k2]);
    await anna('DELETE', `${url}/skills/${sid}`);
    expect(((await anna('GET', url)).json() as { skills: Skill[] }).skills).toEqual([]);
  });

  it('is for leaders alone; the log carries no names', async () => {
    const { s, anna, kai, vic, rob, url } = await table();
    const gid = randomUUID();
    await anna('PUT', `${url}/groups/${gid}`, { name: 'ZEBRA gang', profiles: [{ ...ferryman, name: 'ZEBRA' }], baseSeq: 0 });
    for (const who of [kai, vic]) {
      const g = await who('GET', url);
      expect(g.statusCode).toBe(403);
      expect(g.body).not.toMatch(/ZEBRA/);
      expect((await who('PUT', `${url}/groups/${randomUUID()}`, { name: 'Mine', profiles: [], baseSeq: 0 })).statusCode).toBe(403);
      expect((await who('DELETE', `${url}/groups/${gid}`)).statusCode).toBe(403);
    }
    expect((await rob('GET', url)).statusCode).toBe(404);
    const log = s.db.prepare("SELECT payload FROM audit_log WHERE action LIKE 'opponents.%'").all() as { payload: string | null }[];
    expect(log.length).toBeGreaterThan(0);
    for (const l of log) expect(l.payload ?? '').not.toMatch(/ZEBRA/);
  });

  it('refuses what is not a group: no name, a profile without an id, too many profiles, an unknown key, a bad id', async () => {
    const { anna, url } = await table();
    const put = (body: unknown, id: string = randomUUID()) => anna('PUT', `${url}/groups/${id}`, body).then((r) => r.statusCode);
    expect(await put({ name: '', profiles: [], baseSeq: 0 })).toBe(400);
    expect(await put({ name: 'X', profiles: [{ name: 'No id', profile: {} }], baseSeq: 0 })).toBe(400);
    expect(await put({ name: 'X', profiles: Array.from({ length: 41 }, (_, i) => ({ id: `p${i}`, name: 'Man', profile: {} })), baseSeq: 0 })).toBe(400);
    expect(await put({ name: 'X', profiles: [{ ...ferryman, profile: { Q: '1' } }], baseSeq: 0 })).toBe(400);
    expect(await put({ name: 'X', profiles: [], baseSeq: 0, extra: 1 })).toBe(400);
    expect(await put({ name: 'X', profiles: [] }, 'not-an-id')).toBe(400);
  });
});

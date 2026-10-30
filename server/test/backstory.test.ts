/* The campaign's backstory: what happened before the campaign came into the
   app, told in sections ("Battle 3 …"). Every member reads it; a leader with
   the authenticator brings it in – replacing what was there, from the stand
   the device saw. The log says that it changed, never what it says. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

interface Section { heading: string; battleNo: number | null; text: string }
type Backstory = { sections: Section[]; updatedBy: string | null; updatedAt: string | null; seq: number };

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
  return { s, cid, anna, ben, kai, vic, rob, url: `/campaigns/${cid}/backstory` };
}

const sections: Section[] = [
  { heading: 'Before the war', battleNo: null, text: 'The Silver Caravan left Nuln in the spring.' },
  { heading: 'Battle 1 – the ferry', battleNo: 1, text: 'Rain over the Stir.' },
  { heading: 'Battle 2 – the quay', battleNo: 2, text: 'A building collapsed.' },
];

describe('the backstory', () => {
  it('is empty at first; a leader brings it in, from 0', async () => {
    const { anna, url } = await table();
    expect((await anna('GET', url)).json()).toEqual({ backstory: { sections: [], updatedBy: null, updatedAt: null, seq: 0 } });
    const r = await anna('PUT', url, { sections, baseSeq: 0 });
    expect(r.statusCode).toBe(200);
    const { backstory } = r.json() as { backstory: Backstory };
    expect(backstory).toMatchObject({ sections, updatedBy: expect.any(String) });
    expect(backstory.seq).toBeGreaterThan(0);
    expect(((await anna('GET', url)).json() as { backstory: Backstory }).backstory).toEqual(backstory);
  });

  it('every member reads it – players and viewers too – an outsider is told it does not exist', async () => {
    const { anna, kai, vic, rob, url } = await table();
    await anna('PUT', url, { sections, baseSeq: 0 });
    for (const who of [kai, vic]) {
      const g = await who('GET', url);
      expect(g.statusCode).toBe(200);
      expect((g.json() as { backstory: Backstory }).backstory.sections).toEqual(sections);
    }
    expect((await rob('GET', url)).statusCode).toBe(404);
  });

  it('only a leader writes it: a player and a viewer get a 403, an outsider a 404', async () => {
    const { anna, kai, vic, rob, url } = await table();
    for (const who of [kai, vic]) expect((await who('PUT', url, { sections, baseSeq: 0 })).statusCode).toBe(403);
    expect((await rob('PUT', url, { sections, baseSeq: 0 })).statusCode).toBe(404);
    expect(((await anna('GET', url)).json() as { backstory: Backstory }).backstory.sections).toEqual([]);
  });

  it('is changed from the stand the device saw; another leader’s change in between is a 409 with the current backstory', async () => {
    const { anna, url } = await table();
    const first = ((await anna('PUT', url, { sections: sections.slice(0, 1), baseSeq: 0 })).json() as { backstory: Backstory }).backstory;
    const second = ((await anna('PUT', url, { sections, baseSeq: first.seq })).json() as { backstory: Backstory }).backstory;
    const stale = await anna('PUT', url, { sections: [], baseSeq: first.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { seq: second.seq, sections } });
    expect((await anna('PUT', url, { sections: [], baseSeq: 0 })).statusCode).toBe(409);
  });

  it('replaces what was there; writing the same again changes nothing; it may be cleared', async () => {
    const { s, anna, url } = await table();
    const a = ((await anna('PUT', url, { sections, baseSeq: 0 })).json() as { backstory: Backstory }).backstory;
    const again = ((await anna('PUT', url, { sections, baseSeq: 0 })).json() as { backstory: Backstory }).backstory;
    expect(again.seq).toBe(a.seq);
    const fewer = ((await anna('PUT', url, { sections: sections.slice(1), baseSeq: a.seq })).json() as { backstory: Backstory }).backstory;
    expect(fewer.sections).toHaveLength(2);
    const cleared = ((await anna('PUT', url, { sections: [], baseSeq: fewer.seq })).json() as { backstory: Backstory }).backstory;
    expect(cleared.sections).toEqual([]);
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'backstory.edit'").get()).toEqual({ n: 3 });
  });

  it('the log says that it changed – how many sections – never what it says', async () => {
    const { s, anna, url } = await table();
    await anna('PUT', url, { sections: [{ heading: 'Battle 1', battleNo: 1, text: 'ZEBRA stays out of the log.' }], baseSeq: 0 });
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action = 'backstory.edit'").all() as { action: string; visibility: string; payload: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.visibility).toBe('public');
    expect(rows[0]!.payload).not.toMatch(/ZEBRA/);
    expect(JSON.parse(rows[0]!.payload)).toMatchObject({ sections: 1 });
  });

  it('refuses what is not a backstory: no heading, a battle number out of range, too much text, unknown keys', async () => {
    const { anna, url } = await table();
    const bad = (body: unknown) => anna('PUT', url, body).then((r) => r.statusCode);
    expect(await bad({ sections: [{ heading: '', battleNo: null, text: 'x' }], baseSeq: 0 })).toBe(400);
    expect(await bad({ sections: [{ heading: 'Battle 0', battleNo: 0, text: 'x' }], baseSeq: 0 })).toBe(400);
    expect(await bad({ sections: [{ heading: 'Battle 1000', battleNo: 1000, text: 'x' }], baseSeq: 0 })).toBe(400);
    expect(await bad({ sections: [{ heading: 'Long', battleNo: null, text: 'x'.repeat(60_001) }], baseSeq: 0 })).toBe(400);
    expect(await bad({ sections: Array.from({ length: 201 }, (_, i) => ({ heading: `S${i}`, battleNo: null, text: 'x' })), baseSeq: 0 })).toBe(400);
    expect(await bad({ sections, baseSeq: 0, extra: true })).toBe(400);
    expect(await bad({ sections: 'text', baseSeq: 0 })).toBe(400);
  });
});

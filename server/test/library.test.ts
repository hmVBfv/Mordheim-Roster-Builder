/* The Library (ADR 0023): ideas, later factions, NPCs, groups and scenarios, kept with the account –
   private to its owner, written with the device's ids, never changed from a stale state. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

interface Item { id: string; kind: string; name: string; body: { text: string; topic: string }; createdAt: string; updatedAt: string; deletedAt: string | null; seq: number }

async function two() {
  const s = await startAccounts();
  const kai = await s.user('kai');
  const ben = await s.user('ben');
  const rob = await s.user('rob', { admin: true, totp: true });
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'PUT' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  return { s, kai: as(kai), ben: as(ben), rob: as(rob) };
}
const idea = (text = 'A war band of ferrymen who know the Stir.', topic = 'warband') => ({ kind: 'idea', name: 'The ferrymen', body: { text, topic } });

describe('the Library: groups of warbands', () => {
  const wid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
  const wgroup = (over: Record<string, unknown> = {}) => ({ kind: 'warband_group', name: 'Reikland bands', body: { warbands: [wid(1), wid(2)], ...over } });

  it('a group of warbands is kept with the ids of the warbands in it, and is nobody else’s', async () => {
    const { kai, ben } = await two();
    const made = await kai('PUT', `/library/${randomUUID()}`, wgroup());
    expect(made.statusCode).toBe(201);
    expect((made.json() as { item: unknown }).item).toMatchObject({ kind: 'warband_group', name: 'Reikland bands', body: { warbands: [wid(1), wid(2)] } });
    expect((await kai('PUT', `/library/${randomUUID()}`, { kind: 'warband_group', name: 'Empty', body: {} })).statusCode).toBe(201);
    expect(((await ben('GET', '/library')).json() as { items: unknown[] }).items).toEqual([]);
  });

  it('only a group that fits: ids, no repeat, a ceiling', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put(wgroup({ warbands: [wid(1), wid(1)] }))).statusCode).toBe(400);
    expect((await put(wgroup({ warbands: ['x'.repeat(65)] }))).statusCode).toBe(400);
    expect((await put(wgroup({ warbands: Array.from({ length: 501 }, () => randomUUID()) }))).statusCode).toBe(400);
    expect((await put(wgroup({ extra: 1 }))).statusCode).toBe(400);
  });
});

describe('the Library: scenarios', () => {
  const npc = { id: '11111111-1111-4111-8111-111111111111', name: 'Captain Brandt', type: 'Hero', hidden: ['name', 'WS'], profile: { M: '4', WS: '4' }, sv: '5+', skills: [], equipment: 'Sword', equipmentTips: [], rules: '', from: null };
  const scenario = (over: Record<string, unknown> = {}) => ({ kind: 'scenario', name: 'The night at the ferry', body: { body: 'The ferry is dark: no shooting beyond 8".', npcStatlines: 'Captain Brandt M4 WS4', npcs: [npc], ...over } });

  it('a scenario is kept with its rules, its statlines and its NPCs with their hidden parts, and is nobody else’s', async () => {
    const { kai, ben } = await two();
    const made = await kai('PUT', `/library/${randomUUID()}`, scenario());
    expect(made.statusCode).toBe(201);
    expect((made.json() as { item: unknown }).item).toMatchObject({ kind: 'scenario', name: 'The night at the ferry', body: { body: expect.stringContaining('ferry is dark'), npcs: [{ name: 'Captain Brandt', hidden: ['name', 'WS'] }] } });
    expect((await kai('PUT', `/library/${randomUUID()}`, { kind: 'scenario', name: 'Bare', body: {} })).statusCode).toBe(201);
    expect(((await ben('GET', '/library')).json() as { items: unknown[] }).items).toEqual([]);
  });

  it('only a scenario that fits: the limits of a campaign’s scenario held', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put(scenario({ body: 'x'.repeat(20_001) }))).statusCode).toBe(400);
    expect((await put(scenario({ npcStatlines: 'x'.repeat(10_001) }))).statusCode).toBe(400);
    expect((await put(scenario({ npcs: [npc, npc] }))).statusCode).toBe(400);
    expect((await put(scenario({ npcs: [{ ...npc, hidden: ['secret'] }] }))).statusCode).toBe(400);
    expect((await put(scenario({ title: 'a second title' }))).statusCode).toBe(400);
  });
});

describe('the Library: groups of opponents', () => {
  const profile = { id: 'p1', name: 'Ferryman', type: 'Henchman', count: 3, profile: { M: '4', WS: '3' }, sv: '6+', skills: [{ name: 'Dodge', text: '' }], equipment: 'Boat hook', equipmentTips: [], rules: '', note: '', from: null };
  const group = (over: Record<string, unknown> = {}) => ({ kind: 'group', name: 'The ferrymen of the Stir', body: { note: 'Smugglers on the river.', profiles: [profile], ...over } });

  it('a group is kept with its note and its profiles, and is nobody else’s', async () => {
    const { kai, ben } = await two();
    const made = await kai('PUT', `/library/${randomUUID()}`, group());
    expect(made.statusCode).toBe(201);
    expect((made.json() as { item: unknown }).item).toMatchObject({ kind: 'group', name: 'The ferrymen of the Stir', body: { note: 'Smugglers on the river.', profiles: [{ name: 'Ferryman', count: 3, skills: [{ name: 'Dodge' }] }] } });
    expect((await kai('PUT', `/library/${randomUUID()}`, { kind: 'group', name: 'Empty', body: {} })).statusCode).toBe(201);
    expect(((await ben('GET', '/library')).json() as { items: unknown[] }).items).toEqual([]);
  });

  it('only a group that fits: the limits of a campaign’s group held', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put(group({ note: 'x'.repeat(4001) }))).statusCode).toBe(400);
    expect((await put(group({ profiles: Array.from({ length: 41 }, (_, i) => ({ ...profile, id: `p${i}` })) }))).statusCode).toBe(400);
    expect((await put(group({ profiles: [{ ...profile, count: 51 }] }))).statusCode).toBe(400);
    expect((await put(group({ extra: 1 }))).statusCode).toBe(400);
  });
});

describe('the Library: NPCs', () => {
  const npc = (over: Record<string, unknown> = {}) => ({
    kind: 'npc', name: 'Old Brother Anselm',
    body: { de: 'Der alte Bruder Anselm', status: 'Rings the bells at dusk', faction: 'The Bell-ringers', named: true, statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7',
      profile: { type: 'Monk', profile: { M: '4', WS: '3' }, sv: '', skills: [{ name: 'Dodge', text: '' }], equipment: 'Bell hammer', equipmentTips: [], rules: 'Fears nothing', from: null }, ...over },
  });

  it('an NPC is kept with its values, its status and the name of its faction, and read back by its owner only', async () => {
    const { kai, ben } = await two();
    const id = randomUUID();
    const made = await kai('PUT', `/library/${id}`, npc());
    expect(made.statusCode).toBe(201);
    expect((made.json() as { item: unknown }).item).toMatchObject({ kind: 'npc', name: 'Old Brother Anselm', body: { named: true, faction: 'The Bell-ringers', profile: { type: 'Monk', skills: [{ name: 'Dodge' }] } } });
    const bare = await kai('PUT', `/library/${randomUUID()}`, { kind: 'npc', name: 'A beggar', body: {} });
    expect(bare.statusCode).toBe(201);
    expect(((await ben('GET', '/library')).json() as { items: unknown[] }).items).toEqual([]);
  });

  it('only an NPC that fits: no idea’s words in it, the limits held, a profile like the world’s', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put({ kind: 'npc', name: 'x', body: { text: 'an idea', topic: 'other' } })).statusCode).toBe(400);
    expect((await put(npc({ status: 'x'.repeat(201) }))).statusCode).toBe(400);
    expect((await put(npc({ faction: 'x'.repeat(121) }))).statusCode).toBe(400);
    expect((await put(npc({ statlineTts: 'x'.repeat(12_001) }))).statusCode).toBe(400);
    expect((await put(npc({ profile: { profile: { M: '4' }, extra: 1 } }))).statusCode).toBe(400);
  });
});

describe('the Library: factions', () => {
  const faction = (over: Record<string, unknown> = {}) => ({ kind: 'faction', name: 'The Bell-ringers', body: { de: 'Die Glockenläuter', status: 'Known in the drowned quarter', lore: 'Monks who ring the bells and know what the water hides.', ...over } });

  it('a faction is kept with its German name, what players may read and its lore', async () => {
    const { kai } = await two();
    const id = randomUUID();
    const made = await kai('PUT', `/library/${id}`, faction());
    expect(made.statusCode).toBe(201);
    expect((made.json() as { item: { kind: string; name: string; body: unknown } }).item).toMatchObject({ kind: 'faction', name: 'The Bell-ringers', body: { de: 'Die Glockenläuter', status: 'Known in the drowned quarter', lore: expect.stringContaining('bells') } });
    // the German name, the status and the lore may be left out: they are empty then
    const bare = await kai('PUT', `/library/${randomUUID()}`, { kind: 'faction', name: 'The Ferrymen', body: {} });
    expect((bare.json() as { item: { body: unknown } }).item.body).toEqual({ de: '', status: '', lore: '' });
    const list = (await kai('GET', '/library')).json() as { items: { kind: string }[] };
    expect(list.items.map((i) => i.kind).sort()).toEqual(['faction', 'faction']);
  });

  it('only a faction that fits: no idea’s words in it, the limits held', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put({ kind: 'faction', name: 'x', body: { text: 'an idea', topic: 'other' } })).statusCode).toBe(400);
    expect((await put(faction({ status: 'x'.repeat(201) }))).statusCode).toBe(400);
    expect((await put(faction({ de: 'x'.repeat(121) }))).statusCode).toBe(400);
    expect((await put(faction({ lore: 'x'.repeat(20_001) }))).statusCode).toBe(400);
  });
});

describe('the Library: ideas', () => {
  it('an idea is written under the device’s id, read back, and changed from the state it was seen in', async () => {
    const { kai } = await two();
    const id = randomUUID();
    const made = await kai('PUT', `/library/${id}`, idea());
    expect(made.statusCode).toBe(201);
    const item = (made.json() as { item: Item }).item;
    expect(item).toMatchObject({ id, kind: 'idea', name: 'The ferrymen', body: { text: 'A war band of ferrymen who know the Stir.', topic: 'warband' }, deletedAt: null });
    expect(item.seq).toBeGreaterThan(0);

    // sent again (an answer lost on the way): the same idea, nothing new
    const again = await kai('PUT', `/library/${id}`, idea());
    expect(again.statusCode).toBe(200);
    expect((again.json() as { item: Item }).item.seq).toBe(item.seq);

    // changed from the state seen
    const changed = await kai('PUT', `/library/${id}`, { ...idea('Better: they smuggle for the Countess.'), baseSeq: item.seq });
    expect(changed.statusCode).toBe(200);
    const next = (changed.json() as { item: Item }).item;
    expect(next.body.text).toMatch(/Countess/);
    expect(next.seq).toBeGreaterThan(item.seq);
    expect(next.createdAt).toBe(item.createdAt);

    // from an older state: refused, with the state as it is
    const stale = await kai('PUT', `/library/${id}`, { ...idea('Lost update'), baseSeq: item.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', item: { id, seq: next.seq } });

    const list = (await kai('GET', '/library')).json() as { items: Item[]; seq: number };
    expect(list.items.map((i) => i.id)).toEqual([id]);
    expect(list.seq).toBe(next.seq);
  });

  it('a device asks only for what is newer; what was taken out stays as a grave for the devices that have it', async () => {
    const { kai } = await two();
    const a = randomUUID(), b = randomUUID();
    await kai('PUT', `/library/${a}`, idea('first'));
    const seqA = ((await kai('GET', '/library')).json() as { seq: number }).seq;
    await kai('PUT', `/library/${b}`, { ...idea('second'), name: 'Second' });
    const fresh = (await kai('GET', `/library?since=${seqA}`)).json() as { items: Item[] };
    expect(fresh.items.map((i) => i.id)).toEqual([b]);

    expect((await kai('DELETE', `/library/${a}`)).json()).toEqual({ removed: true });
    const after = (await kai('GET', `/library?since=${seqA}`)).json() as { items: Item[] };
    expect(after.items.map((i) => [i.id, i.deletedAt !== null])).toEqual([[b, false], [a, true]]);
    // taken out: not written again under that id, and a second removal finds nothing to do
    expect((await kai('PUT', `/library/${a}`, idea('back again'))).json()).toMatchObject({ error: 'removed' });
    expect((await kai('DELETE', `/library/${a}`)).statusCode).toBe(200);
    expect((await kai('DELETE', `/library/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('is nobody else’s: not another player’s, not the admin’s', async () => {
    const { kai, ben, rob } = await two();
    const id = randomUUID();
    await kai('PUT', `/library/${id}`, idea('mine alone'));
    for (const who of [ben, rob]) {
      const list = (await who('GET', '/library')).json() as { items: Item[] };
      expect(list.items).toEqual([]);
      expect((await who('DELETE', `/library/${id}`)).statusCode).toBe(404);
      // not even a guess at the id says that it exists
      const taken = await who('PUT', `/library/${id}`, idea('overwrite'));
      expect([404, 409]).toContain(taken.statusCode);
    }
    expect(((await kai('GET', '/library')).json() as { items: Item[] }).items[0]!.body.text).toBe('mine alone');
  });

  it('only what it can read: a kind that is not here yet, a body that does not fit, too much', async () => {
    const { kai } = await two();
    const put = (b: unknown) => kai('PUT', `/library/${randomUUID()}`, b);
    expect((await put({ kind: 'rumour', name: 'Not a kind', body: {} })).statusCode).toBe(400);
    expect((await put({ kind: 'idea', name: '', body: { text: 'x', topic: 'other' } })).statusCode).toBe(400);
    expect((await put({ kind: 'idea', name: 'x', body: { text: 'x', topic: 'secret' } })).statusCode).toBe(400);
    expect((await put({ kind: 'idea', name: 'x', body: { text: 'x'.repeat(20_001), topic: 'other' } })).statusCode).toBe(400);
    expect((await put({ kind: 'idea', name: 'x', body: { text: 'x', topic: 'other', extra: 1 } })).statusCode).toBe(400);
    expect((await put({ kind: 'idea', name: 'x'.repeat(121), body: { text: 'x', topic: 'other' } })).statusCode).toBe(400);
  });

  it('keeps 500 at most per account', async () => {
    const { s, kai, ben } = await two();
    const owner = s.db.prepare("SELECT id FROM users WHERE username = 'kai'").get() as { id: string };
    const ins = s.db.prepare("INSERT INTO library_items (id, owner_id, kind, name, body, created_at, updated_at, seq) VALUES (?, ?, 'idea', 'x', '{\"text\":\"\",\"topic\":\"other\"}', 't', 't', ?)");
    for (let i = 1; i <= 500; i++) ins.run(randomUUID(), owner.id, i);
    const full = await kai('PUT', `/library/${randomUUID()}`, idea());
    expect(full.statusCode).toBe(409);
    expect(full.json()).toMatchObject({ error: 'full' });
    // another account is not held back by it
    expect((await ben('PUT', `/library/${randomUUID()}`, idea())).statusCode).toBe(201);
  });
});

/* Scenarios (phase 4b3c): a leaders' own scenario, hidden until a leader
   releases it to a battle. A draft does not exist for anyone but a leader with
   the authenticator; released, every member reads it and it stays. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { revisionsOf } from '../src/scenarios.ts';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Npc = {
  id: string; name: string; type: string; hidden: string[]; profile: Record<string, string>; sv: string; skills: { name: string; text: string }[]; equipment: string; rules: string; from: unknown;
};
type Scenario = {
  id: string; title: string; body: string; npcStatlines: string; npcs: Npc[]; visibility: 'leader' | 'public'; playedInBattle: string | null;
  releasedAt: string | null; releasedBy: string | null; edited: boolean; seq: number;
};
type List = { scenarios: Scenario[]; seq: number };

const SECRET = 'ZEBRA: the Countess’s men wait at the ferry.';
const STATS = 'Captain Brandt M4 WS4 BS3 S3 T3 W1 I4 A1 Ld8';

/** Anna leads (authenticator), Ben leads without one, Kai and Lea play, Vic watches, Rob (admin) is outside; Kai's warband and two battles. */
async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), lea: await s.user('lea'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), lea = as(u.lea), vic = as(u.vic), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.lea.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const battle = async () => {
    const bid = randomUUID();
    await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
    return bid;
  };
  const bid = await battle();
  const base = `/campaigns/${id}/scenarios`;
  const list = async (who: typeof anna) => (await who('GET', base)).json() as List;
  const draft = async (over: Record<string, unknown> = {}) => {
    const sid = randomUUID();
    const r = await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, ...over });
    return { sid, r, scenario: (r.json() as { scenario: Scenario }).scenario };
  };
  return { s, u, id, w, bid, battle, anna, ben, kai, lea, vic, rob, base, list, draft };
}

describe('a draft', () => {
  it('is read by a leader with the authenticator alone; for everyone else it does not exist, not even as a number', async () => {
    const { anna, ben, kai, lea, vic, rob, base, list, draft } = await table();
    const before = await list(kai);
    expect(before).toEqual({ scenarios: [], seq: 0 });
    const { sid, r } = await draft();
    expect(r.statusCode).toBe(200);
    expect(await list(anna)).toMatchObject({ scenarios: [{ id: sid, title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, visibility: 'leader', playedInBattle: null, releasedAt: null, edited: false }] });
    // Ben leads without an authenticator: like every leader's right, it needs one
    for (const who of [ben, kai, lea, vic]) expect(await list(who)).toEqual({ scenarios: [], seq: 0 });
    expect((await rob('GET', base)).statusCode).toBe(404);
  });

  it('is made by a leader only, with the authenticator; the device names it; sent twice it is one', async () => {
    const { s, anna, ben, kai, lea, vic, rob, base, draft } = await table();
    const { sid, r } = await draft();
    expect(await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS }).then((x) => x.statusCode)).toBe(200);
    expect(s.db.prepare('SELECT count(*) AS n FROM scenarios').get()).toEqual({ n: 1 });
    expect(s.db.prepare('SELECT count(*) AS n FROM scenario_revisions').get()).toEqual({ n: 0 });
    expect((r.json() as { seq: number }).seq).toBeGreaterThan(0);
    for (const who of [ben, kai, lea, vic]) {
      expect((await who('PUT', `${base}/${randomUUID()}`, { title: 'Me too' })).statusCode).toBe(403);
      expect((await who('POST', `${base}/${sid}/release`, { battleId: randomUUID() })).statusCode).toBe(403);
      expect((await who('DELETE', `${base}/${sid}`)).statusCode).toBe(403);
    }
    expect((await rob('PUT', `${base}/${randomUUID()}`, { title: 'Me too' })).statusCode).toBe(404);
    expect(s.db.prepare('SELECT count(*) AS n FROM scenarios').get()).toEqual({ n: 1 });
  });

  it('wants a title and nothing foreign; the limits hold', async () => {
    const { anna, base, draft } = await table();
    const bad = async (body: unknown, id: string = randomUUID()) => (await anna('PUT', `${base}/${id}`, body));
    expect((await bad({ body: 'no title' })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/not a scenario/) });
    expect((await bad({ title: '   ' })).statusCode).toBe(400);
    expect((await bad({ title: 'x', extra: 1 })).statusCode).toBe(400);
    expect((await bad({ title: 'x'.repeat(201) })).statusCode).toBe(400);
    expect((await bad({ title: 'x', body: 'y'.repeat(20_001) })).statusCode).toBe(400);
    expect((await bad({ title: 'x', npcStatlines: 'y'.repeat(10_001) })).statusCode).toBe(400);
    expect((await bad({ title: 'x' }, 'not-a-uuid')).statusCode).toBe(400);
    expect((await bad({ title: 'Only a title' })).statusCode).toBe(200);
    expect((await draft({ title: 'x'.repeat(200) })).r.statusCode).toBe(200);
  });

  it('is corrected with the earlier wording kept; another leader’s change in between is a 409 with the current one', async () => {
    const { s, anna, base, draft } = await table();
    const { sid, scenario } = await draft();
    const edit = { title: 'The night at the ferry', body: 'Better rules.', npcStatlines: STATS, baseSeq: scenario.seq };
    const ok = await anna('PUT', `${base}/${sid}`, edit);
    expect(ok.statusCode).toBe(200);
    const changed = (ok.json() as { scenario: Scenario }).scenario;
    expect(changed).toMatchObject({ body: 'Better rules.', edited: true });
    expect(changed.seq).toBeGreaterThan(scenario.seq);
    expect(revisionsOf(s.db, sid)).toMatchObject([{ title: 'The night at the ferry', body: SECRET, npcStatlines: STATS }]);
    const stale = await anna('PUT', `${base}/${sid}`, { ...edit, title: 'Other', baseSeq: scenario.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { body: 'Better rules.' } });
    // the same change sent again is no new revision
    expect((await anna('PUT', `${base}/${sid}`, { ...edit, body: 'Better rules.', baseSeq: changed.seq })).statusCode).toBe(200);
    expect(revisionsOf(s.db, sid)).toHaveLength(1);
  });

  it('keeps the last 50 wordings', async () => {
    const { s, anna, base, draft } = await table();
    const { sid, scenario } = await draft();
    let seq = scenario.seq;
    for (let i = 1; i <= 55; i++) {
      const r = await anna('PUT', `${base}/${sid}`, { title: 'T', body: `Wording ${i}`, baseSeq: seq });
      seq = (r.json() as { scenario: Scenario }).scenario.seq;
    }
    const kept = revisionsOf(s.db, sid);
    expect(kept).toHaveLength(50);
    expect(kept[0]!.body).toBe('Wording 54');
  });

  it('is taken out by a leader: gone for the leaders, a tombstone, its id not given again, nothing moves for the players', async () => {
    const { s, anna, kai, base, list, draft } = await table();
    const { sid } = await draft();
    const seqBefore = (await list(kai)).seq;
    const gone = await anna('DELETE', `${base}/${sid}`);
    expect(gone.statusCode).toBe(200);
    expect(gone.json()).toMatchObject({ removed: true });
    expect((await list(anna)).scenarios).toEqual([]);
    expect((await list(kai)).seq).toBe(seqBefore);
    // sent twice: nothing more happens; the same id is not made again
    expect((await anna('DELETE', `${base}/${sid}`)).json()).toMatchObject({ removed: false });
    expect((await anna('PUT', `${base}/${sid}`, { title: 'Back again' })).json()).toMatchObject({ error: 'removed' });
    expect((await anna('DELETE', `${base}/${randomUUID()}`)).statusCode).toBe(404);
    expect(s.db.prepare('SELECT count(*) AS n FROM scenarios WHERE deleted_at IS NOT NULL').get()).toEqual({ n: 1 });
    expect(revisionsOf(s.db, sid)).toHaveLength(1);
  });

  it('is not made for another campaign’s id, and a campaign holds at most 200', async () => {
    const { s, anna, id, base, draft } = await table();
    const { sid } = await draft();
    const other = ((await anna('POST', '/campaigns', { name: 'Summer in Sylvania' })).json() as { campaign: { id: string } }).campaign.id;
    expect((await anna('PUT', `/campaigns/${other}/scenarios/${sid}`, { title: 'Stolen' })).json()).toMatchObject({ error: 'exists' });
    expect((await anna('POST', `/campaigns/${other}/scenarios/${sid}/release`, { battleId: randomUUID() })).statusCode).toBe(404);
    expect((await anna('DELETE', `/campaigns/${other}/scenarios/${sid}`)).statusCode).toBe(404);
    const insert = s.db.prepare("INSERT INTO scenarios (id, campaign_id, title, created_by, updated_by, created_at, updated_at, seq) SELECT ?, ?, 'x', created_by, created_by, created_at, created_at, 1 FROM scenarios WHERE id = ?");
    for (let i = 0; i < 199; i++) insert.run(randomUUID(), id, sid);
    const full = await anna('PUT', `${base}/${randomUUID()}`, { title: 'One too many' });
    expect(full.statusCode).toBe(409);
    expect(full.json()).toMatchObject({ error: 'full' });
  });
});

describe('releasing', () => {
  it('a leader assigns the draft to a battle; from then on every member reads it, and the viewer too', async () => {
    const { anna, ben, kai, lea, vic, rob, base, bid, list, draft } = await table();
    const { sid } = await draft();
    const seqBefore = (await list(kai)).seq;
    const r = await anna('POST', `${base}/${sid}/release`, { battleId: bid });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ scenario: { id: sid, visibility: 'public', playedInBattle: bid, edited: false, releasedBy: expect.any(String) } });
    for (const who of [anna, ben, kai, lea, vic]) {
      const l = await list(who);
      expect(l.scenarios).toMatchObject([{ id: sid, title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, visibility: 'public', playedInBattle: bid }]);
      expect(l.scenarios[0]!.releasedAt).toEqual(expect.any(String));
    }
    expect((await list(kai)).seq).toBeGreaterThan(seqBefore);
    expect((await rob('GET', base)).statusCode).toBe(404);
  });

  it('is done once: sent twice for the same battle it is one; for another battle it is a 409; it cannot be hidden again or taken out', async () => {
    const { s, anna, kai, base, bid, battle, list, draft } = await table();
    const { sid } = await draft();
    const first = (await anna('POST', `${base}/${sid}/release`, { battleId: bid })).json() as { scenario: Scenario };
    const again = await anna('POST', `${base}/${sid}/release`, { battleId: bid });
    expect(again.statusCode).toBe(200);
    expect((again.json() as { scenario: Scenario }).scenario.seq).toBe(first.scenario.seq);
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'scenario.release'").get()).toEqual({ n: 1 });
    expect((await anna('POST', `${base}/${sid}/release`, { battleId: await battle() })).json()).toMatchObject({ error: 'released' });
    const del = await anna('DELETE', `${base}/${sid}`);
    expect(del.statusCode).toBe(409);
    expect(del.json()).toMatchObject({ error: 'released' });
    expect((await list(kai)).scenarios).toHaveLength(1);
  });

  it('wants a battle of this campaign', async () => {
    const { anna, base, draft } = await table();
    const { sid } = await draft();
    const other = ((await anna('POST', '/campaigns', { name: 'Summer in Sylvania' })).json() as { campaign: { id: string } }).campaign.id;
    const foreign = randomUUID();
    await anna('POST', `/campaigns/${other}/battles`, { id: foreign, title: 'Elsewhere', warbandIds: [] });
    expect((await anna('POST', `${base}/${sid}/release`, { battleId: foreign })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/no such battle/) });
    expect((await anna('POST', `${base}/${sid}/release`, { battleId: randomUUID() })).statusCode).toBe(400);
    expect((await anna('POST', `${base}/${sid}/release`, { battleId: 'nope' })).statusCode).toBe(400);
    expect((await anna('POST', `${base}/${sid}/release`, {})).statusCode).toBe(400);
    expect((await anna('POST', `${base}/${randomUUID()}/release`, { battleId: randomUUID() })).statusCode).toBe(404);
  });

  it('a released scenario may still be corrected, with the earlier wording kept, and everyone sees that it was edited', async () => {
    const { s, anna, kai, base, bid, list, draft } = await table();
    const { sid } = await draft();
    const released = (await anna('POST', `${base}/${sid}/release`, { battleId: bid })).json() as { scenario: Scenario };
    const fix = await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: 'Corrected rules.', npcStatlines: STATS, baseSeq: released.scenario.seq });
    expect(fix.statusCode).toBe(200);
    expect((await list(kai)).scenarios).toMatchObject([{ body: 'Corrected rules.', edited: true, visibility: 'public', playedInBattle: bid }]);
    expect(revisionsOf(s.db, sid)).toMatchObject([{ body: SECRET }]);
  });
});

describe('the log', () => {
  it('names the scenario and its battle, never the words; a draft’s entries are for leaders only', async () => {
    const { s, anna, base, bid, draft } = await table();
    const { sid, scenario } = await draft({ title: 'ZEBRA title' });
    await anna('PUT', `${base}/${sid}`, { title: 'ZEBRA title', body: 'ZEBRA changed', npcStatlines: '', baseSeq: scenario.seq });
    await anna('POST', `${base}/${sid}/release`, { battleId: bid });
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action LIKE 'scenario.%' ORDER BY seq").all() as { action: string; visibility: string; payload: string | null }[];
    expect(rows.map((r) => [r.action, r.visibility])).toEqual([['scenario.create', 'leader'], ['scenario.edit', 'leader'], ['scenario.release', 'public']]);
    expect(rows[2]!.payload).toBe(JSON.stringify({ battle: bid }));
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toMatch(/ZEBRA/);
  });
});

/* The NPCs of a scenario (ADR 0022): the leader hides parts of them; after the release everyone but a leader with the authenticator reads a "?" there. */
const GERHARD = {
  name: 'Gerhard QUOKKA-Voss', type: 'QUOKKA-Hero', profile: { M: '4', WS: 'QUOKKA-9', BS: '3', S: '4', T: '4', W: '3', I: '4', A: '2', Ld: '8' }, sv: '5+',
  skills: [{ name: 'Strongman', text: 'Hits harder.' }], equipment: 'Boat hook', rules: 'QUOKKA kills witnesses', from: { kind: 'hired', key: 'hired/ogre', label: 'QUOKKA Ogre (Rulebook)' },
};
const npc = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), ...GERHARD, hidden: ['name', 'WS', 'rules'], ...over });

describe('the NPCs of a scenario', () => {
  it('a leader writes them into a draft and reads them back as written, hidden parts included; the order of the parts is the form’s', async () => {
    const { anna, draft, list } = await table();
    const n = npc({ hidden: ['rules', 'WS', 'name', 'WS'] });
    const { r, scenario } = await draft({ npcs: [n] });
    expect(r.statusCode).toBe(200);
    expect(scenario.npcs).toEqual([{ ...n, hidden: ['name', 'WS', 'rules'] }]);
    expect((await list(anna)).scenarios[0]!.npcs).toEqual(scenario.npcs);
  });

  it('wants a name, a known part to hide, each NPC once, at most 30, and nothing foreign', async () => {
    const { anna, base, draft } = await table();
    const put = async (npcs: unknown[]) => (await anna('PUT', `${base}/${randomUUID()}`, { title: 'x', npcs })).statusCode;
    expect(await put([npc({ name: '' })])).toBe(400);
    expect(await put([npc({ hidden: ['name', 'luck'] })])).toBe(400);
    expect(await put([npc({ id: 'not-an-id' })])).toBe(400);
    const same = npc();
    expect(await put([same, { ...same }])).toBe(400);
    expect(await put(Array.from({ length: 31 }, () => npc()))).toBe(400);
    expect(await put([{ ...npc(), surprise: 1 }])).toBe(400);
    expect(await put([npc({ profile: { M: 'x'.repeat(13) } })])).toBe(400);
    expect(await put(Array.from({ length: 30 }, () => npc()))).toBe(200);
    expect((await draft({ npcs: [] })).r.statusCode).toBe(200);
  });

  it('sent twice it is one; an NPC added later is a change with the earlier wording kept', async () => {
    const { anna, s, base, draft } = await table();
    const first = npc();
    const { sid, scenario } = await draft({ npcs: [first] });
    const again = await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, npcs: [first], baseSeq: scenario.seq });
    expect((again.json() as { scenario: Scenario }).scenario.seq).toBe(scenario.seq); // nothing changed, nothing written
    const more = await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, npcs: [first, npc({ name: 'Second', hidden: [] })], baseSeq: scenario.seq });
    expect((more.json() as { scenario: Scenario }).scenario.npcs).toHaveLength(2);
    expect(revisionsOf(s.db, sid)[0]!.npcs).toHaveLength(1);
  });

  it('after the release a player, a viewer and a leader without the authenticator read a "?" for every hidden part – and not one hidden word reaches them', async () => {
    const { anna, ben, kai, lea, vic, base, bid, draft, list } = await table();
    const { sid } = await draft({ npcs: [npc({ hidden: ['name', 'WS', 'rules'] })] });
    for (const who of [kai, vic, ben]) expect((await list(who)).scenarios).toEqual([]); // a draft is nobody else's
    await anna('POST', `${base}/${sid}/release`, { battleId: bid });
    for (const who of [kai, lea, vic, ben]) {
      const body = JSON.stringify((await who('GET', `${base}`)).json());
      expect(body).not.toMatch(/QUOKKA/);
      expect(body).not.toMatch(/Gerhard|Voss/);
      const n = (await list(who)).scenarios[0]!.npcs[0]!;
      expect(n).toMatchObject({ name: '?', type: '', hidden: ['name', 'WS', 'rules'], profile: { M: '4', WS: '?', BS: '3' }, sv: '5+', rules: '?', equipment: 'Boat hook', from: null });
      expect(n.skills).toEqual([{ name: 'Strongman', text: 'Hits harder.' }]);
    }
    // the leader with the authenticator reads it all
    const mine = (await list(anna)).scenarios[0]!.npcs[0]!;
    expect(mine).toMatchObject({ name: 'Gerhard QUOKKA-Voss', profile: { WS: 'QUOKKA-9' }, rules: 'QUOKKA kills witnesses', hidden: ['name', 'WS', 'rules'] });
  });

  it('one NPC with nothing hidden is read as it is', async () => {
    const { anna, kai, base, bid, draft, list } = await table();
    const { sid } = await draft({ npcs: [npc({ hidden: [] })] });
    await anna('POST', `${base}/${sid}/release`, { battleId: bid });
    // ... except for its type, which the players never read: not as it is, not as a "?" (Rob, 20.10.2026), while the leader keeps it
    expect((await list(kai)).scenarios[0]!.npcs[0]).toMatchObject({ name: 'Gerhard QUOKKA-Voss', profile: { WS: 'QUOKKA-9' }, rules: 'QUOKKA kills witnesses', hidden: [], from: null, type: '' });
    expect((await list(anna)).scenarios[0]!.npcs[0]).toMatchObject({ type: 'QUOKKA-Hero' });
  });
});

describe('the NPCs of a released scenario', () => {
  const released = async () => {
    const t = await table();
    const n = npc({ hidden: ['name', 'WS', 'rules'] });
    const { sid } = await t.draft({ npcs: [n] });
    const r = (await t.anna('POST', `${t.base}/${sid}/release`, { battleId: t.bid })).json() as { scenario: Scenario };
    const change = (npcs: unknown[], seq = r.scenario.seq) => t.anna('PUT', `${t.base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, npcs, baseSeq: seq });
    return { ...t, sid, n, seq: r.scenario.seq, change };
  };

  it('a hidden value cannot be changed any more – also not while it is revealed; nothing is hidden that was read', async () => {
    const { n, change, list, kai } = await released();
    for (const bad of [{ ...n, profile: { ...n.profile, WS: '3' } }, { ...n, name: 'Someone else' }, { ...n, rules: 'Harmless' }, { ...n, hidden: ['name'], rules: 'Harmless' }, { ...n, hidden: ['name', 'WS', 'rules', 'Ld'] }]) {
      const res = await change([bad]);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: 'frozen', problem: expect.stringMatching(/hidden|changed/) });
    }
    const gone = await change([]);
    expect(gone.statusCode).toBe(409);
    expect(gone.json()).toMatchObject({ error: 'frozen' });
    expect((await list(kai)).scenarios[0]!.npcs[0]).toMatchObject({ name: '?', profile: { WS: '?' } }); // nothing moved
  });

  it('what is not hidden may be corrected, and a new NPC may come with its own hidden parts', async () => {
    const { n, change, list, kai, anna } = await released();
    const res = await change([{ ...n, equipment: 'Boat hook and net', profile: { ...n.profile, BS: '4' } }, npc({ name: 'A newcomer', hidden: ['Ld'] })]);
    expect(res.statusCode).toBe(200);
    const read = (await list(kai)).scenarios[0]!.npcs;
    expect(read[0]).toMatchObject({ name: '?', equipment: 'Boat hook and net', profile: { BS: '4', WS: '?' } });
    expect(read[1]).toMatchObject({ name: 'A newcomer', profile: { Ld: '?' } });
    expect((await list(anna)).scenarios[0]!.npcs[1]!.profile.Ld).toBe('8');
  });

  it('a reveal shows the value it always had, is not undone, and the log says where – never what', async () => {
    const { s, n, sid, change, list, kai, seq } = await released();
    const step = await change([{ ...n, hidden: ['WS'] }]);
    expect(step.statusCode).toBe(200);
    const read = (await list(kai)).scenarios[0]!.npcs[0]!;
    expect(read).toMatchObject({ name: 'Gerhard QUOKKA-Voss', rules: 'QUOKKA kills witnesses', profile: { WS: '?' }, hidden: ['WS'] });
    // what was hidden again is refused
    const again = await change([{ ...n, hidden: ['WS', 'name'] }], (step.json() as { scenario: Scenario }).scenario.seq);
    expect(again.statusCode).toBe(409);
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action = 'scenario.reveal'").all() as { action: string; visibility: string; payload: string }[];
    expect(rows).toEqual([{ action: 'scenario.reveal', visibility: 'public', payload: JSON.stringify({ npc: n.id, parts: ['name', 'rules'] }) }]);
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toMatch(/QUOKKA/);
    expect(seq).toBeLessThan((step.json() as { scenario: Scenario }).scenario.seq);
    expect(revisionsOf(s.db, sid)[0]!.npcs[0]!.hidden).toEqual(['name', 'WS', 'rules']);
  });

  it('a draft can still hide and show as it likes – nobody has read it', async () => {
    const { anna, base, draft } = await table();
    const n = npc({ hidden: ['name'] });
    const { sid, scenario } = await draft({ npcs: [n] });
    const res = await anna('PUT', `${base}/${sid}`, { title: 'The night at the ferry', body: SECRET, npcStatlines: STATS, npcs: [{ ...n, hidden: ['WS', 'Ld'], name: 'Renamed' }], baseSeq: scenario.seq });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { scenario: Scenario }).scenario.npcs[0]).toMatchObject({ name: 'Renamed', hidden: ['WS', 'Ld'] });
  });
});


/* The campaign world (phase 4b3b): factions, NPCs and the reputation log.
   Mechanics, so every member reads all of it; only a leader with the
   authenticator writes; an outsider does not even know the campaign. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Faction = { id: string; nameDe: string; nameEn: string; publicStatus: string };
type Npc = { id: string; factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string; named: boolean; profile: Record<string, unknown> | null };
type Event = { id: string; warbandId: string; warband: string; factionId: string; delta: number; reason: string; battleId: string | null; actor: string };
type World = { factions: Faction[]; npcs: Npc[]; reputation: Event[]; seq: number; removed?: boolean };

/** Anna leads (authenticator), Ben leads without one, Kai and Lea play, Vic watches, Rob (admin) is outside; Kai's warband and one battle. */
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
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const base = `/campaigns/${id}/world`;
  const get = async (who: typeof anna) => (await who('GET', base)).json() as World;
  const faction = async (over: Record<string, unknown> = {}) => {
    const fid = randomUUID();
    const r = await anna('PUT', `${base}/factions/${fid}`, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing', ...over });
    return { fid, r };
  };
  return { s, u, id, w, bid, anna, ben, kai, lea, vic, rob, base, get, faction };
}

describe('reading', () => {
  it('every member reads the whole world, a viewer too; an outsider does not know the campaign', async () => {
    const { anna, ben, kai, lea, vic, rob, base, get, faction } = await table();
    const { fid } = await faction();
    const nid = randomUUID();
    await anna('PUT', `${base}/npcs/${nid}`, { factionId: fid, nameEn: 'Old Marek', publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' });
    for (const who of [anna, ben, kai, lea, vic]) {
      const w = await get(who);
      expect(w.factions).toMatchObject([{ id: fid, nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' }]);
      expect(w.npcs).toMatchObject([{ id: nid, factionId: fid, nameEn: 'Old Marek', publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' }]);
    }
    expect((await rob('GET', base)).statusCode).toBe(404);
  });

  it('is empty for a campaign that has nothing yet, and a second campaign has its own world', async () => {
    const { anna, get, faction } = await table();
    expect(await get(anna)).toMatchObject({ factions: [], npcs: [], reputation: [], seq: 0 });
    await faction();
    const other = ((await anna('POST', '/campaigns', { name: 'Summer in Sylvania' })).json() as { campaign: { id: string } }).campaign.id;
    expect(((await anna('GET', `/campaigns/${other}/world`)).json() as World).factions).toEqual([]);
    expect((await get(anna)).factions).toHaveLength(1);
  });
});

describe('writing', () => {
  it('only a leader with the authenticator writes; sent twice, it is one; the name can be German, English or both', async () => {
    const { s, anna, ben, kai, lea, vic, rob, base, faction } = await table();
    const { fid, r } = await faction();
    expect(r.statusCode).toBe(200);
    expect(await anna('PUT', `${base}/factions/${fid}`, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' }).then((x) => x.statusCode)).toBe(200);
    expect(s.db.prepare('SELECT count(*) AS n FROM factions').get()).toEqual({ n: 1 });
    for (const who of [ben, kai, lea, vic]) {
      expect((await who('PUT', `${base}/factions/${randomUUID()}`, { nameEn: 'Me too' })).statusCode).toBe(403);
      expect((await who('PUT', `${base}/npcs/${randomUUID()}`, { nameEn: 'Me too' })).statusCode).toBe(403);
      expect((await who('DELETE', `${base}/factions/${fid}`)).statusCode).toBe(403);
    }
    expect((await rob('PUT', `${base}/factions/${randomUUID()}`, { nameEn: 'Me too' })).statusCode).toBe(404);
    expect((await anna('PUT', `${base}/factions/${randomUUID()}`, { nameDe: 'Nur Deutsch' })).statusCode).toBe(200);
    expect((await anna('PUT', `${base}/factions/${randomUUID()}`, { publicStatus: 'no name' })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/a name, in German or English/) });
    expect((await anna('PUT', `${base}/factions/not-a-uuid`, { nameEn: 'x' })).statusCode).toBe(400);
    expect((await anna('PUT', `${base}/factions/${randomUUID()}`, { nameEn: 'x', extra: 1 })).statusCode).toBe(400);
    expect((await anna('PUT', `${base}/factions/${randomUUID()}`, { nameEn: 'x'.repeat(121) })).statusCode).toBe(400);
  });

  it('changes a faction and an NPC; an NPC is put under a faction of the campaign only; taking a faction out frees its NPCs and hides its reputation', async () => {
    const { w, anna, base, get, faction } = await table();
    const { fid } = await faction();
    expect((await anna('PUT', `${base}/factions/${fid}`, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'driven from the Stir' })).statusCode).toBe(200);
    const nid = randomUUID();
    expect((await anna('PUT', `${base}/npcs/${nid}`, { factionId: randomUUID(), nameEn: 'Old Marek' })).json()).toMatchObject({ problem: 'no such faction in this campaign' });
    expect((await anna('PUT', `${base}/npcs/${nid}`, { factionId: fid, nameEn: 'Old Marek', publicStatus: 'alive' })).statusCode).toBe(200);
    expect((await anna('PUT', `${base}/npcs/${nid}`, { factionId: fid, nameEn: 'Old Marek', publicStatus: 'dead' })).statusCode).toBe(200);
    expect((await anna('PUT', `${base}/npcs/${randomUUID()}`, { nameEn: 'A', statlineTts: 'x'.repeat(12_001) })).statusCode).toBe(400);
    await anna('PUT', `${base}/reputation/${randomUUID()}`, { warbandId: w, factionId: fid, delta: 2, reason: 'Escorted the barge.' });
    let world = await get(anna);
    expect(world.factions[0]!.publicStatus).toBe('driven from the Stir');
    expect(world.npcs[0]).toMatchObject({ factionId: fid, publicStatus: 'dead' });
    expect(world.reputation).toHaveLength(1);

    const gone = await anna('DELETE', `${base}/factions/${fid}`);
    expect(gone.json()).toMatchObject({ removed: true, factions: [], reputation: [] });
    world = await get(anna);
    expect(world.npcs).toMatchObject([{ id: nid, factionId: null }]); // the NPC stays, unaffiliated
    expect((await anna('DELETE', `${base}/factions/${fid}`)).json()).toMatchObject({ removed: false }); // taken out twice: nothing more happens
    expect((await anna('PUT', `${base}/factions/${fid}`, { nameEn: 'Back again' })).json()).toEqual({ error: 'removed' });
    expect((await anna('DELETE', `${base}/factions/${randomUUID()}`)).statusCode).toBe(404);
    expect((await anna('DELETE', `${base}/npcs/${nid}`)).json()).toMatchObject({ removed: true, npcs: [] });
  });
});

/* Rob, 19.10.2026: an NPC gets its values in a form (characteristics, save, skills, equipment, rules) and can be a named, unique person;
   the text stays for the NPCs that have only that. */
describe('the values of an NPC', () => {
  const values = { type: 'Hero', profile: { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' }, sv: '6+', skills: [{ name: 'Step Aside', text: 'Dodges the first hit.' }], equipment: 'Dagger', equipmentTips: [{ name: 'Dagger', text: 'Close combat · Strength: as user — Parry.' }], rules: 'Knows every shoal', from: { kind: 'beast', key: 'beast/wardog', label: 'Wardog (Bestiary)' } };

  it('keeps the values and the named flag, and every member reads them; an NPC with only a text has neither', async () => {
    const { anna, kai, vic, base, get } = await table();
    const named = randomUUID(), plain = randomUUID();
    expect((await anna('PUT', `${base}/npcs/${named}`, { nameEn: 'Old Marek', named: true, profile: values, statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv 6+' })).statusCode).toBe(200);
    expect((await anna('PUT', `${base}/npcs/${plain}`, { nameEn: 'A ferryman', statlineTts: 'M4 WS3' })).statusCode).toBe(200);
    for (const who of [anna, kai, vic]) {
      const w = await get(who);
      expect(w.npcs.find((n) => n.id === named)).toMatchObject({ named: true, profile: values, statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv 6+' });
      expect(w.npcs.find((n) => n.id === plain)).toMatchObject({ named: false, profile: null, statlineTts: 'M4 WS3' });
    }
  });

  it('a change of the values or the flag is a change; the same again is not', async () => {
    const { anna, base, get } = await table();
    const id = randomUUID();
    const body = { nameEn: 'Old Marek', named: true, profile: values, statlineTts: 'x' };
    await anna('PUT', `${base}/npcs/${id}`, body);
    const seq0 = (await get(anna)).seq;
    await anna('PUT', `${base}/npcs/${id}`, body);
    expect((await get(anna)).seq).toBe(seq0);
    await anna('PUT', `${base}/npcs/${id}`, { ...body, profile: { ...values, sv: '5+' } });
    const w1 = await get(anna);
    expect(w1.seq).toBeGreaterThan(seq0);
    expect(w1.npcs[0]!.profile).toMatchObject({ sv: '5+' });
    await anna('PUT', `${base}/npcs/${id}`, { ...body, profile: { ...values, sv: '5+' }, named: false });
    expect((await get(anna)).npcs[0]).toMatchObject({ named: false });
  });

  it('takes no value it does not know, no more than the limits, and a longer text than before', async () => {
    const { anna, base } = await table();
    const put = (body: Record<string, unknown>) => anna('PUT', `${base}/npcs/${randomUUID()}`, { nameEn: 'Old Marek', ...body });
    expect((await put({ profile: { ...values, profile: { ...values.profile, Mana: '9' } } })).statusCode).toBe(400);
    expect((await put({ profile: { ...values, skills: Array.from({ length: 41 }, (_, i) => ({ name: `S${i}`, text: '' })) } })).statusCode).toBe(400);
    expect((await put({ profile: { ...values, rules: 'x'.repeat(6001) } })).statusCode).toBe(400);
    expect((await put({ profile: { ...values, from: { kind: 'dragon', key: 'x', label: 'x' } } })).statusCode).toBe(400);
    expect((await put({ profile: { ...values, note: 'not part of an NPC' } })).statusCode).toBe(400);
    expect((await put({ named: 'yes' })).statusCode).toBe(400);
    expect((await put({ statlineTts: 'x'.repeat(12_000) })).statusCode).toBe(200);
    expect((await put({ statlineTts: 'x'.repeat(12_001) })).statusCode).toBe(400);
  });

  it('only a leader with the authenticator writes them', async () => {
    const { ben, kai, base } = await table();
    for (const who of [ben, kai]) expect((await who('PUT', `${base}/npcs/${randomUUID()}`, { nameEn: 'Old Marek', named: true, profile: values })).statusCode).toBe(403);
  });
});

describe('reputation', () => {
  it('is a log of events with a reason; the standing is their sum; a mistake is taken out and the log keeps who did it', async () => {
    const { s, u, w, bid, anna, kai, base, get, faction } = await table();
    const { fid } = await faction();
    const e1 = randomUUID(), e2 = randomUUID();
    const add = (rid: string, over: Record<string, unknown> = {}) => anna('PUT', `${base}/reputation/${rid}`, { warbandId: w, factionId: fid, delta: 2, reason: 'Escorted the barge.', battleId: bid, ...over });
    expect((await add(e1)).statusCode).toBe(200);
    expect((await add(e2, { delta: -1, reason: 'Left the ferryman to the rats.' })).statusCode).toBe(200);
    let rep = (await get(kai)).reputation;
    expect(rep.map((e) => [e.delta, e.reason, e.battleId, e.actor, e.warband])).toEqual(expect.arrayContaining([
      [2, 'Escorted the barge.', bid, 'anna', expect.any(String)], [-1, 'Left the ferryman to the rats.', bid, 'anna', expect.any(String)],
    ]));
    expect(rep.reduce((n, e) => n + e.delta, 0)).toBe(1);

    // sent twice with the same content: one event; with other content under the same id: a conflict – events are not edited
    expect((await add(e1)).statusCode).toBe(200);
    expect(s.db.prepare('SELECT count(*) AS n FROM reputation_events').get()).toEqual({ n: 2 });
    expect((await add(e1, { delta: 5 })).json()).toEqual({ error: 'exists' });

    expect((await anna('DELETE', `${base}/reputation/${e2}`)).json()).toMatchObject({ removed: true });
    rep = (await get(kai)).reputation;
    expect(rep.map((e) => e.id)).toEqual([e1]);
    expect((await add(e2, { delta: -1, reason: 'Left the ferryman to the rats.' })).json()).toEqual({ error: 'removed' });
    const log = s.db.prepare("SELECT actor_id, visibility, payload FROM audit_log WHERE action = 'world.reputation.remove'").all() as { actor_id: string; visibility: string; payload: string | null }[];
    expect(log).toEqual([{ actor_id: u.anna.id, visibility: 'public', payload: null }]);
  });

  it('needs a warband that takes part, a faction and a battle of this campaign, a real step and a reason', async () => {
    const { anna, base, bid, w, faction } = await table();
    const { fid } = await faction();
    const put = (over: Record<string, unknown>) => anna('PUT', `${base}/reputation/${randomUUID()}`, { warbandId: w, factionId: fid, delta: 1, reason: 'Paid the toll.', ...over });
    expect((await put({})).statusCode).toBe(200);
    expect((await put({ warbandId: randomUUID() })).json()).toMatchObject({ problem: 'no such warband in this campaign' });
    expect((await put({ factionId: randomUUID() })).json()).toMatchObject({ problem: 'no such faction in this campaign' });
    expect((await put({ battleId: randomUUID() })).json()).toMatchObject({ problem: 'no such battle in this campaign' });
    expect((await put({ battleId: bid })).statusCode).toBe(200);
    expect((await put({ delta: 0 })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/a change, not nothing/) });
    expect((await put({ delta: 101 })).statusCode).toBe(400);
    expect((await put({ delta: 1.5 })).statusCode).toBe(400);
    expect((await put({ reason: '  ' })).statusCode).toBe(400);
    expect((await put({ reason: 'x'.repeat(501) })).statusCode).toBe(400);
  });

  it('a warband of another campaign has no reputation here', async () => {
    const { anna, base, faction } = await table();
    const { fid } = await faction();
    const other = ((await anna('POST', '/campaigns', { name: 'Summer in Sylvania' })).json() as { campaign: { id: string } }).campaign.id;
    const foreign = randomUUID();
    await anna('POST', `/campaigns/${other}/enrolments`, { warbandId: foreign, data: SAVE });
    const r = await anna('PUT', `${base}/reputation/${randomUUID()}`, { warbandId: foreign, factionId: fid, delta: 1, reason: 'Wrong table.' });
    expect(r.json()).toMatchObject({ problem: 'no such warband in this campaign' });
  });
});

describe('the seq and the log', () => {
  it('moves with every change, a removal included, so a device that holds an older state asks again', async () => {
    const { anna, base, get, faction } = await table();
    const seqs = [(await get(anna)).seq];
    const { fid } = await faction();
    seqs.push((await get(anna)).seq);
    await anna('PUT', `${base}/factions/${fid}`, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'in hiding' });
    seqs.push((await get(anna)).seq);
    await anna('DELETE', `${base}/factions/${fid}`);
    seqs.push((await get(anna)).seq);
    expect(seqs.every((n, i) => i === 0 || n > seqs[i - 1]!)).toBe(true);
  });

  it('writes public entries without the words', async () => {
    const { s, faction } = await table();
    await faction({ nameEn: 'ZEBRA-FACTION', publicStatus: 'ZEBRA-STATUS' });
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action LIKE 'world.%'").all() as { action: string; visibility: string; payload: string | null }[];
    expect(rows).toEqual([{ action: 'world.faction.create', visibility: 'public', payload: null }]);
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toMatch(/ZEBRA/);
  });
});

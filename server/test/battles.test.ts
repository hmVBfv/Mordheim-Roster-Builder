/* Battles (phase 4a2): a leader sets one up and writes its protocol, every
   member reads it live, players send corrections – with the device's ids,
   so what was gathered offline and sent twice is there once (ADR 0010). */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

interface View { battle: { id: string; round: number; title: string; turn: number; district: string; status: string }; seq: number; participants: { warbandId: string; name: string; player: string; outcome: string; revBefore: number }[]; entries: { id: string; turn: number; kind: string; payload: Record<string, unknown>; author: string }[]; proposals: { id: string; targetId: string; status: string; author: string; payload: { text: string } }[] }

/** Anna leads, Kai and Ben play, Vic watches, Rob (the admin) is outside; Kai's and Ben's warbands entered and confirmed. */
async function world() {
  const s = await startAccounts();
  const users = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), ben: await s.user('ben'), vic: await s.user('vic') };
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(users.anna), kai = as(users.kai), ben = as(users.ben), vic = as(users.vic), rob = as(users.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${users.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${users.ben.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${users.vic.id}`, { role: 'viewer' });
  const enter = async (who: typeof kai, name: string) => {
    const w = randomUUID();
    const e = (await who('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: { ...SAVE, name } })).json() as { enrolmentId: string };
    return { w, e: e.enrolmentId };
  };
  const caravan = await enter(kai, 'The Silver Caravan');
  const skrittle = await enter(ben, 'Clan Skrittle');
  await anna('POST', `/campaigns/${id}/enrolments/${caravan.e}/confirm`);
  await anna('POST', `/campaigns/${id}/enrolments/${skrittle.e}/confirm`);
  return { s, users, id, anna, kai, ben, vic, rob, caravan: caravan.w, skrittle: skrittle.w, enter };
}

async function battle() {
  const w = await world();
  const bid = randomUUID();
  const made = await w.anna('POST', `/campaigns/${w.id}/battles`, { id: bid, title: ' Hel Fenn ferry ', district: 'artisanquarter', warbandIds: [w.caravan, w.skrittle] });
  expect(made.statusCode).toBe(201);
  return { ...w, bid, url: `/campaigns/${w.id}/battles/${bid}` };
}

const casualty = (victim: { warbandId: string; name: string; uid?: number }, attacker: { warbandId?: string; name: string; env?: true } | null, note = '') => ({ victim, attacker, note });

describe('setting up a battle', () => {
  it('a leader sets it up from confirmed warbands; every member sees it, nobody outside', async () => {
    const { id, anna, kai, vic, rob, caravan, skrittle, bid, url } = await battle();
    const v = (await kai('GET', url)).json() as View;
    expect(v.battle).toMatchObject({ id: bid, round: 1, title: 'Hel Fenn ferry', turn: 1, district: 'artisanquarter', status: 'open' });
    expect(v.participants.map((p) => [p.name, p.player, p.outcome, p.revBefore])).toEqual([['Clan Skrittle', 'ben', '', 1], ['The Silver Caravan', 'kai', '', 1]]);
    expect((await vic('GET', `/campaigns/${id}/battles`)).json()).toMatchObject({ battles: [{ id: bid, round: 1, title: 'Hel Fenn ferry', status: 'open', warbands: ['Clan Skrittle', 'The Silver Caravan'] }] });
    expect((await kai('GET', `/campaigns/${id}`)).json()).toMatchObject({ battles: [{ id: bid }] });
    expect((await rob('GET', url)).statusCode).toBe(404);
    // only a leader sets one up
    expect((await kai('POST', `/campaigns/${id}/battles`, { id: randomUUID(), warbandIds: [caravan] })).json()).toEqual({ error: 'forbidden' });
    // sent twice: one battle
    expect((await anna('POST', `/campaigns/${id}/battles`, { id: bid, warbandIds: [caravan, skrittle] })).statusCode).toBe(200);
    expect(((await anna('GET', `/campaigns/${id}/battles`)).json() as { battles: unknown[] }).battles).toHaveLength(1);
  });

  it('only warbands confirmed in the campaign fight; a district is one of the map’s', async () => {
    const { id, anna, kai, caravan, enter } = await world();
    const waiting = await enter(kai, 'Waiting');
    for (const [ws, district, problem] of [[[], '', /needs a warband/], [[waiting.w], '', /entered and confirmed/], [[randomUUID()], '', /entered and confirmed/], [[caravan], 'atlantis', /district/]] as const) {
      const r = await anna('POST', `/campaigns/${id}/battles`, { id: randomUUID(), warbandIds: ws, district });
      expect(r.statusCode).toBe(400);
      expect((r.json() as { problem: string }).problem).toMatch(problem);
    }
  });

  it('a leader sets the turn, the outcomes and who fought; never an outcome for someone who did not', async () => {
    const { anna, kai, caravan, skrittle, url } = await battle();
    const v = (await anna('PATCH', url, { turn: 4, outcomes: { [caravan]: 'victory', [skrittle]: 'routed' } })).json() as View;
    expect(v.battle.turn).toBe(4);
    expect(Object.fromEntries(v.participants.map((p) => [p.warbandId, p.outcome]))).toEqual({ [caravan]: 'victory', [skrittle]: 'routed' });
    expect((await anna('PATCH', url, { outcomes: { [randomUUID()]: 'victory' } })).statusCode).toBe(400);
    expect((await anna('PATCH', url, { outcomes: { [caravan]: 'triumph' } })).statusCode).toBe(400);
    expect((await kai('PATCH', url, { turn: 5 })).statusCode).toBe(403);
    // taking a warband out takes its outcome with it
    expect(((await anna('PATCH', url, { warbandIds: [caravan] })).json() as View).participants.map((p) => p.outcome)).toEqual(['victory']);
  });
});

describe('the protocol', () => {
  it('a leader writes it under the device’s ids – sent twice, there once; corrected; taken out', async () => {
    const { s, anna, kai, ben, caravan, skrittle, url } = await battle();
    const a = randomUUID();
    const entry = { turn: 2, kind: 'casualty', payload: casualty({ warbandId: skrittle, uid: 3, name: 'Tik' }, { warbandId: caravan, name: 'Lukas' }) };
    expect((await anna('PUT', `${url}/protocol/${a}`, entry)).json()).toMatchObject({ entry: { id: a, turn: 2, kind: 'casualty', author: 'anna', payload: { victim: { name: 'Tik' }, note: '' } } });
    await anna('PUT', `${url}/protocol/${a}`, entry);
    const seen = (await kai('GET', url)).json() as View;
    expect(seen.entries).toHaveLength(1);
    // a device that has it learns that nothing changed
    expect((await ben('GET', `${url}?since=${seen.seq}`)).json()).toEqual({ unchanged: true, seq: seen.seq });
    // corrected: the same id, the earlier wording in the log
    await anna('PUT', `${url}/protocol/${a}`, { ...entry, turn: 3 });
    expect(((await ben('GET', `${url}?since=${seen.seq}`)).json() as View).entries).toMatchObject([{ id: a, turn: 3 }]);
    const e = randomUUID();
    await anna('PUT', `${url}/protocol/${e}`, { turn: 3, kind: 'event', payload: { text: 'The ferry drifts.' } });
    expect((await anna('DELETE', `${url}/protocol/${e}`)).json()).toMatchObject({ removed: true });
    expect(((await kai('GET', url)).json() as View).entries.map((x) => x.id)).toEqual([a]);
    // a removed entry stays removed, even when a slow device sends it again
    expect((await anna('PUT', `${url}/protocol/${e}`, { turn: 3, kind: 'event', payload: { text: 'The ferry drifts.' } })).json()).toEqual({ error: 'removed' });
    expect(s.db.prepare("SELECT action FROM audit_log WHERE action LIKE 'protocol.%' ORDER BY seq").all()).toEqual([{ action: 'protocol.add' }, { action: 'protocol.correct' }, { action: 'protocol.add' }, { action: 'protocol.remove' }]);
  });

  it('only a leader writes; what an entry says is checked', async () => {
    const { anna, kai, caravan, url } = await battle();
    expect((await kai('PUT', `${url}/protocol/${randomUUID()}`, { turn: 1, kind: 'event', payload: { text: 'Mine now' } })).json()).toEqual({ error: 'forbidden' });
    for (const bad of [
      { kind: 'event', payload: { text: '' } },
      { kind: 'event', payload: { text: 'x', more: 1 } },
      { kind: 'casualty', payload: casualty({ warbandId: randomUUID(), name: 'Nobody here' }, null) },
      { kind: 'casualty', payload: { victim: { name: 'Tik' } } },
    ]) expect((await anna('PUT', `${url}/protocol/${randomUUID()}`, { turn: 1, ...bad })).statusCode).toBe(400);
    // the surroundings, or someone outside the rosters, may take a warrior out
    expect((await anna('PUT', `${url}/protocol/${randomUUID()}`, { turn: 1, kind: 'casualty', payload: casualty({ warbandId: caravan, uid: 1, name: 'Ulrich' }, { name: 'The surroundings', env: true }) })).statusCode).toBe(200);
    expect((await anna('PUT', `${url}/protocol/not-an-id`, { turn: 1, kind: 'event', payload: { text: 'x' } })).statusCode).toBe(400);
  });
});

describe('corrections', () => {
  it('a player proposes, the leader accepts – the entry reads as proposed – or rejects', async () => {
    const { anna, kai, ben, caravan, skrittle, url } = await battle();
    const a = randomUUID();
    await anna('PUT', `${url}/protocol/${a}`, { turn: 4, kind: 'casualty', payload: casualty({ warbandId: caravan, uid: 2, name: 'Magda' }, { warbandId: skrittle, name: 'Skritch' }) });
    const p = randomUUID();
    const change = { turn: 3, kind: 'casualty', payload: casualty({ warbandId: caravan, uid: 2, name: 'Magda' }, { warbandId: skrittle, name: 'Tik' }) };
    expect((await kai('PUT', `${url}/proposals/${p}`, { entryId: a, text: 'It was Tik, in turn 3.', change })).json()).toMatchObject({ ok: true });
    // sent twice, reworded while open
    await kai('PUT', `${url}/proposals/${p}`, { entryId: a, text: 'It was Tik, in turn 3 – I am sure.', change });
    let v = (await ben('GET', url)).json() as View;
    expect(v.proposals).toMatchObject([{ id: p, targetId: a, status: 'open', author: 'kai', payload: { text: 'It was Tik, in turn 3 – I am sure.' } }]);
    // someone else's proposal is not theirs to reword
    expect((await ben('PUT', `${url}/proposals/${p}`, { text: 'Mine' })).statusCode).toBe(409);
    expect((await kai('POST', `${url}/proposals/${p}/accept`)).statusCode).toBe(403);
    v = (await anna('POST', `${url}/proposals/${p}/accept`)).json() as View;
    expect(v.entries).toMatchObject([{ id: a, turn: 3, payload: { attacker: { name: 'Tik' } } }]);
    expect(v.proposals).toMatchObject([{ status: 'accepted' }]);
    expect((await anna('POST', `${url}/proposals/${p}/reject`)).json()).toEqual({ error: 'decided' });
    expect((await kai('PUT', `${url}/proposals/${p}`, { text: 'again' })).json()).toEqual({ error: 'decided' });

    const q = randomUUID();
    await ben('PUT', `${url}/proposals/${q}`, { text: 'Skrittle did not rout, we held.' });
    expect(((await anna('POST', `${url}/proposals/${q}/reject`)).json() as View).proposals.map((x) => x.status)).toEqual(['accepted', 'rejected']);
  });

  it('a viewer only reads; a change must be one for an entry, and a valid one', async () => {
    const { anna, kai, vic, caravan, url } = await battle();
    const a = randomUUID();
    await anna('PUT', `${url}/protocol/${a}`, { turn: 1, kind: 'event', payload: { text: 'Rain.' } });
    expect((await vic('GET', url)).statusCode).toBe(200);
    expect((await vic('PUT', `${url}/proposals/${randomUUID()}`, { text: 'Snow.' })).json()).toEqual({ error: 'forbidden' });
    expect((await kai('PUT', `${url}/proposals/${randomUUID()}`, { text: 'Snow.', change: { kind: 'event', payload: { text: 'Snow.' } } })).statusCode).toBe(400);
    expect((await kai('PUT', `${url}/proposals/${randomUUID()}`, { entryId: a, text: 'x', change: { kind: 'casualty', payload: casualty({ warbandId: randomUUID(), name: 'x' }, null) } })).statusCode).toBe(400);
    expect((await kai('PUT', `${url}/proposals/${randomUUID()}`, { entryId: randomUUID(), text: 'x' })).json()).toMatchObject({ error: 'invalid' });
    expect((await kai('PUT', `${url}/proposals/${randomUUID()}`, { entryId: a, text: 'Snow.', change: { kind: 'event', payload: { text: 'Snow.' } } })).statusCode).toBe(200);
    expect(caravan).toBeTruthy();
  });
});

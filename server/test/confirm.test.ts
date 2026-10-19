/* The version that goes into a battle is confirmed before it is fought:
   by its player, or for them by a leader; totals are frozen with it; the
   mark after the battle may not be older. Nothing here blocks a battle. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ctxOf, loadSave, stageTotals } from '@mordheim/core';
import { loadGameData } from '@mordheim/core/node';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown> & { models: Record<string, unknown>[] };
const rules = loadGameData();
const totals = (save: unknown) => { const r = loadSave(rules, save); if (!r.ok) throw new Error(r.msg); return stageTotals(ctxOf(rules, r.state)); };
/** The warband with more experience on its first hero: a version that rates higher. */
const stronger = (exp: number) => { const s = structuredClone(SAVE); s.models[0]!.exp = Number(s.models[0]!.exp) + exp; return s; };

async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), ben: await s.user('ben'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), ben = as(u.ben), vic = as(u.vic);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  for (const [x, role] of [[u.kai, 'player'], [u.ben, 'player'], [u.vic, 'player']] as const) await anna('PUT', `/campaigns/${id}/members/${x.id}`, { role });
  const enter = async (who: typeof kai, name: string) => {
    const w = randomUUID();
    const e = (await who('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: { ...SAVE, name } })).json() as { enrolmentId: string };
    await anna('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
    return w;
  };
  const caravan = await enter(kai, 'The Silver Caravan');
  const skrittle = await enter(ben, 'Clan Skrittle');
  const resting = await enter(vic, 'The Resting Band');
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [caravan, skrittle] });
  return { s, id, bid, caravan, skrittle, resting, anna, kai, ben, vic, url: `/campaigns/${id}/battles/${bid}` };
}

interface P { warbandId: string; revBefore: number | null; confirmedAt: string | null; confirmedBy: string | null; beforeTotals: unknown; headRev: number }
const parts = (v: unknown) => (v as { participants: P[] }).participants;
const of = (v: unknown, w: string) => parts(v).find((p) => p.warbandId === w)!;

describe('confirming the version for a battle', () => {
  it('until then a warband shows the head of the day the battle was set up, unconfirmed', async () => {
    const { url, caravan, anna } = await world();
    const v = (await anna('GET', url)).json();
    expect(of(v, caravan)).toMatchObject({ revBefore: 1, confirmedAt: null, confirmedBy: null, beforeTotals: null, headRev: 1 });
  });

  it('its player confirms a version; rating, gold and models are frozen with it', async () => {
    const { url, caravan, kai, anna } = await world();
    const saved = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: stronger(3) })).json() as { rev: number };
    const r = await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: saved.rev });
    expect(r.statusCode).toBe(200);
    expect(of(r.json(), caravan)).toMatchObject({ revBefore: saved.rev, confirmedAt: expect.any(String), confirmedBy: expect.any(String), beforeTotals: totals(stronger(3)), headRev: saved.rev });
    // saving on afterwards changes the head, never what was frozen
    const later = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: saved.rev, data: stronger(9) })).json() as { rev: number };
    const v = (await anna('GET', url)).json();
    expect(of(v, caravan)).toMatchObject({ revBefore: saved.rev, beforeTotals: totals(stronger(3)), headRev: later.rev });
  });

  it('the other warband is still not confirmed; the battle list says who is', async () => {
    const { id, url, caravan, skrittle, kai, anna } = await world();
    await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: 1 });
    const v = (await anna('GET', url)).json();
    expect(of(v, skrittle).confirmedAt).toBeNull();
    const list = (await anna('GET', `/campaigns/${id}/battles`)).json() as { battles: { confirmed: string[]; warbandIds: string[] }[] };
    expect(list.battles[0]).toMatchObject({ confirmed: [caravan] });
  });

  it('only its player confirms it – or a leader for them; nobody else', async () => {
    const { url, caravan, skrittle, kai, ben, anna } = await world();
    expect((await ben('POST', `${url}/confirm`, { warbandId: caravan, rev: 1 })).json()).toEqual({ error: 'forbidden' });
    expect((await kai('POST', `${url}/confirm`, { warbandId: skrittle, rev: 1 })).json()).toEqual({ error: 'forbidden' });
    const r = (await anna('POST', `${url}/confirm`, { warbandId: skrittle, rev: 1 })).json();
    expect(of(r, skrittle)).toMatchObject({ revBefore: 1, confirmedAt: expect.any(String) });
  });

  it('a warband that does not fight, a version that does not exist: turned away', async () => {
    const { url, caravan, resting, vic, kai } = await world();
    expect((await vic('POST', `${url}/confirm`, { warbandId: resting, rev: 1 })).json()).toMatchObject({ error: 'invalid' });
    expect((await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: 7 })).json()).toMatchObject({ error: 'not_found' });
  });

  it('confirmed again, the newer version stands and both confirmations are in the log', async () => {
    const { s, url, caravan, kai } = await world();
    const saved = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: stronger(3) })).json() as { rev: number };
    await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: 1 });
    const r = (await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: saved.rev })).json();
    expect(of(r, caravan)).toMatchObject({ revBefore: saved.rev, beforeTotals: totals(stronger(3)) });
    const log = s.db.prepare("SELECT payload FROM audit_log WHERE action = 'battle.confirm' ORDER BY seq").all() as { payload: string }[];
    expect(log.map((l) => (JSON.parse(l.payload) as { rev: number }).rev)).toEqual([1, saved.rev]);
  });

  it('a device that saw the battle learns of it: the confirmation moves its seq', async () => {
    const { url, caravan, kai, anna } = await world();
    const { seq } = (await anna('GET', url)).json() as { seq: number };
    expect((await anna('GET', `${url}?since=${seq}`)).json()).toEqual({ unchanged: true, seq });
    await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: 1 });
    expect((await anna('GET', `${url}?since=${seq}`)).json()).toMatchObject({ participants: expect.any(Array) });
  });

  it('a closed battle is no longer confirmed: it was fought', async () => {
    const { url, caravan, kai, anna } = await world();
    await anna('POST', `${url}/close`);
    expect((await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: 1 })).json()).toMatchObject({ error: 'closed' });
  });
});

describe('the mark after the battle, with the confirmation before it', () => {
  it('may not be older than the version confirmed for the battle', async () => {
    const { url, caravan, kai, anna } = await world();
    const two = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: stronger(3) })).json() as { rev: number };
    await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: two.rev });
    await anna('POST', `${url}/close`);
    const r = await kai('POST', `${url}/marks`, { warbandId: caravan, rev: 1 });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ error: 'older' });
    expect((await kai('POST', `${url}/marks`, { warbandId: caravan, rev: two.rev })).statusCode).toBe(200);
  });

  it('without a confirmation any version still marks (nothing blocks the battle)', async () => {
    const { url, caravan, kai, anna } = await world();
    await anna('POST', `${url}/close`);
    expect((await kai('POST', `${url}/marks`, { warbandId: caravan, rev: 1 })).statusCode).toBe(200);
  });

  it('the view after the battle holds both frozen sides: what went in and what came out', async () => {
    const { url, caravan, kai, anna } = await world();
    const two = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: stronger(3) })).json() as { rev: number };
    await kai('POST', `${url}/confirm`, { warbandId: caravan, rev: two.rev });
    await anna('POST', `${url}/close`);
    const three = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: two.rev, data: stronger(5) })).json() as { rev: number };
    await kai('POST', `${url}/marks`, { warbandId: caravan, rev: three.rev });
    const v = (await anna('GET', url)).json() as { marks: Record<string, { rev: number; totals: unknown }> };
    expect(of(v, caravan).beforeTotals).toEqual(totals(stronger(3)));
    expect(v.marks[caravan]).toMatchObject({ rev: three.rev, totals: totals(stronger(5)) });
  });
});

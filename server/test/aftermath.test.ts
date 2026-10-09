/* After a battle (phase 4a4; ADR 0003, ADR 0016): a leader closes it –
   the protocol is fixed, sealed notes open, the database is snapshotted;
   each player marks their warband "after battle N" – totals and changes
   frozen as core computes them from the versions; then a leader moves the
   campaign on, and who fought no battle sat the round out. */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ctxOf, loadSave, stageTotals } from '@mordheim/core';
import { loadGameData } from '@mordheim/core/node';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown> & { models: Record<string, unknown>[]; campaign: Record<string, unknown> };
const rules = loadGameData();
const totals = (save: unknown) => { const r = loadSave(rules, save); if (!r.ok) throw new Error(r.msg); return stageTotals(ctxOf(rules, r.state)); };

/** The warband after the battle, as the app leaves it: the battle taken over (its server id), Ulrich with more experience and a new WS. */
function afterBattle(battleId: string) {
  const s = structuredClone(SAVE);
  const u = s.models[0]!;
  u.exp = Number(u.exp) + 3;
  u.adv = { ...(u.adv as object), WS: 2 };
  s.campaign = { ...s.campaign, on: true, round: 1, battles: [{ id: 900, round: 1, serverId: battleId, sides: [], opponents: [], district: '', outcome: 'Victory', notes: '' }], casualties: [], log: [] };
  return s;
}

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
  return { s, u, id, bid, caravan, skrittle, resting, anna, kai, ben, vic, url: `/campaigns/${id}/battles/${bid}` };
}

describe('closing a battle', () => {
  it('a leader closes it: the protocol is fixed, the notes sealed for it open, a snapshot is taken', async () => {
    const { s, id, bid, url, anna, kai, ben } = await world();
    const sealed = randomUUID();
    await kai('PUT', `/campaigns/${id}/notes/${sealed}`, { battleId: bid, text: 'Skritch goes for the captain.', visibility: 'sealed' });
    const { seq } = (await ben('GET', `/campaigns/${id}/notes`)).json() as { seq: number };
    expect((await kai('POST', `${url}/close`)).json()).toEqual({ error: 'forbidden' });
    const v = (await anna('POST', `${url}/close`)).json() as { battle: { status: string; closedAt: string } };
    expect(v.battle).toMatchObject({ status: 'closed', closedAt: expect.any(String) });
    // the protocol is fixed
    expect((await anna('PUT', `${url}/protocol/${randomUUID()}`, { turn: 1, kind: 'event', payload: { text: 'late' } })).json()).toEqual({ error: 'closed' });
    // a device that saw the notes before learns that one opened
    expect((await ben('GET', `/campaigns/${id}/notes?since=${seq}`)).json()).toMatchObject({ notes: [{ id: sealed, text: 'Skritch goes for the captain.', opened: true }] });
    expect(readdirSync(join(s.data, 'snapshots')).filter((f) => f.includes('battle-1'))).toHaveLength(1);
    // closing twice changes nothing
    expect((await anna('POST', `${url}/close`)).statusCode).toBe(200);
  });
});

describe('marking a warband after the battle', () => {
  it('its player marks a version once the battle is closed; totals and changes are frozen as core computes them', async () => {
    const { id, bid, url, caravan, skrittle, anna, kai } = await world();
    const after = afterBattle(bid);
    const saved = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: after })).json() as { rev: number };
    expect((await kai('POST', `${url}/marks`, { warbandId: caravan, rev: saved.rev })).json()).toMatchObject({ error: 'open' });
    await anna('POST', `${url}/close`);
    // only its player marks it
    expect((await kai('POST', `${url}/marks`, { warbandId: skrittle, rev: 1 })).json()).toEqual({ error: 'forbidden' });
    const m = (await kai('POST', `${url}/marks`, { warbandId: caravan, rev: saved.rev })).json() as { tag: { kind: string; rev: number; round: number; totals: unknown }; changes: { kind: string; name: string; payload: Record<string, unknown>; unexplained: boolean }[] };
    expect(m.tag).toMatchObject({ kind: 'after_battle', rev: saved.rev, round: 1, totals: totals(after) });
    expect(m.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'experience', name: 'Ulrich the Grey', payload: expect.objectContaining({ gained: 3 }) }),
      // a stat rising without an advance roll in the log: marked for everyone, blocking nothing
      expect.objectContaining({ kind: 'stat', name: 'Ulrich the Grey', unexplained: true }),
    ]));
    const v = (await anna('GET', url)).json() as { marks: Record<string, { rev: number; changes: number; unexplained: number }>; participants: { warbandId: string }[] };
    expect(v.marks[caravan]).toMatchObject({ rev: saved.rev, changes: m.changes.length, unexplained: m.changes.filter((c) => c.unexplained).length });
    expect((await anna('GET', `/campaigns/${id}`)).json()).toMatchObject({ enrolments: [{ warbandId: caravan, tag: { kind: 'after_battle', round: 1 } }, { warbandId: skrittle, tag: { kind: 'start' } }, {}] });
    // everyone reads what changed, frozen with the mark
    const read = (await anna('GET', `/campaigns/${id}/warbands/${caravan}`)).json() as { tags: { kind: string; changes: unknown[] }[] };
    expect(read.tags.map((t) => [t.kind, t.changes.length])).toEqual([['start', 0], ['after_battle', m.changes.length]]);
  });

  it('marked again, the newer mark corrects the earlier, which stays', async () => {
    const { s, bid, url, caravan, anna, kai } = await world();
    await anna('POST', `${url}/close`);
    const one = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: 1, data: afterBattle(bid) })).json() as { rev: number };
    await kai('POST', `${url}/marks`, { warbandId: caravan, rev: one.rev });
    const fixed = afterBattle(bid);
    fixed.models[0]!.adv = SAVE.models[0]!.adv;
    const two = (await kai('POST', `/warbands/${caravan}/versions`, { baseRev: one.rev, data: fixed })).json() as { rev: number };
    const m = (await kai('POST', `${url}/marks`, { warbandId: caravan, rev: two.rev })).json() as { changes: { kind: string }[] };
    expect(m.changes.map((c) => c.kind)).not.toContain('stat');
    expect(s.db.prepare("SELECT rev, superseded_by IS NOT NULL AS old FROM tags WHERE warband_id = ? AND kind = 'after_battle' ORDER BY created_at").all(caravan)).toEqual([{ rev: one.rev, old: 1 }, { rev: two.rev, old: 0 }]);
  });
});

describe('the next round', () => {
  it('once the round’s battles are closed; who fought none sat it out', async () => {
    const { id, url, resting, anna, kai } = await world();
    expect((await anna('POST', `/campaigns/${id}/rounds/advance`)).json()).toMatchObject({ error: 'open' });
    await anna('POST', `${url}/close`);
    expect((await kai('POST', `/campaigns/${id}/rounds/advance`)).statusCode).toBe(403);
    const v = (await anna('POST', `/campaigns/${id}/rounds/advance`)).json() as { campaign: { round: number }; enrolments: { warbandId: string; tag: { kind: string; round: number } }[] };
    expect(v.campaign.round).toBe(1);
    expect(v.enrolments.find((e) => e.warbandId === resting)!.tag).toMatchObject({ kind: 'sat_out', round: 1 });
    expect((await anna('POST', `/campaigns/${id}/rounds/advance`)).json()).toMatchObject({ error: 'no_battle' });
  });
});

/* Taking over a running campaign (phase 4a5; roadmap 4a5, Decision E): a
   leader records the battles played before the app – who fought them and
   how they ended – while the campaign has none of its own. They are closed
   from the start, never marked; the campaign stands after the last of them,
   and the warbands' start marks move there, on the same version with the
   same frozen totals. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

interface View {
  campaign: { round: number };
  enrolments: { warbandId: string; tag: { id: string; kind: string; round: number; rev: number; totals: unknown } | null }[];
  battles: { id: string; round: number; title: string; status: string; warbandIds: string[]; takenOver: boolean; playedAt: string | null; marked: string[] }[];
}

/** Anna leads (authenticator), Kai and Ben play, Vic watches; Kai's and Ben's warbands are entered and confirmed at the founding. */
async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), ben: await s.user('ben'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), ben = as(u.ben), vic = as(u.vic);
  const id = ((await anna('POST', '/campaigns', { name: 'The Lustria Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const enter = async (who: typeof kai, name: string, confirm = true) => {
    const w = randomUUID();
    const e = (await who('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: { ...SAVE, name } })).json() as { enrolmentId: string };
    if (confirm) await anna('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
    return { w, e: e.enrolmentId };
  };
  const caravan = (await enter(kai, 'Die Silberne Karavane')).w;
  const reavers = (await enter(ben, "Rangvald's Reavers")).w;
  const past = (who: typeof kai, bid: string, body: Record<string, unknown>) => who('PUT', `/campaigns/${id}/history/${bid}`, body);
  const view = async (who: typeof kai = vic) => (await who('GET', `/campaigns/${id}`)).json() as View;
  return { s, u, id, caravan, reavers, anna, kai, ben, vic, enter, past, view };
}

describe('the history of a running campaign', () => {
  it('a leader records the battles before the app: closed, with who fought and how it ended; the campaign stands after the last', async () => {
    const { s, id, caravan, reavers, anna, kai, vic, past, view } = await world();
    const one = randomUUID(), two = randomUUID();
    expect((await past(kai, one, { round: 1, outcomes: { [caravan]: 'victory' } })).json()).toEqual({ error: 'forbidden' });
    expect((await past(vic, one, { round: 1, outcomes: { [caravan]: 'victory' } })).statusCode).toBe(403);
    const r = await past(anna, one, { round: 1, title: '  Das Urteil   im Nebel ', district: 'quayside', playedOn: '2026-06-12', outcomes: { [reavers]: 'victory', [caravan]: 'routed' } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as View).campaign.round).toBe(1);
    await past(anna, two, { round: 2, title: 'Die verbrannten Seiten', outcomes: { [reavers]: 'draw', [caravan]: 'draw' } });
    const v = await view();
    expect(v.campaign.round).toBe(2);
    expect(v.battles).toEqual([
      expect.objectContaining({ id: one, round: 1, title: 'Das Urteil im Nebel', status: 'closed', takenOver: true, playedAt: '2026-06-12', marked: [] }),
      expect.objectContaining({ id: two, round: 2, status: 'closed', takenOver: true, playedAt: null }),
    ]);
    const b = (await vic('GET', `/campaigns/${id}/battles/${one}`)).json() as { battle: { district: string; takenOver: boolean }; participants: { warbandId: string; outcome: string; revBefore: number | null }[]; entries: unknown[] };
    expect(b.battle).toMatchObject({ district: 'quayside', takenOver: true });
    expect(b.entries).toEqual([]);
    expect(Object.fromEntries(b.participants.map((p) => [p.warbandId, [p.outcome, p.revBefore]]))).toEqual({ [reavers]: ['victory', null], [caravan]: ['routed', null] });
    expect(s.db.prepare("SELECT action FROM audit_log WHERE campaign_id = ? AND action LIKE 'battle.history%' ORDER BY seq").all(id)).toEqual([{ action: 'battle.history' }, { action: 'battle.history' }]);
  });

  it('the start marks move after the history – the same version, the same frozen totals; a warband confirmed later starts there too', async () => {
    const { s, caravan, anna, ben, enter, past, view } = await world();
    const before = (await view()).enrolments.find((e) => e.warbandId === caravan)!.tag!;
    expect(before).toMatchObject({ kind: 'start', round: 0, rev: 1 });
    await past(anna, randomUUID(), { round: 1, outcomes: { [caravan]: 'defeat' } });
    await past(anna, randomUUID(), { round: 3, outcomes: { [caravan]: 'victory' } });
    const after = (await view()).enrolments.find((e) => e.warbandId === caravan)!.tag!;
    expect(after).toMatchObject({ kind: 'start', round: 3, rev: 1, totals: before.totals });
    expect(after.id).not.toBe(before.id);
    // the first is kept, superseded – never changed
    expect(s.db.prepare('SELECT round, superseded_by FROM tags WHERE id = ?').get(before.id)).toMatchObject({ round: 0, superseded_by: expect.any(String) });
    const late = await enter(ben, 'Kinder des Sotek');
    expect((await view()).enrolments.find((e) => e.warbandId === late.w)!.tag).toMatchObject({ kind: 'start', round: 3 });
  });

  it('a battle of the history is corrected under its id, or taken out while nothing refers to it; the round follows', async () => {
    const { id, caravan, reavers, anna, kai, past, view } = await world();
    const one = randomUUID(), two = randomUUID();
    await past(anna, one, { round: 1, outcomes: { [caravan]: 'victory', [reavers]: 'defeat' } });
    await past(anna, two, { round: 2, outcomes: { [caravan]: 'victory' } });
    await past(anna, one, { round: 1, title: 'Quayside', outcomes: { [reavers]: 'victory' } });
    expect((await view()).battles.find((b) => b.id === one)).toMatchObject({ title: 'Quayside', warbandIds: [reavers] });
    expect((await anna('DELETE', `/campaigns/${id}/history/${two}`)).statusCode).toBe(200);
    expect((await view()).campaign.round).toBe(1);
    await kai('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: one, text: 'Fog over the Stir.' });
    expect((await anna('DELETE', `/campaigns/${id}/history/${one}`)).json()).toMatchObject({ error: 'in_use' });
    expect((await kai('DELETE', `/campaigns/${id}/history/${one}`)).statusCode).toBe(403);
    expect((await anna('DELETE', `/campaigns/${id}/history/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('once the campaign plays a battle of its own, its history is closed; the new battle comes after it', async () => {
    const { id, caravan, reavers, anna, past } = await world();
    const one = randomUUID();
    await past(anna, one, { round: 1, outcomes: { [caravan]: 'victory', [reavers]: 'defeat' } });
    expect((await anna('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 1, warbandIds: [caravan] })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/before the app/) });
    const own = randomUUID();
    expect((await anna('POST', `/campaigns/${id}/battles`, { id: own, warbandIds: [caravan, reavers] })).json()).toMatchObject({ battle: { round: 2, takenOver: false } });
    expect((await past(anna, randomUUID(), { round: 1, outcomes: { [caravan]: 'draw' } })).json()).toMatchObject({ error: 'history_closed' });
    expect((await past(anna, one, { round: 1, outcomes: { [caravan]: 'draw' } })).statusCode).toBe(409);
    expect((await anna('DELETE', `/campaigns/${id}/history/${one}`)).json()).toMatchObject({ error: 'history_closed' });
    expect((await anna('DELETE', `/campaigns/${id}/history/${own}`)).json()).toMatchObject({ error: 'not_history' });
  });

  it('a battle of the history has no protocol, no corrections and no marks', async () => {
    const { id, caravan, anna, kai, past } = await world();
    const one = randomUUID();
    await past(anna, one, { round: 1, outcomes: { [caravan]: 'victory' } });
    const url = `/campaigns/${id}/battles/${one}`;
    expect((await anna('PUT', `${url}/protocol/${randomUUID()}`, { turn: 1, kind: 'event', payload: { text: 'Rain.' } })).json()).toEqual({ error: 'closed' });
    expect((await anna('PATCH' as 'PUT', url, { title: 'Elsewhere' })).json()).toEqual({ error: 'closed' });
    expect((await kai('POST', `${url}/marks`, { warbandId: caravan, rev: 1 })).json()).toMatchObject({ error: 'history' });
  });

  it('refuses what is not a battle of the history', async () => {
    const { s, id, caravan, anna, kai, enter, past } = await world();
    const pending = await enter(kai, 'Waiting', false);
    for (const body of [
      { round: 0, outcomes: { [caravan]: 'victory' } },
      { round: 1, outcomes: {} },
      { round: 1, outcomes: { [caravan]: 'won' } },
      { round: 1, outcomes: { [pending.w]: 'victory' } },
      { round: 1, outcomes: { [randomUUID()]: 'victory' } },
      { round: 1, district: 'atlantis', outcomes: { [caravan]: 'victory' } },
      { round: 1, playedOn: 'last week', outcomes: { [caravan]: 'victory' } },
      { round: 1, scenario: 'x', outcomes: { [caravan]: 'victory' } },
    ]) expect((await past(anna, randomUUID(), body)).statusCode, JSON.stringify(body)).toBe(400);
    // a battle id of another campaign
    const other = ((await anna('POST', '/campaigns', { name: 'Elsewhere' })).json() as { campaign: { id: string } }).campaign.id;
    const w = randomUUID();
    await anna('POST', `/campaigns/${other}/enrolments`, { warbandId: w, data: SAVE });
    const theirs = randomUUID();
    expect((await anna('PUT', `/campaigns/${other}/history/${theirs}`, { round: 1, outcomes: { [w]: 'victory' } })).statusCode).toBe(200);
    expect((await past(anna, theirs, { round: 1, outcomes: { [caravan]: 'victory' } })).json()).toEqual({ error: 'exists' });
    expect(s.db.prepare('SELECT count(*) AS n FROM battles WHERE campaign_id = ?').get(id)).toEqual({ n: 0 });
  });
});

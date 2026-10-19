/* A battle's number is the leader's choice (default: the next). A campaign
   that comes into the app at battle 4 starts with battle 4: its round moves
   up to 3 so that "move on" still means the battle just played. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

async function world() {
  const s = await startAccounts();
  const anna = await s.user('anna', { totp: true });
  const kai = await s.user('kai');
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const lead = as(anna), kaiCall = as(kai);
  const id = ((await lead('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await lead('PUT', `/campaigns/${id}/members/${kai.id}`, { role: 'player' });
  const w = randomUUID();
  const e = (await kaiCall('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: { ...SAVE, name: 'The Silver Caravan' } })).json() as { enrolmentId: string };
  await lead('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
  const round = async () => ((await lead('GET', `/campaigns/${id}`)).json() as { campaign: { round: number } }).campaign.round;
  return { id, lead, w, round };
}

describe('the number of a battle', () => {
  it('defaults to the next one and leaves the round where it is', async () => {
    const { id, lead, w, round } = await world();
    const r = await lead('POST', `/campaigns/${id}/battles`, { id: randomUUID(), warbandIds: [w] });
    expect(r.statusCode).toBe(201);
    expect((r.json() as { battle: { round: number } }).battle.round).toBe(1);
    expect(await round()).toBe(0);
  });

  it('can be chosen: the campaign comes to it, and moving on after it works', async () => {
    const { id, lead, w, round } = await world();
    const bid = randomUUID();
    const r = await lead('POST', `/campaigns/${id}/battles`, { id: bid, round: 4, warbandIds: [w] });
    expect(r.statusCode).toBe(201);
    expect((r.json() as { battle: { round: number } }).battle.round).toBe(4);
    expect(await round()).toBe(3);
    expect((await lead('POST', `/campaigns/${id}/battles/${bid}/close`)).statusCode).toBe(200);
    const moved = await lead('POST', `/campaigns/${id}/rounds/advance`);
    expect(moved.statusCode).toBe(200);
    expect(await round()).toBe(4);
  });

  it('a second battle of the same number does not move the round again; an earlier number never moves it back', async () => {
    const { id, lead, w, round } = await world();
    await lead('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 4, warbandIds: [w] });
    await lead('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 4, warbandIds: [w] });
    expect(await round()).toBe(3);
    expect((await lead('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 2, warbandIds: [w] })).statusCode).toBe(201);
    expect(await round()).toBe(3);
  });
});

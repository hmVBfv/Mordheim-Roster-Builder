/* Wish #167 (Rob, 30.10.2026), step 2: a campaign can play Vanilla Mordheim – only the rulebook. It is chosen when the campaign starts
   (off unless asked for), only the warbands of the rulebook enter it, a running campaign cannot be turned to Vanilla, and a leader can
   turn Vanilla off for good. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type View = { campaign: { id: string; vanilla: boolean }; role: string };

async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  return { s, u, anna: as(u.anna), kai: as(u.kai) };
}

describe('a campaign that plays Vanilla Mordheim', () => {
  it('is off unless the leader asks for it at the start', async () => {
    const { anna } = await world();
    const plain = (await anna('POST', '/campaigns', { name: 'The Plain Fenn' })).json() as View;
    expect(plain.campaign.vanilla).toBe(false);
    const made = await anna('POST', '/campaigns', { name: 'The Vanilla Fenn', vanilla: true });
    expect(made.statusCode).toBe(201);
    expect((made.json() as View).campaign.vanilla).toBe(true);
    expect(((await anna('GET', `/campaigns/${(made.json() as View).campaign.id}`)).json() as View).campaign.vanilla).toBe(true);
  });

  it('takes the warbands of the rulebook and turns the others away, with the reason', async () => {
    const { anna, kai, u } = await world();
    const id = ((await anna('POST', '/campaigns', { name: 'The Vanilla Fenn', vanilla: true })).json() as View).campaign.id;
    await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
    // the Mercenaries are a warband of the rulebook
    const ok = await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: SAVE, appVersion: 'test' });
    expect(ok.statusCode).toBe(201);
    // the Merchant Caravans are not
    const no = await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: { ...SAVE, wb: 'caravans' }, appVersion: 'test' });
    expect(no.statusCode).toBe(400);
    expect((no.json() as { problem: string }).problem).toMatch(/Vanilla Mordheim.*rulebook/);
    // and a campaign that is not Vanilla takes it
    const plain = ((await anna('POST', '/campaigns', { name: 'The Plain Fenn' })).json() as View).campaign.id;
    await anna('PUT', `/campaigns/${plain}/members/${u.kai.id}`, { role: 'player' });
    expect((await kai('POST', `/campaigns/${plain}/enrolments`, { warbandId: randomUUID(), data: { ...SAVE, wb: 'caravans' }, appVersion: 'test' })).statusCode).toBe(201);
  });

  it('cannot be switched on for a campaign that runs, but a leader can switch it off – for good', async () => {
    const { anna, kai, u } = await world();
    const plain = ((await anna('POST', '/campaigns', { name: 'The Plain Fenn' })).json() as View).campaign.id;
    const on = await anna('PUT', `/campaigns/${plain}/vanilla`, { vanilla: true });
    expect(on.statusCode).toBe(409);
    expect((on.json() as { problem: string }).problem).toMatch(/cannot be turned to Vanilla/);
    expect(((await anna('GET', `/campaigns/${plain}`)).json() as View).campaign.vanilla).toBe(false);
    const id = ((await anna('POST', '/campaigns', { name: 'The Vanilla Fenn', vanilla: true })).json() as View).campaign.id;
    await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
    // a player cannot, a leader can
    expect((await kai('PUT', `/campaigns/${id}/vanilla`, { vanilla: false })).statusCode).toBe(403);
    const off = await anna('PUT', `/campaigns/${id}/vanilla`, { vanilla: false });
    expect(off.statusCode).toBe(200);
    expect((off.json() as View).campaign.vanilla).toBe(false);
    // and it stays off
    expect((await anna('PUT', `/campaigns/${id}/vanilla`, { vanilla: true })).statusCode).toBe(409);
    expect((await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: { ...SAVE, wb: 'caravans' }, appVersion: 'test' })).statusCode).toBe(201);
  });
});

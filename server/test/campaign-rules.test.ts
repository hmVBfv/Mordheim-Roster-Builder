/* A campaign's house rules and what its overview shows of each warband
   (phase 4a4; concept.md 4.4): a leader sets the rules for every warband;
   every member sees whose own rules differ and which districts it holds –
   read from its newest version, the mechanics open to all (ADR 0002). */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown> & { campaign: Record<string, unknown> };

async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), vic = as(u.vic);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  return { s, id, anna, kai, vic };
}

type View = { campaign: { houseRules: Record<string, unknown> }; enrolments: { warbandId: string; houseDiffers: string[]; districts: { id: string; name: string; hold: string }[] }[] };

describe('the campaign’s house rules', () => {
  it('a leader sets them for every warband; players and viewers read them; nonsense is refused', async () => {
    const { s, id, anna, kai, vic } = await world();
    const v = (await anna('PUT', `/campaigns/${id}/house-rules`, { rules: { freeDagger: true, priceArmour: 80, showRarity: true, notes: 'Daggers are on the house.' } })).json() as View;
    expect(v.campaign.houseRules).toMatchObject({ freeDagger: true, priceArmour: 80, showRarity: false, notes: 'Daggers are on the house.', priceAll: 100 });
    for (const who of [kai, vic]) expect(((await who('GET', `/campaigns/${id}`)).json() as View).campaign.houseRules).toMatchObject({ freeDagger: true });
    expect((await kai('PUT', `/campaigns/${id}/house-rules`, { rules: {} })).statusCode).toBe(403);
    for (const rules of [{ priceAll: 300 }, { flying: true }, { hsGrades: { '3z': false } }, { notes: 'x'.repeat(2001) }]) {
      expect((await anna('PUT', `/campaigns/${id}/house-rules`, { rules })).statusCode).toBe(400);
    }
    // logged with what changed; setting the same again logs nothing
    await anna('PUT', `/campaigns/${id}/house-rules`, { rules: { freeDagger: true, priceArmour: 80, notes: 'Daggers are on the house.' } });
    expect(s.db.prepare("SELECT payload FROM audit_log WHERE action = 'campaign.house_rules'").all()).toEqual([{ payload: JSON.stringify({ changed: ['priceArmour', 'freeDagger'], notes: true }) }]);
  });

  it('every member sees whose rules differ and which districts a warband holds, from its newest version', async () => {
    const { id, anna, kai, vic } = await world();
    await anna('PUT', `/campaigns/${id}/house-rules`, { rules: { freeDagger: true } });
    const own = randomUUID(), other = randomUUID();
    const e1 = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: own, data: { ...SAVE, name: 'As written' } })).json() as { enrolmentId: string };
    const e2 = (await kai('POST', `/campaigns/${id}/enrolments`, {
      warbandId: other, data: { ...SAVE, name: 'Held to the campaign', house: { freeDagger: true, showRarity: true }, campaign: { ...SAVE.campaign, districts: { artisanquarter: 'foothold', richquarter: 'none' } } },
    })).json() as { enrolmentId: string };
    for (const e of [e1, e2]) await anna('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
    const v = (await vic('GET', `/campaigns/${id}`)).json() as View;
    expect(v.enrolments.map((e) => [e.houseDiffers, e.districts.map((d) => [d.id, d.hold])])).toEqual([
      [['freeDagger'], []],
      [[], [['artisanquarter', 'foothold']]],
    ]);
    expect(v.enrolments[1]!.districts[0]!.name).toMatch(/Artisan/);
    // the player takes the campaign's rules into a new version: no longer marked
    await kai('POST', `/warbands/${own}/versions`, { baseRev: 1, data: { ...SAVE, name: 'As written', house: { freeDagger: true } } });
    expect(((await anna('GET', `/campaigns/${id}`)).json() as View).enrolments[0]!.houseDiffers).toEqual([]);
  });
});

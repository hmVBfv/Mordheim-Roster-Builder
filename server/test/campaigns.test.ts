/* Campaigns (phase 4a, step 1): starting one, its members and roles,
   entering a warband (always a copy, confirmed by a leader, its start
   marked with frozen totals), and what members may read – the mechanics of
   every warband entered (ADR 0002), nothing of a campaign one is not in. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ctxOf, loadSave, stageTotals } from '@mordheim/core';
import { loadGameData } from '@mordheim/core/node';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const rules = loadGameData();
const totals = (save: unknown) => {
  const r = loadSave(rules, save);
  if (!r.ok) throw new Error(r.msg);
  return stageTotals(ctxOf(rules, r.state));
};

interface View { campaign: { id: string; name: string; round: number }; role: string; members: { userId: string; role: string; displayName: string; canLead?: boolean }[]; enrolments: { id: string; warbandId: string; player: string; status: string; tag: { kind: string; rev: number; round: number; totals: unknown } | null }[] }

async function world() {
  const s = await startAccounts();
  const rob = await s.user('rob', { admin: true, totp: true });
  const anna = await s.user('anna', { totp: true });
  const kai = await s.user('kai');
  const ben = await s.user('ben');
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  return { s, ids: { rob: rob.id, anna: anna.id, kai: kai.id, ben: ben.id }, rob: as(rob), anna: as(anna), kai: as(kai), ben: as(ben) };
}

/** A campaign Anna leads, Kai a player in it. */
async function campaign() {
  const w = await world();
  const made = await w.anna('POST', '/campaigns', { name: '  The Hel   Fenn Campaign ' });
  expect(made.statusCode).toBe(201);
  const id = (made.json() as View).campaign.id;
  await w.anna('PUT', `/campaigns/${id}/members/${w.ids.kai}`, { role: 'player' });
  return { ...w, id };
}

describe('starting a campaign', () => {
  it('needs the authenticator; whoever starts it leads it', async () => {
    const { kai, anna, ids } = await world();
    expect((await kai('POST', '/campaigns', { name: 'No factor' })).json()).toEqual({ error: 'forbidden' });
    const made = await anna('POST', '/campaigns', { name: '  The Hel   Fenn Campaign ' });
    expect(made.json()).toMatchObject({ campaign: { name: 'The Hel Fenn Campaign', round: 0 }, role: 'leader', members: [{ userId: ids.anna, role: 'leader', canLead: true }], enrolments: [] });
    expect((await anna('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ name: 'The Hel Fenn Campaign', role: 'leader', members: 1, warbands: 0 }] });
    expect((await kai('GET', '/campaigns')).json()).toEqual({ campaigns: [] });
    expect((await anna('POST', '/campaigns', { name: '   ' })).statusCode).toBe(400);
  });
});

describe('members', () => {
  it('a leader adds players and changes roles; a campaign keeps a leader', async () => {
    const { id, anna, kai, ben, rob, ids } = await campaign();
    // outside the campaign it does not exist – the admin included
    expect((await ben('GET', `/campaigns/${id}`)).statusCode).toBe(404);
    expect((await rob('GET', `/campaigns/${id}`)).statusCode).toBe(404);
    // a player reads, but does not manage
    expect((await kai('GET', `/campaigns/${id}`)).json()).toMatchObject({ role: 'player', members: [{ userId: ids.anna, role: 'leader' }, { userId: ids.kai, role: 'player' }] });
    expect(JSON.stringify((await kai('GET', `/campaigns/${id}`)).json())).not.toContain('canLead');
    expect((await kai('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'player' })).json()).toEqual({ error: 'forbidden' });
    expect((await kai('PATCH', `/campaigns/${id}`, { name: 'Mine now' })).statusCode).toBe(403);

    await anna('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'viewer' });
    expect((await anna('PATCH', `/campaigns/${id}`, { name: 'The Hel Fenn' })).json()).toMatchObject({ campaign: { name: 'The Hel Fenn' } });
    expect((await ben('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ name: 'The Hel Fenn', role: 'viewer', members: 3 }] });
    // the last leader stays one
    expect((await anna('PUT', `/campaigns/${id}/members/${ids.anna}`, { role: 'player' })).json()).toEqual({ error: 'last_leader' });
    expect((await anna('DELETE', `/campaigns/${id}/members/${ids.anna}`)).json()).toEqual({ error: 'last_leader' });
    // a leader without the authenticator may read, not lead
    await anna('PUT', `/campaigns/${id}/members/${ids.kai}`, { role: 'leader' });
    expect((await anna('GET', `/campaigns/${id}`)).json()).toMatchObject({ members: [{ userId: ids.anna, canLead: true }, { userId: ids.kai, canLead: false }, { userId: ids.ben, role: 'viewer' }] });
    expect((await kai('GET', `/campaigns/${id}`)).statusCode).toBe(200);
    expect((await kai('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'player' })).json()).toEqual({ error: 'forbidden' });
    // taken out, the campaign is gone for them
    await anna('DELETE', `/campaigns/${id}/members/${ids.ben}`);
    expect((await ben('GET', `/campaigns/${id}`)).statusCode).toBe(404);
    expect((await anna('PUT', `/campaigns/${id}/members/${randomUUID()}`, { role: 'player' })).statusCode).toBe(400);
  });
});

describe('entering a warband', () => {
  it('a copy of the player’s own waits for a leader; confirmed, its start is marked with the totals the rules compute', async () => {
    const { s, id, anna, kai, ids } = await campaign();
    const mine = randomUUID();
    await kai('POST', '/warbands', { id: mine, data: SAVE, source: 'save' });
    const copy = randomUUID();
    const entered = await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: copy, data: SAVE, copiedFrom: { id: mine, rev: 1 }, appVersion: 'test' });
    expect(entered.statusCode).toBe(201);
    expect(entered.json()).toMatchObject({
      warband: { id: copy, campaignId: id, copiedFrom: { id: mine, rev: 1 } },
      head: { rev: 1, source: 'copy', note: 'entered in The Hel Fenn Campaign' },
      campaign: { enrolments: [{ warbandId: copy, player: 'kai', status: 'pending', tag: null }] },
    });
    // the original stays free
    expect(((await kai('GET', `/warbands/${mine}`)).json() as { warband: { campaignId: unknown } }).warband.campaignId).toBeNull();
    const enrolmentId = (entered.json() as { enrolmentId: string }).enrolmentId;
    // the player does not confirm their own
    expect((await kai('POST', `/campaigns/${id}/enrolments/${enrolmentId}/confirm`)).statusCode).toBe(403);
    const before = (await kai('GET', '/sync?cursor=0')).json() as { cursor: number };

    s.clock.advance(1000);
    const done = (await anna('POST', `/campaigns/${id}/enrolments/${enrolmentId}/confirm`)).json() as View;
    expect(done.enrolments).toMatchObject([{ status: 'active', tag: { kind: 'start', rev: 1, round: 0, totals: totals(SAVE) } }]);
    expect(totals(SAVE).rating).toBeGreaterThan(0);
    // the player's devices learn it on the next sync
    expect((await kai('GET', `/sync?cursor=${before.cursor}`)).json()).toMatchObject({ warbands: [{ id: copy, campaignId: id }] });
    expect((await kai('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ warbands: 1 }] });
    expect(s.db.prepare("SELECT action, campaign_id, visibility FROM audit_log WHERE action LIKE 'enrolment.%' ORDER BY seq").all()).toEqual([
      { action: 'enrolment.create', campaign_id: id, visibility: 'public' },
      { action: 'enrolment.confirm', campaign_id: id, visibility: 'public' },
    ]);
    expect(ids.kai).toBeTruthy();
  });

  it('a leader’s own warband needs no one else’s word; a viewer enters none', async () => {
    const { id, anna, ben, ids } = await campaign();
    const entered = (await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: SAVE })).json() as { campaign: View; head: { source: string } };
    expect(entered.head.source).toBe('import');
    expect(entered.campaign.enrolments).toMatchObject([{ player: 'anna', status: 'active', tag: { kind: 'start' } }]);
    await anna('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'viewer' });
    expect((await ben('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: SAVE })).json()).toEqual({ error: 'forbidden' });
  });

  it('names its source only if that is the player’s own; refuses what the rules cannot read', async () => {
    const { id, anna, kai } = await campaign();
    const hers = randomUUID();
    await anna('POST', '/warbands', { id: hers, data: SAVE, source: 'save' });
    const r = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: SAVE, copiedFrom: { id: hers, rev: 1 } })).json() as { warband: { copiedFrom: unknown }; head: { source: string } };
    expect(r).toMatchObject({ warband: { copiedFrom: null }, head: { source: 'import' } });
    expect((await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: { ...SAVE, wb: 'no-such-warband' } })).json()).toMatchObject({ error: 'invalid' });
  });
});

describe('a warband in a campaign', () => {
  it('every member reads it, the player’s work since the last version included; nobody outside', async () => {
    const { id, anna, kai, ben, rob, ids } = await campaign();
    await anna('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'viewer' });
    const copy = randomUUID();
    const e = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: copy, data: SAVE })).json() as { enrolmentId: string };
    // pending, it is readable already: the leader decides on what is there
    expect((await anna('GET', `/campaigns/${id}/warbands/${copy}`)).json()).toMatchObject({ status: 'pending', player: { displayName: 'kai' }, head: { rev: 1, data: SAVE }, draft: null, tags: [] });
    await anna('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
    await kai('PUT', `/warbands/${copy}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Renamed on the phone' }, device: 'Phone' });
    const seen = (await ben('GET', `/campaigns/${id}/warbands/${copy}`)).json();
    expect(seen).toMatchObject({ status: 'active', draft: { data: { name: 'Renamed on the phone' } }, tags: [{ kind: 'start', rev: 1 }] });
    expect(JSON.stringify(seen)).not.toContain('Phone"');
    expect((await rob('GET', `/campaigns/${id}/warbands/${copy}`)).statusCode).toBe(404);
    // the warband itself stays its owner's
    expect((await ben('GET', `/warbands/${copy}`)).statusCode).toBe(404);
    // a warband not entered here is not readable through the campaign
    const other = randomUUID();
    await kai('POST', '/warbands', { id: other, data: SAVE, source: 'save' });
    expect((await anna('GET', `/campaigns/${id}/warbands/${other}`)).statusCode).toBe(404);
  });

  it('cannot be removed while entered; withdrawn, declined or with its player taken out, it is free again', async () => {
    const { id, anna, kai, ids } = await campaign();
    const a = randomUUID();
    const ea = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: a, data: SAVE })).json() as { enrolmentId: string };
    expect((await kai('DELETE', `/warbands/${a}`)).json()).toEqual({ error: 'enrolled' });
    // only the player withdraws their own (or a leader)
    await anna('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'player' });
    expect((await kai('DELETE', `/campaigns/${id}/enrolments/${ea.enrolmentId}`)).json()).toMatchObject({ enrolments: [] });
    expect(((await kai('GET', `/warbands/${a}`)).json() as { warband: { campaignId: unknown } }).warband.campaignId).toBeNull();
    expect((await kai('DELETE', `/warbands/${a}`)).statusCode).toBe(200);

    const b = randomUUID();
    const eb = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: b, data: SAVE })).json() as { enrolmentId: string };
    expect((await anna('POST', `/campaigns/${id}/enrolments/${eb.enrolmentId}/decline`)).json()).toMatchObject({ enrolments: [] });
    expect((await anna('POST', `/campaigns/${id}/enrolments/${eb.enrolmentId}/confirm`)).statusCode).toBe(404);

    const c = randomUUID();
    const ec = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: c, data: SAVE })).json() as { enrolmentId: string };
    await anna('POST', `/campaigns/${id}/enrolments/${ec.enrolmentId}/confirm`);
    expect((await anna('POST', `/campaigns/${id}/enrolments/${ec.enrolmentId}/decline`)).json()).toEqual({ error: 'confirmed' });
    await anna('DELETE', `/campaigns/${id}/members/${ids.kai}`);
    expect(((await kai('GET', `/warbands/${c}`)).json() as { warband: { campaignId: unknown } }).warband.campaignId).toBeNull();
    expect(((await anna('GET', `/campaigns/${id}`)).json() as View).enrolments).toEqual([]);
  });
});

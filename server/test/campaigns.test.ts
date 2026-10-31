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
  it('needs no authenticator (ADR 0030); whoever starts it leads it', async () => {
    const { kai, anna, ids } = await world();
    expect((await kai('POST', '/campaigns', { name: 'No factor' })).statusCode).toBe(201);
    const made = await anna('POST', '/campaigns', { name: '  The Hel   Fenn Campaign ' });
    expect(made.json()).toMatchObject({ campaign: { name: 'The Hel Fenn Campaign', round: 0 }, role: 'leader', members: [{ userId: ids.anna, role: 'leader' }], enrolments: [] });
    expect((await anna('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ name: 'The Hel Fenn Campaign', role: 'leader', members: 1, warbands: 0 }] });
    // Kai started one of his own above, and is in none of Anna's
    expect((await kai('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ name: 'No factor', role: 'leader' }] });
    expect((await anna('POST', '/campaigns', { name: '   ' })).statusCode).toBe(400);
  });
});

describe('the place of a campaign (#66)', () => {
  it('is optional, a key of the lore chosen when it starts, and every member reads it', async () => {
    const { anna } = await world();
    const plain = await anna('POST', '/campaigns', { name: 'Nowhere in particular' });
    expect((plain.json() as { campaign: { place: string } }).campaign.place).toBe('');
    const made = await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign', place: 'mordheim' });
    expect(made.statusCode).toBe(201);
    const { campaign } = made.json() as { campaign: { id: string; place: string } };
    expect(campaign.place).toBe('mordheim');
    expect((await anna('GET', `/campaigns/${campaign.id}`)).json()).toMatchObject({ campaign: { place: 'mordheim' } });
    // not a key: refused, nothing is made
    expect((await anna('POST', '/campaigns', { name: 'Bad place', place: 'A <script> place' })).statusCode).toBe(400);
  });
});

describe('the place of a Vanilla campaign (#174)', () => {
  it('is Mordheim, whether the app sends it or not, and nothing else', async () => {
    const { anna } = await world();
    const none = await anna('POST', '/campaigns', { name: 'Vanilla without a place', vanilla: true });
    expect(none.statusCode).toBe(201);
    expect((none.json() as { campaign: { place: string; vanilla: boolean } }).campaign).toMatchObject({ place: 'mordheim', vanilla: true });
    const same = await anna('POST', '/campaigns', { name: 'Vanilla in Mordheim', vanilla: true, place: 'mordheim' });
    expect((same.json() as { campaign: { place: string } }).campaign.place).toBe('mordheim');
    // another place is refused, and nothing is made
    const other = await anna('POST', '/campaigns', { name: 'Vanilla elsewhere', vanilla: true, place: 'ostermark' });
    expect(other.statusCode).toBe(400);
    expect((await anna('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ name: 'Vanilla without a place' }, { name: 'Vanilla in Mordheim' }] });
  });

  it('leaves the place of any other campaign as it is', async () => {
    const { anna } = await world();
    const made = await anna('POST', '/campaigns', { name: 'Ostermark, with every item', place: 'ostermark' });
    expect((made.json() as { campaign: { place: string } }).campaign.place).toBe('ostermark');
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
    // a leader without the authenticator leads like any other (ADR 0030)
    await anna('PUT', `/campaigns/${id}/members/${ids.kai}`, { role: 'leader' });
    expect((await anna('GET', `/campaigns/${id}`)).json()).toMatchObject({ members: [{ userId: ids.anna, role: 'leader' }, { userId: ids.kai, role: 'leader' }, { userId: ids.ben, role: 'viewer' }] });
    expect((await kai('GET', `/campaigns/${id}`)).statusCode).toBe(200);
    expect((await kai('PUT', `/campaigns/${id}/members/${ids.ben}`, { role: 'player' })).statusCode).toBe(200);
    // taken out, the campaign is gone for them
    await anna('DELETE', `/campaigns/${id}/members/${ids.ben}`);
    expect((await ben('GET', `/campaigns/${id}`)).statusCode).toBe(404);
    expect((await anna('PUT', `/campaigns/${id}/members/${randomUUID()}`, { role: 'player' })).statusCode).toBe(400);
  });
});

/* Wish #77: what a warband that joins late is measured by – the figures of the warbands already in, without names. */
describe('the figures of the others (catch-up)', () => {
  it('rating, value and battles fought of each active warband; the pending and the left are not in; every member reads', async () => {
    const { s, id, anna, kai, ben } = await campaign();
    const mine = randomUUID();
    await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: mine, data: SAVE, appVersion: 'test' });
    const enrolmentId = ((await kai('GET', `/campaigns/${id}`)).json() as View).enrolments[0]!.id;
    // waiting for a leader: not yet one of the others
    expect((await kai('GET', `/campaigns/${id}/catchup`)).json()).toEqual({ peers: [], round: 0 });
    await anna('POST', `/campaigns/${id}/enrolments/${enrolmentId}/confirm`);
    const t = totals(SAVE);
    expect((await kai('GET', `/campaigns/${id}/catchup`)).json()).toEqual({ peers: [{ rating: t.rating, value: t.spent + t.gold, battles: 0 }], round: 0 });
    // a closed battle it fought counts; an open one does not
    const insert = (bid: string, status: string) => {
      s.db.prepare("INSERT INTO battles (id, campaign_id, round, status, created_by, created_at, updated_at, seq) VALUES (?, ?, 1, ?, ?, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 1)").run(bid, id, status, s.db.prepare('SELECT id FROM users WHERE username = ?').pluck().get('anna') as string);
      s.db.prepare('INSERT INTO battle_participants (battle_id, warband_id) VALUES (?, ?)').run(bid, mine);
    };
    insert(randomUUID(), 'closed');
    insert(randomUUID(), 'open');
    expect((await kai('GET', `/campaigns/${id}/catchup`)).json()).toEqual({ peers: [{ rating: t.rating, value: t.spent + t.gold, battles: 1 }], round: 0 });
    // nobody outside the campaign reads it
    expect((await ben('GET', `/campaigns/${id}/catchup`)).statusCode).toBe(404);
    // a warband that left is not one of the others
    await kai('DELETE', `/campaigns/${id}/enrolments/${enrolmentId}`);
    expect((await anna('GET', `/campaigns/${id}/catchup`)).json()).toEqual({ peers: [], round: 0 });
  });
});

describe('entering a warband', () => {
  /* Wish #77: a planner is for planning; the server does not take it into a campaign as it is. */
  it('a planner is refused; the same warband without the mark enters', async () => {
    const { id, kai } = await campaign();
    const refused = await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: { ...SAVE, planner: true }, appVersion: 'test' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/planner/) });
    expect((await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: randomUUID(), data: SAVE, appVersion: 'test' })).statusCode).toBe(201);
  });

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

/* Rob, 19.10.2026: a leader deletes a campaign (a tombstone the admin can
   bring back; the warbands stay with their owners, free), and every member
   files campaigns away in their own list. */
describe('deleting a campaign', () => {
  async function entered() {
    const w = await campaign();
    const copy = randomUUID();
    const made = await w.kai('POST', `/campaigns/${w.id}/enrolments`, { warbandId: copy, data: SAVE, appVersion: 'test' });
    const enrolmentId = (made.json() as { enrolmentId: string }).enrolmentId;
    await w.anna('POST', `/campaigns/${w.id}/enrolments/${enrolmentId}/confirm`);
    return { ...w, copy };
  }

  it('a leader deletes it by its name; it is gone for every member, the warbands are free again', async () => {
    const { s, id, anna, kai, copy } = await entered();
    // a player may not; a leader must type the name
    expect((await kai('DELETE', `/campaigns/${id}`, { name: 'The Hel Fenn Campaign' })).json()).toEqual({ error: 'forbidden' });
    expect((await anna('DELETE', `/campaigns/${id}`, { name: 'The Hel Fenn' })).statusCode).toBe(400);
    const before = (await kai('GET', '/sync?cursor=0')).json() as { cursor: number };
    s.clock.advance(1000);
    expect((await anna('DELETE', `/campaigns/${id}`, { name: ' The Hel Fenn Campaign ' })).json()).toEqual({ deleted: true });
    // gone: from the lists, and every route of it answers as if it never was
    expect((await anna('GET', '/campaigns')).json()).toEqual({ campaigns: [] });
    expect((await kai('GET', '/campaigns')).json()).toEqual({ campaigns: [] });
    for (const path of ['', '/notes', '/timeline', '/battles', `/warbands/${copy}`]) {
      expect((await kai('GET', `/campaigns/${id}${path}`)).statusCode, path).toBe(404);
      expect((await anna('GET', `/campaigns/${id}${path}`)).statusCode, path).toBe(404);
    }
    expect((await anna('DELETE', `/campaigns/${id}`, { name: 'The Hel Fenn Campaign' })).statusCode).toBe(404);
    // the warband stays with its owner, free, with its versions; the devices learn it on the next sync
    expect((await kai('GET', `/sync?cursor=${before.cursor}`)).json()).toMatchObject({ warbands: [{ id: copy, campaignId: null }] });
    expect((await kai('GET', `/warbands/${copy}`)).json()).toMatchObject({ warband: { id: copy, campaignId: null } });
    // a tombstone, logged
    expect(s.db.prepare('SELECT deleted_at IS NOT NULL AS gone FROM campaigns WHERE id = ?').get(id)).toEqual({ gone: 1 });
    expect(s.db.prepare("SELECT action, visibility FROM audit_log WHERE action = 'campaign.delete'").all()).toEqual([{ action: 'campaign.delete', visibility: 'public' }]);
  });

  it('the admin brings it back: its warbands that are still free rejoin it, one entered elsewhere stays there', async () => {
    const { s, id, anna, kai, ids, copy } = await entered();
    const { restoreCampaign, deletedCampaigns } = await import('../src/campaigns.ts');
    await anna('DELETE', `/campaigns/${id}`, { name: 'The Hel Fenn Campaign' });
    expect(deletedCampaigns(s.db).map((c) => c.id)).toEqual([id]);
    expect(restoreCampaign(s.db, id, s.clock.now())).toEqual({ ok: true, warbands: 1, elsewhere: 0 });
    expect((await kai('GET', `/campaigns/${id}`)).json()).toMatchObject({ campaign: { name: 'The Hel Fenn Campaign' }, enrolments: [{ warbandId: copy, status: 'active' }] });
    expect((await kai('GET', `/warbands/${copy}`)).json()).toMatchObject({ warband: { campaignId: id } });
    expect(restoreCampaign(s.db, id, s.clock.now())).toEqual({ ok: false });
    // deleted again; meanwhile Kai enters the free warband in another campaign
    await anna('DELETE', `/campaigns/${id}`, { name: 'The Hel Fenn Campaign' });
    const other = ((await anna('POST', '/campaigns', { name: 'Summer in Sylvania' })).json() as View).campaign.id;
    s.db.prepare('UPDATE warbands SET campaign_id = ? WHERE id = ?').run(other, copy);
    expect(restoreCampaign(s.db, id, s.clock.now())).toEqual({ ok: true, warbands: 0, elsewhere: 1 });
    expect(ids.kai).toBeTruthy();
  });
});

describe('the archive of one’s own list', () => {
  it('each member files a campaign away for themselves; the others’ lists stay as they are', async () => {
    const { id, anna, kai, ben, ids } = await campaign();
    expect((await kai('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ id, archived: false }] });
    expect((await kai('PUT', `/campaigns/${id}/archive`, { archived: true })).json()).toEqual({ archived: true });
    expect((await kai('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ id, archived: true }] });
    expect((await anna('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ id, archived: false }] });
    // still a member: it reads as before
    expect((await kai('GET', `/campaigns/${id}`)).statusCode).toBe(200);
    expect((await kai('PUT', `/campaigns/${id}/archive`, { archived: false })).json()).toEqual({ archived: false });
    expect((await kai('GET', '/campaigns')).json()).toMatchObject({ campaigns: [{ id, archived: false }] });
    // outside the campaign there is nothing to file away
    expect((await ben('PUT', `/campaigns/${id}/archive`, { archived: true })).statusCode).toBe(404);
    expect(ids.ben).toBeTruthy();
  });
});

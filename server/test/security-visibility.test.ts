/* What members – and the admin – see, after the security review of
   09.10.2026 (docs/security-review.md, AUTHZ-…): hidden narrative leaves no
   trace in the admin's log or in the numbers a device asks with; the
   picture quota counts what is kept. Each test was written to fail before
   its fix. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attachmentById, putAttachment, storeFile } from '../src/attachments.ts';
import { campaignById } from '../src/campaigns.ts';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

/** Anna leads (authenticator), Kai plays, Rob is the admin – outside the campaign unless asked in. */
async function world(o: { robInside?: boolean } = {}) {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), rob: await s.user('rob', { admin: true, totp: true }) };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'SECRET-CAMPAIGN' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  if (o.robInside) await anna('PUT', `/campaigns/${id}/members/${u.rob.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'SECRET-BATTLE', warbandIds: [w] });
  return { s, u, id, bid, w, anna, kai, rob };
}

const audit = async (rob: (m: 'GET', url: string) => Promise<{ json: () => unknown }>) => (await rob('GET', '/admin/audit?limit=200')).json() as { entries: { action: string; payload: unknown }[] };

describe('the admin’s log', () => {
  it('AUTHZ-1: of a campaign he is not part of, the admin sees what happened and who did it – no names, titles or words', async () => {
    const { id, bid, anna, kai, rob } = await world();
    await kai('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: bid, kind: 'hook', text: 'sealed words', visibility: 'sealed' });
    const eid = randomUUID();
    await anna('PUT', `/campaigns/${id}/battles/${bid}/protocol/${eid}`, { turn: 1, kind: 'event', payload: { text: 'FIRST-WORDING' } });
    await anna('PUT', `/campaigns/${id}/battles/${bid}/protocol/${eid}`, { turn: 1, kind: 'event', payload: { text: 'second' } });
    const a = await audit(rob);
    const text = JSON.stringify(a);
    expect(text).not.toMatch(/SECRET-CAMPAIGN|SECRET-BATTLE|FIRST-WORDING|"kind":"hook"/);
    // the public entries are there, as entries; the sealed note not even as one (independent review)
    expect(a.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['campaign.create', 'battle.create', 'protocol.correct']));
    expect(a.entries.map((e) => e.action)).not.toContain('note.create');
    expect(a.entries.filter((e) => ['campaign.create', 'battle.create', 'protocol.correct'].includes(e.action)).every((e) => e.payload === null)).toBe(true);
  });

  it('AUTHZ-1: in a campaign he is part of, the admin reads the public entries – never a sealed note’s kind, nor a leaders’ note', async () => {
    const { s, id, bid, anna, kai, rob } = await world({ robInside: true });
    await kai('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: bid, kind: 'hook', text: 'sealed words', visibility: 'sealed' });
    await anna('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: bid, kind: 'scene', text: 'leader words', visibility: 'leader' });
    await kai('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: bid, kind: 'quote', text: 'open words', visibility: 'public' });
    const a = await audit(rob);
    const text = JSON.stringify(a);
    expect(text).toMatch(/SECRET-CAMPAIGN/);
    expect(text).not.toMatch(/"kind":"hook"|"kind":"scene"/);
    // a hidden note is not even an entry: only the public one is listed (independent review)
    expect(a.entries.filter((e) => e.action === 'note.create').map((e) => e.payload)).toEqual([expect.objectContaining({ kind: 'quote' })]);
    // the log itself keeps no sealed note's kind
    expect(JSON.stringify(s.db.prepare("SELECT payload FROM audit_log WHERE action = 'note.create'").all())).not.toMatch(/hook/);
  });
});

describe('the numbers a device asks with', () => {
  it('AUTHZ-3: a leaders’ note or picture does not move what a player is told is new', async () => {
    const { id, anna, kai } = await world();
    const n0 = (await kai('GET', `/campaigns/${id}/notes`)).json() as { seq: number };
    const p0 = (await kai('GET', `/campaigns/${id}/attachments`)).json() as { seq: number };
    const note = randomUUID();
    await anna('PUT', `/campaigns/${id}/notes/${note}`, { text: 'hidden', visibility: 'leader' });
    await anna('PUT', `/campaigns/${id}/attachments/${randomUUID()}`, { mime: 'image/png', bytes: 777, width: 1, height: 1, visibility: 'leader' });
    await anna('DELETE', `/campaigns/${id}/notes/${note}`);
    expect((await kai('GET', `/campaigns/${id}/notes?since=${n0.seq}`)).json()).toEqual({ unchanged: true, seq: n0.seq });
    expect((await kai('GET', `/campaigns/${id}/attachments?since=${p0.seq}`)).json()).toEqual({ unchanged: true, seq: p0.seq });
    // the leader is told
    expect((await anna('GET', `/campaigns/${id}/notes?since=${n0.seq}`)).json()).not.toHaveProperty('unchanged');
  });
});

describe('a note that becomes hidden', () => {
  it('AUTHZ-3: turned into a leaders\u2019 note, it leaves the players\u2019 lists – the number they asked with no longer matches (independent review)', async () => {
    const { id, anna, kai } = await world();
    const note = randomUUID();
    await anna('PUT', `/campaigns/${id}/notes/${note}`, { text: 'open words', visibility: 'public' });
    const seen = (await kai('GET', `/campaigns/${id}/notes`)).json() as { seq: number; notes: { id: string }[] };
    expect(seen.notes.map((n) => n.id)).toContain(note);
    await anna('PUT', `/campaigns/${id}/notes/${note}`, { text: 'now hidden', visibility: 'leader' });
    const after = (await kai('GET', `/campaigns/${id}/notes?since=${seen.seq}`)).json() as { unchanged?: boolean; notes: { id: string }[] };
    expect(after.unchanged).toBeUndefined();
    expect(after.notes.map((n) => n.id)).not.toContain(note);
  });
});

describe('hidden after being seen, behind newer ones', () => {
  it('AUTHZ-3: a note or picture turned leaders\u2019-only moves everybody\u2019s number, even when newer ones exist (independent review, second round)', async () => {
    const { id, anna, kai } = await world();
    const p = randomUUID();
    await anna('PUT', `/campaigns/${id}/notes/${p}`, { text: 'first words', visibility: 'public' });
    await anna('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { text: 'newer words', visibility: 'public' });
    const seen = (await kai('GET', `/campaigns/${id}/notes`)).json() as { seq: number };
    await anna('PUT', `/campaigns/${id}/notes/${p}`, { text: 'first words', visibility: 'leader' });
    const after = (await kai('GET', `/campaigns/${id}/notes?since=${seen.seq}`)).json() as { unchanged?: boolean; notes: { id: string }[] };
    expect(after.unchanged).toBeUndefined();
    expect(after.notes.map((n) => n.id)).not.toContain(p);

    const pic = randomUUID();
    const meta = { mime: 'image/png', bytes: 10, width: 1, height: 1 };
    await anna('PUT', `/campaigns/${id}/attachments/${pic}`, { ...meta, visibility: 'public' });
    await anna('PUT', `/campaigns/${id}/attachments/${randomUUID()}`, { ...meta, visibility: 'public' });
    const pics = (await kai('GET', `/campaigns/${id}/attachments`)).json() as { seq: number };
    await anna('PUT', `/campaigns/${id}/attachments/${pic}`, { ...meta, visibility: 'leader' });
    const later = (await kai('GET', `/campaigns/${id}/attachments?since=${pics.seq}`)).json() as { unchanged?: boolean; attachments: { id: string }[] };
    expect(later.unchanged).toBeUndefined();
    expect(later.attachments.map((x) => x.id)).not.toContain(pic);
  });
});

describe('the picture quota', () => {
  it('AUTHZ-2: what is announced but never sent takes no room; at most 20 wait per member; the room is checked again when the bytes come', async () => {
    const { s, id, u } = await world();
    const c = campaignById(s.db, id)!;
    const t = s.clock.now();
    const kai = { id: u.kai.id, leader: false };
    const announce = (bytes: number, by = kai) => putAttachment(s.db, c.id, randomUUID(), { battleId: null, turn: null, mime: 'image/png', bytes, width: 1, height: 1, caption: '', visibility: 'public' }, by, t, 100);
    for (let i = 0; i < 20; i++) expect(announce(90).ok).toBe(true);
    expect(announce(90)).toMatchObject({ ok: false, status: 409, error: 'too_many_waiting' });
    // another member still has the whole room
    const anna = { id: u.anna.id, leader: true };
    const one = announce(PNG.length, anna);
    const two = announce(100 - PNG.length + 1, anna);
    expect([one.ok, two.ok]).toEqual([true, true]);
    const dir = join(s.data, 'uploads');
    expect(storeFile(s.db, dir, attachmentById(s.db, (one as { row: { id: string } }).row.id)!, PNG, 'image/png', u.anna.id, t, 100).ok).toBe(true);
    // the second no longer fits once the first is kept
    const big = Buffer.concat([PNG, Buffer.alloc(100 - PNG.length + 1 - PNG.length)]);
    expect(storeFile(s.db, dir, attachmentById(s.db, (two as { row: { id: string } }).row.id)!, big, 'image/png', u.anna.id, t, 100)).toMatchObject({ ok: false, status: 413, error: 'quota' });
  });
});

describe('a player’s own warbands', () => {
  it('AUTHZ-5: the id of the warband an entered copy came from reaches its owner only', async () => {
    const { id, kai, anna } = await world();
    const priv = randomUUID();
    await kai('POST', '/warbands', { id: priv, data: SAVE, source: 'save' });
    const e = randomUUID();
    await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: e, data: SAVE, copiedFrom: { id: priv, rev: 1 } });
    expect(((await anna('GET', `/campaigns/${id}/warbands/${e}`)).json() as { warband: Record<string, unknown> }).warband.copiedFrom).toBeNull();
    expect(((await kai('GET', `/campaigns/${id}/warbands/${e}`)).json() as { warband: { copiedFrom: { id: string } } }).warband.copiedFrom.id).toBe(priv);
  });
});

describe('what a warband may carry', () => {
  it('CLIENT-3: an id of a hired sword is a plain key – markup in it is refused, so no older reader can run it', async () => {
    const { kai } = await world();
    const bad = { ...SAVE, hired: [{ key: 'ogre', uid: '"><img src=x onerror=alert(1)>', exp: 0 }] };
    expect((await kai('POST', '/warbands', { id: randomUUID(), data: bad, source: 'save' })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/hired\.0\.uid/) });
    const good = { ...SAVE, hired: [{ key: 'ogre', uid: 'hs1700000000000123', exp: 0 }] };
    expect((await kai('POST', '/warbands', { id: randomUUID(), data: good, source: 'save' })).statusCode).toBe(201);
  });
});

describe('whose a request is', () => {
  it('CLIENT-1: a request made for another account than the cookie’s is refused – a tab where somebody else signed in meanwhile (independent review)', async () => {
    const { u, s, id } = await world();
    const token = u.kai.session();
    const as = (who: string) => s.call({ url: `/api/v1/campaigns/${id}/notes`, token, headers: { 'x-roster-user': who } });
    expect((await as(u.anna.id)).statusCode).toBe(409);
    expect((await as(u.anna.id)).json()).toEqual({ error: 'other_user' });
    expect((await as(u.kai.id)).statusCode).toBe(200);
    // without the header, as before; signed out, the header changes nothing
    expect((await s.call({ url: `/api/v1/campaigns/${id}/notes`, token })).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/auth/me', headers: { 'x-roster-user': u.anna.id } })).json()).toMatchObject({ user: null });
  });
});

describe('signing out', () => {
  it('CLIENT-1: the browser is told to drop what it kept of the account’s answers', async () => {
    const { u, s } = await world();
    const r = await s.call({ url: '/api/v1/auth/logout', body: {}, token: u.kai.session() });
    expect(r.headers['clear-site-data']).toBe('"cache"');
  });
});

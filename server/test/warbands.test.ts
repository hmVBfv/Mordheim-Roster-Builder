/* Warbands on the server (phase 3h): owned, versioned, drafted, removed and
   brought back, copied as a blueprint, and synced – through HTTP as the app
   uses them. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { renewEpoch } from '../src/db.ts';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = { wb: 'reikland', name: 'The Silver Caravan', models: [{ uid: 1, uid_def: 'captain', exp: 20 }], format: 2 };
const MIN = 60 * 1000;

async function world() {
  const s = await startAccounts();
  const kai = await s.user('kai');
  const ben = await s.user('ben');
  const rob = await s.user('rob', { admin: true, totp: true });
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  return { s, kai: as(kai), ben: as(ben), rob: as(rob), kaiId: kai.id };
}

const create = (call: Awaited<ReturnType<typeof world>>['kai'], data: unknown = SAVE, extra: Record<string, unknown> = {}) => {
  const id = randomUUID();
  return call('POST', '/warbands', { id, data, source: 'save', ...extra }).then((res) => ({ id, res }));
};

describe('a warband of one’s own', () => {
  it('is made with its first version and seen by its owner only – not by another player, not by the admin', async () => {
    const { kai, ben, rob } = await world();
    const { id, res } = await create(kai);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ warband: { id, name: 'The Silver Caravan', wbType: 'reikland', headRev: 1, copiedFrom: null, archivedAt: null }, rev: 1 });
    expect(((await kai('GET', '/warbands')).json() as { warbands: { id: string }[] }).warbands.map((w) => w.id)).toEqual([id]);
    expect((await ben('GET', '/warbands')).json()).toEqual({ warbands: [] });
    expect((await rob('GET', '/warbands')).json()).toEqual({ warbands: [] });
    for (const call of [ben, rob]) {
      for (const url of [`/warbands/${id}`, `/warbands/${id}/versions`, `/warbands/${id}/versions/1`]) expect((await call('GET', url)).json(), url).toEqual({ error: 'not_found' });
      expect((await call('POST', `/warbands/${id}/versions`, { baseRev: 1, data: SAVE })).statusCode).toBe(404);
      expect((await call('DELETE', `/warbands/${id}`)).statusCode).toBe(404);
    }
    const got = (await kai('GET', `/warbands/${id}`)).json() as { head: { rev: number; data: unknown; source: string; createdBy: string }; draft: unknown };
    expect(got.head).toMatchObject({ rev: 1, data: SAVE, source: 'save', createdBy: 'kai', format: 2 });
    expect(got.draft).toBeNull();
    // the same id from nowhere else
    expect((await ben('GET', `/warbands/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('sent twice (the outbox after a lost answer) it is made once; a different warband under the same id is refused', async () => {
    const { kai, ben } = await world();
    const { id } = await create(kai);
    const again = await kai('POST', '/warbands', { id, data: SAVE, source: 'save' });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ rev: 1 });
    expect((await kai('POST', '/warbands', { id, data: { ...SAVE, name: 'Other' }, source: 'save' })).json()).toEqual({ error: 'exists' });
    expect((await ben('POST', '/warbands', { id, data: SAVE, source: 'save' })).json()).toEqual({ error: 'exists' });
  });

  it('keeps only what is a warband save, at most 2 MB, without the app’s own "_" keys', async () => {
    const { kai } = await world();
    for (const data of [{ name: 'no type' }, { wb: 'reikland' }, { wb: 'reikland', models: 'none' }]) {
      const r = (await create(kai, data)).res;
      expect(r.statusCode, JSON.stringify(data)).toBe(400);
      expect(r.json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/^not a warband save/) });
    }
    const big = { ...SAVE, story: { prologue: 'x'.repeat(2 * 1024 * 1024) } };
    expect((await create(kai, big)).res.json()).toMatchObject({ error: 'too_large' });
    const { id } = await create(kai, { ...SAVE, _open: true, models: [{ uid: 1, uid_def: 'captain', _edit: 'x' }] });
    expect(((await kai('GET', `/warbands/${id}`)).json() as { head: { data: unknown } }).head.data).toEqual({ ...SAVE, models: [{ uid: 1, uid_def: 'captain' }] });
    expect((await kai('POST', '/warbands', { id: 'not-a-uuid', data: SAVE, source: 'save' })).statusCode).toBe(400);
  });
});

describe('versions', () => {
  it('a new version builds on the latest; one built on an older is refused, never overwrites (ADR 0003)', async () => {
    const { s, kai } = await world();
    const { id } = await create(kai);
    s.clock.advance(MIN);
    const v2 = await kai('POST', `/warbands/${id}/versions`, { baseRev: 1, data: { ...SAVE, name: 'Renamed' }, note: 'after the hunt', appVersion: 'abc1234' });
    expect(v2.statusCode).toBe(201);
    expect(v2.json()).toMatchObject({ warband: { headRev: 2, name: 'Renamed' }, rev: 2 });
    const stale = await kai('POST', `/warbands/${id}/versions`, { baseRev: 1, data: SAVE });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: 'stale', headRev: 2 });
    const list = (await kai('GET', `/warbands/${id}/versions`)).json() as { versions: { rev: number; note: string; appVersion: string; createdBy: string; bytes: number }[] };
    expect(list.versions.map((v) => [v.rev, v.note, v.appVersion, v.createdBy])).toEqual([[2, 'after the hunt', 'abc1234', 'kai'], [1, '', '', 'kai']]);
    expect(list.versions[0]!.bytes).toBeGreaterThan(10);
    expect(((await kai('GET', `/warbands/${id}/versions/1`)).json() as { version: { data: unknown } }).version.data).toEqual(SAVE);
    expect((await kai('GET', `/warbands/${id}/versions/7`)).statusCode).toBe(404);
  });
});

describe('the draft', () => {
  it('keeps the work between versions; another device’s newer draft is not overwritten unseen', async () => {
    const { s, kai, rob } = await world();
    const { id } = await create(kai);
    const phone = await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Draft 1' }, device: 'Phone', afterSeq: null });
    const seq1 = (phone.json() as { seq: number }).seq;
    expect(seq1).toBeGreaterThan(0);
    // the phone again, having seen its own draft
    const seq2 = ((await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Draft 2' }, device: 'Phone', afterSeq: seq1 })).json() as { seq: number }).seq;
    // the laptop never saw it
    const clash = await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Laptop' }, device: 'Laptop', afterSeq: null });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ error: 'draft_conflict', draft: { baseRev: 1, device: 'Phone', seq: seq2, data: { name: 'Draft 2' } } });
    expect((await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Laptop' }, device: 'Laptop', afterSeq: null, force: true })).statusCode).toBe(200);
    expect(((await kai('GET', `/warbands/${id}`)).json() as { draft: { device: string; data: { name: string } } }).draft).toMatchObject({ device: 'Laptop', data: { name: 'Laptop' } });
    expect((await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 2, data: SAVE, force: true })).json()).toMatchObject({ error: 'invalid' });
    // drafts are no changes worth a line each: one entry at most, and none in the admin's view
    const autosaves = s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'warband.autosave'").get() as { n: number };
    expect(autosaves.n).toBe(1);
    const audit = (await rob('GET', '/admin/audit')).json() as { entries: { action: string }[] };
    expect(audit.entries.map((e) => e.action)).toEqual(['warband.create']);
    // a version by its user empties it
    s.clock.advance(MIN);
    await kai('POST', `/warbands/${id}/versions`, { baseRev: 1, data: { ...SAVE, name: 'Laptop' } });
    expect(((await kai('GET', `/warbands/${id}`)).json() as { draft: unknown }).draft).toBeNull();
  });

  it('can be thrown away', async () => {
    const { kai } = await world();
    const { id } = await create(kai);
    await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: SAVE });
    expect((await kai('DELETE', `/warbands/${id}/autosave`)).json()).toEqual({ dropped: true });
    expect((await kai('DELETE', `/warbands/${id}/autosave`)).json()).toEqual({ dropped: false });
  });
});

describe('removing and bringing back', () => {
  it('a removed warband keeps its versions, takes no new ones, and comes back', async () => {
    const { kai } = await world();
    const { id } = await create(kai);
    expect((await kai('DELETE', `/warbands/${id}`)).json()).toMatchObject({ warband: { archivedAt: expect.any(String) } });
    expect((await kai('GET', '/warbands')).json()).toEqual({ warbands: [] });
    expect(((await kai('GET', '/warbands?archived=1')).json() as { warbands: unknown[] }).warbands).toHaveLength(1);
    expect((await kai('POST', `/warbands/${id}/versions`, { baseRev: 1, data: SAVE })).json()).toEqual({ error: 'archived' });
    expect((await kai('PUT', `/warbands/${id}/autosave`, { baseRev: 1, data: SAVE })).json()).toEqual({ error: 'archived' });
    expect((await kai('POST', `/warbands/${id}/unarchive`)).json()).toMatchObject({ warband: { archivedAt: null } });
    expect(((await kai('GET', '/warbands')).json() as { warbands: unknown[] }).warbands).toHaveLength(1);
  });
});

describe('a blueprint for a campaign start (concept.md 4.1)', () => {
  it('a copy names the warband and version it came from – one’s own only', async () => {
    const { kai, ben } = await world();
    const { id } = await create(kai);
    const copy = await create(kai, { ...SAVE, name: 'The Silver Caravan (Hel Fenn)' }, { source: 'copy', copiedFrom: { id, rev: 1 } });
    expect(copy.res.json()).toMatchObject({ warband: { copiedFrom: { id, rev: 1 }, name: 'The Silver Caravan (Hel Fenn)' } });
    expect((await kai('GET', `/warbands/${id}`)).json()).toMatchObject({ warband: { headRev: 1 } });
    expect((await create(ben, SAVE, { source: 'copy', copiedFrom: { id, rev: 1 } })).res.json()).toMatchObject({ error: 'invalid' });
    expect((await create(kai, SAVE, { source: 'copy', copiedFrom: { id, rev: 9 } })).res.statusCode).toBe(400);
  });
});

describe('sync (docs/architecture.md section 6)', () => {
  it('everything of one’s own from cursor 0, then only what changed – drafts and removals included, nobody else’s ever', async () => {
    const { s, kai, ben } = await world();
    const a = await create(kai);
    const b = await create(kai);
    await create(ben);
    const first = (await kai('GET', '/sync?cursor=0')).json() as { epoch: string; cursor: number; warbands: { id: string; head: { rev: number; data: unknown } | null; draft: unknown }[] };
    expect(first.epoch).toMatch(/[0-9a-f-]{36}/);
    expect(first.warbands.map((w) => w.id)).toEqual([a.id, b.id]);
    expect(first.warbands[0]!.head).toMatchObject({ rev: 1, data: SAVE });
    expect((await kai(`GET`, `/sync?cursor=${first.cursor}`)).json()).toMatchObject({ cursor: first.cursor, warbands: [] });

    await kai('PUT', `/warbands/${a.id}/autosave`, { baseRev: 1, data: { ...SAVE, name: 'Draft' } });
    const second = (await kai('GET', `/sync?cursor=${first.cursor}`)).json() as typeof first;
    expect(second.warbands.map((w) => w.id)).toEqual([a.id]);
    expect(second.warbands[0]!.draft).toMatchObject({ data: { name: 'Draft' } });
    expect(second.cursor).toBeGreaterThan(first.cursor);

    await kai('DELETE', `/warbands/${b.id}`);
    const third = (await kai('GET', `/sync?cursor=${second.cursor}`)).json() as { warbands: { id: string; archivedAt: string | null; head: unknown }[] };
    expect(third.warbands).toEqual([expect.objectContaining({ id: b.id, archivedAt: expect.any(String), head: null })]);

    // after a restore the epoch is new: the app syncs anew from 0
    const renewed = renewEpoch(s.db);
    expect(((await kai('GET', '/sync?cursor=0')).json() as { epoch: string }).epoch).toBe(renewed);
    expect(((await ben('GET', '/sync?cursor=0')).json() as { warbands: unknown[] }).warbands).toHaveLength(1);
  });
});

/* Chapters as drafts (phase 4b5b): the text of a chapter before it is
   published. Leaders' own – read, written, published and thrown away with the
   authenticator, for nobody else; published, its language goes into the
   chapter of its ref and everybody reads it. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

type Draft = { id: string; refKey: string; kind: string; lang: 'de' | 'en'; title: string; text: string; seq: number; createdBy: string };
type Chapter = { id: string; refKey: string; kind: string; de: { title: string; text?: string; length?: number } | null; en: { title: string; text?: string; length?: number } | null };

/** Anna leads (authenticator), Ben leads without one, Kai and Lea play, Vic watches, Rob (admin) is outside. */
async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), lea: await s.user('lea'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' || method === 'DELETE' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), lea = as(u.lea), vic = as(u.vic), rob = as(u.rob);
  const created = await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'The Hel Fenn Campaign' }, token: u.anna.session() });
  const cid = (created.json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${cid}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${cid}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.lea.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${cid}/members/${u.vic.id}`, { role: 'viewer' });
  const base = `/campaigns/${cid}/chapter-drafts`;
  const body = (o: Record<string, unknown> = {}) => ({ refKey: 'battle-1', kind: 'battle', lang: 'de', title: 'Das Rathaus', label: 'Kapitel 1', text: 'Das Rathaus stand noch.', ...o });
  const put = async (o: Record<string, unknown> = {}, id: string = randomUUID()) => ({ id, res: await anna('PUT', `${base}/${id}`, body(o)) });
  const list = async () => ((await anna('GET', base)).json() as { drafts: Draft[]; seq: number }).drafts;
  const chapters = async (who = kai) => ((await who('GET', `/campaigns/${cid}/timeline`)).json() as { chapters: Chapter[] }).chapters;
  return { s, u, cid, anna, ben, kai, lea, vic, rob, base, body, put, list, chapters };
}

describe('chapter drafts', () => {
  it('a leader with the authenticator writes one and reads it back, for everyone else it does not exist', async () => {
    const { anna, ben, kai, lea, vic, rob, base, put, list, chapters } = await table();
    expect(await list()).toEqual([]);
    const { id, res } = await put({ text: 'ZEBRA: die Gräfin zahlt den Fährmann.' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { draft: Draft }).draft).toMatchObject({ id, refKey: 'battle-1', lang: 'de', title: 'Das Rathaus', text: 'ZEBRA: die Gräfin zahlt den Fährmann.' });
    expect(await list()).toHaveLength(1);
    for (const who of [ben, kai, lea, vic]) {
      const g = await who('GET', base);
      expect(g.statusCode).toBe(403);
      expect(g.body).not.toMatch(/ZEBRA/);
      expect((await who('PUT', `${base}/${randomUUID()}`, { refKey: 'x', kind: 'battle', lang: 'de', title: 'x', text: 'x' })).statusCode).toBe(403);
      expect((await who('POST', `${base}/${id}/publish`, { at: { segment: 'pre', pos: '5' } })).statusCode).toBe(403);
      expect((await who('DELETE', `${base}/${id}`)).statusCode).toBe(403);
    }
    expect((await rob('GET', base)).statusCode).toBe(404);
    expect((await rob('DELETE', `${base}/${id}`)).statusCode).toBe(404);
    // a draft is no chapter: no member reads it in the timeline
    expect(await chapters()).toEqual([]);
    expect(((await anna('GET', base)).json() as { drafts: Draft[] }).drafts).toHaveLength(1);
  });

  it('is changed from the stand the device saw; another leader’s change in between is a 409 with the current draft; the same words change nothing', async () => {
    const { s, anna, base, body, put } = await table();
    const { id, res } = await put();
    const first = (res.json() as { draft: Draft }).draft;
    const again = await anna('PUT', `${base}/${id}`, body());
    expect((again.json() as { draft: Draft }).draft.seq).toBe(first.seq);
    const second = ((await anna('PUT', `${base}/${id}`, { ...body({ text: 'Zwei.' }), baseSeq: first.seq })).json() as { draft: Draft }).draft;
    expect(second.seq).toBeGreaterThan(first.seq);
    const stale = await anna('PUT', `${base}/${id}`, { ...body({ text: 'Drei.' }), baseSeq: first.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { text: 'Zwei.', seq: second.seq } });
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'chapter_draft.edit'").get()).toEqual({ n: 1 });
  });

  it('keeps to its shape and its limits', async () => {
    const { anna, base, body, put } = await table();
    const bad = (o: Record<string, unknown>) => anna('PUT', `${base}/${randomUUID()}`, body(o));
    expect((await bad({ refKey: 'Battle 1' })).statusCode).toBe(400);
    expect((await bad({ lang: 'fr' })).statusCode).toBe(400);
    expect((await bad({ title: '  ' })).statusCode).toBe(400);
    expect((await bad({ text: '' })).statusCode).toBe(400);
    expect((await bad({ text: 'x'.repeat(200_001) })).statusCode).toBe(400);
    expect((await bad({ extra: 1 })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/not a chapter draft/) });
    expect((await anna('PUT', `${base}/not-an-id`, body())).statusCode).toBe(400);
    expect((await put({ text: 'x'.repeat(200_000) })).res.statusCode).toBe(200);
  });

  it('publishes a new chapter at its place: everybody reads it, the draft is used up', async () => {
    const { anna, kai, vic, cid, base, put, list, chapters } = await table();
    const { id } = await put({ title: 'Das Rathaus', text: 'Das Rathaus stand noch.' });
    // a new chapter needs its place in the story
    const none = await anna('POST', `${base}/${id}/publish`, {});
    expect(none.statusCode).toBe(400);
    expect(none.json()).toMatchObject({ problem: 'a new chapter needs its place in the story' });
    expect((await anna('POST', `${base}/${id}/publish`, { at: { segment: 'nowhere', pos: '5' } })).statusCode).toBe(400);
    const r = await anna('POST', `${base}/${id}/publish`, { at: { segment: 'pre', pos: '5' }, publishedOn: '2026-10-16' });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { chapter: Chapter }).chapter).toMatchObject({ refKey: 'battle-1', kind: 'battle', de: { title: 'Das Rathaus' }, en: null });
    expect((await chapters(vic)).map((c) => c.refKey)).toEqual(['battle-1']);
    const [c] = await chapters(kai);
    const read = ((await kai('GET', `/campaigns/${cid}/chapters/${c!.id}`)).json() as { chapter: Chapter }).chapter;
    expect(read.de?.text).toBe('Das Rathaus stand noch.');
    expect(await list()).toEqual([]);
    // published twice, published once
    const again = await anna('POST', `${base}/${id}/publish`, { at: { segment: 'pre', pos: '5' } });
    expect(again.statusCode).toBe(200);
    expect(await chapters()).toHaveLength(1);
  });

  it('the other language of a published chapter goes into the same chapter and leaves the first as it is; the same language replaces it', async () => {
    const { s, anna, kai, cid, base, put, chapters } = await table();
    const de = await put({ lang: 'de', title: 'Das Rathaus', text: 'Das Rathaus stand noch.' });
    await anna('POST', `${base}/${de.id}/publish`, { at: { segment: 'pre', pos: '5' } });
    const en = await put({ lang: 'en', title: 'City Hall', text: 'The hall still stood.' });
    // the chapter is there: no place needed
    const merged = await anna('POST', `${base}/${en.id}/publish`, {});
    expect(merged.statusCode).toBe(200);
    const [c] = await chapters();
    expect(c).toMatchObject({ refKey: 'battle-1', de: { title: 'Das Rathaus' }, en: { title: 'City Hall' } });
    expect(await chapters()).toHaveLength(1);
    const read = ((await kai('GET', `/campaigns/${cid}/chapters/${c!.id}`)).json() as { chapter: Chapter }).chapter;
    expect(read.de?.text).toBe('Das Rathaus stand noch.');
    expect(read.en?.text).toBe('The hall still stood.');
    // a better German text replaces the German one
    const better = await put({ lang: 'de', title: 'Das Rathaus', text: 'Das Rathaus stand noch, wenn man es so nennen wollte.' });
    await anna('POST', `${base}/${better.id}/publish`, {});
    const after = ((await kai('GET', `/campaigns/${cid}/chapters/${c!.id}`)).json() as { chapter: Chapter }).chapter;
    expect(after.de?.text).toBe('Das Rathaus stand noch, wenn man es so nennen wollte.');
    expect(after.en?.text).toBe('The hall still stood.');
    expect(s.db.prepare("SELECT count(*) AS n FROM chapters WHERE deleted_at IS NULL").get()).toEqual({ n: 1 });
  });

  it('a draft is thrown away as a tombstone; a published one stays', async () => {
    const { anna, base, put, list } = await table();
    const a = await put();
    expect(((await anna('DELETE', `${base}/${a.id}`)).json() as { removed: boolean }).removed).toBe(true);
    expect(await list()).toEqual([]);
    expect(((await anna('DELETE', `${base}/${a.id}`)).json() as { removed: boolean }).removed).toBe(false);
    expect((await anna('PUT', `${base}/${a.id}`, { refKey: 'battle-1', kind: 'battle', lang: 'de', title: 'Neu', text: 'Neu', baseSeq: 1 })).statusCode).toBe(409);
    expect((await anna('POST', `${base}/${a.id}/publish`, { at: { segment: 'pre', pos: '5' } })).statusCode).toBe(404);
    const b = await put({ refKey: 'battle-2' });
    await anna('POST', `${base}/${b.id}/publish`, { at: { segment: 'pre', pos: '5' } });
    expect((await anna('DELETE', `${base}/${b.id}`)).statusCode).toBe(409);
    expect((await anna('DELETE', `${base}/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('is one list per campaign, held to a ceiling, and the log never carries a word of a draft', async () => {
    const { s, u, anna, base, put, list } = await table();
    const other = ((await s.call({ method: 'POST', url: '/api/v1/campaigns', body: { name: 'Summer in Sylvania' }, token: u.anna.session() })).json() as { campaign: { id: string } }).campaign.id;
    const { id } = await put({ text: 'ZEBRA: der Verrat im Nebel.', title: 'Der Verrat' });
    expect(((await anna('GET', `/campaigns/${other}/chapter-drafts`)).json() as { drafts: Draft[] }).drafts).toEqual([]);
    expect((await anna('PUT', `/campaigns/${other}/chapter-drafts/${id}`, { refKey: 'battle-1', kind: 'battle', lang: 'de', title: 'x', text: 'x' })).statusCode).toBe(409);
    await anna('POST', `${base}/${id}/publish`, { at: { segment: 'pre', pos: '5' } });
    const log = JSON.stringify(s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action LIKE 'chapter_draft.%'").all());
    expect(log).not.toMatch(/ZEBRA|Verrat/);
    expect(log).toMatch(/chapter_draft\.create/);
    expect(log).toMatch(/chapter_draft\.publish/);
    // the published one no longer counts: a hundred open drafts fit, the next one does not
    for (let i = 0; i < 100; i++) expect((await put({ refKey: `x-${i}`, kind: 'chapter' })).res.statusCode).toBe(200);
    const full = await put({ refKey: 'x-100', kind: 'chapter' });
    expect(full.res.statusCode).toBe(409);
    expect(full.res.json()).toMatchObject({ error: 'full' });
    expect(await list()).toHaveLength(100);
  });
});

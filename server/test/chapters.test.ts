/* The published chapters of the chronicle in the timeline (phase 4a5, part
   2): a leader imports them with both languages and their place in the
   story; every member reads them – the list without texts, a chapter with
   its text; a leader moves or takes them out. What is published is public
   (ADR 0002). */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db.ts';
import { loadMigrations, migrate } from '../src/migrations.ts';
import { startAccounts } from './accounts-helpers.ts';
import { clock } from './helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

const de = { label: 'Erste Schlacht', title: 'Das Urteil im Nebel', icDate: 'Frühes Jahr 2000 IC', place: 'Quayside, Mordheim', victor: 'Das Feld blieb den Reavers.', text: '### Am Kai\n\nNebel über dem Stir.' };
const en = { label: 'First Battle', title: 'The Verdict in the Fog', icDate: 'Early 2000 IC', place: 'Quayside, Mordheim', victor: 'The field stayed with the Reavers.', text: '### At the Quay\n\nFog over the Stir.' };

/** Anna leads (authenticator), Kai plays, Vic watches; one battle of the history. */
async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), vic = as(u.vic);
  const id = ((await anna('POST', '/campaigns', { name: 'The Lustria Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const b1 = randomUUID();
  await anna('PUT', `/campaigns/${id}/history/${b1}`, { round: 1, title: 'Das Urteil im Nebel', outcomes: { [w]: 'victory' } });
  const put = (who: typeof kai, chid: string, body: Record<string, unknown>) => who('PUT', `/campaigns/${id}/chapters/${chid}`, body);
  const timeline = async (who: typeof kai) => (await who('GET', `/campaigns/${id}/timeline`)).json() as {
    chapters: { id: string; refKey: string; kind: string; publishedOn: string | null; de: Record<string, unknown> | null; en: Record<string, unknown> | null }[];
    positions: { itemType: string; itemId: string; segment: string; pos: string }[];
  };
  return { s, id, b1, anna, kai, vic, put, timeline };
}

describe('the published chapters', () => {
  it('a leader imports a chapter with both languages and its place; every member reads it – listed without its text', async () => {
    const { s, id, b1, anna, kai, vic, put, timeline } = await world();
    const chid = randomUUID();
    const body = { refKey: 'battle-1', kind: 'battle', publishedOn: '2026-06-14', de, en, place: { segment: `b${b1}:battle`, pos: '001' } };
    expect((await put(kai, chid, body)).json()).toEqual({ error: 'forbidden' });
    expect((await put(vic, chid, body)).statusCode).toBe(403);
    const r = await put(anna, chid, body);
    expect(r.statusCode).toBe(200);
    expect((r.json() as { chapter: { de: Record<string, unknown> } }).chapter.de).toEqual({ label: 'Erste Schlacht', title: 'Das Urteil im Nebel', icDate: 'Frühes Jahr 2000 IC', place: 'Quayside, Mordheim', victor: 'Das Feld blieb den Reavers.', length: de.text.length });
    const t = await timeline(vic);
    expect(t.chapters).toEqual([expect.objectContaining({ id: chid, refKey: 'battle-1', kind: 'battle', publishedOn: '2026-06-14', de: expect.not.objectContaining({ text: expect.anything() }), en: expect.objectContaining({ title: 'The Verdict in the Fog', length: en.text.length }) })]);
    expect(t.positions).toEqual([expect.objectContaining({ itemType: 'chapter', itemId: chid, segment: `b${b1}:battle`, pos: '001' })]);
    expect((await vic('GET', `/campaigns/${id}/chapters/${chid}`)).json()).toMatchObject({ chapter: { de: { text: de.text }, en: { text: en.text } } });
    expect(s.db.prepare("SELECT action FROM audit_log WHERE campaign_id = ? AND action LIKE 'chapter.%'").all(id)).toEqual([{ action: 'chapter.import' }]);
  });

  it('imported anew under its id: the texts change, the place stays unless given; a ref is one chapter', async () => {
    const { id, anna, put, timeline } = await world();
    const chid = randomUUID();
    await put(anna, chid, { refKey: 'prolog', kind: 'prologue', de: { ...de, label: 'Prolog', title: 'Auf Flügeln aus Feuer' }, place: { segment: 'pre', pos: '5' } });
    expect((await put(anna, chid, { refKey: 'prolog', kind: 'prologue', de: { ...de, label: 'Prolog', title: 'Auf Flügeln aus Feuer', text: 'Neu.' }, en })).statusCode).toBe(200);
    expect((await anna('GET', `/campaigns/${id}/chapters/${chid}`)).json()).toMatchObject({ chapter: { de: { text: 'Neu.' }, en: { title: 'The Verdict in the Fog' } } });
    expect((await timeline(anna)).positions).toEqual([expect.objectContaining({ itemId: chid, segment: 'pre', pos: '5' })]);
    expect((await put(anna, randomUUID(), { refKey: 'prolog', kind: 'prologue', de, place: { segment: 'pre', pos: '7' } })).json()).toMatchObject({ error: 'exists' });
  });

  it('a leader moves a chapter in the timeline or takes it out; a player does neither', async () => {
    const { id, b1, anna, kai, put, timeline } = await world();
    const chid = randomUUID();
    await put(anna, chid, { refKey: 'interlude-1', kind: 'interlude', de: { ...de, label: 'Zwischenspiel', title: 'Der Nebel hebt sich' }, place: { segment: 'i1', pos: '5' } });
    expect((await kai('PUT', `/campaigns/${id}/timeline/chapter/${chid}`, { segment: `b${b1}:battle`, pos: '9' })).json()).toEqual({ error: 'forbidden' });
    expect((await anna('PUT', `/campaigns/${id}/timeline/chapter/${chid}`, { segment: `b${b1}:battle`, pos: '9' })).statusCode).toBe(200);
    expect((await timeline(kai)).positions).toEqual([expect.objectContaining({ itemType: 'chapter', segment: `b${b1}:battle`, pos: '9' })]);
    expect((await kai('DELETE', `/campaigns/${id}/chapters/${chid}`)).statusCode).toBe(403);
    expect((await anna('DELETE', `/campaigns/${id}/chapters/${chid}`)).json()).toEqual({ removed: true });
    const t = await timeline(kai);
    expect([t.chapters, t.positions]).toEqual([[], []]);
    expect((await kai('GET', `/campaigns/${id}/chapters/${chid}`)).statusCode).toBe(404);
    expect((await anna('DELETE', `/campaigns/${id}/chapters/${chid}`)).statusCode).toBe(404);
    // the ref is free again, the id is spent
    expect((await put(anna, randomUUID(), { refKey: 'interlude-1', kind: 'interlude', de, place: { segment: 'i1', pos: '5' } })).statusCode).toBe(200);
    expect((await put(anna, chid, { refKey: 'interlude-2', kind: 'interlude', de, place: { segment: 'i1', pos: '7' } })).json()).toMatchObject({ error: 'exists' });
  });

  it('refuses what is not a chapter, or not a place in this story', async () => {
    const { anna, put } = await world();
    const ok = { refKey: 'battle-2', kind: 'battle', de, place: { segment: 'pre', pos: '5' } };
    for (const body of [
      { ...ok, de: null },
      { ...ok, refKey: 'Battle 2' },
      { ...ok, kind: 'epilogue' },
      { ...ok, de: { ...de, title: '' } },
      { ...ok, de: { ...de, text: 'x'.repeat(200_001) } },
      { ...ok, de: { ...de, script: '<b>' } },
      { ...ok, publishedOn: 'June' },
      { ...ok, place: undefined },
      { ...ok, place: { segment: 'elsewhere', pos: '5' } },
      { ...ok, place: { segment: 'pre', pos: '50' } },
      { ...ok, place: { segment: `b${randomUUID()}:battle`, pos: '5' } },
    ]) expect((await put(anna, randomUUID(), body)).statusCode, JSON.stringify(body).slice(0, 80)).toBe(400);
    expect((await put(anna, 'not-a-uuid', ok)).statusCode).toBe(400);
  });

  it('the places blocks were moved to survive the migration that lets chapters in', () => {
    const db = openDb(':memory:');
    const all = loadMigrations();
    migrate(db, all.filter((m) => m.version < 12), clock().now);
    const at = '2026-10-09T10:00:00.000Z';
    db.prepare("INSERT INTO users (id, username, display_name, pw_hash, created_at) VALUES ('u1', 'anna', 'Anna', 'x', ?)").run(at);
    db.prepare("INSERT INTO campaigns (id, name, created_by, created_at, updated_at) VALUES ('c1', 'The Lustria Campaign', 'u1', ?, ?)").run(at, at);
    db.prepare("INSERT INTO timeline_positions (campaign_id, item_type, item_id, segment, pos, turn, moved_by, moved_at, seq) VALUES ('c1', 'note', 'n1', 'pre', '5', NULL, 'u1', ?, 7)").run(at);
    migrate(db, all, clock().now);
    expect(db.prepare('SELECT * FROM timeline_positions').all()).toEqual([{ campaign_id: 'c1', item_type: 'note', item_id: 'n1', segment: 'pre', pos: '5', turn: null, moved_by: 'u1', moved_at: at, seq: 7 }]);
    db.prepare("INSERT INTO timeline_positions (campaign_id, item_type, item_id, segment, pos, moved_by, moved_at, seq) VALUES ('c1', 'chapter', 'ch1', 'pre', '7', 'u1', ?, 8)").run(at);
    expect(() => db.prepare("INSERT INTO timeline_positions (campaign_id, item_type, item_id, segment, pos, moved_by, moved_at, seq) VALUES ('c1', 'tag', 't1', 'pre', '5', 'u1', ?, 9)").run(at)).toThrow(/CHECK/);
  });
});

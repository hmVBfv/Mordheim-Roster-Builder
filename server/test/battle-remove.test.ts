/* A leader takes an open battle out again (a battle made by mistake): its own
   protocol and corrections go with it, what other things hang on it holds it
   back, and the same battle sent a second time from a device does not come
   back. The warbands' versions stay as they are (ADR 0003). */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

/** Anna leads, Kai plays with one confirmed warband, Vic watches, Rob (the admin) is outside; one open battle with a protocol entry. */
async function open() {
  const s = await startAccounts();
  const users = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (u: { session: () => string }) => {
    const token = u.session();
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(users.anna), kai = as(users.kai), vic = as(users.vic), rob = as(users.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${users.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${users.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  const e = (await kai('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: { ...SAVE, name: 'The Silver Caravan' } })).json() as { enrolmentId: string };
  await anna('POST', `/campaigns/${id}/enrolments/${e.enrolmentId}/confirm`);
  const bid = randomUUID();
  expect((await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Made by mistake', warbandIds: [w] })).statusCode).toBe(201);
  const eid = randomUUID();
  expect((await anna('PUT', `/campaigns/${id}/battles/${bid}/protocol/${eid}`, { turn: 1, kind: 'event', payload: { text: 'The ferry drifts.' } })).statusCode).toBeLessThan(300);
  return { s, id, anna, kai, vic, rob, w, bid, eid, url: `/campaigns/${id}/battles/${bid}` };
}

describe('taking an open battle out', () => {
  it('a leader removes it, with its protocol; the warband’s versions stay', async () => {
    const { s, id, anna, kai, bid, url, w } = await open();
    const before = (await kai('GET', `/campaigns/${id}`)).json() as { battles: { id: string }[] };
    expect(before.battles.map((b) => b.id)).toEqual([bid]);

    const r = await anna('DELETE', url);
    expect(r.statusCode).toBe(200);
    expect((await anna('GET', url)).statusCode).toBe(404);
    expect(((await kai('GET', `/campaigns/${id}/battles`)).json() as { battles: unknown[] }).battles).toEqual([]);
    expect((await kai('GET', `/campaigns/${id}`)).json()).toMatchObject({ battles: [] });
    // the warband and its versions are untouched
    expect((await kai('GET', `/warbands/${w}`)).statusCode).toBe(200);
    expect((await kai('GET', `/warbands/${w}/versions/1`)).statusCode).toBe(200);
    // the log says who took it out, for everyone to read
    expect(s.db.prepare("SELECT action, visibility FROM audit_log WHERE campaign_id = ? AND action = 'battle.remove'").all(id)).toEqual([{ action: 'battle.remove', visibility: 'public' }]);
  });

  it('only a leader; nobody outside the campaign; a battle that is closed is refused', async () => {
    const { id, anna, kai, vic, rob, url, bid } = await open();
    expect((await kai('DELETE', url)).json()).toEqual({ error: 'forbidden' });
    expect((await vic('DELETE', url)).json()).toEqual({ error: 'forbidden' });
    expect((await rob('DELETE', url)).statusCode).toBe(404);
    expect((await anna('GET', url)).statusCode).toBe(200);

    expect((await anna('POST', `${url}/close`)).statusCode).toBe(200);
    expect((await anna('DELETE', url)).json()).toMatchObject({ error: 'closed' });
    expect(((await kai('GET', `/campaigns/${id}/battles`)).json() as { battles: { id: string }[] }).battles.map((b) => b.id)).toEqual([bid]);
  });

  it('what hangs on it holds it back: a note does, until it is taken out itself', async () => {
    const { id, anna, url, bid } = await open();
    const nid = randomUUID();
    expect((await anna('PUT', `/campaigns/${id}/notes/${nid}`, { battleId: bid, text: 'Remember the ferryman.' })).statusCode).toBeLessThan(300);
    const refused = await anna('DELETE', url);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'in_use' });
    expect((await anna('GET', url)).statusCode).toBe(200);

    expect((await anna('DELETE', `/campaigns/${id}/notes/${nid}`)).statusCode).toBeLessThan(300);
    expect((await anna('DELETE', url)).statusCode).toBe(200);
  });

  it('sent again from a device, the same battle does not come back; a new one can be made', async () => {
    const { id, anna, w, bid, url } = await open();
    expect((await anna('DELETE', url)).statusCode).toBe(200);
    const again = await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Made by mistake', warbandIds: [w] });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'removed' });
    expect((await anna('GET', url)).statusCode).toBe(404);
    // taken out twice (the answer was lost): nothing there any more
    expect((await anna('DELETE', url)).statusCode).toBe(404);
    expect((await anna('POST', `/campaigns/${id}/battles`, { id: randomUUID(), title: 'On purpose', warbandIds: [w] })).statusCode).toBe(201);
  });

  describe('with everything written for it (reports #34 and #35)', () => {
    /** Notes of three kinds, a question and a background entry hang on the open battle; the log is read for words afterwards. */
    async function written() {
      const w = await open();
      const { id, anna, kai, bid, s } = w;
      const pub = randomUUID(), sealed = randomUUID(), gm = randomUUID(), q = randomUUID(), bg = randomUUID();
      await kai('PUT', `/campaigns/${id}/notes/${pub}`, { battleId: bid, text: 'Secret words of the ferryman.' });
      await kai('PUT', `/campaigns/${id}/notes/${sealed}`, { battleId: bid, text: 'A sealed plan.', visibility: 'sealed' });
      await anna('PUT', `/campaigns/${id}/notes/${gm}`, { battleId: bid, text: 'Leader only.', visibility: 'leader' });
      await anna('PUT', `/campaigns/${id}/background/${bg}`, { kind: 'gm_note', title: 'The ferry plot', truth: 'The ferryman sells them.', battleId: bid });
      const qr = await anna('PUT', `/campaigns/${id}/questions/${q}`, { to: (s.db.prepare('SELECT user_id FROM members WHERE campaign_id = ? AND role = ?').get(id, 'player') as { user_id: string }).user_id, battleId: bid, text: 'Who rows the boat?' });
      expect(qr.statusCode, qr.body).toBeLessThan(300);
      return { ...w, pub, sealed, gm, bg, q };
    }

    it('a leader takes the battle out with its notes, sealed ones included; their words are gone from the database', async () => {
      const { s, id, anna, kai, url, pub, sealed, gm, bg, q, bid } = await written();
      expect((await anna('DELETE', url)).statusCode).toBe(409);
      expect((await kai('DELETE', `${url}?content=1`)).json()).toEqual({ error: 'forbidden' });
      expect((await anna('DELETE', `${url}?content=1`)).statusCode).toBe(200);
      expect((await anna('GET', url)).statusCode).toBe(404);
      for (const n of [pub, sealed, gm]) {
        expect(s.db.prepare('SELECT text, mentions, deleted_at IS NOT NULL AS gone, battle_id FROM notes WHERE id = ?').get(n)).toEqual({ text: '', mentions: '[]', gone: 1, battle_id: null });
      }
      expect(s.db.prepare('SELECT count(*) AS n FROM note_revisions WHERE note_id IN (?, ?, ?)').get(pub, sealed, gm)).toEqual({ n: 0 });
      expect(s.db.prepare('SELECT title, truth, deleted_at IS NOT NULL AS gone FROM background_entries WHERE id = ?').get(bg)).toEqual({ title: '', truth: '', gone: 1 });
      expect(s.db.prepare('SELECT text, status FROM questions WHERE id = ?').get(q)).toEqual({ text: '', status: 'withdrawn' });
      // the notes are no longer listed to anybody; the log names no words
      const listed = ((await kai('GET', `/campaigns/${id}/notes`)).json() as { notes: { id: string }[] }).notes.map((n) => n.id);
      expect(listed).not.toContain(pub);
      const log = JSON.stringify(s.db.prepare('SELECT action, payload FROM audit_log WHERE campaign_id = ?').all(id));
      expect(log).not.toContain('ferryman');
      expect(log).not.toContain('sealed plan');
      expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'battle.remove' AND target_id = ?").get(bid)).toEqual({ n: 1 });
    });

    it('an entry that is revealed from this battle on holds it back, content or not: it would be shown at once', async () => {
      const { s, id, anna, url } = await open();
      const bid = (s.db.prepare('SELECT id FROM battles WHERE campaign_id = ?').get(id) as { id: string }).id;
      const bg = randomUUID();
      const put = await anna('PUT', `/campaigns/${id}/background/${bg}`, { kind: 'thread', title: 'Dark thread', truth: 'Hidden.', reveal: 'revealed', revealFromBattle: bid });
      expect(put.statusCode, put.body).toBeLessThan(300);
      for (const q of ['', '?content=1']) expect((await anna('DELETE', `${url}${q}`)).json()).toMatchObject({ error: 'waits' });
      expect((await anna('GET', url)).statusCode).toBe(200);
    });

    it('a closed battle stays, with or without its content', async () => {
      const { anna, url } = await written();
      expect((await anna('POST', `${url}/close`)).statusCode).toBe(200);
      expect((await anna('DELETE', `${url}?content=1`)).json()).toMatchObject({ error: 'closed' });
    });
  });
});

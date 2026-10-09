/* Notes (phase 4a3): one author each, written with the device's id; what
   the one who asks may read is decided on the server (ADR 0011) – a sealed
   note is its author's alone until its battle is closed, the leader and
   the admin included; a leaders' note never reaches a player. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Note = { id: string; text?: string; kind?: string; sealed?: true; opened?: boolean; visibility: string; edited?: boolean; mentions?: unknown; author: string };

/** Anna leads (authenticator), Ben leads without one, Kai plays, Vic watches, Rob (admin) is outside; one open battle. */
async function world() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), vic = as(u.vic), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const notes = async (who: typeof kai) => ((await who('GET', `/campaigns/${id}/notes`)).json() as { notes: Note[] }).notes;
  return { s, u, id, bid, w, anna, ben, kai, vic, rob, notes, url: (nid: string) => `/campaigns/${id}/notes/${nid}` };
}

describe('a note', () => {
  it('every member reads it; its author changes it, the earlier wording kept; a viewer only reads; nobody outside', async () => {
    const { s, id, bid, w, kai, vic, rob, notes, url } = await world();
    const n = randomUUID();
    const body = { battleId: bid, turn: 3, kind: 'quote', text: 'Bolt the doors. Whatever knocks tonight is not a customer.', mentions: [{ warbandId: w, uid: 1, name: 'Ulrich the Grey' }] };
    expect((await kai('PUT', url(n), body)).json()).toMatchObject({ note: { id: n, kind: 'quote', author: 'kai', visibility: 'public', edited: false } });
    // sent twice: there once
    await kai('PUT', url(n), body);
    expect(await notes(vic)).toMatchObject([{ id: n, text: body.text, mentions: [{ name: 'Ulrich the Grey' }] }]);
    expect((await rob('GET', `/campaigns/${id}/notes`)).statusCode).toBe(404);
    expect((await vic('PUT', url(randomUUID()), { text: 'Me too' })).json()).toEqual({ error: 'forbidden' });

    await kai('PUT', url(n), { ...body, text: 'Bolt the doors.' });
    expect(await notes(vic)).toMatchObject([{ text: 'Bolt the doors.', edited: true }]);
    expect(s.db.prepare('SELECT text FROM note_revisions WHERE note_id = ?').all(n)).toEqual([{ text: body.text }]);
    // a device that has seen it asks only for news
    const { seq } = (await kai('GET', `/campaigns/${id}/notes`)).json() as { seq: number };
    expect((await vic('GET', `/campaigns/${id}/notes?since=${seq}`)).json()).toEqual({ unchanged: true, seq });

    expect((await kai('DELETE', url(n))).json()).toMatchObject({ removed: true });
    expect(await notes(vic)).toEqual([]);
    expect((await kai('PUT', url(n), body)).json()).toEqual({ error: 'removed' });
  });

  it('what a note says and where it hangs is checked', async () => {
    const { anna, kai, bid, url } = await world();
    const other = ((await anna('POST', '/campaigns', { name: 'Elsewhere' })).json() as { campaign: { id: string } }).campaign.id;
    const w2 = randomUUID();
    await anna('POST', `/campaigns/${other}/enrolments`, { warbandId: w2, data: SAVE });
    const otherBattle = randomUUID();
    await anna('POST', `/campaigns/${other}/battles`, { id: otherBattle, warbandIds: [w2] });
    for (const bad of [{ text: '   ' }, { text: 'x', kind: 'rumour' }, { text: 'x', battleId: otherBattle }, { text: 'x', battleId: bid, protocolEntryId: randomUUID() }, { text: 'x', mentions: [{ name: 'Nobody' }] }, { text: 'x'.repeat(20_001) }]) {
      expect((await kai('PUT', url(randomUUID()), bad)).statusCode).toBe(400);
    }
    expect((await kai('PUT', `/campaigns/${other}/notes/${randomUUID()}`, { text: 'x' })).statusCode).toBe(404);
    expect((await kai('PUT', url('not-an-id'), { text: 'x' })).statusCode).toBe(400);
  });
});

describe('sealed', () => {
  it('its author alone reads it until the battle is closed – not the leader, not the admin; then everyone', async () => {
    const { s, bid, w, anna, ben, kai, vic, notes, url } = await world();
    const n = randomUUID();
    await kai('PUT', url(n), { battleId: bid, kind: 'scene', text: 'Skritch goes for the captain. Whatever it costs.', visibility: 'sealed', mentions: [{ warbandId: w, uid: 1, name: 'Ulrich the Grey' }] });
    expect(await notes(kai)).toMatchObject([{ id: n, text: 'Skritch goes for the captain. Whatever it costs.', visibility: 'sealed', opened: false }]);
    for (const who of [anna, ben, vic]) {
      const [p] = await notes(who);
      expect(p).toEqual({ id: n, battleId: bid, authorId: expect.any(String), author: 'kai', visibility: 'sealed', sealedUntil: bid, sealed: true, createdAt: expect.any(String) });
      expect(JSON.stringify(p)).not.toMatch(/Skritch|Ulrich|scene/);
    }
    // nobody but the author changes or removes it before it opens
    expect((await anna('PUT', url(n), { battleId: bid, text: 'Changed' })).statusCode).toBe(403);
    expect((await anna('DELETE', url(n))).statusCode).toBe(403);
    // the audit log carries no words of it
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log WHERE target_id = ?').all(n))).not.toMatch(/Skritch/);

    s.db.prepare("UPDATE battles SET status = 'closed' WHERE id = ?").run(bid);
    expect(await notes(vic)).toMatchObject([{ id: n, text: 'Skritch goes for the captain. Whatever it costs.', opened: true }]);
    // opened, it stays open; and no note is sealed for a closed battle
    expect((await kai('PUT', url(n), { battleId: bid, text: 'Skritch goes for the captain.', visibility: 'public' })).json()).toEqual({ error: 'opened' });
    expect((await kai('PUT', url(randomUUID()), { battleId: bid, text: 'Too late', visibility: 'sealed' })).statusCode).toBe(400);
  });
});

describe('leaders only', () => {
  it('a leader with the authenticator writes and reads them; players and viewers never get them', async () => {
    const { bid, anna, ben, kai, vic, notes, url } = await world();
    const n = randomUUID();
    expect((await anna('PUT', url(n), { battleId: bid, text: 'The ferryman is in the Countess’s pay.', visibility: 'leader' })).statusCode).toBe(200);
    expect(await notes(anna)).toMatchObject([{ id: n, visibility: 'leader' }]);
    for (const who of [kai, vic, ben]) expect(await notes(who)).toEqual([]);
    expect((await kai('PUT', url(randomUUID()), { text: 'For the leader', visibility: 'leader' })).json()).toEqual({ error: 'forbidden' });
    expect((await kai('DELETE', url(n))).statusCode).toBe(404);
  });

  it('a leader corrects another’s words (logged, the earlier kept) and takes a note out; who may read it stays the author’s', async () => {
    const { s, bid, anna, kai, notes, url } = await world();
    const n = randomUUID();
    await kai('PUT', url(n), { battleId: bid, text: 'Magda falls in turn 4.' });
    await anna('PUT', url(n), { battleId: bid, text: 'Magda falls in turn 3.', visibility: 'leader' });
    expect(await notes(kai)).toMatchObject([{ text: 'Magda falls in turn 3.', visibility: 'public', author: 'kai', edited: true }]);
    expect(s.db.prepare("SELECT action FROM audit_log WHERE action LIKE 'note.%' ORDER BY seq").all()).toEqual([{ action: 'note.create' }, { action: 'note.edit_other' }]);
    expect((await anna('DELETE', url(n))).json()).toMatchObject({ removed: true });
    expect(await notes(kai)).toEqual([]);
  });
});

/* The background (phase 4b1): the leaders' side of the story. Only a leader
   with the authenticator reads or writes it; nothing of it reaches a player,
   a viewer or an admin outside the campaign – not in any list, not in the
   log. A reveal turns the words the leader wrote into a public note and
   raises the entry's level; the truth stays hidden. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const TRUTH = 'ZEBRA-TRUTH: the Countess pays the ferrymen.';
type Entry = { id: string; title: string; truth: string; playersKnow: string; reveal: string; revealFromBattle: string | null; seq: number; lastReveal: { by: string; noteId: string; level: string } | null };

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
  const bg = `/campaigns/${id}/background`;
  const make = async (over: Record<string, unknown> = {}) => {
    const eid = randomUUID();
    const r = await anna('PUT', `${bg}/${eid}`, { kind: 'thread', title: 'Who pays the ferryman?', truth: TRUTH, status: 'active', reveal: 'hint', hintLimits: 'Traces yes – the name never.', ...over });
    return { eid, r, entry: (r.json() as { entry: Entry }).entry };
  };
  return { s, u, id, bid, w, anna, ben, kai, vic, rob, bg, make };
}

describe('the background', () => {
  it('only a leader with the authenticator reads or writes it; an outsider does not even know the campaign', async () => {
    const { anna, ben, kai, vic, rob, bg, make } = await world();
    const { eid, r } = await make();
    expect(r.statusCode).toBe(200);
    for (const who of [ben, kai, vic]) {
      expect((await who('GET', bg)).json()).toEqual({ error: 'forbidden' });
      expect((await who('GET', `${bg}/${eid}`)).statusCode).toBe(403);
      expect((await who('PUT', `${bg}/${randomUUID()}`, { kind: 'thread', title: 'Me too' })).statusCode).toBe(403);
      expect((await who('DELETE', `${bg}/${eid}`)).statusCode).toBe(403);
      expect((await who('POST', `${bg}/${eid}/reveal`, { noteId: randomUUID(), text: 'x', level: 'hint' })).statusCode).toBe(403);
    }
    expect((await rob('GET', bg)).statusCode).toBe(404);
    expect((await rob('PUT', `${bg}/${randomUUID()}`, { kind: 'thread', title: 'Me too' })).statusCode).toBe(404);
    expect(((await anna('GET', bg)).json() as { entries: Entry[] }).entries).toMatchObject([{ id: eid, truth: TRUTH, reveal: 'hint' }]);
  });

  it('an entry is made under the device’s id, changed with its earlier wording kept, and a second leader who was not up to date is told so', async () => {
    const { s, anna, bg, make } = await world();
    const { eid, entry } = await make();
    // sent twice: there once
    expect((await anna('PUT', `${bg}/${eid}`, { kind: 'thread', title: entry.title, truth: TRUTH, status: 'active', reveal: 'hint', hintLimits: 'Traces yes – the name never.' })).statusCode).toBe(200);
    expect(s.db.prepare('SELECT count(*) AS n FROM background_entries').get()).toEqual({ n: 1 });

    const edit = { kind: 'thread', title: 'Who pays the ferryman?', truth: `${TRUTH} She wants the wyrdstone.`, status: 'active', reveal: 'hint', hintLimits: 'Traces yes – the name never.' };
    const done = (await anna('PUT', `${bg}/${eid}`, { ...edit, baseSeq: entry.seq })).json() as { entry: Entry };
    expect(done.entry.truth).toContain('wyrdstone');
    expect(done.entry.seq).toBeGreaterThan(entry.seq);
    // the earlier wording is kept
    const one = (await anna('GET', `${bg}/${eid}`)).json() as { revisions: { snapshot: { truth: string } }[] };
    expect(one.revisions).toMatchObject([{ snapshot: { truth: TRUTH } }]);
    // someone edited from the older state: refused, with what stands now
    const stale = await anna('PUT', `${bg}/${eid}`, { ...edit, title: 'Other', baseSeq: entry.seq });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'stale', current: { title: 'Who pays the ferryman?' } });
  });

  it('what is said and where it hangs is checked; taking an entry out leaves a tombstone', async () => {
    const { s, anna, bg, make } = await world();
    expect((await anna('PUT', `${bg}/not-an-id`, { kind: 'thread', title: 'x' })).statusCode).toBe(400);
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'thread', title: '' })).statusCode).toBe(400);
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'saga', title: 'x' })).statusCode).toBe(400);
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'thread', title: 'x', surprise: 1 })).statusCode).toBe(400);
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'thread', title: 'x', truth: 'x'.repeat(20_001) })).statusCode).toBe(400);
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'gm_note', title: 'x', battleId: randomUUID() })).json()).toMatchObject({ error: 'invalid' });
    // a battle of another campaign is no battle here
    const other = ((await anna('POST', '/campaigns', { name: 'Elsewhere' })).json() as { campaign: { id: string } }).campaign.id;
    const ob = randomUUID();
    await anna('POST', `/campaigns/${other}/battles`, { id: ob, title: 'Elsewhere' });
    expect((await anna('PUT', `${bg}/${randomUUID()}`, { kind: 'gm_note', title: 'x', battleId: ob })).json()).toMatchObject({ error: 'invalid' });

    const { eid } = await make();
    const { seq: before } = (await anna('GET', bg)).json() as { seq: number };
    expect((await anna('DELETE', `${bg}/${eid}`)).json()).toMatchObject({ removed: true });
    expect(((await anna('GET', bg)).json() as { entries: Entry[] }).entries).toEqual([]);
    // a device that has seen the entry learns that something changed
    expect((await anna('GET', `${bg}?since=${before}`)).json()).toMatchObject({ entries: [] });
    expect((await anna('GET', `${bg}/${eid}`)).statusCode).toBe(404);
    expect((await anna('PUT', `${bg}/${eid}`, { kind: 'thread', title: 'back' })).json()).toEqual({ error: 'removed' });
    expect(s.db.prepare('SELECT count(*) AS n FROM background_revisions WHERE entry_id = ?').get(eid)).toEqual({ n: 1 });
  });

  it('nothing of it reaches anyone else: not in any list a player reads, not in the admin’s log', async () => {
    const { id, bid, anna, kai, vic, rob, bg, make } = await world();
    await make({ title: 'ZEBRA-TITLE', playersKnow: 'ZEBRA-KNOW' });
    await make({ kind: 'gm_note', title: 'ZEBRA-GM', battleId: bid });
    const urls = [`/campaigns/${id}`, `/campaigns/${id}/battles`, `/campaigns/${id}/battles/${bid}`, `/campaigns/${id}/notes`, `/campaigns/${id}/attachments`, `/campaigns/${id}/timeline`, '/campaigns', '/sync'];
    for (const who of [kai, vic]) for (const url of urls) {
      const res = await who('GET', url);
      expect(res.body, `${url}`).not.toMatch(/ZEBRA/);
    }
    // the admin’s log lists that something changed in a campaign, never what it said
    const audit = (await rob('GET', '/admin/audit?limit=200')).body;
    expect(audit).not.toMatch(/ZEBRA/);
    expect(audit).not.toMatch(/background\./);
    // the leader’s own list does
    expect((await anna('GET', bg)).body).toMatch(/ZEBRA-TRUTH/);
  });

  it('a reveal makes a public note of the words given, places it, and raises the level; the truth stays hidden', async () => {
    const { s, id, bid, anna, kai, vic, bg, make } = await world();
    const { eid, entry } = await make({ playersKnow: 'Skritch was paid in advance.' });
    const noteId = randomUUID();
    const body = { noteId, text: 'The ferryman did not come back. Someone had paid him not to.', battleId: bid, place: { segment: `b${bid}:after`, pos: '5' }, level: 'hint' };
    const r = (await anna('POST', `${bg}/${eid}/reveal`, body)).json() as { entry: Entry; note: string };
    expect(r.note).toBe(noteId);
    expect(r.entry).toMatchObject({ reveal: 'hint', truth: TRUTH, lastReveal: { noteId, level: 'hint' } });
    expect(r.entry.playersKnow).toBe('Skritch was paid in advance.\n\nThe ferryman did not come back. Someone had paid him not to.');
    // sent twice: revealed once
    await anna('POST', `${bg}/${eid}/reveal`, body);
    expect(s.db.prepare('SELECT count(*) AS n FROM background_reveals').get()).toEqual({ n: 1 });
    expect(s.db.prepare('SELECT count(*) AS n FROM notes').get()).toEqual({ n: 1 });
    // everyone reads the note, at its place; nobody reads the truth
    for (const who of [kai, vic]) {
      const notes = (await who('GET', `/campaigns/${id}/notes`)).json() as { notes: { id: string; text: string; visibility: string; author: string }[] };
      expect(notes.notes).toMatchObject([{ id: noteId, text: body.text, visibility: 'public', author: 'anna' }]);
      const tl = (await who('GET', `/campaigns/${id}/timeline`)).json() as { positions: { itemId: string; segment: string }[] };
      expect(tl.positions).toMatchObject([{ itemId: noteId, segment: `b${bid}:after` }]);
      expect((await who('GET', `/campaigns/${id}/notes`)).body).not.toMatch(/ZEBRA/);
    }
    // up to "revealed": public from that battle on
    const full = (await anna('POST', `${bg}/${eid}/reveal`, { noteId: randomUUID(), text: 'It was the Countess.', battleId: bid, level: 'revealed' })).json() as { entry: Entry };
    expect(full.entry).toMatchObject({ reveal: 'revealed', revealFromBattle: bid });
    expect(entry.seq).toBeLessThan(full.entry.seq);
    const detail = (await anna('GET', `${bg}/${eid}`)).json() as { reveals: unknown[]; revisions: unknown[] };
    expect(detail.reveals).toHaveLength(2);
    expect(detail.revisions).toHaveLength(2);
  });

  it('a reveal that cannot be placed changes nothing', async () => {
    const { s, anna, bg, make } = await world();
    const { eid } = await make();
    const bad = await anna('POST', `${bg}/${eid}/reveal`, { noteId: randomUUID(), text: 'x', place: { segment: 'nowhere', pos: '5' }, level: 'hint' });
    expect(bad.statusCode).toBe(400);
    expect(await anna('POST', `${bg}/${eid}/reveal`, { noteId: randomUUID(), text: '', level: 'hint' }).then((x) => x.statusCode)).toBe(400);
    expect(await anna('POST', `${bg}/${eid}/reveal`, { noteId: randomUUID(), text: 'x', level: 'hidden' }).then((x) => x.statusCode)).toBe(400);
    expect(await anna('POST', `${bg}/${randomUUID()}/reveal`, { noteId: randomUUID(), text: 'x', level: 'hint' }).then((x) => x.statusCode)).toBe(404);
    expect(s.db.prepare('SELECT count(*) AS n FROM notes').get()).toEqual({ n: 0 });
    expect(s.db.prepare('SELECT count(*) AS n FROM background_reveals').get()).toEqual({ n: 0 });
  });
});

describe('view as player', () => {
  it('a leader sees notes, pictures and positions as a player would – not even the own sealed or leaders’ notes', async () => {
    const { id, bid, anna, kai } = await world();
    const note = (text: string, visibility: string) => anna('PUT', `/campaigns/${id}/notes/${randomUUID()}`, { battleId: bid, text, visibility });
    await note('Open words', 'public');
    await note('SEALED-WORDS', 'sealed');
    await note('LEADER-WORDS', 'leader');
    const words = async (who: typeof anna, q = '') => (await who('GET', `/campaigns/${id}/notes${q}`)).body;
    const plain = await words(anna);
    expect(plain).toMatch(/SEALED-WORDS/);
    expect(plain).toMatch(/LEADER-WORDS/);
    const asPlayer = await words(anna, '?as=player');
    expect(asPlayer).toMatch(/Open words/);
    expect(asPlayer).not.toMatch(/SEALED-WORDS|LEADER-WORDS/);
    expect(JSON.parse(asPlayer).notes).toHaveLength(2); // the sealed one as a placeholder
    // asking "since" does not turn it into "unchanged": a view as player is always the whole list
    const { seq } = JSON.parse(asPlayer) as { seq: number };
    expect(JSON.parse(await words(anna, `?as=player&since=${seq}`)).notes).toHaveLength(2);
    // a player asking the same gets what a player gets
    expect(await words(kai, '?as=player')).toBe(await words(kai));
    expect((await anna('GET', `/campaigns/${id}/attachments?as=player`)).json()).toMatchObject({ attachments: [] });
    expect((await anna('GET', `/campaigns/${id}/timeline?as=player`)).statusCode).toBe(200);
    expect((await anna('GET', `/campaigns/${id}/notes?as=nobody`)).statusCode).toBe(400);
  });
});

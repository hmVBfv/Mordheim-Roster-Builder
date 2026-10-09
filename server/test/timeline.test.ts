/* The timeline's order (phase 4a3, part 2; concept.md 4.7): every member
   reads the protocol of every battle and the marks; a moved block's place
   only reaches who may see the block (ADR 0011). Each one moves their own
   blocks, a leader all – the protocol only a leader, a sealed note only its
   author until it opens; every move is logged. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

/** Anna leads (authenticator), Kai plays, Vic watches; a battle with a protocol entry; notes of each kind. */
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
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const entry = randomUUID();
  await anna('PUT', `/campaigns/${id}/battles/${bid}/protocol/${entry}`, { turn: 2, kind: 'event', payload: { text: 'The ferry burns.' } });
  const note = async (who: typeof kai, body: Record<string, unknown>) => { const nid = randomUUID(); await who('PUT', `/campaigns/${id}/notes/${nid}`, body); return nid; };
  const kais = await note(kai, { battleId: bid, text: 'Rain over the Stir.' });
  const sealed = await note(kai, { battleId: bid, text: 'Skritch goes for the captain.', visibility: 'sealed' });
  const secret = await note(anna, { battleId: bid, text: 'The ferryman is paid.', visibility: 'leader' });
  const move = (who: typeof kai, type: string, itemId: string, segment = `b${bid}:before`, pos = '5') => who('PUT', `/campaigns/${id}/timeline/${type}/${itemId}`, { segment, pos });
  const timeline = async (who: typeof kai) => (await who('GET', `/campaigns/${id}/timeline`)).json() as { positions: { itemId: string; segment: string; pos: string }[]; entries: { id: string; battleId: string; turn: number }[]; marks: { warbandId: string; kind: string }[] };
  return { s, id, bid, w, entry, kais, sealed, secret, anna, kai, vic, move, timeline };
}

describe('the timeline', () => {
  it('every member reads the protocol of every battle and the marks', async () => {
    const { bid, w, entry, vic, timeline } = await world();
    expect(await timeline(vic)).toMatchObject({ positions: [], entries: [{ id: entry, battleId: bid, turn: 2 }], outcomes: [{ battleId: bid, warbandId: w, outcome: '' }], marks: [{ warbandId: w, kind: 'start' }] });
  });

  it('each moves their own blocks, a leader all; the protocol only a leader; every move logged', async () => {
    const { s, id, bid, entry, kais, anna, kai, vic, move, timeline } = await world();
    expect((await move(kai, 'note', kais)).json()).toMatchObject({ position: { itemType: 'note', itemId: kais, segment: `b${bid}:before`, pos: '5' } });
    expect(await timeline(vic)).toMatchObject({ positions: [{ itemId: kais, segment: `b${bid}:before`, pos: '5' }] });
    // moved again: one place
    await move(kai, 'note', kais, 'i1', '25');
    expect((await timeline(kai)).positions).toEqual([expect.objectContaining({ itemId: kais, segment: 'i1', pos: '25' })]);
    expect((await move(kai, 'entry', entry)).json()).toEqual({ error: 'forbidden' });
    expect((await move(anna, 'entry', entry, `b${bid}:after`, '3')).statusCode).toBe(200);
    expect((await move(anna, 'note', kais, 'pre', '7')).statusCode).toBe(200);
    expect((await move(vic, 'note', kais)).json()).toEqual({ error: 'forbidden' });
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'timeline.move' AND campaign_id = ?").get(id)).toEqual({ n: 4 });
  });

  it('a place only reaches who may see the block; a sealed note is its author’s to move until it opens', async () => {
    const { s, bid, kais, sealed, secret, anna, kai, move, timeline } = await world();
    await move(anna, 'note', secret, 'pre', '3');
    expect((await timeline(anna)).positions.map((p) => p.itemId)).toEqual([secret]);
    expect((await timeline(kai)).positions).toEqual([]);
    expect((await move(kai, 'note', secret)).json()).toEqual({ error: 'not_found' });
    expect((await move(anna, 'note', sealed)).json()).toEqual({ error: 'forbidden' });
    expect((await move(kai, 'note', sealed)).statusCode).toBe(200);
    s.db.prepare("UPDATE battles SET status = 'closed' WHERE id = ?").run(bid);
    expect((await move(anna, 'note', sealed, `b${bid}:after`, '9')).statusCode).toBe(200);
    // nonsense places are refused
    for (const [segment, pos] of [['b1:before', '5'], ['elsewhere', '5'], [`b${bid}:before`, '5a'], [`b${bid}:before`, '50'], [`b${bid}:before`, '']]) {
      expect((await move(kai, 'note', kais, segment, pos)).statusCode).toBe(400);
    }
    expect((await move(kai, 'note', kais, `b${randomUUID()}:before`, '5')).json()).toMatchObject({ error: 'invalid' });
    expect((await move(kai, 'notes', kais)).statusCode).toBe(400);
    expect((await move(kai, 'note', randomUUID())).statusCode).toBe(404);
  });
});

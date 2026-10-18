/* Live updates (ADR 0020): the stream says "something changed" and nothing
   more, and only to those who may see the change – the visibility the audit
   log carries decides (a public entry reaches the campaign's members, a
   leaders' entry its leaders, a sealed one its author, an admin entry
   nobody; a warband's draft the owner's own devices). */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { audit } from '../src/accounts.ts';
import { COOKIE } from '../src/routes-accounts.ts';
import type { LiveOptions } from '../src/live.ts';
import { startAccounts } from './accounts-helpers.ts';
import { bodyOf, openStream } from './stream-client.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

interface Ev { event: string; data: unknown }

const hangups: (() => void)[] = [];
afterEach(() => hangups.splice(0).forEach((f) => f()));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A client of the stream over a real connection: what it has heard, and whether it has been hung up on. */
async function listen(url: string, token: string | null, query = '') {
  const o = await openStream(`${url}/api/v1/events${query}`, token ? { cookie: `${COOKIE}=${token}` } : {});
  hangups.push(o.hangUp);
  const events: Ev[] = [];
  let raw = '';
  let ended = false;
  const waiting: (() => void)[] = [];
  const wake = () => waiting.splice(0).forEach((f) => f());
  const rest = o.status === 200 ? '' : await bodyOf(o);
  if (o.status === 200) {
    o.res.setEncoding('utf8');
    o.res.on('data', (chunk: string) => {
      raw += chunk;
      for (let i = raw.indexOf('\n\n'); i >= 0; i = raw.indexOf('\n\n')) {
        const frame = raw.slice(0, i);
        raw = raw.slice(i + 2);
        const event = /^event: (.*)$/m.exec(frame)?.[1];
        const data = /^data: (.*)$/m.exec(frame)?.[1];
        // the line that says the connection is alive is not news
        if (event && event !== 'ping') events.push({ event, data: data ? JSON.parse(data) : null });
        wake();
      }
    });
    const over = () => { ended = true; wake(); };
    o.res.on('end', over);
    o.res.on('close', over);
    o.res.on('error', over);
    // the first bytes are out once the server has taken the stream
    await sleep(30);
  }
  return {
    status: o.status,
    headers: new Map(Object.entries(o.headers).map(([k, v]) => [k, String(v)])),
    body: rest,
    events,
    /** The next event, or a failure after `ms`. */
    async next(ms = 1500): Promise<Ev> {
      const end = Date.now() + ms;
      while (events.length === 0) {
        if (Date.now() > end) throw new Error('no event');
        await new Promise<void>((r) => { waiting.push(r); setTimeout(r, 50); });
      }
      return events.shift()!;
    },
    /** Nothing arrives for `ms`. */
    async quiet(ms = 200): Promise<Ev[]> {
      await sleep(ms);
      return events.splice(0);
    },
    /** The server ended the stream (within `ms`). */
    async over(ms = 1500): Promise<boolean> {
      const end = Date.now() + ms;
      while (!ended && Date.now() < end) await new Promise<void>((r) => { waiting.push(r); setTimeout(r, 50); });
      return ended;
    },
    hangUp: o.hangUp,
  };
}

const FAST: Partial<LiveOptions> = { settleMs: 10, heartbeatMs: 40 };

/** Anna leads (authenticator), Ben leads, Kai plays, Vic watches; Eve is outside; one open battle with Anna's warband in it. */
async function world(live: Partial<LiveOptions> = FAST) {
  const s = await startAccounts({ live });
  const u = { anna: await s.user('anna', { totp: true }), ben: await s.user('ben', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic'), eve: await s.user('eve', { admin: true, totp: true }) };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return { token, call: (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token }) };
  };
  const a = { anna: as(u.anna), ben: as(u.ben), kai: as(u.kai), vic: as(u.vic), eve: as(u.eve) };
  const id = ((await a.anna.call('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await a.anna.call('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'leader' });
  await a.anna.call('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await a.anna.call('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await a.anna.call('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await a.anna.call('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const hear = (who: keyof typeof a) => listen(s.url, a[who].token);
  return { s, u, a, id, w, bid, hear, note: (who: keyof typeof a, body: object) => a[who].call('PUT', `/campaigns/${id}/notes/${randomUUID()}`, body) };
}

describe('the live stream', () => {
  it('is for whoever is signed in, and for the account it is opened for', async () => {
    const { s, u, a } = await world();
    expect((await listen(s.url, null)).status).toBe(401);
    expect((await listen(s.url, a.kai.token, `?user=${u.anna.id}`)).status).toBe(409);
    const mine = await listen(s.url, a.kai.token, `?user=${u.kai.id}`);
    expect(mine.status).toBe(200);
    expect(mine.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(mine.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(mine.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('tells every member of a campaign of a public change – not someone outside it, nor a member who left', async () => {
    const { s, u, id, hear, note } = await world();
    const [anna, ben, kai, vic, eve] = await Promise.all([hear('anna'), hear('ben'), hear('kai'), hear('vic'), hear('eve')]);
    expect((await note('kai', { text: 'Bolt the doors.', kind: 'quote' })).statusCode).toBe(200);
    for (const m of [anna, ben, kai, vic]) expect(await m.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await eve.quiet()).toEqual([]);

    // Vic leaves: the next change does not reach him
    s.db.prepare('UPDATE members SET left_at = ? WHERE campaign_id = ? AND user_id = ?').run(s.clock.now().toISOString(), id, u.vic.id);
    await note('kai', { text: 'Again.', kind: 'quote' });
    expect(await kai.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await vic.quiet()).toEqual([]);
  });

  it('keeps a leaders-only change from the players and the viewers', async () => {
    const { a, id, hear, note } = await world();
    const [anna, ben, kai, vic] = await Promise.all([hear('anna'), hear('ben'), hear('kai'), hear('vic')]);
    expect((await note('anna', { text: 'The Countess pays the ferryman.', kind: 'general', visibility: 'leader' })).statusCode).toBe(200);
    expect(await anna.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await ben.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await kai.quiet()).toEqual([]);
    expect(await vic.quiet()).toEqual([]);
    expect(a.kai.token).toBeTruthy();
  });

  it('tells only the author of a sealed note, as it says nothing the others may know', async () => {
    const { bid, hear, id, note } = await world();
    const [anna, kai, vic] = await Promise.all([hear('anna'), hear('kai'), hear('vic')]);
    expect((await note('kai', { text: 'What I saw at the ferry.', kind: 'general', visibility: 'sealed', battleId: bid })).statusCode).toBe(200);
    expect(await kai.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await anna.quiet()).toEqual([]);
    expect(await vic.quiet()).toEqual([]);
  });

  it('tells nobody of an entry only the admin reads', async () => {
    const { s, u, id, hear } = await world();
    const anna = await hear('anna');
    audit(s.db, { actorId: u.anna.id, action: 'bug.update', campaignId: id }, s.clock.now());
    audit(s.db, { actorId: u.anna.id, action: 'campaign.something', campaignId: id, visibility: 'admin' }, s.clock.now());
    expect(await anna.quiet()).toEqual([]);
  });

  it('tells a warband draft to the owner\'s devices only, and a new version in a campaign to its members as well', async () => {
    const { s, u, id, w, hear } = await world();
    const [annaPhone, annaDesk, kai] = [await hear('anna'), await hear('anna'), await hear('kai')];
    audit(s.db, { actorId: u.anna.id, action: 'warband.autosave', targetType: 'warband', targetId: w }, s.clock.now());
    for (const d of [annaPhone, annaDesk]) expect(await d.next()).toEqual({ event: 'change', data: { sync: true } });
    expect(await kai.quiet()).toEqual([]);

    audit(s.db, { actorId: u.anna.id, action: 'warband.version', targetType: 'warband', targetId: w }, s.clock.now());
    expect(await kai.next()).toEqual({ event: 'change', data: { campaign: id } });
    const heard = [await annaPhone.next(), await annaPhone.next()].map((e) => JSON.stringify(e.data)).sort();
    expect(heard).toEqual([JSON.stringify({ campaign: id }), JSON.stringify({ sync: true })].sort());
  });

  it('tells a burst of changes once, and never carries a sequence number, a title or a name', async () => {
    const { s, u, id, hear } = await world();
    const kai = await hear('kai');
    for (let i = 0; i < 8; i++) audit(s.db, { actorId: u.anna.id, action: 'note.create', targetType: 'note', targetId: `Secret ${i}`, campaignId: id, visibility: 'public', payload: { text: 'Secret' } }, s.clock.now());
    expect(await kai.next()).toEqual({ event: 'change', data: { campaign: id } });
    expect(await kai.quiet()).toEqual([]);
  });

  it('keeps a user to a few streams: the oldest ends when another opens', async () => {
    const { s, a } = await world({ ...FAST, perUser: 2 });
    const one = await listen(s.url, a.kai.token);
    const two = await listen(s.url, a.kai.token);
    expect(await one.over(100)).toBe(false);
    const three = await listen(s.url, a.kai.token);
    expect(await one.over()).toBe(true);
    expect(await two.over(100)).toBe(false);
    expect(await three.over(100)).toBe(false);
  });

  it('turns away a stream when the server holds enough, and says when to try again', async () => {
    const { s, a } = await world({ ...FAST, total: 1 });
    await listen(s.url, a.kai.token);
    const busy = await listen(s.url, a.anna.token);
    expect(busy.status).toBe(503);
    expect(busy.headers.get('retry-after')).toBe('30');
    expect(JSON.parse(busy.body)).toEqual({ error: 'busy' });
  });

  it('ends when the session ends, and after its longest age', async () => {
    const { s, u, a } = await world();
    const signedOut = await listen(s.url, a.kai.token);
    s.db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ?').run(s.clock.now().toISOString(), u.kai.id);
    expect(await signedOut.over()).toBe(true);

    const old = await listen(s.url, a.vic.token);
    expect(await old.over(150)).toBe(false);
    s.clock.advance(16 * 60 * 1000);
    expect(await old.over()).toBe(true);
  });

  it('ends every stream when the server closes, so shutting down does not wait for them', async () => {
    const { s, a } = await world();
    const kai = await listen(s.url, a.kai.token);
    await s.close();
    expect(await kai.over()).toBe(true);
  });

  it('stops without waiting for a connection Node does not count as idle (a keep-alive socket after a stream the app hung up on)', async () => {
    const s = await startAccounts({ closeGraceMs: 300 });
    const kai = await s.user('kai');
    // fetch keeps its connections: a stream that is hung up on, then an ordinary request
    const ctl = new AbortController();
    const stream = await fetch(`${s.url}/api/v1/events`, { headers: { cookie: `${COOKIE}=${kai.session()}` }, signal: ctl.signal });
    expect(stream.status).toBe(200);
    await stream.body!.getReader().read();
    ctl.abort();
    await (await fetch(`${s.url}/api/v1/health`)).text();
    const t0 = Date.now();
    await s.close();
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});

/* Problem reports (phase 4c1): anyone signed in sends one and follows its
   status; the admin with the authenticator reads and sorts all of them;
   nobody else reads any. A warband travels along only when the reporter
   ticks it, and is dropped when the report is closed. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT, MAX_PER_DAY } from '../src/bugs.ts';
import { startAccounts } from './accounts-helpers.ts';

type Mine = { id: string; kind: string; title: string; text: string; sourceRef: string; status: string; fixedIn: string; createdAt: string; updatedAt: string };
type Summary = { id: string; reporterName: string; kind: string; title: string; status: string; severity: string | null; area: string; fixedIn: string; consent: boolean; attached: boolean };
type Detail = Summary & { text: string; sourceRef: string; device: string; jsErrors: { message: string }[]; context: { screen: string; steps: unknown[] } | null; warbandId: string | null; rev: number | null; attachment: { name?: string } | null };

/** Rob is the admin (authenticator), Anna and Ben report, Cy has nothing to do with it. */
async function table() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna'), ben: await s.user('ben'), robNoTotp: await s.user('rob2', { admin: true }) };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'POST' || method === 'PATCH' ? {} : undefined), token });
  };
  const rob = as(u.rob), anna = as(u.anna), ben = as(u.ben), robNoTotp = as(u.robNoTotp);
  const context = {
    screen: '/warbands/:id/trade',
    steps: [{ at: '2026-09-30T11:59:00.000Z', kind: 'screen', what: '/warbands/:id', n: 1 }, { at: '2026-09-30T11:59:30.000Z', kind: 'api', what: 'PUT /warbands/:x/draft → 409 stale', n: 2 }],
    settings: { theme: 'chronicle', flavour: 'campaign', online: true, sync: 'synced', role: null, viewport: '360×740', installed: false },
    houseRules: { warband: { heroes: 7 }, campaign: null },
  };
  const report = (o: Record<string, unknown> = {}) => ({
    id: randomUUID(), kind: 'bug', title: 'The trading post does not open', text: 'I tap Buy and nothing happens.', appVersion: 'abc1234', device: 'Chrome on Android', view: '/warbands/:id/trade',
    context, jsErrors: [{ at: '2026-09-30T11:59:40.000Z', message: 'TypeError: x is undefined', where: 'index.js:1:2' }], ...o,
  });
  const send = async (who: typeof anna, o: Record<string, unknown> = {}) => {
    const body = report(o);
    return { body, res: await who('POST', '/bugs', body) };
  };
  const list = async (q = '') => ((await rob('GET', `/bugs${q}`)).json() as { bugs: Summary[] }).bugs;
  const one = async (id: string) => ((await rob('GET', `/bugs/${id}`)).json() as { bug: Detail }).bug;
  return { s, u, anna, ben, rob, robNoTotp, report, send, list, one, context };
}

describe('problem reports', () => {
  it('a signed-in user sends one and reads it back with its status; sending it twice is one report', async () => {
    const { s, anna, send } = await table();
    const { body, res } = await send(anna);
    expect(res.statusCode).toBe(201);
    const bug = (res.json() as { bug: Mine }).bug;
    expect(bug).toMatchObject({ id: body.id, kind: 'bug', title: 'The trading post does not open', status: 'new', fixedIn: '' });
    // what the reporter reads is their words and the status – no severity, no technical details, no copy of a warband
    expect(Object.keys(bug).sort()).toEqual(['createdAt', 'fixedIn', 'id', 'kind', 'sourceRef', 'status', 'text', 'title', 'updatedAt']);
    const again = await anna('POST', '/bugs', body);
    expect(again.statusCode).toBe(200);
    expect((again.json() as { bug: Mine }).bug.id).toBe(body.id);
    expect(((await anna('GET', '/bugs/mine')).json() as { bugs: Mine[] }).bugs).toHaveLength(1);
    expect((s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'bug.report'").get() as { n: number }).n).toBe(1);
  });

  it('the same id with other words, or from someone else, is refused without saying whose it is', async () => {
    const { anna, ben, send } = await table();
    const { body } = await send(anna, { text: 'ZEBRA first words.' });
    const other = await anna('POST', '/bugs', { ...body, text: 'Other words.' });
    expect(other.statusCode).toBe(409);
    expect(other.json()).toEqual({ error: 'exists' });
    const theirs = await ben('POST', '/bugs', body);
    expect(theirs.statusCode).toBe(409);
    expect(theirs.body).not.toMatch(/ZEBRA/);
    expect(((await ben('GET', '/bugs/mine')).json() as { bugs: Mine[] }).bugs).toEqual([]);
  });

  it('nobody but the reporter reads their reports, and nobody but the admin with the authenticator reads all', async () => {
    const { anna, ben, rob, robNoTotp, s, send, list } = await table();
    const { body } = await send(anna, { text: 'ZEBRA: the trading post.' });
    const id = body.id as string;
    expect(((await ben('GET', '/bugs/mine')).json() as { bugs: Mine[] }).bugs).toEqual([]);
    for (const who of [anna, ben]) {
      for (const [m, url] of [['GET', '/bugs'], ['GET', `/bugs/${id}`], ['PATCH', `/bugs/${id}`]] as const) {
        const r = await who(m, url, m === 'PATCH' ? { status: 'confirmed' } : undefined);
        expect(r.statusCode, `${m} ${url}`).toBe(403);
        expect(r.json()).toEqual({ error: 'forbidden' });
      }
    }
    // an admin who has not set up the authenticator may only look after the own account
    expect((await robNoTotp('GET', '/bugs')).statusCode).toBe(403);
    expect((await robNoTotp('POST', '/bugs', { ...(await send(anna)).body, id: randomUUID() })).statusCode).toBe(403);
    // without an account: asked to sign in
    expect((await s.call({ url: '/api/v1/bugs' })).statusCode).toBe(401);
    expect((await s.call({ url: '/api/v1/bugs', body: {}, token: null })).statusCode).toBe(401);
    expect((await list()).map((b) => b.id)).toContain(id);
    expect((await rob('GET', `/bugs/${id}`)).statusCode).toBe(200);
  });

  it('the admin’s list is a summary; the whole report, with the technical details, is one request away', async () => {
    const { send, anna, list, one } = await table();
    const { body } = await send(anna, { text: 'ZEBRA: the full story.', attach: { warbandId: randomUUID(), rev: 3, save: { name: 'ATTACH-ZEBRA', models: [] } } });
    const id = body.id as string;
    const rows = await list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, reporterName: 'anna', kind: 'bug', status: 'new', severity: null, consent: true, attached: true });
    // the list says that a warband is attached, not what it is, and does not carry the words
    expect(JSON.stringify(rows)).not.toMatch(/ZEBRA/);
    const bug = await one(id);
    expect(bug).toMatchObject({ text: 'ZEBRA: the full story.', device: 'Chrome on Android', rev: 3, attachment: { name: 'ATTACH-ZEBRA' } });
    expect(bug.context?.screen).toBe('/warbands/:id/trade');
    expect(bug.context?.steps).toHaveLength(2);
    expect(bug.jsErrors[0]!.message).toBe('TypeError: x is undefined');
  });

  it('a warband travels along only when the reporter attached it', async () => {
    const { send, anna, one, s } = await table();
    const plain = await send(anna);
    expect(await one(plain.body.id as string)).toMatchObject({ consent: false, attached: false, attachment: null, warbandId: null, rev: null });
    const row = s.db.prepare('SELECT consent_attach, attachment FROM bugs WHERE id = ?').get(plain.body.id) as { consent_attach: number; attachment: string | null };
    expect(row).toEqual({ consent_attach: 0, attachment: null });
    // a copy without the warband it is of, or a warband that is not an object, is not accepted
    expect((await anna('POST', '/bugs', { ...(await send(anna)).body, id: randomUUID(), attach: { rev: 1, save: {} } })).statusCode).toBe(400);
    expect((await anna('POST', '/bugs', { ...plain.body, id: randomUUID(), attach: { warbandId: randomUUID(), rev: 1, save: 'x' } })).statusCode).toBe(400);
  });

  it('a copy that is too large is refused', async () => {
    const { anna, report } = await table();
    const big = { name: 'x'.repeat(MAX_ATTACHMENT + 10) };
    const r = await anna('POST', '/bugs', report({ attach: { warbandId: randomUUID(), rev: 1, save: big } }));
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ error: 'invalid', problem: 'the warband is too large to attach' });
  });

  it('the admin sorts a report; the reporter sees the status and the version, never the severity', async () => {
    const { send, anna, rob, one, list } = await table();
    const { body } = await send(anna);
    const id = body.id as string;
    const confirm = await rob('PATCH', `/bugs/${id}`, { status: 'confirmed', severity: 'S2', area: 'trading post' });
    expect(confirm.statusCode).toBe(200);
    expect((confirm.json() as { bug: Detail }).bug).toMatchObject({ status: 'confirmed', severity: 'S2', area: 'trading post' });
    // fixed names its version
    const bare = await rob('PATCH', `/bugs/${id}`, { status: 'fixed' });
    expect(bare.statusCode).toBe(400);
    expect(bare.json()).toMatchObject({ error: 'invalid', problem: 'a fixed report names the version it is fixed in' });
    expect((await rob('PATCH', `/bugs/${id}`, { status: 'fixed', fixedIn: 'f00dbee' })).statusCode).toBe(200);
    const mine = ((await anna('GET', '/bugs/mine')).json() as { bugs: Mine[] }).bugs[0]!;
    expect(mine).toMatchObject({ status: 'fixed', fixedIn: 'f00dbee' });
    expect(mine).not.toHaveProperty('severity');
    expect(mine).not.toHaveProperty('area');
    // a fixed report is out of the open list, in the one for fixed
    expect(await list()).toEqual([]);
    expect((await list('?status=fixed')).map((b) => b.id)).toEqual([id]);
    expect((await list('?status=all')).map((b) => b.id)).toEqual([id]);
    // back in work: the version is forgotten
    expect((await rob('PATCH', `/bugs/${id}`, { status: 'in_progress' })).statusCode).toBe(200);
    expect((await one(id)).fixedIn).toBe('');
    // the severity can be taken back
    expect((await rob('PATCH', `/bugs/${id}`, { severity: null })).statusCode).toBe(200);
    expect((await one(id)).severity).toBeNull();
  });

  it('closing a report, or calling it a duplicate, lets go of the warband copy; that it was attached stays', async () => {
    const { send, anna, rob, one, s } = await table();
    const a = await send(anna, { attach: { warbandId: randomUUID(), rev: 1, save: { name: 'ATTACH-ZEBRA' } } });
    const b = await send(anna, { attach: { warbandId: randomUUID(), rev: 1, save: { name: 'ATTACH-ZEBRA' } } });
    const keep = await send(anna, { attach: { warbandId: randomUUID(), rev: 1, save: { name: 'ATTACH-ZEBRA' } } });
    expect((await rob('PATCH', `/bugs/${a.body.id}`, { status: 'closed' })).statusCode).toBe(200);
    expect((await rob('PATCH', `/bugs/${b.body.id}`, { status: 'duplicate' })).statusCode).toBe(200);
    expect((await rob('PATCH', `/bugs/${keep.body.id}`, { status: 'fixed', fixedIn: 'f00dbee' })).statusCode).toBe(200);
    for (const x of [a, b]) expect(await one(x.body.id as string)).toMatchObject({ consent: true, attached: false, attachment: null });
    expect(await one(keep.body.id as string)).toMatchObject({ attached: true, attachment: { name: 'ATTACH-ZEBRA' } });
    expect((s.db.prepare('SELECT count(*) AS n FROM bugs WHERE attachment IS NOT NULL').get() as { n: number }).n).toBe(1);
  });

  it('a change that changes nothing is not logged; an unknown report is not found; a bad change is refused', async () => {
    const { send, anna, rob, s } = await table();
    const { body } = await send(anna);
    const id = body.id as string;
    const updates = () => (s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'bug.update'").get() as { n: number }).n;
    expect((await rob('PATCH', `/bugs/${id}`, { status: 'new', area: '' })).statusCode).toBe(200);
    expect(updates()).toBe(0);
    expect((await rob('PATCH', `/bugs/${id}`, { status: 'confirmed' })).statusCode).toBe(200);
    expect(updates()).toBe(1);
    expect((await rob('PATCH', `/bugs/${randomUUID()}`, { status: 'confirmed' })).statusCode).toBe(404);
    expect((await rob('PATCH', '/bugs/not-an-id', { status: 'confirmed' })).statusCode).toBe(404);
    for (const bad of [{}, { status: 'done' }, { severity: 'S9' }, { status: 'confirmed', reporter: 'x' }, { area: 'x'.repeat(61) }]) {
      const r = await rob('PATCH', `/bugs/${id}`, bad);
      expect(r.statusCode, JSON.stringify(bad)).toBe(400);
      expect(r.json()).toMatchObject({ error: 'invalid' });
    }
    expect((await rob('GET', `/bugs/${randomUUID()}`)).statusCode).toBe(404);
    expect((await rob('GET', '/bugs?status=done')).statusCode).toBe(400);
    expect((await rob('GET', '/bugs?limit=0')).statusCode).toBe(400);
    expect((await rob('GET', '/bugs?limit=201')).statusCode).toBe(400);
  });

  it('refuses what is not a report: no words, a wrong kind, an unknown field, typed text smuggled into the context', async () => {
    const { anna, report, context } = await table();
    const bad: Record<string, unknown>[] = [
      { text: '   ' }, { title: '' }, { kind: 'complaint' }, { id: 'not-an-id' }, { text: 'x'.repeat(4_001) }, { title: 'x'.repeat(121) }, { reporterId: 'someone' }, { status: 'fixed' },
      { context: { ...context, typed: 'ZEBRA' } },
      { context: { ...context, settings: { ...context.settings, note: 'ZEBRA' } } },
      { context: { ...context, steps: [{ at: 'now', kind: 'typed', what: 'ZEBRA' }] } },
      { context: { ...context, steps: Array.from({ length: 31 }, () => ({ at: 'now', kind: 'screen', what: '/' })) } },
      { jsErrors: Array.from({ length: 6 }, () => ({ at: 'now', message: 'e' })) },
    ];
    for (const o of bad) {
      const r = await anna('POST', '/bugs', report(o));
      expect(r.statusCode, JSON.stringify(o).slice(0, 80)).toBe(400);
      expect(r.json()).toMatchObject({ error: 'invalid' });
      expect(r.body).not.toMatch(/ZEBRA/);
    }
    // the shortest report is a kind and a sentence
    const min = await anna('POST', '/bugs', { id: randomUUID(), kind: 'wish', title: 'Dark mode', text: 'A darker theme, please.' });
    expect(min.statusCode).toBe(201);
    const rules = await anna('POST', '/bugs', { id: randomUUID(), kind: 'rules', title: 'Scout cost', text: 'The scout costs 25.', sourceRef: 'https://mordheimer.net/example' });
    expect((rules.json() as { bug: Mine }).bug).toMatchObject({ kind: 'rules', sourceRef: 'https://mordheimer.net/example' });
  });

  it('a user sends at most a handful in a day; a day later it works again', async () => {
    const { s, anna, ben, report } = await table();
    for (let i = 0; i < MAX_PER_DAY; i++) expect((await anna('POST', '/bugs', report())).statusCode).toBe(201);
    const over = await anna('POST', '/bugs', report());
    expect(over.statusCode).toBe(429);
    expect(over.json()).toEqual({ error: 'too_many' });
    // someone else is not held back
    expect((await ben('POST', '/bugs', report())).statusCode).toBe(201);
    s.clock.advance(25 * 3_600_000);
    expect((await anna('POST', '/bugs', report())).statusCode).toBe(201);
  });

  it('the admin is not held back by the daily limit', async () => {
    const { rob, report } = await table();
    for (let i = 0; i < MAX_PER_DAY + 1; i++) expect((await rob('POST', '/bugs', report())).statusCode).toBe(201);
  });

  it('the log says that a report came in and was sorted, never what it says', async () => {
    const { s, send, anna, rob } = await table();
    const { body } = await send(anna, { title: 'ZEBRA title', text: 'ZEBRA words', attach: { warbandId: randomUUID(), rev: 1, save: { name: 'ATTACH-ZEBRA' } } });
    await rob('PATCH', `/bugs/${body.id}`, { status: 'confirmed', severity: 'S3', area: 'ZEBRA area' });
    const log = (await rob('GET', '/admin/audit')).json() as { entries: { action: string; payload: unknown }[] };
    const mine = log.entries.filter((e) => e.action.startsWith('bug.'));
    expect(mine.map((e) => e.action).sort()).toEqual(['bug.report', 'bug.update']);
    expect(JSON.stringify(mine)).not.toMatch(/ZEBRA/);
    expect(mine.find((e) => e.action === 'bug.report')!.payload).toEqual({ kind: 'bug', attached: true });
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action LIKE 'bug.%' AND visibility = 'admin'").get()).toEqual({ n: 2 });
  });
});

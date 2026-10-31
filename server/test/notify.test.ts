/* A message on Rob's phone when a report comes in (ntfy.sh; Rob, 31.10.2026). The notice says that there is a report and of what kind –
   never its words (a report is text from a player, and may carry warband data) – and it can never stand in the way of the report. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ConfigError, readConfig } from '../src/config.ts';
import { ntfyNotifier, type Notice } from '../src/notify.ts';
import { startAccounts } from './accounts-helpers.ts';

const URL_OK = 'https://ntfy.sh/roster-secret-topic-1234';

describe('NTFY_URL', () => {
  it('is an https address, or nothing', () => {
    expect(readConfig({}).ntfyUrl).toBeNull();
    expect(readConfig({ NTFY_URL: URL_OK }).ntfyUrl).toBe(URL_OK);
    expect(readConfig({ NTFY_URL: '' }).ntfyUrl).toBeNull();
  });

  it('refuses another scheme or text that is no address, without repeating it (the topic is the secret)', () => {
    for (const bad of ['http://ntfy.sh/topic', 'ftp://ntfy.sh/topic', 'not an address', 'https://ntfy.sh/']) {
      let message = '';
      try { readConfig({ NTFY_URL: bad }); } catch (e) { expect(e).toBeInstanceOf(ConfigError); message = (e as Error).message; }
      expect(message, bad).toMatch(/NTFY_URL/);
      expect(message, bad).not.toContain(bad);
    }
  });
});

describe('the notifier', () => {
  it('posts the message to the address, with its title, and nothing else', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response('ok'));
    const notify = ntfyNotifier(URL_OK, { warn: vi.fn() }, f);
    notify({ title: 'Mordheim: new report', message: 'A new bug report is in.' });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe(URL_OK);
    expect(init!.method).toBe('POST');
    expect(init!.body).toBe('A new bug report is in.');
    expect(new Headers(init!.headers).get('title')).toBe('Mordheim: new report');
    expect(init!.signal).toBeTruthy();
  });

  it('never throws, never waits for the answer, and never writes the address in the log', async () => {
    const warn = vi.fn();
    const down = ntfyNotifier(URL_OK, { warn }, async () => { throw new Error(`connect to ${URL_OK} failed`); });
    expect(() => down({ title: 't', message: 'm' })).not.toThrow();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('roster-secret-topic');
    const refused = vi.fn();
    ntfyNotifier(URL_OK, { warn: refused }, async () => new Response('no', { status: 429 }))({ title: 't', message: 'm' });
    await vi.waitFor(() => expect(refused).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(refused.mock.calls)).not.toContain('roster-secret-topic');
  });
});

describe('a new report', () => {
  async function world(notify: (n: Notice) => void) {
    const s = await startAccounts({ notify });
    const anna = await s.user('anna');
    const rob = await s.user('rob', { admin: true, totp: true });
    const as = (u: { session: () => string }) => { const token = u.session(); return (body: unknown) => s.call({ url: '/api/v1/bugs', body, token }); };
    const report = (o: Record<string, unknown> = {}) => ({ id: randomUUID(), kind: 'bug', title: 'The trading post does not open', text: 'Secret words of a player: The Grey Company, 1234 gold.', ...o });
    return { send: as(anna), sendAdmin: as(rob), report };
  }

  it('is told once, by kind, without a word of it', async () => {
    const seen: Notice[] = [];
    const { send, report } = await world((n) => seen.push(n));
    const body = report({ kind: 'wish' });
    expect((await send(body)).statusCode).toBe(201);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.message).toMatch(/wish/i);
    expect(JSON.stringify(seen[0])).not.toMatch(/Grey Company|trading post|1234/i);
    // the same report sent again is the same report: no second message
    expect((await send(body)).statusCode).toBe(200);
    expect(seen).toHaveLength(1);
    expect((await send(report())).statusCode).toBe(201);
    expect(seen).toHaveLength(2);
  });

  it('is saved whatever the notice does', async () => {
    const { send, report } = await world(() => { throw new Error('ntfy is down'); });
    const body = report();
    expect((await send(body)).statusCode).toBe(201);
    expect((await send(body)).statusCode).toBe(200);
  });

  it('is not announced to the admin who sends it', async () => {
    const seen: Notice[] = [];
    const { sendAdmin, report } = await world((n) => seen.push(n));
    expect((await sendAdmin(report())).statusCode).toBe(201);
    expect(seen).toHaveLength(0);
  });

  it('is announced to nobody where no address is set', async () => {
    const s = await startAccounts();
    const anna = await s.user('anna');
    const r = await s.call({ url: '/api/v1/bugs', body: { id: randomUUID(), kind: 'bug', title: 't', text: 'x' }, token: anna.session() });
    expect(r.statusCode).toBe(201);
  });
});

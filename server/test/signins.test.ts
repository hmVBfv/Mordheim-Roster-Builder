/* Where and with what a person signed in (wish #69, Rob, 24.10.2026): only the last few sign-ins and the first time of each device,
   with a rough place from a database on the Pi itself; read by the admin and nobody else. */
import { describe, expect, it } from 'vitest';
import { KEEP_SIGNINS } from '../src/signins.ts';
import { PASSWORD, startAccounts } from './accounts-helpers.ts';

interface Row { at: string; kind: string; device: string; place: string; ip: string; firstTime: boolean }
interface Reply { signins: Row[]; devices: { device: string; firstAt: string; firstIp: string; firstPlace: string }[]; located: boolean }

/** A tiny stand-in for the database on the Pi: the first number of the address says where it is. */
const geo = (ip: string) => (ip.startsWith('81.') ? 'Berlin, Germany' : ip.startsWith('203.') ? 'Sydney, Australia' : '');

async function table() {
  const s = await startAccounts({ geo });
  const rob = await s.user('rob', { admin: true, totp: true });
  const kai = await s.user('kai');
  const anna = await s.user('anna', { totp: true });
  const login = (username: string, device: string, ip: string) => s.call({ method: 'POST', url: '/api/v1/auth/login', body: { username, password: PASSWORD, device }, headers: { 'x-forwarded-for': ip } });
  const seen = async (who: string) => (await s.call({ url: `/api/v1/admin/users/${who}/signins`, token: rob.session() })).json() as Reply;
  return { s, rob, kai, anna, login, seen };
}

describe('the admin sees where and with what someone signed in', () => {
  it('lists the newest first with the place, and marks the first time of a device', async () => {
    const { s, kai, login, seen } = await table();
    s.clock.advance(60_000);
    expect((await login('kai', 'Firefox on Linux', '81.2.69.142')).statusCode).toBe(200);
    s.clock.advance(60_000);
    expect((await login('kai', 'Firefox on Linux', '81.2.69.142')).statusCode).toBe(200);
    s.clock.advance(60_000);
    expect((await login('kai', 'Safari on iPhone', '203.0.113.7')).statusCode).toBe(200);
    const r = await seen(kai.id);
    expect(r.signins.map((x) => [x.device, x.place, x.firstTime])).toEqual([
      ['Safari on iPhone', 'Sydney, Australia', true],
      ['Firefox on Linux', 'Berlin, Germany', false],
      ['Firefox on Linux', 'Berlin, Germany', true],
    ]);
    expect(r.devices.map((d) => [d.device, d.firstPlace])).toEqual([['Firefox on Linux', 'Berlin, Germany'], ['Safari on iPhone', 'Sydney, Australia']]);
    expect(r.located).toBe(true);
  });

  it('keeps only the last few sign-ins, but every device’s first time', async () => {
    const { s, kai, login, seen } = await table();
    await login('kai', 'Opera on Windows', '81.2.69.142');
    for (let i = 0; i < KEEP_SIGNINS + 5; i++) { s.clock.advance(1000); await login('kai', 'Firefox on Linux', '81.2.69.142'); }
    const r = await seen(kai.id);
    expect(r.signins).toHaveLength(KEEP_SIGNINS);
    expect(r.signins.some((x) => x.device === 'Opera on Windows')).toBe(false);
    expect(r.devices.map((d) => d.device).sort()).toEqual(['Firefox on Linux', 'Opera on Windows']);
  });

  it('counts the next sign-in of an account that was there before as a first time, once', async () => {
    const { s, kai, login, seen } = await table();
    // the table is new: nothing is known of the device yet, however old the account is
    expect((await seen(kai.id)).signins).toEqual([]);
    await login('kai', 'Firefox on Linux', '81.2.69.142');
    await login('kai', 'Firefox on Linux', '81.2.69.142');
    expect((await seen(kai.id)).signins.map((x) => x.firstTime)).toEqual([false, true]);
    expect(s.db.prepare('SELECT count(*) AS n FROM known_devices').get()).toEqual({ n: 1 });
  });

  it('records a sign-in with an authenticator when the code is right, not at the password', async () => {
    const { s, anna, seen } = await table();
    const step = anna.session('totp');
    expect((await seen(anna.id)).signins).toEqual([]);
    const ok = await s.call({ method: 'POST', url: '/api/v1/auth/totp', token: step, body: { code: anna.code() }, headers: { 'x-forwarded-for': '203.0.113.7' } });
    expect(ok.statusCode).toBe(200);
    expect((await seen(anna.id)).signins.map((x) => [x.device, x.firstTime])).toEqual([['test', true]]);
  });

  it('names an address of the local network as that, without asking the database', async () => {
    const { kai, login, seen } = await table();
    await login('kai', 'Firefox on Linux', '192.168.1.20');
    expect((await seen(kai.id)).signins[0]).toMatchObject({ place: 'local network' });
  });

  it('says whether there is a database of places at all, and leaves the place empty without one', async () => {
    const s = await startAccounts();
    const rob = await s.user('rob', { admin: true, totp: true });
    const kai = await s.user('kai');
    await s.call({ method: 'POST', url: '/api/v1/auth/login', body: { username: 'kai', password: PASSWORD, device: 'Firefox on Linux' }, headers: { 'x-forwarded-for': '81.2.69.142' } });
    const r = (await s.call({ url: `/api/v1/admin/users/${kai.id}/signins`, token: rob.session() })).json() as Reply;
    expect(r.located).toBe(false);
    expect(r.signins[0]).toMatchObject({ device: 'Firefox on Linux', place: '' });
  });
});

describe('nobody but the admin reads it', () => {
  it('is closed to a player, to one who is signed out, to an admin without the authenticator and to the user’s own account', async () => {
    const { s, kai, rob, login } = await table();
    await login('kai', 'Firefox on Linux', '81.2.69.142');
    const url = `/api/v1/admin/users/${kai.id}/signins`;
    expect((await s.call({ url })).statusCode).toBe(401);
    expect((await s.call({ url, token: kai.session() })).statusCode).toBe(403);
    const plainAdmin = await s.user('ben', { admin: true });
    expect((await s.call({ url, token: plainAdmin.session() })).statusCode).toBe(403);
    expect((await s.call({ url, token: rob.session('totp') })).statusCode).toBe(403);
    // what the user reads of his own account carries no place and no list of sign-ins
    const mine = await s.call({ url: '/api/v1/auth/sessions', token: kai.session() });
    expect(mine.body).not.toMatch(/Berlin|firstTime|known_devices/);
    expect((await s.call({ url: '/api/v1/auth/me', token: kai.session() })).body).not.toMatch(/Berlin|signins/);
  });

  it('is not a way to read someone who does not exist, and takes no query to widen it', async () => {
    const { s, rob } = await table();
    expect((await s.call({ url: '/api/v1/admin/users/nobody/signins', token: rob.session() })).statusCode).toBe(404);
    expect((await s.call({ url: '/api/v1/admin/users/nobody/signins?limit=9999', token: rob.session() })).statusCode).toBe(404);
  });
});

describe('the database of places on the Pi', () => {
  it('is left out, with a word in the log, when it is missing, not a database, or too large for the container', async () => {
    const { openGeo } = await import('../src/geo.ts');
    const { tmpDir } = await import('./helpers.ts');
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const said: string[] = [];
    const log = { info: (o: { event: string }) => void said.push(o.event), warn: (o: { event: string }) => void said.push(o.event) } as never;
    const dir = tmpDir();
    expect(await openGeo(join(dir, 'none.mmdb'), log)).toBeNull();
    writeFileSync(join(dir, 'garbage.mmdb'), 'this is not a database');
    expect(await openGeo(join(dir, 'garbage.mmdb'), log)).toBeNull();
    writeFileSync(join(dir, 'big.mmdb'), Buffer.alloc(3 * 1024 * 1024));
    expect(await openGeo(join(dir, 'big.mmdb'), log, 1)).toBeNull();
    expect(said).toEqual(['geoip_missing', 'geoip_unreadable', 'geoip_too_large']);
  });

  it('a sign-in goes through when noting it fails', async () => {
    const { s, login } = await table();
    s.db.exec('DROP TABLE signins');
    expect((await login('kai', 'Firefox on Linux', '81.2.69.142')).statusCode).toBe(200);
  });
});

describe('a session used from another place (#69, Rob: "Wechsel erfassen")', () => {
  /** Signs kai in and gives back his session token. */
  async function signedIn(s: Awaited<ReturnType<typeof table>>['s'], login: Awaited<ReturnType<typeof table>>['login'], ip: string) {
    const r = await login('kai', 'Firefox on Linux', ip);
    const cookie = String(([] as string[]).concat(r.headers['set-cookie'] ?? []).find((c) => c.startsWith('mh_session=')) ?? '');
    const token = /mh_session=([^;]+)/.exec(cookie)?.[1] ?? '';
    expect(token).not.toBe('');
    return { token, use: (from: string) => s.call({ url: '/api/v1/auth/me', token, headers: { 'x-forwarded-for': from } }) };
  }
  const kinds = async (seen: (id: string) => Promise<Reply & { signins: (Row & { kind: string })[] }>, id: string) => (await seen(id)).signins.map((x) => [x.kind, x.place]);

  it('is noted once the session is used from a different place, as a move and not as a sign-in', async () => {
    const { s, kai, login, seen } = await table();
    const { use } = await signedIn(s, login, '81.2.69.142');
    s.clock.advance(2 * 3600_000);
    expect((await use('203.0.113.7')).statusCode).toBe(200);
    expect(await kinds(seen as never, kai.id)).toEqual([['moved', 'Sydney, Australia'], ['signin', 'Berlin, Germany']]);
    // the first time of a device is a matter of sign-ins only
    expect((await seen(kai.id)).signins.map((x) => x.firstTime)).toEqual([false, true]);
  });

  it('is not noted for the same place, however the address changes, nor within the hour', async () => {
    const { s, kai, login, seen } = await table();
    const { use } = await signedIn(s, login, '81.2.69.142');
    s.clock.advance(30 * 60_000);
    await use('203.0.113.7');
    s.clock.advance(2 * 3600_000);
    await use('81.2.69.200');
    expect(await kinds(seen as never, kai.id)).toEqual([['signin', 'Berlin, Germany']]);
  });

  it('without a database of places a different address is the move', async () => {
    const s = await startAccounts();
    const rob = await s.user('rob', { admin: true, totp: true });
    const kai = await s.user('kai');
    const r = await s.call({ method: 'POST', url: '/api/v1/auth/login', body: { username: 'kai', password: PASSWORD, device: 'Firefox on Linux' }, headers: { 'x-forwarded-for': '81.2.69.142' } });
    const token = /mh_session=([^;]+)/.exec(String(([] as string[]).concat(r.headers['set-cookie'] ?? [])[0]))![1]!;
    s.clock.advance(2 * 3600_000);
    await s.call({ url: '/api/v1/auth/me', token, headers: { 'x-forwarded-for': '81.2.69.143' } });
    const seen = (await s.call({ url: `/api/v1/admin/users/${kai.id}/signins`, token: rob.session() })).json() as Reply & { signins: { kind: string }[] };
    expect(seen.signins.map((x) => x.kind)).toEqual(['moved', 'signin']);
  });

  it('keeps the last few moves apart from the sign-ins', async () => {
    const { s, kai, login, seen } = await table();
    const { use } = await signedIn(s, login, '81.2.69.142');
    for (let i = 0; i < KEEP_SIGNINS + 4; i++) { s.clock.advance(2 * 3600_000); await use(i % 2 ? '81.2.69.142' : '203.0.113.7'); }
    const all = (await seen(kai.id)).signins as (Row & { kind: string })[];
    expect(all.filter((x) => x.kind === 'moved')).toHaveLength(KEEP_SIGNINS);
    expect(all.filter((x) => x.kind === 'signin')).toHaveLength(1);
  });
});

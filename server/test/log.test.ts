/* The log's contract with Fail2Ban (ops/fail2ban/filter.d/roster-auth.conf):
   the failregex finds the IP of a failed login, and nothing a user types can
   make it find another. Secrets never reach the log. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loginBraked, loginFailed } from '../src/log.ts';
import { captureLog } from './helpers.ts';

const FILTER = readFileSync(new URL('../../ops/fail2ban/filter.d/roster-auth.conf', import.meta.url), 'utf8');

/** The filter's failregex as a JS regex; <HOST> as Fail2Ban reads an address. */
function failregex(): RegExp {
  const line = /^failregex\s*=\s*(.+)$/m.exec(FILTER)![1]!.trim();
  const escaped = line.split('<HOST>').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?<host>[0-9a-fA-F.:]+)');
  return new RegExp(escaped);
}

describe('Fail2Ban', () => {
  it('reads the IP of a failed login', () => {
    const log = captureLog();
    loginFailed(log.logger, '203.0.113.9', 'player');
    expect(failregex().exec(log.lines[0]!)?.groups?.host).toBe('203.0.113.9');
    loginFailed(log.logger.child({ reqId: 'req-7' }), '2001:db8::1', 'player');
    expect(failregex().exec(log.lines[1]!)?.groups?.host).toBe('2001:db8::1');
  });

  it('an account name cannot put another IP into the line', () => {
    const log = captureLog();
    loginFailed(log.logger, '203.0.113.9', '","event":"login_failed","ip":"192.0.2.1');
    const all = [...log.lines[0]!.matchAll(new RegExp(failregex(), 'g'))].map((m) => m.groups!.host);
    expect(all).toEqual(['203.0.113.9']);
  });

  it('only an IP address reaches the line (security review OPS-6): a forwarded name cannot point a ban elsewhere', () => {
    const log = captureLog();
    loginFailed(log.logger, 'player.example.org', 'player');
    loginBraked(log.logger, '203.0.113.9, 192.0.2.1', 'player');
    expect(JSON.parse(log.lines[0]!)).toMatchObject({ event: 'login_failed', ip: 'invalid' });
    expect(JSON.parse(log.lines[1]!)).toMatchObject({ event: 'login_braked', ip: 'invalid' });
    expect(failregex().exec(log.lines[0]!)).toBeNull();
    expect(/^usedns\s*=\s*no$/m.test(readFileSync(new URL('../../ops/fail2ban/jail.d/roster.local', import.meta.url), 'utf8'))).toBe(true);
  });

  it('watches both containers by name: the test instance holds a copy of the accounts (security review OPS-3)', () => {
    expect(FILTER).toMatch(/^journalmatch\s*=\s*CONTAINER_NAME=roster-app \+ CONTAINER_NAME=roster-staging$/m);
  });
});

describe('secrets', () => {
  it('known secret fields are redacted', () => {
    const log = captureLog();
    log.logger.info({ password: 'hunter2hunter2', body: { token: 'abc', totp: '123456' }, headers: { cookie: 'sid=1', authorization: 'Bearer x' } }, 'x');
    expect(log.lines[0]).not.toMatch(/hunter2|abc|123456|sid=1|Bearer/);
  });
});

/* Passwords and the authenticator, without HTTP: scrypt hashes, the
   password rules, RFC 6238 codes, the secret at rest, recovery codes. */
import { describe, expect, it } from 'vitest';
import { brakeWait } from '../src/routes-accounts.ts';
import { COMMON_PASSWORDS } from '../src/common-passwords.ts';
import { readConfig, ConfigError } from '../src/config.ts';
import { DEFAULT_COST, hashPassword, MAX_PARALLEL, passwordProblem, verifyPassword } from '../src/passwords.ts';
import { base32, decryptSecret, encryptSecret, fromBase32, hashCode, hotp, newRecoveryCodes, newSecret, otpauthUri, parseKey, totpAt, verifyTotp } from '../src/totp.ts';
import { FAST } from './accounts-helpers.ts';

describe('passwords', () => {
  it('hashes with salt and parameters, and verifies', async () => {
    const a = await hashPassword('correct horse battery', FAST);
    const b = await hashPassword('correct horse battery', FAST);
    expect(a).toMatch(/^scrypt\$16\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterY', a)).toBe(false);
    expect(await verifyPassword('anything', 'not a hash')).toBe(false);
    // the same text in another Unicode form is the same password
    expect(await verifyPassword('ﬁve fine fish swim', await hashPassword('five fine fish swim', FAST))).toBe(true);
  });

  it('the real cost: N = 2^15, and at most two hashes at once', async () => {
    expect(DEFAULT_COST).toEqual({ N: 32768, r: 8, p: 1 });
    expect(MAX_PARALLEL).toBe(2);
    const h = await hashPassword('correct horse battery');
    expect(h.startsWith('scrypt$32768$8$1$')).toBe(true);
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => verifyPassword('correct horse battery', h)));
    expect(all).toEqual([true, true, true, true, true]);
  });

  it('refuses short, common, simple passwords and the username', () => {
    expect(passwordProblem('short')).toBe('at least 12 characters');
    expect(passwordProblem('x'.repeat(201))).toBe('at most 200 characters');
    expect(passwordProblem('Password1234')).toMatch(/too common/);
    expect(passwordProblem('ababababababab')).toBe('too simple');
    expect(passwordProblem('i am rob the admin', 'Rob')).toBe('it may not contain the username');
    expect(passwordProblem(undefined)).toBe('a password is needed');
    expect(passwordProblem('correct horse battery', 'player')).toBe('');
    // counts characters, not UTF-16 units
    expect(passwordProblem('\u{1F5E1}\u{1F6E1}\u{1F3F0}\u{1F480}\u{1F5E1}\u{1F6E1}')).toBe('at least 12 characters');
  });

  it('the list of common passwords: only those long enough to pass the length rule, all lower case', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThan(1000);
    for (const p of COMMON_PASSWORDS) {
      expect(p.length).toBeGreaterThanOrEqual(12);
      expect(p).toBe(p.toLowerCase());
    }
  });
});

describe('TOTP (RFC 6238)', () => {
  // the RFC's SHA-1 test secret, "12345678901234567890"; its codes, last six digits
  const secret = base32(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130'],
  ])('at %i: %s', (t, code) => {
    expect(totpAt(secret, new Date(t * 1000))).toBe(code);
  });

  it('base32 both ways', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(fromBase32(secret.toLowerCase().replace(/(.{4})/g, '$1 ')).toString()).toBe('12345678901234567890');
    expect(newSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(hotp(secret, 0)).toBe('755224');
  });

  it('accepts one step of drift either way, and a step only once', () => {
    const at = new Date(1111111111 * 1000);
    const step = Math.floor(1111111111 / 30);
    expect(verifyTotp(secret, '050471', at)).toBe(step);
    expect(verifyTotp(secret, '050 471', at)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, new Date(at.getTime() - 30000)), at)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, new Date(at.getTime() + 30000)), at)).toBe(step + 1);
    expect(verifyTotp(secret, totpAt(secret, new Date(at.getTime() + 60000)), at)).toBeNull();
    expect(verifyTotp(secret, '050471', at, step)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', at)).toBeNull();
    expect(verifyTotp(secret, '12345', at)).toBeNull();
  });

  it('the otpauth link names the issuer and the account', () => {
    expect(otpauthUri('ABC', 'rob')).toBe('otpauth://totp/Mordheim%20Campaign%3Arob?secret=ABC&issuer=Mordheim%20Campaign&algorithm=SHA1&digits=6&period=30');
  });

  it('keeps the secret encrypted; another key cannot read it', () => {
    const key = parseKey(Buffer.alloc(32, 1).toString('base64'))!;
    const other = parseKey(Buffer.alloc(32, 2).toString('base64'))!;
    const s = newSecret();
    const enc = encryptSecret(s, key);
    expect(enc).not.toContain(s);
    expect(enc).not.toBe(encryptSecret(s, key));
    expect(decryptSecret(enc, key)).toBe(s);
    expect(() => decryptSecret(enc, other)).toThrow();
    expect(() => decryptSecret('v2:a:b:c', key)).toThrow(/unknown secret format/);
  });

  it('TOTP_KEY: 32 bytes of base64, or the server does not start', () => {
    expect(parseKey(undefined)).toBeNull();
    expect(parseKey(Buffer.alloc(16).toString('base64'))).toBeNull();
    expect(readConfig({ TOTP_KEY: Buffer.alloc(32, 3).toString('base64') }).totpKey).toHaveLength(32);
    expect(readConfig({}).totpKey).toBeNull();
    expect(() => readConfig({ TOTP_KEY: 'too short' })).toThrow(ConfigError);
  });

  it('recovery codes: ten, readable, compared without case or dash', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    expect(hashCode('ABCD-EFGH')).toBe(hashCode('abcdefgh'));
  });
});

describe('the brake', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
  it('five free failures, then 30 s, doubling, at most 15 minutes', () => {
    expect(brakeWait(4, ago(0), now)).toBe(0);
    expect(brakeWait(5, ago(0), now)).toBe(30);
    expect(brakeWait(5, ago(25), now)).toBe(5);
    expect(brakeWait(6, ago(0), now)).toBe(60);
    expect(brakeWait(7, ago(0), now)).toBe(120);
    expect(brakeWait(20, ago(0), now)).toBe(900);
    expect(brakeWait(5, null, now)).toBe(0);
  });
});

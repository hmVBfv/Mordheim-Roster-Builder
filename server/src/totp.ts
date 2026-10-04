/* The second factor (ADR 0008): time-based one-time passwords as every
   authenticator app makes them (RFC 6238 over RFC 4226: HMAC-SHA1, 30
   seconds, 6 digits), one step of clock drift either way. The secret is
   kept encrypted with TOTP_KEY (AES-256-GCM), so a copy of the database
   alone does not give the codes away. Recovery codes: ten one-time codes,
   kept as hashes. */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const STEP = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function fromBase32(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new secret: 20 random bytes, as the authenticator wants it (base32). */
export function newSecret(): string {
  return base32(randomBytes(20));
}

export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', fromBase32(secret)).update(msg).digest();
  const off = h[h.length - 1]! & 15;
  const n = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(n % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function totpAt(secret: string, at: Date): string {
  return hotp(secret, Math.floor(at.getTime() / 1000 / STEP));
}

/** The time step a code belongs to (now, or one step either side), or null.
    The caller keeps the last step used, so a code works only once. */
export function verifyTotp(secret: string, code: string, at: Date, lastStep = -1): number | null {
  const c = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const now = Math.floor(at.getTime() / 1000 / STEP);
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastStep) continue;
    const want = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(want, Buffer.from(c))) return step;
  }
  return null;
}

/** What an authenticator app reads from a QR code or a link. */
export function otpauthUri(secret: string, account: string, issuer = 'Mordheim Campaign'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/* ---- the secret at rest ---- */

/** TOTP_KEY: 32 bytes, base64. */
export function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

export function encryptSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join(':');
}

export function decryptSecret(stored: string, key: Buffer): string {
  const [v, iv, tag, body] = stored.split(':');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('unknown secret format');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

/* ---- recovery codes ---- */

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Ten codes like "k7m2-q9xd", shown once. */
export function newRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const hashCode = (code: string) => createHash('sha256').update(code.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('base64url');

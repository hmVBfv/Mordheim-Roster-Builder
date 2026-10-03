/* Passwords (docs/security.md, section 3): at least 12 characters, not on
   the list of common passwords, not the username; stored as a scrypt hash
   with its parameters, so a later change of cost still verifies old hashes.
   Node's own crypto, no extra package. */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { COMMON_PASSWORDS } from './common-passwords.ts';

export const MIN_LENGTH = 12;
const MAX_LENGTH = 200;

/** scrypt's cost: N = 2^15 needs 32 MiB for a moment – fine within the
    container's 256 MB – and takes a fraction of a second on the Pi. Tests
    pass a smaller N. */
export interface HashCost { N: number; r: number; p: number }
export const DEFAULT_COST: HashCost = { N: 2 ** 15, r: 8, p: 1 };
const KEYLEN = 32;

/** At most two hashes at once: each needs its 32 MiB, and the Pi's memory is
    shared (CLAUDE.md, "Design for the Pi's limits"). */
export const MAX_PARALLEL = 2;
let running = 0;
const queue: (() => void)[] = [];

async function scrypt(pw: string, salt: Buffer, cost: HashCost): Promise<Buffer> {
  if (running >= MAX_PARALLEL) await new Promise<void>((go) => queue.push(go));
  running++;
  try {
    const opts: ScryptOptions = { ...cost, maxmem: 256 * cost.N * cost.r * cost.p + 1024 * 1024 };
    return await new Promise((resolve, reject) => scryptCb(pw.normalize('NFKC'), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))));
  } finally {
    running--;
    queue.shift()?.();
  }
}

/** "scrypt$N$r$p$salt$hash" (base64url). */
export async function hashPassword(pw: string, cost: HashCost = DEFAULT_COST): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, cost);
  return ['scrypt', cost.N, cost.r, cost.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await scrypt(pw, Buffer.from(salt, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A hash to verify against when the account does not exist, so a wrong
    username takes as long as a wrong password. */
let dummy: Promise<string> | null = null;
export function dummyHash(cost: HashCost = DEFAULT_COST): Promise<string> {
  dummy ??= hashPassword(randomBytes(18).toString('base64url'), cost);
  return dummy;
}

/** Why a new password is refused, or ''. */
export function passwordProblem(pw: unknown, username = ''): string {
  if (typeof pw !== 'string') return 'a password is needed';
  if ([...pw].length < MIN_LENGTH) return `at least ${MIN_LENGTH} characters`;
  if (pw.length > MAX_LENGTH) return `at most ${MAX_LENGTH} characters`;
  const low = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(low)) return 'too common – it is on the list of passwords tried first';
  if (username && low.includes(username.toLowerCase())) return 'it may not contain the username';
  if (new Set(pw).size < 4) return 'too simple';
  return '';
}

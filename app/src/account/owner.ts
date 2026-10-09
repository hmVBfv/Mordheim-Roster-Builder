/* Whose campaign data this device keeps (security review CLIENT-1). What
   the campaign server shows an account – campaigns, notes, pictures, the
   timeline, battles, chapters – is kept on the device under keys that carry
   the account's id, so a second account on the same phone never reads the
   first one's leaders' notes or sealed words, not even from the cache.
   Signing out removes all of it; signing in as somebody else removes
   everyone else's. Unsent items in the outbox stay their author's: shown to
   and sent by nobody else. */
import { db } from '../db/db.ts';
import { getSession, knownUser } from './session.ts';

export const CAMPAIGN_CACHES = ['campaign:', 'campaigns:', 'notes:', 'pictures:', 'timeline:', 'chapter:', 'battle:', 'cw:'] as const;
export type CampaignCache = (typeof CAMPAIGN_CACHES)[number];

/** The account this device answers for now: signed in, out of reach, or still being asked – '-' for nobody. */
export function ownerId(): string {
  const s = getSession();
  const u = s.status === 'in' ? s.user : s.status === 'unreachable' ? s.user : s.status === 'loading' ? knownUser() : null;
  return u?.id ?? '-';
}

/** The key of a cache of this account's: `<kind><account>:<rest>`. */
export const ownKey = (kind: CampaignCache, rest: string) => `${kind}${ownerId()}:${rest}`;

/** Removes the campaign data kept on this device – all of it, or all but `keep`'s. */
export async function forgetCampaignData(keep: string | null = null): Promise<number> {
  const keys = (await db.meta.toCollection().primaryKeys()) as string[];
  const drop = keys.filter((k) => CAMPAIGN_CACHES.some((c) => k.startsWith(c)) && (keep === null || !CAMPAIGN_CACHES.some((c) => k.startsWith(`${c}${keep}:`))));
  await db.meta.bulkDelete(drop);
  return drop.length;
}

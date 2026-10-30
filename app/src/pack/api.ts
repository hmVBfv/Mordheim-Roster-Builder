/* The campaign's style guide on the server (phase 4b4a; server/src/routes-style.ts):
   the writing instructions the AI pack hands to whoever writes the chapter.
   Leaders' own – read and written by leaders. The last
   answer is kept on the device (under the account's own key); writing needs
   the connection. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export interface Style { text: string; updatedBy: string | null; updatedAt: string | null; seq: number }

/** The limit the server holds to (server/src/style.ts). */
export const MAX_STYLE = 10_000;

const key = (cid: string) => ownKey('style:', cid);

export async function cachedStyle(cid: string): Promise<Style | null> {
  return ((await db.meta.get(key(cid)))?.value as Style | undefined) ?? null;
}

export async function getStyle(cid: string): Promise<Style> {
  const who = asker();
  const r = await api<{ style: Style }>(`/campaigns/${cid}/style`);
  await who.keep('style:', cid, r.style);
  return r.style;
}

/** Writes the style guide from the stand the device saw (`baseSeq`). */
export async function putStyle(cid: string, text: string, baseSeq: number): Promise<Style> {
  const who = asker();
  const r = await api<{ style: Style }>(`/campaigns/${cid}/style`, { method: 'PUT', body: { text, baseSeq } });
  await who.keep('style:', cid, r.style);
  return r.style;
}

/** The style as it stands now, when another leader changed it first (the server's 409 `stale`). */
export function staleStyle(e: unknown): Style | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Style } | undefined)?.current ?? null) : null;
}

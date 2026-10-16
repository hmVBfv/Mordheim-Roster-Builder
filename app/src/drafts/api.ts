/* Chapter drafts on the server (phase 4b5b; server/src/routes-drafts.ts):
   a chapter text before it is published. Leaders' own – read, written,
   published and discarded by leaders with the authenticator; for everyone
   else there is no such thing. The last list is kept on the device (under
   the account's own key); every change needs the connection. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';
import type { ChapterSummary } from '../timeline/api.ts';
import type { ChapterKind, Lang } from '../timeline/chapters.ts';

/** The limits the server holds to (server/src/chapter-drafts.ts). */
export const MAX_DRAFT_TEXT = 200_000;
export const MAX_DRAFTS = 100;

export interface DraftBody { refKey: string; kind: ChapterKind; lang: Lang; title: string; label: string; icDate: string; place: string; victor: string; text: string }
export interface Draft extends DraftBody { id: string; createdBy: string; createdAt: string; updatedAt: string; seq: number }
interface Kept { drafts: Draft[]; seq: number }

const key = (cid: string) => ownKey('drafts:', cid);

export async function cachedDrafts(cid: string): Promise<Kept | null> {
  return ((await db.meta.get(key(cid)))?.value as Kept | undefined) ?? null;
}

export async function getDrafts(cid: string): Promise<Kept> {
  const who = asker();
  const r = await api<Kept>(`/campaigns/${cid}/chapter-drafts`);
  await who.keep('drafts:', cid, r);
  return r;
}

/** Keeps the list in step with a change this device made, so the next start shows it. */
async function keepWith(cid: string, change: (list: Draft[]) => Draft[], seq: number): Promise<void> {
  const who = asker();
  const cur = (await cachedDrafts(cid)) ?? { drafts: [], seq: 0 };
  await who.keep('drafts:', cid, { drafts: change(cur.drafts), seq });
}

/** Writes a draft under the device's id, from the stand the device saw (`baseSeq`; 0 for a new one). */
export async function putDraft(cid: string, id: string, body: DraftBody, baseSeq: number): Promise<Draft> {
  const r = await api<{ draft: Draft; seq: number }>(`/campaigns/${cid}/chapter-drafts/${id}`, { method: 'PUT', body: { ...body, baseSeq } });
  await keepWith(cid, (l) => [r.draft, ...l.filter((d) => d.id !== id)], r.seq);
  return r.draft;
}

/** Puts the draft's language into the chapter of its ref (a new chapter needs `at`); the draft is then used up. */
export async function publishDraft(cid: string, id: string, at: { segment: string; pos: string } | null, publishedOn: string | null): Promise<ChapterSummary> {
  const r = await api<{ chapter: ChapterSummary; seq: number }>(`/campaigns/${cid}/chapter-drafts/${id}/publish`, { method: 'POST', body: { ...(at ? { at } : {}), publishedOn } });
  await keepWith(cid, (l) => l.filter((d) => d.id !== id), r.seq);
  return r.chapter;
}

export async function discardDraft(cid: string, id: string): Promise<void> {
  const r = await api<{ removed: boolean; seq: number }>(`/campaigns/${cid}/chapter-drafts/${id}`, { method: 'DELETE' });
  await keepWith(cid, (l) => l.filter((d) => d.id !== id), r.seq);
}

/** The draft as it stands now, when another leader changed it first (the server's 409 `stale`). */
export function staleDraft(e: unknown): Draft | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Draft } | undefined)?.current ?? null) : null;
}

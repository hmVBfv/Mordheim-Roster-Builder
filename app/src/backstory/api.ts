/* The campaign's backstory on the server (phase 4b; server/src/routes-backstory.ts):
   what happened before the campaign came into the app, in sections. Every
   member reads it; a leader replaces it as a whole.
   The last answer is kept on the device (under the account's own key);
   writing needs the connection. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';
import type { BackstorySection } from './split.ts';

export interface Backstory { sections: BackstorySection[]; updatedBy: string | null; updatedAt: string | null; seq: number }

export const NONE: Backstory = { sections: [], updatedBy: null, updatedAt: null, seq: 0 };

const key = (cid: string) => ownKey('backstory:', cid);

export async function cachedBackstory(cid: string): Promise<Backstory | null> {
  return ((await db.meta.get(key(cid)))?.value as Backstory | undefined) ?? null;
}

export async function getBackstory(cid: string): Promise<Backstory> {
  const who = asker();
  const r = await api<{ backstory: Backstory }>(`/campaigns/${cid}/backstory`);
  await who.keep('backstory:', cid, r.backstory);
  return r.backstory;
}

/** Replaces the backstory, from the stand the device read (`baseSeq`; 0 while there is none). */
export async function putBackstory(cid: string, sections: BackstorySection[], baseSeq: number): Promise<Backstory> {
  const who = asker();
  const r = await api<{ backstory: Backstory }>(`/campaigns/${cid}/backstory`, { method: 'PUT', body: { sections, baseSeq } });
  await who.keep('backstory:', cid, r.backstory);
  return r.backstory;
}

/** The backstory as it stands now, when another leader replaced it first (the server's 409 `stale`). */
export function staleBackstory(e: unknown): Backstory | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Backstory } | undefined)?.current ?? null) : null;
}

/** What precedes a battle: the sections that tell of no battle, or of an earlier one – the AI pack's backstory. */
export const before = (b: Backstory, round: number): BackstorySection[] => b.sections.filter((s) => s.battleNo === null || s.battleNo < round);

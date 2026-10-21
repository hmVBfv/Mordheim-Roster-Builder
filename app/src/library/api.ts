/* The Library on the server (server/src/routes-library.ts, ADR 0023): one's own ideas – later factions, NPCs,
   groups and scenarios – with the account, private to it. The last list is kept on the device (under the
   account's own key) so it reads offline; writing needs the connection. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export type Topic = 'campaign' | 'faction' | 'warband' | 'other';
export const TOPIC_NAMES: Record<Topic, string> = { campaign: 'Campaign', faction: 'Faction', warband: 'Warband', other: 'Something else' };
export const TOPICS = Object.keys(TOPIC_NAMES) as Topic[];

/** The limits the server holds to (server/src/library.ts). */
export const MAX_IDEA = 20_000;
export const MAX_NAME = 120;

export interface IdeaBody { text: string; topic: Topic }
export interface LibraryItem<B = unknown> { id: string; kind: string; name: string; body: B; createdAt: string; updatedAt: string; deletedAt: string | null; seq: number }
export type Idea = LibraryItem<IdeaBody>;

const KEY = 'items';

/** What is alive: the server's answer also carries the graves of what was taken out. */
const alive = (items: LibraryItem[]) => items.filter((i) => !i.deletedAt);

export async function cachedLibrary(): Promise<LibraryItem[] | null> {
  return ((await db.meta.get(ownKey('library:', KEY)))?.value as LibraryItem[] | undefined) ?? null;
}

/** The entries of the account, newest change first. */
export async function getLibrary(): Promise<LibraryItem[]> {
  const who = asker();
  const r = await api<{ items: LibraryItem[] }>('/library');
  const items = alive(r.items).sort((a, b) => b.seq - a.seq);
  await who.keep('library:', KEY, items);
  return items;
}

/** Writes one idea under the device's id; `baseSeq` is the state it is changed from (none for a new one). */
export async function putIdea(id: string, name: string, body: IdeaBody, baseSeq?: number): Promise<Idea> {
  const who = asker();
  const r = await api<{ item: Idea }>(`/library/${id}`, { method: 'PUT', body: { kind: 'idea', name, body, ...(baseSeq !== undefined ? { baseSeq } : {}) } });
  const cur = (await cachedLibrary()) ?? [];
  await who.keep('library:', KEY, [r.item, ...cur.filter((i) => i.id !== id)]);
  return r.item;
}

export async function removeItem(id: string): Promise<void> {
  const who = asker();
  try {
    await api<{ removed: true }>(`/library/${id}`, { method: 'DELETE' });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  await who.keep('library:', KEY, ((await cachedLibrary()) ?? []).filter((i) => i.id !== id));
}

/** The entry as it stands now, when it was changed from another device first (the server's 409 `stale`). */
export function staleItem(e: unknown): Idea | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { item?: Idea } | undefined)?.item ?? null) : null;
}

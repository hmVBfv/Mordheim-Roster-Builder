/* The Library on the server (server/src/routes-library.ts, ADR 0023): one's own ideas – later factions, NPCs,
   groups and scenarios – with the account, private to it. The last list is kept on the device (under the
   account's own key) so it reads offline; writing needs the connection. */
import type { NpcProfile, OpponentProfile, ScenarioNpc } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export type Topic = 'campaign' | 'faction' | 'warband' | 'other';
export const TOPIC_NAMES: Record<Topic, string> = { campaign: 'Campaign', faction: 'Faction', warband: 'Warband', other: 'Something else' };
export const TOPICS = Object.keys(TOPIC_NAMES) as Topic[];

/** The limits the server holds to (server/src/library.ts). */
export const MAX_IDEA = 20_000;
export const MAX_NAME = 120;
export const MAX_STATUS = 200;

/** The entries an entry points to (server/src/library.ts, wish #74): ids of other entries; older entries have none. */
export interface Linked { links?: string[] }
export interface IdeaBody { text: string; topic: Topic }
/** A faction as the Library keeps it; its `name` is the English one. */
export interface FactionBody extends Linked { de: string; status: string; lore: string }
/** An NPC outside any campaign (server/src/library.ts): the world's NPC with its faction as a name. `statlineTts`/`profile` as in a world's NPC. */
export interface NpcBody extends Linked { de: string; status: string; faction: string; named: boolean; statlineTts: string; profile: NpcProfile | null }
/** A group of opponents outside any campaign (server/src/library.ts): the campaign's group without ids of its own skills. */
export interface GroupBody extends Linked { note: string; profiles: OpponentProfile[] }
/** A scenario outside any campaign (server/src/library.ts): the campaign's scenario without a title of its own (the entry's `name`); its NPCs keep their hidden parts. */
export interface ScenarioBody extends Linked { body: string; npcStatlines: string; npcs: ScenarioNpc[] }
/** A place of the world (server/src/library.ts, wish #73): the German name, a tag to sort it by ("Region", "Town" …) and the lore behind it. */
export interface LocationBody extends Linked { de: string; type: string; lore: string }
/** A group of one's own warbands: the ids of the warbands in it (server/src/library.ts); the entry's `name` is the group's. */
export interface WarbandGroupBody { warbands: string[] }
/** The warbands marked as favourites (server/src/library.ts, wish #95): their ids; the entry's `name` is only a label. */
export type WarbandFavouritesBody = WarbandGroupBody;
export interface LibraryItem<B = unknown> { id: string; kind: string; name: string; body: B; createdAt: string; updatedAt: string; deletedAt: string | null; seq: number }
export type Idea = LibraryItem<IdeaBody>;
export type Faction = LibraryItem<FactionBody>;
export type LibraryNpc = LibraryItem<NpcBody>;
export type LibraryGroup = LibraryItem<GroupBody>;
export type LibraryScenario = LibraryItem<ScenarioBody>;
export type LibraryWarbandGroup = LibraryItem<WarbandGroupBody>;
export type LibraryLocation = LibraryItem<LocationBody>;
export type LibraryWarbandFavourites = LibraryItem<WarbandFavouritesBody>;

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

/** Writes one entry under the device's id; `baseSeq` is the state it is changed from (none for a new one). */
export async function putItem<B>(kind: 'idea' | 'faction' | 'npc' | 'group' | 'scenario' | 'warband_group' | 'location' | 'warband_favourites', id: string, name: string, body: B, baseSeq?: number): Promise<LibraryItem<B>> {
  const who = asker();
  const r = await api<{ item: LibraryItem<B> }>(`/library/${id}`, { method: 'PUT', body: { kind, name, body, ...(baseSeq !== undefined ? { baseSeq } : {}) } });
  const cur = (await cachedLibrary()) ?? [];
  await who.keep('library:', KEY, [r.item, ...cur.filter((i) => i.id !== id)]);
  return r.item;
}
export const putIdea = (id: string, name: string, body: IdeaBody, baseSeq?: number) => putItem<IdeaBody>('idea', id, name, body, baseSeq);
export const putFaction = (id: string, name: string, body: FactionBody, baseSeq?: number) => putItem<FactionBody>('faction', id, name, body, baseSeq);

export const putNpc = (id: string, name: string, body: NpcBody, baseSeq?: number) => putItem<NpcBody>('npc', id, name, body, baseSeq);

export const putScenario = (id: string, name: string, body: ScenarioBody, baseSeq?: number) => putItem<ScenarioBody>('scenario', id, name, body, baseSeq);
export const putWarbandGroup = (id: string, name: string, body: WarbandGroupBody, baseSeq?: number) => putItem<WarbandGroupBody>('warband_group', id, name, body, baseSeq);
export const putWarbandFavourites = (id: string, name: string, body: WarbandFavouritesBody, baseSeq?: number) => putItem<WarbandFavouritesBody>('warband_favourites', id, name, body, baseSeq);
export const putLocation = (id: string, name: string, body: LocationBody, baseSeq?: number) => putItem<LocationBody>('location', id, name, body, baseSeq);
export const putGroup = (id: string, name: string, body: GroupBody, baseSeq?: number) => putItem<GroupBody>('group', id, name, body, baseSeq);

/** The profiles with no link to a campaign's own skills: that skill is only known there, so the copy keeps its name and tooltip. */
export const withoutRefs = (profiles: OpponentProfile[]): OpponentProfile[] => profiles.map((p) => ({ ...p, skills: p.skills.map((s) => ({ name: s.name, text: s.text })) }));

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
export function staleItem<B = unknown>(e: unknown): LibraryItem<B> | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { item?: LibraryItem<B> } | undefined)?.item ?? null) : null;
}

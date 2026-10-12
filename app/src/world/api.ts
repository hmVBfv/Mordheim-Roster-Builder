/* A campaign's world on the server (phase 4b3b; server/src/routes-world.ts):
   factions, the NPCs under them and the reputation log. Mechanics are open,
   so every member gets all of it; a leader (with the authenticator) writes.
   The last answer is kept on the device (under the account's own key, like
   the notes), so the world still shows without a connection; writing needs
   the connection, and every write answers with the whole world. */
import { api } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export interface Faction { id: string; nameDe: string; nameEn: string; publicStatus: string; updatedAt: string; seq: number }
export interface Npc { id: string; factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string; updatedAt: string; seq: number }
export interface ReputationEvent { id: string; warbandId: string; warband: string; factionId: string; delta: number; reason: string; battleId: string | null; actor: string; createdAt: string; seq: number }
export interface World { factions: Faction[]; npcs: Npc[]; reputation: ReputationEvent[]; seq: number }

/** The limits the server holds to (server/src/world.ts). */
export const LIMITS = { name: 120, status: 200, statline: 2_000, reason: 500, step: 100 } as const;

const key = (cid: string) => ownKey('world:', cid);
const keep = (cid: string, who = asker()) => async (w: World & { removed?: boolean }): Promise<World> => {
  const world: World & { removed?: boolean } = { ...w };
  delete world.removed; // the answer to a removal says whether anything was removed; the world kept is the world
  await who.keep('world:', cid, world);
  return world;
};

export async function cachedWorld(cid: string): Promise<World | null> {
  return ((await db.meta.get(key(cid)))?.value as World | undefined) ?? null;
}

export const getWorld = (cid: string) => api<World>(`/campaigns/${cid}/world`).then(keep(cid));

export interface FactionBody { nameDe: string; nameEn: string; publicStatus: string }
export const putFaction = (cid: string, id: string, body: FactionBody) =>
  api<World>(`/campaigns/${cid}/world/factions/${id}`, { method: 'PUT', body }).then(keep(cid));
export const removeFaction = (cid: string, id: string) =>
  api<World>(`/campaigns/${cid}/world/factions/${id}`, { method: 'DELETE' }).then(keep(cid));

export interface NpcBody { factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string }
export const putNpc = (cid: string, id: string, body: NpcBody) =>
  api<World>(`/campaigns/${cid}/world/npcs/${id}`, { method: 'PUT', body }).then(keep(cid));
export const removeNpc = (cid: string, id: string) =>
  api<World>(`/campaigns/${cid}/world/npcs/${id}`, { method: 'DELETE' }).then(keep(cid));

export interface ReputationBody { warbandId: string; factionId: string; delta: number; reason: string; battleId: string | null }
export const addReputation = (cid: string, id: string, body: ReputationBody) =>
  api<World>(`/campaigns/${cid}/world/reputation/${id}`, { method: 'PUT', body }).then(keep(cid));
export const removeReputation = (cid: string, id: string) =>
  api<World>(`/campaigns/${cid}/world/reputation/${id}`, { method: 'DELETE' }).then(keep(cid));

/** A faction or NPC by its English name, or its German one when that is all it has. */
export const nameOf = (x: { nameEn: string; nameDe: string }) => x.nameEn || x.nameDe;
/** The other language's name, when there is one and it differs. */
export const otherName = (x: { nameEn: string; nameDe: string }) => (x.nameEn && x.nameDe && x.nameEn !== x.nameDe ? x.nameDe : '');

/** A step of reputation as it is written: +2, −1 (a real minus sign). */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** What each warband stands at with a faction: the sum of its events. Only a warband with an event is listed, the best standing first. */
export function standings(world: World, factionId: string): { warbandId: string; warband: string; value: number; events: number }[] {
  const by = new Map<string, { warbandId: string; warband: string; value: number; events: number }>();
  for (const e of world.reputation.filter((x) => x.factionId === factionId)) {
    const cur = by.get(e.warbandId) ?? { warbandId: e.warbandId, warband: e.warband, value: 0, events: 0 };
    cur.value += e.delta;
    cur.events += 1;
    by.set(e.warbandId, cur);
  }
  return [...by.values()].sort((a, b) => b.value - a.value || a.warband.localeCompare(b.warband));
}

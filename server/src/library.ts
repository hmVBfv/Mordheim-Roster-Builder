/* The Library in the database (ADR 0023): a person's own ideas – later factions, NPCs, groups and scenarios –
   with the account, private to it. Plain functions; the routes ask who may. An entry is written under the
   device's id, changed only from the state it was seen in (`baseSeq`), and taken out as a tombstone. */
import { z } from 'zod';
import type { DB } from './db.ts';
import { MAX_PROFILES, NpcProfileBody, Profile } from './opponents.ts';
import { ScenarioBody } from './scenarios.ts';

export const KINDS = ['idea', 'faction', 'npc', 'group', 'scenario', 'warband_group'] as const;
export type Kind = (typeof KINDS)[number];
/** The kinds the server reads: all of them since the scenarios came. */
export const ACTIVE_KINDS: readonly Kind[] = ['idea', 'faction', 'npc', 'group', 'scenario', 'warband_group'];
/** Entries a person may keep, and the text of one. */
export const MAX_ITEMS = 500;

const NAME = z.string().trim().min(1).max(120);
const Idea = z.object({
  text: z.string().max(20_000),
  /** What the idea is about; "Make a …" comes later. */
  topic: z.enum(['campaign', 'faction', 'warband', 'other']).default('other'),
}).strict();
/** A faction as a person writes it: the German name next to the English one (the entry's `name`), what the players may read of it, and the lore behind it. */
const Faction = z.object({
  de: z.string().trim().max(120).default(''),
  status: z.string().trim().max(200).default(''),
  lore: z.string().max(20_000).default(''),
}).strict();
/** An NPC outside any campaign: the world's NPC without its faction id – the faction is only a name here, matched when the NPC goes into a world. */
const Npc = z.object({
  de: z.string().trim().max(120).default(''),
  status: z.string().trim().max(200).default(''),
  faction: z.string().trim().max(120).default(''),
  named: z.boolean().default(false),
  statlineTts: z.string().max(12_000).default(''),
  profile: NpcProfileBody.nullable().default(null),
}).strict();
/** A group of opponents outside any campaign: a campaign's group (server/src/opponents.ts) without its name (the entry's `name`) and its `baseSeq`. */
const Group = z.object({
  note: z.string().max(4000).default(''),
  profiles: z.array(Profile).max(MAX_PROFILES).default([]),
}).strict();
/** A scenario outside any campaign: a campaign's scenario (server/src/scenarios.ts) without its title (the entry's `name`) and its `baseSeq`. Its NPCs keep their hidden parts (ADR 0022); nobody but the owner reads it. */
const Scenario = ScenarioBody.omit({ title: true, baseSeq: true });
/** A group of one's own warbands (the list's folders): the ids of the warbands in it, each in at most one group – the client moves one warband from group to group. */
const WarbandGroup = z.object({
  warbands: z.array(z.string().min(1).max(64)).max(500).default([]).refine((l) => new Set(l).size === l.length, { message: 'a warband twice' }),
}).strict();
const BODIES: Partial<Record<Kind, z.ZodType>> = { idea: Idea, faction: Faction, npc: Npc, group: Group, scenario: Scenario, warband_group: WarbandGroup };

interface Row { id: string; owner_id: string; kind: Kind; name: string; body: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number }
export interface Item { id: string; kind: Kind; name: string; body: unknown; createdAt: string; updatedAt: string; deletedAt: string | null; seq: number }

const view = (r: Row): Item => ({ id: r.id, kind: r.kind, name: r.name, body: JSON.parse(r.body) as unknown, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, seq: r.seq });

export type Checked = { ok: true; name: string; body: unknown } | { ok: false; problem: string };

export function checkItem(kind: string, name: unknown, body: unknown): Checked {
  if (!ACTIVE_KINDS.includes(kind as Kind)) return { ok: false, problem: `no ${kind} in the Library yet` };
  const n = NAME.safeParse(name);
  if (!n.success) return { ok: false, problem: 'a name of 1 to 120 characters' };
  const b = BODIES[kind as Kind]!.safeParse(body);
  if (!b.success) return { ok: false, problem: `the ${kind} does not fit: ${b.error.issues[0]?.message ?? 'invalid'}` };
  return { ok: true, name: n.data, body: b.data };
}

const rowOf = (db: DB, id: string) => db.prepare('SELECT * FROM library_items WHERE id = ?').get(id) as Row | undefined;
const nextSeq = (db: DB, owner: string) => (db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM library_items WHERE owner_id = ?').get(owner) as { s: number }).s + 1;

/** Whose an entry is, or null where there is none. */
export const ownerOf = (db: DB, id: string): string | null => rowOf(db, id)?.owner_id ?? null;

/** What the owner has, or has that is newer than `since` (graves included). */
export function listItems(db: DB, owner: string, since = 0): { items: Item[]; seq: number } {
  const rows = db.prepare('SELECT * FROM library_items WHERE owner_id = ? AND seq > ? ORDER BY seq').all(owner, since) as Row[];
  const top = (db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM library_items WHERE owner_id = ?').get(owner) as { s: number }).s;
  return { items: rows.map(view), seq: top };
}

export type Put = { ok: true; item: Item; created: boolean } | { ok: false; status: 409; error: 'stale' | 'removed' | 'exists' | 'full'; item?: Item };

export function putItem(db: DB, owner: string, p: { id: string; kind: Kind; name: string; body: unknown; baseSeq?: number }, now: Date): Put {
  return db.transaction((): Put => {
    const there = rowOf(db, p.id);
    const body = JSON.stringify(p.body);
    const at = now.toISOString();
    if (there && there.owner_id !== owner) return { ok: false, status: 409, error: 'exists' };
    if (there?.deleted_at) return { ok: false, status: 409, error: 'removed' };
    if (!there) {
      const n = (db.prepare('SELECT COUNT(*) AS n FROM library_items WHERE owner_id = ? AND deleted_at IS NULL').get(owner) as { n: number }).n;
      if (n >= MAX_ITEMS) return { ok: false, status: 409, error: 'full' };
      db.prepare('INSERT INTO library_items (id, owner_id, kind, name, body, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, owner, p.kind, p.name, body, at, at, nextSeq(db, owner));
      return { ok: true, item: view(rowOf(db, p.id)!), created: true };
    }
    // the same words again (an answer lost on the way): nothing changes
    if (there.kind === p.kind && there.name === p.name && there.body === body) return { ok: true, item: view(there), created: false };
    if (p.baseSeq !== there.seq) return { ok: false, status: 409, error: 'stale', item: view(there) };
    db.prepare('UPDATE library_items SET name = ?, body = ?, updated_at = ?, seq = ? WHERE id = ?').run(p.name, body, at, nextSeq(db, owner), p.id);
    return { ok: true, item: view(rowOf(db, p.id)!), created: false };
  })();
}

/** Takes an entry out (a grave); false when the owner has no such entry. Taking it out twice is the same. */
export function removeItem(db: DB, owner: string, id: string, now: Date): boolean {
  return db.transaction(() => {
    const there = rowOf(db, id);
    if (!there || there.owner_id !== owner) return false;
    if (!there.deleted_at) db.prepare('UPDATE library_items SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(now.toISOString(), now.toISOString(), nextSeq(db, owner), id);
    return true;
  })();
}

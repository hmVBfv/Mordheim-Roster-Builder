/* The campaign world in the database (phase 4b3b; concept.md 4.9, ADR 0002,
   ADR 0011): factions, the NPCs that belong to them, and the reputation each
   warband earns with a faction – a log of events whose sum is the standing.

   This is mechanics, and mechanics are open: every member of the campaign
   reads all of it. The truth behind an NPC stays in the background (leaders
   only); a leader puts an NPC here when the players may know it exists. Only
   the campaign's leaders (with the authenticator) write. A reputation event
   is never edited – a mistake is taken out (a tombstone) and the log keeps
   who did it. The log carries ids and kinds, never the words. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';
import { NpcProfileBody, type NpcProfileInput } from './opponents.ts';

const iso = (d: Date) => d.toISOString();

/** More than a campaign needs; a ceiling against a runaway client. */
export const MAX_FACTIONS = 100;
export const MAX_NPCS = 500;
export const MAX_EVENTS = 5_000;
/** The text form of an NPC's values: the rules of a profile alone can fill 6,000 characters. */
export const MAX_STATLINE = 12_000;

const Name = z.string().trim().max(120).default('');
const named = (b: { nameDe: string; nameEn: string }) => b.nameDe !== '' || b.nameEn !== '';
const NAMED = { message: 'a name, in German or English', path: ['nameEn'] };

export const FactionBody = z.object({
  nameDe: Name,
  nameEn: Name,
  /** What everybody in the campaign may read: "holds the docks", "in hiding". */
  publicStatus: z.string().trim().max(200).default(''),
}).strict().refine(named, NAMED);
export type FactionInput = z.infer<typeof FactionBody>;

export const NpcBody = z.object({
  factionId: z.string().max(64).nullable().default(null),
  nameDe: Name,
  nameEn: Name,
  /** Alive, dead, now leads …: what everybody in the campaign may read. */
  publicStatus: z.string().trim().max(200).default(''),
  /** The profile and rules as the table needs them, in plain text: what the form writes from the values, or what a leader typed by hand. */
  statlineTts: z.string().max(MAX_STATLINE).default(''),
  /** A named, unique person (a character with a name), against a kind of creature or an anonymous hand. */
  named: z.boolean().default(false),
  /** The values in the form: characteristics, save, skills, equipment, rules. Without them the text above is all there is. */
  profile: NpcProfileBody.nullable().default(null),
}).strict().refine(named, NAMED);
export type NpcInput = z.infer<typeof NpcBody>;

export const ReputationBody = z.object({
  warbandId: z.string().max(64),
  factionId: z.string().max(64),
  /** A step up or down; never nothing. */
  delta: z.number().int().min(-100).max(100).refine((n) => n !== 0, { message: 'a change, not nothing' }),
  reason: z.string().trim().min(1).max(500),
  battleId: z.string().max(64).nullable().default(null),
}).strict();
export type ReputationInput = z.infer<typeof ReputationBody>;

interface FactionRow { id: string; campaign_id: string; name_de: string; name_en: string; public_status: string; created_by: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number }
interface NpcRow { id: string; campaign_id: string; faction_id: string | null; name_de: string; name_en: string; public_status: string; statline_tts: string; named: number; profile: string; created_by: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number }
interface EventRow { id: string; campaign_id: string; warband_id: string; faction_id: string; delta: number; reason: string; battle_id: string | null; actor_id: string; created_at: string; deleted_at: string | null; seq: number }

export interface Faction { id: string; nameDe: string; nameEn: string; publicStatus: string; updatedAt: string; seq: number }
export interface Npc { id: string; factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string; named: boolean; profile: NpcProfileInput | null; updatedAt: string; seq: number }
export interface ReputationEvent { id: string; warbandId: string; warband: string; factionId: string; delta: number; reason: string; battleId: string | null; actor: string; createdAt: string; seq: number }
export interface World { factions: Faction[]; npcs: Npc[]; reputation: ReputationEvent[] }

const factionById = (db: DB, id: string) => db.prepare('SELECT * FROM factions WHERE id = ?').get(id) as FactionRow | undefined;
const npcById = (db: DB, id: string) => db.prepare('SELECT * FROM npcs WHERE id = ?').get(id) as NpcRow | undefined;
const eventById = (db: DB, id: string) => db.prepare('SELECT * FROM reputation_events WHERE id = ?').get(id) as EventRow | undefined;

const factionOut = (f: FactionRow): Faction => ({ id: f.id, nameDe: f.name_de, nameEn: f.name_en, publicStatus: f.public_status, updatedAt: f.updated_at, seq: f.seq });
const npcOut = (n: NpcRow, liveFaction: Set<string>): Npc => ({
  id: n.id, factionId: n.faction_id && liveFaction.has(n.faction_id) ? n.faction_id : null, nameDe: n.name_de, nameEn: n.name_en,
  publicStatus: n.public_status, statlineTts: n.statline_tts, named: n.named === 1, profile: n.profile ? (JSON.parse(n.profile) as NpcProfileInput) : null, updatedAt: n.updated_at, seq: n.seq,
});

const label = (f: { name_en: string; name_de: string }) => f.name_en || f.name_de;

/** Everything of the world, for every member alike: factions and NPCs by name, the reputation log newest first. Events of a removed faction go with it. */
export function listWorld(db: DB, campaignId: string): World {
  const factions = (db.prepare('SELECT * FROM factions WHERE campaign_id = ? AND deleted_at IS NULL').all(campaignId) as FactionRow[])
    .sort((a, b) => label(a).localeCompare(label(b)));
  const live = new Set(factions.map((f) => f.id));
  const npcs = (db.prepare('SELECT * FROM npcs WHERE campaign_id = ? AND deleted_at IS NULL').all(campaignId) as NpcRow[])
    .sort((a, b) => label(a).localeCompare(label(b)));
  const events = db.prepare(`SELECT r.*, coalesce(w.name, '(removed warband)') AS warband, u.display_name AS actor
    FROM reputation_events r LEFT JOIN warbands w ON w.id = r.warband_id JOIN users u ON u.id = r.actor_id
    WHERE r.campaign_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at DESC, r.seq DESC`).all(campaignId) as (EventRow & { warband: string; actor: string })[];
  return {
    factions: factions.map(factionOut),
    npcs: npcs.map((n) => npcOut(n, live)),
    reputation: events.filter((e) => live.has(e.faction_id)).map((e) => ({
      id: e.id, warbandId: e.warband_id, warband: e.warband, factionId: e.faction_id, delta: e.delta, reason: e.reason, battleId: e.battle_id, actor: e.actor, createdAt: e.created_at, seq: e.seq,
    })),
  };
}

/** The newest change to anything of the world – a removal included – so a device that holds an older state asks again. */
export const worldSeq = (db: DB, campaignId: string) => (db.prepare(`SELECT coalesce(max(n), 0) AS n FROM (
  SELECT max(seq) AS n FROM factions WHERE campaign_id = ? UNION ALL SELECT max(seq) FROM npcs WHERE campaign_id = ? UNION ALL SELECT max(seq) FROM reputation_events WHERE campaign_id = ?)`)
  .get(campaignId, campaignId, campaignId) as { n: number }).n;

export type Put<T> = { ok: true; row: T } | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };
const invalid = (problem: string): { ok: false; status: 400; error: string; problem: string } => ({ ok: false, status: 400, error: 'invalid', problem });
const count = (db: DB, table: 'factions' | 'npcs' | 'reputation_events', campaignId: string) =>
  (db.prepare(`SELECT count(*) AS n FROM ${table} WHERE campaign_id = ? AND deleted_at IS NULL`).get(campaignId) as { n: number }).n;

/** Makes a faction under the device's id, or changes it. */
export function putFaction(db: DB, campaignId: string, id: string, input: FactionInput, by: { id: string }, now: Date): Put<FactionRow> {
  return db.transaction((): Put<FactionRow> => {
    const cur = factionById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (!cur) {
      if (count(db, 'factions', campaignId) >= MAX_FACTIONS) return invalid(`a campaign holds at most ${MAX_FACTIONS} factions`);
      const seq = audit(db, { actorId: by.id, action: 'world.faction.create', targetType: 'faction', targetId: id, campaignId, visibility: 'public' }, now);
      db.prepare('INSERT INTO factions (id, campaign_id, name_de, name_en, public_status, created_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, campaignId, input.nameDe, input.nameEn, input.publicStatus, by.id, iso(now), iso(now), seq);
      return { ok: true, row: factionById(db, id)! };
    }
    if (cur.name_de === input.nameDe && cur.name_en === input.nameEn && cur.public_status === input.publicStatus) return { ok: true, row: cur };
    const seq = audit(db, { actorId: by.id, action: 'world.faction.edit', targetType: 'faction', targetId: id, campaignId, visibility: 'public' }, now);
    db.prepare('UPDATE factions SET name_de = ?, name_en = ?, public_status = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.nameDe, input.nameEn, input.publicStatus, iso(now), seq, id);
    return { ok: true, row: factionById(db, id)! };
  })();
}

/** Takes a faction out; its NPCs stay, without a faction, and its reputation leaves the view with it. */
export function removeFaction(db: DB, campaignId: string, id: string, by: { id: string }, now: Date): 'ok' | 'gone' | 'unknown' {
  return db.transaction(() => {
    const f = factionById(db, id);
    if (!f || f.campaign_id !== campaignId) return 'unknown';
    if (f.deleted_at) return 'gone';
    const seq = audit(db, { actorId: by.id, action: 'world.faction.remove', targetType: 'faction', targetId: id, campaignId, visibility: 'public' }, now);
    db.prepare('UPDATE factions SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), iso(now), seq, id);
    return 'ok';
  })();
}

export function putNpc(db: DB, campaignId: string, id: string, input: NpcInput, by: { id: string }, now: Date): Put<NpcRow> {
  // the values as one canonical text, so "unchanged" is a comparison of strings
  const profile = input.profile ? JSON.stringify(input.profile) : '';
  const named01 = input.named ? 1 : 0;
  return db.transaction((): Put<NpcRow> => {
    const cur = npcById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (input.factionId) {
      const f = factionById(db, input.factionId);
      if (!f || f.campaign_id !== campaignId || f.deleted_at) return invalid('no such faction in this campaign');
    }
    if (!cur) {
      if (count(db, 'npcs', campaignId) >= MAX_NPCS) return invalid(`a campaign holds at most ${MAX_NPCS} NPCs`);
      const seq = audit(db, { actorId: by.id, action: 'world.npc.create', targetType: 'npc', targetId: id, campaignId, visibility: 'public' }, now);
      db.prepare('INSERT INTO npcs (id, campaign_id, faction_id, name_de, name_en, public_status, statline_tts, named, profile, created_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, campaignId, input.factionId, input.nameDe, input.nameEn, input.publicStatus, input.statlineTts, named01, profile, by.id, iso(now), iso(now), seq);
      return { ok: true, row: npcById(db, id)! };
    }
    if (cur.faction_id === input.factionId && cur.name_de === input.nameDe && cur.name_en === input.nameEn && cur.public_status === input.publicStatus && cur.statline_tts === input.statlineTts && cur.named === named01 && cur.profile === profile) return { ok: true, row: cur };
    const seq = audit(db, { actorId: by.id, action: 'world.npc.edit', targetType: 'npc', targetId: id, campaignId, visibility: 'public' }, now);
    db.prepare('UPDATE npcs SET faction_id = ?, name_de = ?, name_en = ?, public_status = ?, statline_tts = ?, named = ?, profile = ?, updated_at = ?, seq = ? WHERE id = ?')
      .run(input.factionId, input.nameDe, input.nameEn, input.publicStatus, input.statlineTts, named01, profile, iso(now), seq, id);
    return { ok: true, row: npcById(db, id)! };
  })();
}

export function removeNpc(db: DB, campaignId: string, id: string, by: { id: string }, now: Date): 'ok' | 'gone' | 'unknown' {
  return db.transaction(() => {
    const n = npcById(db, id);
    if (!n || n.campaign_id !== campaignId) return 'unknown';
    if (n.deleted_at) return 'gone';
    const seq = audit(db, { actorId: by.id, action: 'world.npc.remove', targetType: 'npc', targetId: id, campaignId, visibility: 'public' }, now);
    db.prepare('UPDATE npcs SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), iso(now), seq, id);
    return 'ok';
  })();
}

/** Records a reputation event under the device's id. Events are not edited: the same id with the same content is the same event, with other content a conflict. */
export function addReputation(db: DB, campaignId: string, id: string, input: ReputationInput, by: { id: string }, now: Date): Put<EventRow> {
  return db.transaction((): Put<EventRow> => {
    const cur = eventById(db, id);
    if (cur) {
      const same = cur.campaign_id === campaignId && !cur.deleted_at && cur.warband_id === input.warbandId && cur.faction_id === input.factionId
        && cur.delta === input.delta && cur.reason === input.reason && cur.battle_id === input.battleId;
      return same ? { ok: true, row: cur } : { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    }
    const enrolled = db.prepare("SELECT 1 AS x FROM enrolments WHERE campaign_id = ? AND warband_id = ? AND status = 'active'").get(campaignId, input.warbandId);
    if (!enrolled) return invalid('no such warband in this campaign');
    const f = factionById(db, input.factionId);
    if (!f || f.campaign_id !== campaignId || f.deleted_at) return invalid('no such faction in this campaign');
    const battle = input.battleId ? battleById(db, input.battleId) : undefined;
    if (input.battleId && (!battle || battle.campaign_id !== campaignId)) return invalid('no such battle in this campaign');
    if (count(db, 'reputation_events', campaignId) >= MAX_EVENTS) return invalid(`a campaign holds at most ${MAX_EVENTS} reputation events`);
    const seq = audit(db, { actorId: by.id, action: 'world.reputation.add', targetType: 'reputation_event', targetId: id, campaignId, visibility: 'public', payload: { delta: input.delta, battle: input.battleId } }, now);
    db.prepare('INSERT INTO reputation_events (id, campaign_id, warband_id, faction_id, delta, reason, battle_id, actor_id, created_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, campaignId, input.warbandId, input.factionId, input.delta, input.reason, input.battleId, by.id, iso(now), seq);
    return { ok: true, row: eventById(db, id)! };
  })();
}

export function removeReputation(db: DB, campaignId: string, id: string, by: { id: string }, now: Date): 'ok' | 'gone' | 'unknown' {
  return db.transaction(() => {
    const e = eventById(db, id);
    if (!e || e.campaign_id !== campaignId) return 'unknown';
    if (e.deleted_at) return 'gone';
    const seq = audit(db, { actorId: by.id, action: 'world.reputation.remove', targetType: 'reputation_event', targetId: id, campaignId, visibility: 'public' }, now);
    db.prepare('UPDATE reputation_events SET deleted_at = ?, seq = ? WHERE id = ?').run(iso(now), seq, id);
    return 'ok';
  })();
}

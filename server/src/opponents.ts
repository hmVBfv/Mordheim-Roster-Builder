/* Opponents in the database (concept.md 4.9, ADR 0002, ADR 0011): groups of
   profiles a leader sets against the warbands, and the campaign's own skills
   with their tooltip text. Leaders' own – read and written by the campaign's
   leaders with the authenticator; for everyone else they do not exist. The
   server checks the shape and the sizes and judges nothing about the values:
   a characteristic is what the leader wrote ("3(4)", "D6"). The log carries
   ids, never the words. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

const iso = (d: Date) => d.toISOString();
const STAT = z.string().trim().max(12);

/** Ceilings against a runaway client – far above what a campaign needs. */
export const MAX_GROUPS = 200;
export const MAX_PROFILES = 40;
export const MAX_SKILLS = 300;

const Skill = z.object({ name: z.string().trim().min(1).max(80), text: z.string().max(2000).default(''), ref: z.string().max(64).optional() }).strict();
const From = z.object({ kind: z.enum(['unit', 'hired', 'dramatis', 'beast', 'warrior', 'npc']), key: z.string().max(160), label: z.string().max(240) }).strict();
const Stats = z.object({ M: STAT, WS: STAT, BS: STAT, S: STAT, T: STAT, W: STAT, I: STAT, A: STAT, Ld: STAT }).partial().strict();

/** The values of an NPC of the world or of a scenario: an opponent's profile without its id, name, number and note. */
export const NpcProfileBody = z.object({
  type: z.string().trim().max(60).default(''),
  profile: Stats,
  sv: STAT.default(''),
  skills: z.array(Skill).max(40).default([]),
  equipment: z.string().max(2000).default(''),
  rules: z.string().max(6000).default(''),
  from: From.nullable().default(null),
}).strict();
export type NpcProfileInput = z.infer<typeof NpcProfileBody>;

const Profile = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().max(120),
  type: z.string().trim().max(60).default(''),
  count: z.number().int().min(1).max(50).default(1),
  profile: Stats,
  sv: STAT.default(''),
  skills: z.array(Skill).max(40).default([]),
  equipment: z.string().max(2000).default(''),
  rules: z.string().max(6000).default(''),
  note: z.string().max(4000).default(''),
  from: From.nullable().default(null),
}).strict();

export const GroupBody = z.object({
  name: z.string().trim().min(1).max(120),
  note: z.string().max(4000).default(''),
  profiles: z.array(Profile).max(MAX_PROFILES).default([]),
  /** The `seq` the device edited from; 0 for a new group. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type GroupInput = z.infer<typeof GroupBody>;

export const SkillBody = z.object({
  name: z.string().trim().min(1).max(80),
  text: z.string().max(2000).default(''),
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type SkillInput = z.infer<typeof SkillBody>;

interface Row { id: string; campaign_id: string; name: string; created_at: string; updated_at: string; deleted_at: string | null; seq: number; by: string }
export interface Group { id: string; name: string; note: string; profiles: GroupInput['profiles']; updatedBy: string; updatedAt: string; seq: number }
export interface OwnSkill { id: string; name: string; text: string; updatedBy: string; updatedAt: string; seq: number }

const groupRow = (db: DB, id: string) => db.prepare('SELECT g.*, u.display_name AS by FROM opponent_groups g JOIN users u ON u.id = g.updated_by WHERE g.id = ?').get(id) as (Row & { body: string }) | undefined;
const skillRow = (db: DB, id: string) => db.prepare('SELECT s.*, u.display_name AS by FROM opponent_skills s JOIN users u ON u.id = s.updated_by WHERE s.id = ?').get(id) as (Row & { text: string }) | undefined;
const toGroup = (r: Row & { body: string }): Group => { const b = JSON.parse(r.body) as { note: string; profiles: Group['profiles'] }; return { id: r.id, name: r.name, note: b.note, profiles: b.profiles, updatedBy: r.by, updatedAt: r.updated_at, seq: r.seq }; };
const toSkill = (r: Row & { text: string }): OwnSkill => ({ id: r.id, name: r.name, text: r.text, updatedBy: r.by, updatedAt: r.updated_at, seq: r.seq });

/** Everything of the campaign's opponents, and the newest change among them (removals included). */
export function listOpponents(db: DB, campaignId: string): { groups: Group[]; skills: OwnSkill[]; seq: number } {
  const groups = (db.prepare('SELECT g.*, u.display_name AS by FROM opponent_groups g JOIN users u ON u.id = g.updated_by WHERE g.campaign_id = ? AND g.deleted_at IS NULL ORDER BY g.name COLLATE NOCASE, g.created_at').all(campaignId) as (Row & { body: string })[]).map(toGroup);
  const skills = (db.prepare('SELECT s.*, u.display_name AS by FROM opponent_skills s JOIN users u ON u.id = s.updated_by WHERE s.campaign_id = ? AND s.deleted_at IS NULL ORDER BY s.name COLLATE NOCASE').all(campaignId) as (Row & { text: string })[]).map(toSkill);
  const seq = (db.prepare('SELECT max(m) AS m FROM (SELECT max(seq) AS m FROM opponent_groups WHERE campaign_id = ? UNION ALL SELECT max(seq) FROM opponent_skills WHERE campaign_id = ?)').get(campaignId, campaignId) as { m: number | null }).m ?? 0;
  return { groups, skills, seq };
}

type Wrong = { ok: false; status: 404 | 409; error: string; current?: Group | OwnSkill };

export function putGroup(db: DB, campaignId: string, id: string, input: GroupInput, by: string, now: Date): { ok: true; group: Group } | Wrong {
  return db.transaction((): { ok: true; group: Group } | Wrong => {
    const cur = groupRow(db, id);
    if (cur && cur.campaign_id !== campaignId) return { ok: false, status: 409, error: 'exists' };
    if (cur?.deleted_at) return { ok: false, status: 404, error: 'not_found' };
    const body = JSON.stringify({ note: input.note, profiles: input.profiles });
    if (!cur) {
      const n = (db.prepare('SELECT count(*) AS n FROM opponent_groups WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (n >= MAX_GROUPS) return { ok: false, status: 409, error: 'too_many' };
      if (input.baseSeq !== 0) return { ok: false, status: 404, error: 'not_found' };
      const seq = audit(db, { actorId: by, action: 'opponents.group.create', targetType: 'opponent_group', targetId: id, campaignId, visibility: 'leader', payload: { profiles: input.profiles.length } }, now);
      db.prepare('INSERT INTO opponent_groups (id, campaign_id, name, body, created_by, updated_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, campaignId, input.name, body, by, by, iso(now), iso(now), seq);
      return { ok: true, group: toGroup(groupRow(db, id)!) };
    }
    if (cur.name === input.name && cur.body === body) return { ok: true, group: toGroup(cur) };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: toGroup(cur) };
    const seq = audit(db, { actorId: by, action: 'opponents.group.edit', targetType: 'opponent_group', targetId: id, campaignId, visibility: 'leader', payload: { profiles: input.profiles.length } }, now);
    db.prepare('UPDATE opponent_groups SET name = ?, body = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.name, body, by, iso(now), seq, id);
    return { ok: true, group: toGroup(groupRow(db, id)!) };
  })();
}

export function putSkill(db: DB, campaignId: string, id: string, input: SkillInput, by: string, now: Date): { ok: true; skill: OwnSkill } | Wrong {
  return db.transaction((): { ok: true; skill: OwnSkill } | Wrong => {
    const cur = skillRow(db, id);
    if (cur && cur.campaign_id !== campaignId) return { ok: false, status: 409, error: 'exists' };
    if (cur?.deleted_at) return { ok: false, status: 404, error: 'not_found' };
    if (!cur) {
      const n = (db.prepare('SELECT count(*) AS n FROM opponent_skills WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (n >= MAX_SKILLS) return { ok: false, status: 409, error: 'too_many' };
      if (input.baseSeq !== 0) return { ok: false, status: 404, error: 'not_found' };
      const seq = audit(db, { actorId: by, action: 'opponents.skill.create', targetType: 'opponent_skill', targetId: id, campaignId, visibility: 'leader' }, now);
      db.prepare('INSERT INTO opponent_skills (id, campaign_id, name, text, created_by, updated_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, campaignId, input.name, input.text, by, by, iso(now), iso(now), seq);
      return { ok: true, skill: toSkill(skillRow(db, id)!) };
    }
    if (cur.name === input.name && cur.text === input.text) return { ok: true, skill: toSkill(cur) };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: toSkill(cur) };
    const seq = audit(db, { actorId: by, action: 'opponents.skill.edit', targetType: 'opponent_skill', targetId: id, campaignId, visibility: 'leader' }, now);
    db.prepare('UPDATE opponent_skills SET name = ?, text = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.name, input.text, by, iso(now), seq, id);
    return { ok: true, skill: toSkill(skillRow(db, id)!) };
  })();
}

/** Takes a group or a skill out; its row stays (deleted_at) and its number moves, so devices learn of it. Gone already: nothing to do. */
export function removeOpponent(db: DB, campaignId: string, table: 'opponent_groups' | 'opponent_skills', id: string, by: string, now: Date): { ok: true; seq: number } | Wrong {
  return db.transaction((): { ok: true; seq: number } | Wrong => {
    const cur = (table === 'opponent_groups' ? groupRow(db, id) : skillRow(db, id));
    if (!cur || cur.campaign_id !== campaignId) return { ok: false, status: 404, error: 'not_found' };
    if (cur.deleted_at) return { ok: true, seq: cur.seq };
    const seq = audit(db, { actorId: by, action: table === 'opponent_groups' ? 'opponents.group.remove' : 'opponents.skill.remove', targetType: table === 'opponent_groups' ? 'opponent_group' : 'opponent_skill', targetId: id, campaignId, visibility: 'leader' }, now);
    db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?`).run(iso(now), by, iso(now), seq, id);
    return { ok: true, seq };
  })();
}

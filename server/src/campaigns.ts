/* Campaigns in the database (phase 4a; concept.md 3, 4.1, 4.2, 4.4): a
   campaign, its members with their roles, and the warbands entered in it.
   Plain functions over the database; who may is asked in the routes through
   can() with the actor's role. Every change is in the audit log with the
   campaign and visibility "public": mechanics are open to all members
   (ADR 0002). Changing a warband's enrolment gives the warband a new seq, so
   its owner's devices learn it on the next sync. */
import { randomUUID } from 'node:crypto';
import { effectiveHouse, houseDifferences, type StageTotals } from '@mordheim/core';
import { z } from 'zod';
import { audit } from './accounts.ts';
import { listBattles, type BattleSummary } from './battles.ts';
import type { DB } from './db.ts';
import { gameData, totalsOf } from './rules.ts';
import { createWarband, versionOf, warbandById, type WarbandRow } from './warbands.ts';

export const ROLES = ['leader', 'player', 'viewer'] as const;
export type CampaignRole = (typeof ROLES)[number];
export type EnrolmentStatus = 'pending' | 'active' | 'declined' | 'left';

const iso = (d: Date) => d.toISOString();

export interface CampaignRow { id: string; name: string; round: number; house_rules: string; created_by: string; created_at: string; updated_at: string; archived_at: string | null }
interface MemberRow { campaign_id: string; user_id: string; role: CampaignRole; joined_at: string; left_at: string | null; added_by: string | null }
export interface EnrolmentRow {
  id: string; campaign_id: string; warband_id: string; player_id: string; status: EnrolmentStatus; from_round: number | null;
  created_at: string; confirmed_by: string | null; confirmed_at: string | null; ended_by: string | null; ended_at: string | null;
}
interface TagRow { id: string; warband_id: string; rev: number; kind: string; campaign_id: string; battle_id: string | null; round: number; totals: string; created_by: string; created_at: string; superseded_by: string | null }

/* ---- what leaves the server ---- */

export interface CampaignSummary { id: string; name: string; round: number; role: CampaignRole; members: number; warbands: number; createdAt: string }
/** `canLead` (the authenticator is set up) only for leaders to see. */
export interface Member { userId: string; displayName: string; username: string; role: CampaignRole; joinedAt: string; canLead?: boolean }
export interface Tag { id: string; kind: string; rev: number; round: number; battleId: string | null; totals: StageTotals; createdBy: string; createdAt: string }
export interface Enrolment {
  id: string; warbandId: string; playerId: string; player: string; status: EnrolmentStatus; fromRound: number | null;
  createdAt: string; confirmedAt: string | null;
  /** wbName: the warband type's name, so a list needs no rules on the device. */
  name: string; wbType: string; wbName: string; headRev: number; updatedAt: string;
  /** The latest tag in this campaign (start, after a battle), with its frozen totals. */
  tag: Tag | null;
  /** Phase 4a4, read from its newest version: the house rules in which it differs from the campaign's (keys), and the districts it holds. */
  houseDiffers: string[];
  districts: { id: string; name: string; hold: string }[];
}
export interface CampaignView {
  campaign: { id: string; name: string; round: number; houseRules: unknown; createdAt: string; updatedAt: string };
  role: CampaignRole;
  members: Member[];
  enrolments: Enrolment[];
  battles: BattleSummary[];
}

const tagOf = (t: TagRow & { by: string }): Tag => ({
  id: t.id, kind: t.kind, rev: t.rev, round: t.round, battleId: t.battle_id, totals: JSON.parse(t.totals) as StageTotals, createdBy: t.by, createdAt: t.created_at,
});

/* ---- reading ---- */

export const campaignById = (db: DB, id: string) => db.prepare('SELECT * FROM campaigns WHERE id = ? AND archived_at IS NULL').get(id) as CampaignRow | undefined;
export const enrolmentById = (db: DB, id: string) => db.prepare('SELECT * FROM enrolments WHERE id = ?').get(id) as EnrolmentRow | undefined;

/** The user's role in the campaign, or null when not (or no longer) a member. */
export function roleIn(db: DB, campaignId: string, userId: string): CampaignRole | null {
  const m = db.prepare('SELECT role FROM members WHERE campaign_id = ? AND user_id = ? AND left_at IS NULL').get(campaignId, userId) as { role: CampaignRole } | undefined;
  return m?.role ?? null;
}

export function listCampaigns(db: DB, userId: string): CampaignSummary[] {
  const rows = db.prepare(`SELECT c.*, m.role,
      (SELECT count(*) FROM members x WHERE x.campaign_id = c.id AND x.left_at IS NULL) AS n_members,
      (SELECT count(*) FROM enrolments e WHERE e.campaign_id = c.id AND e.status = 'active') AS n_warbands
    FROM campaigns c JOIN members m ON m.campaign_id = c.id AND m.user_id = ? AND m.left_at IS NULL
    WHERE c.archived_at IS NULL ORDER BY c.updated_at DESC`).all(userId) as (CampaignRow & { role: CampaignRole; n_members: number; n_warbands: number })[];
  return rows.map((c) => ({ id: c.id, name: c.name, round: c.round, role: c.role, members: c.n_members, warbands: c.n_warbands, createdAt: c.created_at }));
}

/** The latest tag of a warband in a campaign that no correction replaced. */
export function latestTag(db: DB, warbandId: string, campaignId: string): Tag | null {
  const t = db.prepare(`SELECT t.*, u.display_name AS by FROM tags t JOIN users u ON u.id = t.created_by
    WHERE t.warband_id = ? AND t.campaign_id = ? AND t.superseded_by IS NULL ORDER BY t.round DESC, t.created_at DESC LIMIT 1`).get(warbandId, campaignId) as (TagRow & { by: string }) | undefined;
  return t ? tagOf(t) : null;
}

export function tagsOf(db: DB, warbandId: string, campaignId: string): Tag[] {
  const rows = db.prepare(`SELECT t.*, u.display_name AS by FROM tags t JOIN users u ON u.id = t.created_by
    WHERE t.warband_id = ? AND t.campaign_id = ? AND t.superseded_by IS NULL ORDER BY t.round, t.created_at`).all(warbandId, campaignId) as (TagRow & { by: string })[];
  return rows.map(tagOf);
}

/** What every member sees of a warband's newest version beside its tag: where its house rules differ from the campaign's, the districts it holds. */
function standing(db: DB, warbandId: string, rev: number, house: unknown): Pick<Enrolment, 'houseDiffers' | 'districts'> {
  const r = db.prepare("SELECT json_extract(data, '$.house') AS house, json_extract(data, '$.campaign.districts') AS districts FROM warband_versions WHERE warband_id = ? AND rev = ?")
    .get(warbandId, rev) as { house: string | null; districts: string | null } | undefined;
  const parse = (x: string | null | undefined): unknown => { try { return x ? JSON.parse(x) as unknown : null; } catch { return null; } };
  const held = Object.entries((parse(r?.districts) ?? {}) as Record<string, unknown>).filter(([, v]) => v === 'foothold' || v === 'control');
  return {
    houseDiffers: houseDifferences(house, parse(r?.house)),
    districts: held.map(([id, hold]) => ({ id, name: gameData().DISTRICTS.find((d) => d.id === id)?.name ?? id, hold: String(hold) })),
  };
}

export function campaignView(db: DB, c: CampaignRow, role: CampaignRole): CampaignView {
  const house = JSON.parse(c.house_rules) as unknown;
  const members = (db.prepare(`SELECT m.*, u.display_name, u.username, u.totp_enabled_at FROM members m JOIN users u ON u.id = m.user_id
    WHERE m.campaign_id = ? AND m.left_at IS NULL ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'player' THEN 1 ELSE 2 END, u.display_name COLLATE NOCASE`).all(c.id) as
    (MemberRow & { display_name: string; username: string; totp_enabled_at: string | null })[])
    .map((m) => ({ userId: m.user_id, displayName: m.display_name, username: m.username, role: m.role, joinedAt: m.joined_at, ...(role === 'leader' ? { canLead: !!m.totp_enabled_at } : {}) }));
  const enrolments = (db.prepare(`SELECT e.*, u.display_name AS player, w.name, w.wb_type, w.head_rev, w.updated_at AS w_updated FROM enrolments e
    JOIN users u ON u.id = e.player_id JOIN warbands w ON w.id = e.warband_id
    WHERE e.campaign_id = ? AND e.status IN ('pending', 'active') ORDER BY e.created_at`).all(c.id) as
    (EnrolmentRow & { player: string; name: string; wb_type: string; head_rev: number; w_updated: string })[])
    .map((e) => ({
      id: e.id, warbandId: e.warband_id, playerId: e.player_id, player: e.player, status: e.status, fromRound: e.from_round,
      createdAt: e.created_at, confirmedAt: e.confirmed_at, name: e.name, wbType: e.wb_type, wbName: gameData().WARBANDS[e.wb_type]?.name ?? e.wb_type, headRev: e.head_rev, updatedAt: e.w_updated,
      tag: latestTag(db, e.warband_id, c.id),
      ...standing(db, e.warband_id, e.head_rev, house),
    }));
  return {
    campaign: { id: c.id, name: c.name, round: c.round, houseRules: house, createdAt: c.created_at, updatedAt: c.updated_at },
    role, members, enrolments, battles: listBattles(db, c.id),
  };
}

/** The open enrolment of a warband in this campaign. */
export function openEnrolment(db: DB, campaignId: string, warbandId: string): EnrolmentRow | undefined {
  return db.prepare("SELECT * FROM enrolments WHERE campaign_id = ? AND warband_id = ? AND status IN ('pending', 'active')").get(campaignId, warbandId) as EnrolmentRow | undefined;
}

/* ---- writing; each in one transaction, each with its audit entry ---- */

const log = (db: DB, actorId: string, action: string, campaignId: string, target: { type: string; id: string }, payload: unknown, now: Date) =>
  audit(db, { actorId, action, targetType: target.type, targetId: target.id, campaignId, visibility: 'public', payload }, now);

const touch = (db: DB, campaignId: string, now: Date) => db.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').run(iso(now), campaignId);

export function createCampaign(db: DB, c: { name: string; by: string }, now: Date): CampaignRow {
  const id = randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO campaigns (id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, c.name, c.by, iso(now), iso(now));
    db.prepare("INSERT INTO members (campaign_id, user_id, role, joined_at, added_by) VALUES (?, ?, 'leader', ?, ?)").run(id, c.by, iso(now), c.by);
    log(db, c.by, 'campaign.create', id, { type: 'campaign', id }, { name: c.name }, now);
  })();
  return campaignById(db, id)!;
}

export function renameCampaign(db: DB, c: CampaignRow, name: string, by: string, now: Date): void {
  db.transaction(() => {
    db.prepare('UPDATE campaigns SET name = ?, updated_at = ? WHERE id = ?').run(name, iso(now), c.id);
    log(db, by, 'campaign.rename', c.id, { type: 'campaign', id: c.id }, { from: c.name, to: name }, now);
  })();
}

/* ---- the campaign's house rules (phase 4a4) ---- */

const grades = (keys: string[]) => z.object(Object.fromEntries(keys.map((k) => [k, z.boolean()]))).partial().strict();
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const orNone = (min: number, max: number) => z.union([z.literal(''), int(min, max)]);
/** House rules as a leader sends them: the Roster Builder's keys, each within the bounds the app offers. */
export const HouseRulesBody = z.object({
  startGold: orNone(0, 10_000), min: orNone(1, 40), max: orNone(1, 40), heroes: int(1, 20),
  priceAll: int(25, 200), priceArmour: int(25, 200), priceBP: int(25, 200), priceMissile: int(25, 200),
  clubSurcharge: int(0, 50), slingSurcharge: int(0, 50), rangedCap: int(0, 100),
  armourBodyOnly: z.boolean(), freeDagger: z.boolean(), miscHench: z.boolean(), freeMarket: z.boolean(), allSkills: z.boolean(), showRarity: z.boolean(),
  rangedCapOn: z.boolean(), rerollOne: z.boolean(), eqLimitOn: z.boolean(), hireNewLeader: z.boolean(), hsEquip: z.boolean(),
  hsGrades: grades(['1a', '1b', '1c', '2a']), dpGrades: grades(['core', '1a', '1b', '1c', '2a']),
  notes: z.string().max(2000),
}).partial().strict();

/** Sets the campaign's house rules – for every warband in it; "Show rarity" is each player's own display. Logged with the rules that changed. */
export function setHouseRules(db: DB, c: CampaignRow, rules: z.infer<typeof HouseRulesBody>, by: string, now: Date): void {
  const next = { ...effectiveHouse(rules), showRarity: false };
  const changed = houseDifferences(JSON.parse(c.house_rules) as unknown, next);
  const notes = (effectiveHouse(JSON.parse(c.house_rules) as unknown).notes ?? '') !== next.notes;
  if (!changed.length && !notes) return;
  db.transaction(() => {
    db.prepare('UPDATE campaigns SET house_rules = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), iso(now), c.id);
    log(db, by, 'campaign.house_rules', c.id, { type: 'campaign', id: c.id }, { changed, notes }, now);
  })();
}

const leaders = (db: DB, campaignId: string) => (db.prepare("SELECT count(*) AS n FROM members WHERE campaign_id = ? AND role = 'leader' AND left_at IS NULL").get(campaignId) as { n: number }).n;

/** Adds a member, brings a former one back, or changes a role. False when it would leave the campaign without a leader. */
export function setMember(db: DB, campaignId: string, userId: string, role: CampaignRole, by: string, now: Date): boolean {
  return db.transaction(() => {
    const cur = db.prepare('SELECT * FROM members WHERE campaign_id = ? AND user_id = ?').get(campaignId, userId) as MemberRow | undefined;
    if (cur && !cur.left_at && cur.role === role) return true;
    if (cur && !cur.left_at && cur.role === 'leader' && leaders(db, campaignId) <= 1) return false;
    if (cur) db.prepare('UPDATE members SET role = ?, left_at = NULL, joined_at = CASE WHEN left_at IS NULL THEN joined_at ELSE ? END, added_by = ? WHERE campaign_id = ? AND user_id = ?').run(role, iso(now), by, campaignId, userId);
    else db.prepare('INSERT INTO members (campaign_id, user_id, role, joined_at, added_by) VALUES (?, ?, ?, ?, ?)').run(campaignId, userId, role, iso(now), by);
    log(db, by, cur && !cur.left_at ? 'member.role' : 'member.add', campaignId, { type: 'user', id: userId }, { role }, now);
    touch(db, campaignId, now);
    return true;
  })();
}

/** A member leaves (or is taken out): their open enrolments end with them. False for the last leader. */
export function removeMember(db: DB, campaignId: string, userId: string, by: string, now: Date): boolean {
  return db.transaction(() => {
    const role = roleIn(db, campaignId, userId);
    if (!role) return true;
    if (role === 'leader' && leaders(db, campaignId) <= 1) return false;
    db.prepare('UPDATE members SET left_at = ? WHERE campaign_id = ? AND user_id = ?').run(iso(now), campaignId, userId);
    log(db, by, 'member.remove', campaignId, { type: 'user', id: userId }, { role }, now);
    const open = db.prepare("SELECT * FROM enrolments WHERE campaign_id = ? AND player_id = ? AND status IN ('pending', 'active')").all(campaignId, userId) as EnrolmentRow[];
    for (const e of open) endEnrolment(db, e, e.status === 'pending' ? 'declined' : 'left', by, now);
    touch(db, campaignId, now);
    return true;
  })();
}

function setWarbandCampaign(db: DB, warbandId: string, campaignId: string | null, seq: number): void {
  db.prepare('UPDATE warbands SET campaign_id = ?, seq = ? WHERE id = ?').run(campaignId, seq, warbandId);
}

export interface NewEnrolment {
  campaign: CampaignRow; playerId: string; warbandId: string; data: Record<string, unknown>; json: string;
  copiedFrom: { id: string; rev: number } | null; appVersion: string;
}

/** A warband entered in the campaign: a new warband of the player's own (the copy), waiting for a leader. */
export function enrol(db: DB, e: NewEnrolment, now: Date): { enrolment: EnrolmentRow; warband: WarbandRow } {
  return db.transaction(() => {
    createWarband(db, {
      id: e.warbandId, ownerId: e.playerId, data: e.data, json: e.json, source: e.copiedFrom ? 'copy' : 'import',
      note: `entered in ${e.campaign.name}`.slice(0, 200), appVersion: e.appVersion, copiedFrom: e.copiedFrom,
    }, now);
    const id = randomUUID();
    db.prepare("INSERT INTO enrolments (id, campaign_id, warband_id, player_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").run(id, e.campaign.id, e.warbandId, e.playerId, iso(now));
    const seq = log(db, e.playerId, 'enrolment.create', e.campaign.id, { type: 'warband', id: e.warbandId }, { enrolment: id }, now);
    setWarbandCampaign(db, e.warbandId, e.campaign.id, seq);
    touch(db, e.campaign.id, now);
    return { enrolment: enrolmentById(db, id)!, warband: warbandById(db, e.warbandId)! };
  })();
}

export type Confirmed = { ok: true; enrolment: EnrolmentRow; tag: Tag } | { ok: false; error: 'unreadable' };

/** A leader confirms: the warband takes part from the current round, and its latest version is marked "start" with frozen totals. */
export function confirmEnrolment(db: DB, c: CampaignRow, e: EnrolmentRow, by: string, now: Date): Confirmed {
  return db.transaction((): Confirmed => {
    const w = warbandById(db, e.warband_id)!;
    const totals = totalsOf(versionOf(db, w.id, w.head_rev)?.data);
    if (!totals) return { ok: false, error: 'unreadable' };
    db.prepare("UPDATE enrolments SET status = 'active', from_round = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?").run(c.round, by, iso(now), e.id);
    const tagId = randomUUID();
    db.prepare("INSERT INTO tags (id, warband_id, rev, kind, campaign_id, round, totals, created_by, created_at) VALUES (?, ?, ?, 'start', ?, ?, ?, ?, ?)")
      .run(tagId, w.id, w.head_rev, c.id, c.round, JSON.stringify(totals), by, iso(now));
    const seq = log(db, by, 'enrolment.confirm', c.id, { type: 'warband', id: w.id }, { enrolment: e.id, tag: tagId, rev: w.head_rev, totals }, now);
    setWarbandCampaign(db, w.id, c.id, seq);
    touch(db, c.id, now);
    return { ok: true, enrolment: enrolmentById(db, e.id)!, tag: latestTag(db, w.id, c.id)! };
  })();
}

/** Declined (by a leader, while pending) or left (withdrawn by the player, or taken out by a leader): the warband is free again. */
export function endEnrolment(db: DB, e: EnrolmentRow, status: 'declined' | 'left', by: string, now: Date): void {
  db.transaction(() => {
    db.prepare('UPDATE enrolments SET status = ?, ended_by = ?, ended_at = ? WHERE id = ?').run(status, by, iso(now), e.id);
    const seq = log(db, by, status === 'declined' ? 'enrolment.decline' : 'enrolment.leave', e.campaign_id, { type: 'warband', id: e.warband_id }, { enrolment: e.id }, now);
    setWarbandCampaign(db, e.warband_id, null, seq);
    touch(db, e.campaign_id, now);
  })();
}

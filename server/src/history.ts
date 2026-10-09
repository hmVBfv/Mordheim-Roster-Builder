/* Taking over a running campaign (phase 4a5; roadmap 4a5, Decision E): the
   battles played before the campaign moved into the app, recorded
   afterwards by a leader – its history. Such a battle is closed from the
   start and holds only who fought it and how it ended for them: no
   protocol, no aftermath, no marks. The warbands' own files carry no
   earlier stages (Decision E: the group's saves have none), so what a
   warband brings in is where the comparison starts.

   History is written only while the campaign has no battle of its own,
   and the campaign's round follows it: after the last battle of the
   history. The warbands' start marks move along – what entered is the
   state at the takeover, so it is marked after that round (a new start
   tag on the same version with the same frozen totals; the old one is
   superseded, never changed). */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById, OUTCOMES, participantIds, type BattleRow } from './battles.ts';
import { openEnrolment, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { gameData } from './rules.ts';

const iso = (d: Date) => d.toISOString();

export const PastBattleBody = z.object({
  round: z.number().int().min(1).max(99),
  title: z.string().max(120).default(''),
  district: z.string().max(40).default(''),
  /** The day it was played, as the leader gives it. */
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  /** Who fought it, and how it ended for them (the Roster Builder's outcomes; empty: not known). */
  outcomes: z.record(z.string().regex(/^[0-9a-fA-F-]{36}$/), z.enum(OUTCOMES)),
}).strict();
export type PastBattle = z.infer<typeof PastBattleBody>;

export type Written = { ok: true; battle: BattleRow } | { ok: false; status: 400 | 409; error: string; problem?: string };

/** Does the campaign have a battle of its own (played in the app)? Then its history is closed. */
const ownBattle = (db: DB, campaignId: string) => !!db.prepare('SELECT 1 FROM battles WHERE campaign_id = ? AND taken_over = 0 LIMIT 1').get(campaignId);

/** The round the history ends with (0: none). */
export const historyRound = (db: DB, campaignId: string) =>
  (db.prepare('SELECT coalesce(max(round), 0) AS r FROM battles WHERE campaign_id = ? AND taken_over = 1').get(campaignId) as { r: number }).r;

const closedHistory = { ok: false, status: 409, error: 'history_closed', problem: 'the campaign has played a battle in the app; its history is closed' } as const;

/** The campaign's round follows its history; each active warband's start mark moves with it. */
function followHistory(db: DB, c: CampaignRow, by: string, now: Date): void {
  const round = historyRound(db, c.id);
  const was = (db.prepare('SELECT round FROM campaigns WHERE id = ?').get(c.id) as { round: number }).round;
  if (round !== was) {
    db.prepare('UPDATE campaigns SET round = ?, updated_at = ? WHERE id = ?').run(round, iso(now), c.id);
    audit(db, { actorId: by, action: 'campaign.round', targetType: 'campaign', targetId: c.id, campaignId: c.id, visibility: 'public', payload: { round, history: true } }, now);
  }
  const starts = db.prepare(`SELECT t.* FROM tags t JOIN enrolments e ON e.warband_id = t.warband_id AND e.campaign_id = t.campaign_id AND e.status = 'active'
    WHERE t.campaign_id = ? AND t.kind = 'start' AND t.superseded_by IS NULL AND t.round <> ?`).all(c.id, round) as
    { id: string; warband_id: string; rev: number; totals: string }[];
  for (const t of starts) {
    const id = randomUUID();
    db.prepare("INSERT INTO tags (id, warband_id, rev, kind, campaign_id, round, totals, created_by, created_at) VALUES (?, ?, ?, 'start', ?, ?, ?, ?, ?)")
      .run(id, t.warband_id, t.rev, c.id, round, t.totals, by, iso(now));
    db.prepare('UPDATE tags SET superseded_by = ? WHERE id = ?').run(id, t.id);
    audit(db, { actorId: by, action: 'tag.move', targetType: 'warband', targetId: t.warband_id, campaignId: c.id, visibility: 'public', payload: { from: t.id, to: id, round } }, now);
  }
}

/** Records a battle of the history, or corrects one (the same id): its round, title, district, day, and who fought with their outcome. */
export function putPastBattle(db: DB, c: CampaignRow, id: string, p: PastBattle, by: string, now: Date): Written {
  return db.transaction((): Written => {
    if (ownBattle(db, c.id)) return closedHistory;
    const there = battleById(db, id);
    if (there && there.campaign_id !== c.id) return { ok: false, status: 409, error: 'exists' };
    const outcomes = new Map(Object.entries(p.outcomes).map(([w, o]) => [w.toLowerCase(), o]));
    const fought = [...outcomes.keys()];
    if (!fought.length) return { ok: false, status: 400, error: 'invalid', problem: 'a battle needs a warband that fought it' };
    if (fought.some((w) => openEnrolment(db, c.id, w)?.status !== 'active')) return { ok: false, status: 400, error: 'invalid', problem: 'only warbands entered and confirmed in the campaign fight its battles' };
    if (p.district && !gameData().DISTRICTS.some((d) => d.id === p.district)) return { ok: false, status: 400, error: 'invalid', problem: 'no such district' };
    const title = p.title.trim().replace(/\s+/g, ' ');
    if (there) {
      db.prepare('UPDATE battles SET round = ?, title = ?, district = ?, played_at = ? WHERE id = ?').run(p.round, title, p.district, p.playedOn, id);
      for (const w of participantIds(db, id)) if (!fought.includes(w)) db.prepare('DELETE FROM battle_participants WHERE battle_id = ? AND warband_id = ?').run(id, w);
    } else {
      db.prepare(`INSERT INTO battles (id, campaign_id, round, title, district, played_at, status, taken_over, created_by, created_at, updated_at, closed_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, 'closed', 1, ?, ?, ?, ?, 0)`).run(id, c.id, p.round, title, p.district, p.playedOn, by, iso(now), iso(now), iso(now));
    }
    for (const [w, outcome] of outcomes) {
      db.prepare(`INSERT INTO battle_participants (battle_id, warband_id, outcome) VALUES (?, ?, ?)
        ON CONFLICT (battle_id, warband_id) DO UPDATE SET outcome = excluded.outcome`).run(id, w, outcome);
    }
    const seq = audit(db, { actorId: by, action: there ? 'battle.history_update' : 'battle.history', targetType: 'battle', targetId: id, campaignId: c.id, visibility: 'public', payload: { ...p, title } }, now);
    db.prepare('UPDATE battles SET seq = ?, updated_at = ? WHERE id = ?').run(seq, iso(now), id);
    db.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').run(iso(now), c.id);
    followHistory(db, c, by, now);
    return { ok: true, battle: battleById(db, id)! };
  })();
}

export type Removed = { ok: true } | { ok: false; status: 409; error: string; problem?: string };

/** Takes a battle out of the history – while nothing refers to it: no note, picture or moved block. */
export function removePastBattle(db: DB, c: CampaignRow, b: BattleRow, by: string, now: Date): Removed {
  return db.transaction((): Removed => {
    if (!b.taken_over) return { ok: false, status: 409, error: 'not_history', problem: 'only a battle of the history is taken out' };
    if (ownBattle(db, c.id)) return closedHistory;
    const used = db.prepare('SELECT 1 FROM notes WHERE battle_id = ? UNION ALL SELECT 1 FROM attachments WHERE battle_id = ? UNION ALL SELECT 1 FROM timeline_positions WHERE campaign_id = ? AND segment LIKE ? LIMIT 1')
      .get(b.id, b.id, c.id, `b${b.id}:%`);
    if (used) return { ok: false, status: 409, error: 'in_use', problem: 'notes or pictures belong to this battle' };
    db.prepare('DELETE FROM battle_participants WHERE battle_id = ?').run(b.id);
    db.prepare('DELETE FROM battles WHERE id = ?').run(b.id);
    audit(db, { actorId: by, action: 'battle.history_remove', targetType: 'battle', targetId: b.id, campaignId: c.id, visibility: 'public', payload: { round: b.round, title: b.title } }, now);
    followHistory(db, c, by, now);
    return { ok: true };
  })();
}

/** A battle of the campaign's own may not take a round of its history. */
export function roundAfterHistory(db: DB, campaignId: string, round: number): string | null {
  const h = historyRound(db, campaignId);
  return round <= h ? `round ${round} was played before the app (its history ends with battle ${h})` : null;
}

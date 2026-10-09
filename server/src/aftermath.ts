/* After a battle (phase 4a4; concept.md 4.2–4.5, ADR 0003, ADR 0016): a
   leader closes it – the protocol is fixed, sealed notes open; each
   player marks their warband "after battle N" – the server compares the
   marked version with the one of the mark before, with core, and freezes
   totals and changes; then a leader moves the campaign on to the next
   round – warbands that did not fight are marked as having sat it out. */
import { randomUUID } from 'node:crypto';
import { battleEvidence, ctxOf, diffWarbands, loadSave, reconcile, stageTotals, type ReconciledChange, type WarbandState } from '@mordheim/core';
import { audit } from './accounts.ts';
import { participantIds, type BattleRow } from './battles.ts';
import { latestTag, type CampaignRow, type Tag } from './campaigns.ts';
import type { DB } from './db.ts';
import { gameData } from './rules.ts';
import { versionOf, warbandById } from './warbands.ts';

const iso = (d: Date) => d.toISOString();

export interface FrozenChange { kind: string; uid: number | string | null; name: string; changeKey: string; payload: unknown; eventRef: string | null; unexplained: boolean }

/** Closes a battle: its protocol is fixed, and the notes sealed for it open for everyone. */
export function closeBattle(db: DB, b: BattleRow, by: string, now: Date): void {
  db.transaction(() => {
    const seq = audit(db, { actorId: by, action: 'battle.close', targetType: 'battle', targetId: b.id, campaignId: b.campaign_id, visibility: 'public', payload: { round: b.round } }, now);
    db.prepare("UPDATE battles SET status = 'closed', closed_at = ?, updated_at = ?, seq = ? WHERE id = ?").run(iso(now), iso(now), seq, b.id);
    // devices asking for news of the notes learn that these opened
    db.prepare('UPDATE notes SET seq = ? WHERE sealed_until_battle = ?').run(seq, b.id);
  })();
}

const readState = (raw: unknown): WarbandState | null => {
  const r = loadSave(gameData(), raw);
  return r.ok ? r.state : null;
};

export type Marked = { ok: true; tag: Tag; changes: FrozenChange[] } | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };

/** Marks a version of a warband "after battle N": totals and changes frozen; a second mark corrects the first (it stays, superseded). */
export function markAfterBattle(db: DB, c: CampaignRow, b: BattleRow, warbandId: string, rev: number, by: string, now: Date): Marked {
  return db.transaction((): Marked => {
    if (b.status !== 'closed') return { ok: false, status: 409, error: 'open', problem: 'a battle is marked once it is closed' };
    if (b.taken_over) return { ok: false, status: 409, error: 'history', problem: 'a battle of the history, played before the app, is not marked' };
    if (!participantIds(db, b.id).includes(warbandId)) return { ok: false, status: 400, error: 'invalid', problem: 'this warband did not fight the battle' };
    const w = warbandById(db, warbandId)!;
    if (w.campaign_id !== c.id) return { ok: false, status: 409, error: 'invalid', problem: 'the warband is no longer in the campaign' };
    const v = versionOf(db, warbandId, rev);
    if (!v) return { ok: false, status: 404, error: 'not_found', problem: 'no such version' };
    // the mark before: the start, an earlier battle's, or a round sat out
    const before = db.prepare(`SELECT id, rev FROM tags WHERE warband_id = ? AND campaign_id = ? AND superseded_by IS NULL AND round < ?
      ORDER BY round DESC, created_at DESC LIMIT 1`).get(warbandId, c.id, b.round) as { id: string; rev: number } | undefined;
    if (!before) return { ok: false, status: 409, error: 'no_start', problem: 'the warband has no mark before this battle' };
    const sb = readState(versionOf(db, warbandId, before.rev)?.data);
    const sa = readState(v.data);
    if (!sb || !sa) return { ok: false, status: 400, error: 'invalid', problem: 'the rules cannot read this warband' };
    const changes: ReconciledChange[] = reconcile(diffWarbands(gameData(), sb, sa, b.round), battleEvidence(sa, b.id, b.round));
    const totals = stageTotals(ctxOf(gameData(), sa));
    const old = db.prepare("SELECT id FROM tags WHERE warband_id = ? AND battle_id = ? AND kind = 'after_battle' AND superseded_by IS NULL").get(warbandId, b.id) as { id: string } | undefined;
    const tagId = randomUUID();
    db.prepare("INSERT INTO tags (id, warband_id, rev, kind, campaign_id, battle_id, round, totals, created_by, created_at) VALUES (?, ?, ?, 'after_battle', ?, ?, ?, ?, ?, ?)")
      .run(tagId, warbandId, rev, c.id, b.id, b.round, JSON.stringify(totals), by, iso(now));
    if (old) db.prepare('UPDATE tags SET superseded_by = ? WHERE id = ?').run(tagId, old.id);
    const ins = db.prepare('INSERT INTO changes (tag_id, warband_id, battle_id, seq_in_tag, kind, uid, change_key, payload, event_ref, unexplained) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    changes.forEach((ch, i) => ins.run(tagId, warbandId, b.id, i, ch.kind, ch.hireUid ?? (ch.uid == null ? null : String(ch.uid)), ch.changeKey,
      JSON.stringify({ name: ch.name, ...ch.payload }), ch.eventRef, ch.unexplained ? 1 : 0));
    db.prepare('UPDATE battle_participants SET rev_after = ? WHERE battle_id = ? AND warband_id = ?').run(rev, b.id, warbandId);
    const seq = audit(db, { actorId: by, action: old ? 'tag.correct' : 'tag.after_battle', targetType: 'warband', targetId: warbandId, campaignId: c.id, visibility: 'public', payload: { battle: b.id, rev, tag: tagId, totals, changes: changes.length, unexplained: changes.filter((x) => x.unexplained).length } }, now);
    db.prepare('UPDATE battles SET seq = ?, updated_at = ? WHERE id = ?').run(seq, iso(now), b.id);
    db.prepare('UPDATE campaigns SET updated_at = ? WHERE id = ?').run(iso(now), c.id);
    return { ok: true, tag: latestTag(db, warbandId, c.id)!, changes: changesOf(db, tagId) };
  })();
}

export function changesOf(db: DB, tagId: string): FrozenChange[] {
  const rows = db.prepare('SELECT * FROM changes WHERE tag_id = ? ORDER BY seq_in_tag').all(tagId) as { kind: string; uid: string | null; change_key: string; payload: string; event_ref: string | null; unexplained: number }[];
  return rows.map((r) => {
    const p = JSON.parse(r.payload) as { name?: string } & Record<string, unknown>;
    const { name, ...payload } = p;
    return { kind: r.kind, uid: r.uid == null ? null : /^\d+$/.test(r.uid) ? Number(r.uid) : r.uid, name: name ?? '', changeKey: r.change_key, payload, eventRef: r.event_ref, unexplained: !!r.unexplained };
  });
}

/** The mark of each warband after this battle, for the battle's view. */
export function marksOf(db: DB, battleId: string): Record<string, { tagId: string; rev: number; totals: unknown; changes: number; unexplained: number; createdAt: string }> {
  const rows = db.prepare(`SELECT t.id, t.warband_id, t.rev, t.totals, t.created_at,
      (SELECT count(*) FROM changes x WHERE x.tag_id = t.id) AS n, (SELECT count(*) FROM changes x WHERE x.tag_id = t.id AND x.unexplained = 1) AS u
    FROM tags t WHERE t.battle_id = ? AND t.kind = 'after_battle' AND t.superseded_by IS NULL`).all(battleId) as { id: string; warband_id: string; rev: number; totals: string; created_at: string; n: number; u: number }[];
  return Object.fromEntries(rows.map((r) => [r.warband_id, { tagId: r.id, rev: r.rev, totals: JSON.parse(r.totals) as unknown, changes: r.n, unexplained: r.u, createdAt: r.created_at }]));
}

export type Advanced = { ok: true; round: number; satOut: string[] } | { ok: false; status: 409; error: string; problem: string };

/** The campaign moves on to the next round – once its battles are fought and closed. A warband entered that fought none of them sat it out: marked so, on its latest version. */
export function advanceRound(db: DB, c: CampaignRow, by: string, now: Date): Advanced {
  return db.transaction((): Advanced => {
    const next = c.round + 1;
    const battles = db.prepare('SELECT * FROM battles WHERE campaign_id = ? AND round = ?').all(c.id, next) as BattleRow[];
    if (!battles.length) return { ok: false, status: 409, error: 'no_battle', problem: `no battle of round ${next} yet` };
    if (battles.some((x) => x.status !== 'closed')) return { ok: false, status: 409, error: 'open', problem: `a battle of round ${next} is still open` };
    const fought = new Set(battles.flatMap((x) => participantIds(db, x.id)));
    const active = (db.prepare("SELECT warband_id FROM enrolments WHERE campaign_id = ? AND status = 'active'").all(c.id) as { warband_id: string }[]).map((r) => r.warband_id);
    const satOut: string[] = [];
    for (const wid of active.filter((w) => !fought.has(w))) {
      const w = warbandById(db, wid)!;
      const totals = (() => { const s = readState(versionOf(db, wid, w.head_rev)?.data); return s ? stageTotals(ctxOf(gameData(), s)) : null; })();
      if (!totals) continue;
      db.prepare("INSERT INTO tags (id, warband_id, rev, kind, campaign_id, round, totals, created_by, created_at) VALUES (?, ?, ?, 'sat_out', ?, ?, ?, ?, ?)")
        .run(randomUUID(), wid, w.head_rev, c.id, next, JSON.stringify(totals), by, iso(now));
      satOut.push(wid);
    }
    db.prepare('UPDATE campaigns SET round = ?, updated_at = ? WHERE id = ?').run(next, iso(now), c.id);
    audit(db, { actorId: by, action: 'campaign.round', targetType: 'campaign', targetId: c.id, campaignId: c.id, visibility: 'public', payload: { round: next, satOut } }, now);
    return { ok: true, round: next, satOut };
  })();
}


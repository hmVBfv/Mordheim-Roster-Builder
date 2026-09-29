/* Experience earned in battle, held until it is applied (legacy app.js
   grantXp, applyPendingXp, clearPendingXp, awardBattleXp).

   Mordheim awards experience in the post-battle sequence: +1 to a Hero for
   each enemy he puts out of action, +1 to every Hero and Henchman group that
   survives, +1 to the leader of the winning warband. Scenarios vary these, so
   the amounts are arguments. Earned points are held in campaign.xp rather
   than written straight onto the roster, so the whole battle can be tallied
   and applied in one go, and the reason for each point survives. */
import type { Casualty, Model, WarbandState, XpEntry } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { canEarnXp, modelLabel } from '../rules/casualties.ts';
import { unitDef } from '../rules/lookup.ts';
import { leaderUid } from '../rules/profile.ts';
import { campState, logEvent, nextLogId } from './log.ts';
import { update, type WarbandDraft } from './update.ts';

function ledger(d: WarbandDraft): XpEntry[] {
  const c = campState(d);
  if (!Array.isArray(c.xp)) c.xp = [];
  return c.xp as XpEntry[];
}

/** Holds `amount` experience for a model (draft level). */
export function grantXpOn(d: WarbandDraft, c: Ctx, uid: unknown, amount: unknown, reason: unknown, round?: unknown): XpEntry | null {
  const camp = campState(d);
  if (!camp.on) return null;
  const m = (d.models as Model[]).find((x) => x.uid === Number(uid));
  if (!m) return null;
  if (!canEarnXp(c, m)) return null;
  const rec: XpEntry = {
    id: nextLogId(d), round: round == null ? (camp.round ?? 0) : Number(round) || 0, uid: Number(uid),
    name: modelLabel(c, m), amount: Number(amount) || 0, reason: String(reason || ''), applied: false,
  };
  ledger(d).push(rec);
  return rec;
}

/** Writes the held experience onto the roster (draft level); returns the
    points applied. */
export function applyPendingXpOn(d: WarbandDraft, c: Ctx): number {
  const list = ledger(d).filter((x) => !x.applied);
  if (!list.length) return 0;
  // an object, like legacy: its integer keys run in ascending uid order
  const per: Record<string, number> = {};
  for (const x of list) per[x.uid] = (per[x.uid] || 0) + x.amount;
  let n = 0;
  for (const uid of Object.keys(per)) {
    const m = (d.models as Model[]).find((x) => x.uid === Number(uid));
    if (!m) continue;
    const gained = per[uid] as number;
    m.exp = (Number(m.exp) || 0) + gained;
    n += gained;
    const name = m.name || unitDef(c, m.uid_def)?.name;
    logEvent(d, 'xp', `${name} gained ${gained} experience.`, { uid: m.uid, name, gained, exp: Number(m.exp) || 0 });
  }
  for (const x of list) x.applied = true;
  return n;
}

export function grantXp(ctx: Ctx, uid: number, amount: number, reason: string, round?: number): WarbandState {
  return update(ctx, (d, c) => { grantXpOn(d, c, uid, amount, reason, round); });
}

export function applyPendingXp(ctx: Ctx): WarbandState {
  return update(ctx, (d, c) => { applyPendingXpOn(d, c); });
}

/** Discards the experience not yet applied. The interface asks first. */
export function clearPendingXp(ctx: Ctx): WarbandState {
  return update(ctx, (d) => {
    const c = campState(d);
    c.xp = ledger(d).filter((x) => x.applied);
  });
}

export interface BattleXpOptions {
  /** Experience for surviving; the rulebook's 1 unless the scenario differs. */
  survives?: number;
  /** Experience for the leader of the winning warband. */
  winningLeader?: number;
  /** Did we win? Default: read from the battle's outcome. */
  won?: boolean | null;
}

/** The post-battle award for one battle: +survives to every Hero and
    henchman group still standing, +winningLeader to our leader if we won. */
export function awardBattleXp(ctx: Ctx, battleId: number | null, opts?: BattleXpOptions): WarbandState {
  return update(ctx, (d, c) => {
    const camp = campState(d);
    if (!camp.on) return;
    const o = { survives: 1, winningLeader: 1, won: null as boolean | null, ...(opts ?? {}) };
    const bat = (camp.battles ?? []).find((b) => b.id === Number(battleId)) as { round?: number; outcome?: string } | undefined;
    const round = bat ? bat.round : camp.round;
    const won = o.won != null ? !!o.won : (bat ? /victor/i.test(bat.outcome || '') : false);
    // A warrior sitting the battle out did not survive it; nor did one carried
    // off dead, even if the roster has not caught up yet.
    const slain = new Set(((camp.casualties ?? []) as Casualty[])
      .filter((r) => r.round === round && r.result === 'dead' && r.victim.uid != null)
      .map((r) => r.victim.uid));
    for (const m of d.models as Model[]) {
      if ((Number(m.miss) || 0) > 0) continue;
      if (slain.has(m.uid) && (Number(m.qty) || 1) <= 1) continue;
      grantXpOn(d, c, m.uid, o.survives, 'survived the battle', round);
    }
    if (won) {
      const lu = leaderUid(c);
      const lm = lu != null ? (d.models as Model[]).find((x) => x.uid === lu) : null;
      if (lm && (Number(lm.miss) || 0) <= 0) grantXpOn(d, c, lu, o.winningLeader, 'led the winning warband', round);
    }
  });
}

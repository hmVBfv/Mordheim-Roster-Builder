/* Rules that ask for a roll after a battle and have consequences (Rob, 15.11.2026), next to the duties that ask for a choice (duties.ts):
   - the Marauders' "Eye of the Gods": 2D6 plus the battle's count; on 12+ (10+ with Tattooed Body, 13+ for the Norse, 11+ both) a lost battle turns
     the leader into a Chaos Spawn (his experience, skills, injuries and gear are lost; with a Spawn already, he is simply erased), a won battle gives
     the leader a Mark of the Dark Gods. Once the warband has a Mark the test is no longer taken;
   - the Hochland Huckster's "Slick Operator": a D6 between games: 2–6 the warband gains 2D6 gc, 1 he misses the next game.
   The dice are entered or rolled in the app (Rolled, ADR 0032); each result is recorded with its origin. */
import { ctxOf, type Ctx } from '../rules/context.ts';
import { goldCurrent, totalSpent } from '../rules/costs.ts';
import { leaderUid } from '../rules/profile.ts';
import type { Model, WarbandState } from '../state/types.ts';
import { addUnit } from '../warband/roster.ts';
import { setMark } from '../warband/advance.ts';
import { rememberUids, update } from '../warband/update.ts';
import { bookGoldOn } from './locationApply.ts';
import { postbattleOn, type Find, type PostBattleState, type Rolled } from './postbattle.ts';

export type RollDutyKind = 'eye' | 'slick';
export interface RollDutyLine {
  id: string;
  kind: RollDutyKind;
  title: string;
  text: string;
  /** The model it concerns (the leader, the Huckster). */
  uid: number;
  /** What was settled this round, or null. */
  resolved: { outcome: string; total?: number; text: string } | null;
}

export interface RollDutyInput {
  /** Eye of the Gods: how the battle ended for the warband, the count to add (Heroes out of action when lost, enemy models the leader took out when won), whether the leader fought. */
  result?: 'won' | 'lost' | 'draw';
  count?: number;
  leaderFought?: boolean;
  /** 2D6 for the Eye; the D6 for Slick Operator. */
  roll?: Rolled;
  /** Slick Operator on 2–6: the 2D6 of gold. */
  gold?: Rolled;
  /** Eye of the Gods, won, on the threshold: the Mark the leader chooses (a key of MARAUDER_MARKS). */
  mark?: string;
}

const ids = { eye: 'eye-of-the-gods', slick: 'slick-operator' } as const;
const roundRec = (s: WarbandState, round: number): PostBattleState | undefined =>
  (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];
const sum = (r?: Rolled) => (r?.value ?? []).reduce((a, b) => a + b, 0);
const diceOk = (r: Rolled | undefined, n: number) => !!r && r.value.length === n && r.value.every((v) => Number.isInteger(v) && v >= 1 && v <= 6);

/** The roll the Eye of the Gods needs: 12, less with Tattooed Body (10), more for the Norse (13, with Tattooed Body 11). */
export function eyeThreshold(ctx: Ctx): number {
  const lead = ctx.s.models.find((m) => m.uid === leaderUid(ctx));
  const tattooed = (lead?.skills ?? []).some((k) => String(k).toLowerCase() === 'tattooed body');
  const norse = ctx.s.subtype === 'norse';
  return (tattooed ? 10 : 12) + (norse ? 1 : 0);
}

/** The roll duties due after this battle. */
export function rollDutiesDue(ctx: Ctx, round: number): RollDutyLine[] {
  const done = roundRec(ctx.s, round)?.duties?.rolled ?? [];
  const out: RollDutyLine[] = [];
  const line = (kind: RollDutyKind, title: string, text: string, uid: number) => {
    const r = done.find((x) => x.id === ids[kind]);
    out.push({ id: ids[kind], kind, title, text, uid, resolved: r ? { outcome: r.outcome, total: r.total, text: r.text } : null });
  };
  if (ctx.s.wb === 'maraudersofchaos' && (!ctx.s.mark || done.some((x) => x.id === ids.eye))) { // with a Mark the test is no longer taken – but this round's result stays shown
    const lead = leaderUid(ctx);
    if (lead != null) line('eye', 'Eye of the Gods', `Roll 2D6 after the battle, plus 1 for each of your Heroes taken out of action if you lost, or for each enemy model the leader took out of action if you won. On ${eyeThreshold(ctx)}+ a lost battle turns the leader into a Chaos Spawn, a won one lets him choose a Mark of the Dark Gods. Not in effect if the leader did not fight.`, lead);
  }
  const hs = ctx.s.wb === 'hochland' ? ctx.s.models.find((m) => m.uid_def === 'huckster') : undefined;
  if (hs) line('slick', 'Slick Operator (Huckster)', 'Between games roll a D6: on 2–6 the warband gains 2D6 gc, on a 1 the Huckster misses the next game. Not together with the Banditry skill.', hs.uid);
  return out;
}

/** Why this cannot be settled with this input (null if it can). */
export function rollDutyProblem(ctx: Ctx, round: number, id: string, input: RollDutyInput): string | null {
  const d = rollDutiesDue(ctx, round).find((x) => x.id === id);
  if (!d) return 'There is no such rule.';
  if (d.resolved) return 'This is settled: take it back first.';
  if (d.kind === 'eye') {
    if (input.leaderFought === false) return null;
    if (!input.result) return 'Say how the battle ended.';
    if (!diceOk(input.roll, 2)) return 'Enter the two dice.';
    if (!Number.isInteger(input.count) || (input.count as number) < 0) return 'The count is a number from 0.';
    const hit = sum(input.roll) + (input.result === 'draw' ? 0 : (input.count as number)) >= eyeThreshold(ctx);
    if (hit && input.result === 'won' && !ctx.data.MARAUDER_MARKS.some((m) => m[0] === input.mark)) return 'Choose the Mark.';
    return null;
  }
  if (!diceOk(input.roll, 1)) return 'Enter the D6.';
  if (input.roll!.value[0]! >= 2 && !diceOk(input.gold, 2)) return 'Enter the 2D6 of gold.';
  return null;
}

/** Settles the rule with the dice and the consequences, recorded in the round with a find. A refused input leaves the state as it was. */
export function resolveRollDuty(ctx: Ctx, round: number, id: string, input: RollDutyInput): WarbandState {
  if (rollDutyProblem(ctx, round, id, input)) return ctx.s;
  const d = rollDutiesDue(ctx, round).find((x) => x.id === id)!;
  const source = `duty:${id}`;
  let s = ctx.s, outcome = 'nothing', text = '', total: number | undefined, gc = 0;
  const rolls: Rolled[] = [];
  if (d.kind === 'eye') {
    if (input.leaderFought === false) { outcome = 'not-in-effect'; text = 'The leader did not fight: the Eye of the Gods is not in effect.'; }
    else {
      const need = eyeThreshold(ctx);
      total = sum(input.roll) + (input.result === 'draw' ? 0 : input.count!);
      rolls.push(input.roll!);
      text = `Eye of the Gods: ${sum(input.roll)}${input.result === 'draw' ? '' : ` + ${input.count}`} = ${total} (needs ${need}+).`;
      if (total >= need && input.result === 'lost') {
        outcome = 'spawn';
        const goldBefore = goldCurrent(ctx);
        const hadSpawn = ctx.s.models.some((m) => m.uid_def === 'spawn');
        s = update(ctx, (dr) => { dr.models = (dr.models as Model[]).filter((m) => m.uid !== d.uid); rememberUids(dr); if (dr.leaderUid === d.uid) delete dr.leaderUid; });
        if (!hadSpawn) s = addUnit(ctxOf(ctx.data, s), 'spawn');
        s = update(ctxOf(ctx.data, s), (dr, c) => { dr.stash = dr.stash ?? { wyrd: 0, gold: null, items: [] }; dr.stash.gold = goldBefore + totalSpent(c); });
        text += hadSpawn ? ' The leader is erased from the roster (the warband has a Spawn already).' : ' The leader turns into a Chaos Spawn: his experience, skills, injuries and gear are lost.';
      } else if (total >= need && input.result === 'won') {
        outcome = 'mark';
        s = setMark(ctxOf(ctx.data, s), input.mark!);
        text += ` The leader takes a Mark: ${ctx.data.MARAUDER_MARKS.find((m) => m[0] === input.mark)![1]}.`;
      } else text += ' Nothing happens.';
    }
  } else {
    const die = input.roll!.value[0]!;
    rolls.push(input.roll!);
    if (die === 1) {
      outcome = 'misses';
      s = update(ctx, (dr) => { const m = (dr.models as Model[]).find((x) => x.uid === d.uid); if (m) { m.miss = (Number(m.miss) || 0) + 1; m.missWhy = 'Slick Operator'; } });
      text = 'Slick Operator: a 1 – the Huckster misses the next game.';
    } else {
      outcome = 'gold'; gc = sum(input.gold); rolls.push(input.gold!);
      s = update(ctx, (dr, c) => { bookGoldOn(dr, c, gc, `Slick Operator: ${gc} gc`, source); });
      text = `Slick Operator: a ${die} – the warband gains ${gc} gc.`;
    }
  }
  return update(ctxOf(ctx.data, s), (dr, c) => {
    const rec = postbattleOn(dr, c, round);
    const duties = rec.duties ?? { resolved: [] };
    duties.rolled = [...(duties.rolled ?? []), { id, rolls, total: total ?? sum(rolls[0]), outcome, text }];
    rec.duties = duties;
    const finds = rec.finds ?? [];
    finds.push({ id: finds.reduce((n, f) => Math.max(n, f.id), 0) + 1, kind: gc ? 'gold' : 'note', source, ...(gc ? { amount: gc } : {}), text } satisfies Find);
    rec.finds = finds;
  });
}

/** Takes back what can be taken back: the gold, the Mark, the missed game, or a roll that did nothing. A Spawn is not turned back here (the editor's Undo does that). */
export function undoRollDuty(ctx: Ctx, round: number, id: string): WarbandState {
  const r = roundRec(ctx.s, round)?.duties?.rolled?.find((x) => x.id === id);
  if (!r || r.outcome === 'spawn') return ctx.s;
  const gold = r.outcome === 'gold' ? sum(r.rolls[1]) : 0;
  const markWas = r.outcome === 'mark';
  let s = ctx.s;
  if (markWas) s = setMark(ctx, '');
  return update(ctxOf(ctx.data, s), (dr, c) => {
    const rr = postbattleOn(dr, c, round);
    if (gold) bookGoldOn(dr, c, -gold, 'Slick Operator: taken back', `duty:${id}`);
    if (r.outcome === 'misses') { const m = (dr.models as Model[]).find((x) => x.uid_def === 'huckster'); if (m && Number(m.miss) > 0) m.miss = Number(m.miss) - 1; }
    rr.duties = { ...rr.duties!, resolved: rr.duties!.resolved, rolled: (rr.duties!.rolled ?? []).filter((x) => x.id !== id) };
    rr.finds = (rr.finds ?? []).filter((f) => f.source !== `duty:${id}`);
  });
}

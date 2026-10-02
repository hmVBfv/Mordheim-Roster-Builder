/* New recruits during a campaign, and mutations (phase 3c). New logic.

   Rob, 02.10.2026, on the Ultimate FAQ ("You must always equip any newly
   hired warriors using the equipment list from your warband"): the lists
   are not only for founding the warband but for every warrior until HIS
   first battle. A warrior hired after the warband's first battle buys from
   his list at its prices – common items freely, rare ones only as the
   trading rules allow (rulebook, New recruits: "He may only be given Rare
   items from his warband's equipment chart if the warband can obtain them
   via the normal trading rules") – and buys his mutations as he is hired.
   After his own first battle he goes to the Trading Post like everyone
   else, and mutations are no longer bought.

   Mutations (Rob, 02.10.2026, on the UFAQ "You can have multiples of any
   of the mutations with cumulative effects"): the same mutation may be
   taken more than once where that makes sense. A mutation that replaces an
   arm (Great Claw, Tentacle) needs an arm: at most two, plus one for every
   Extra Arm. One whose effect cannot add up is taken once (ONCE). */
import type { Model, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { mutKindFor, warbandHasFought } from '../rules/equipment.ts';
import { unitDef } from '../rules/lookup.ts';
import { tradeKind } from '../trade/market.ts';
import { addUnit, setEqQty } from './roster.ts';
import { findModel, update } from './update.ts';

/** The campaign's round: the latest battle's, else the current stage. */
export function campaignRound(ctx: Ctx): number {
  const c = ctx.s.campaign;
  if (!c || !c.on) return 0;
  const rounds = (c.battles ?? []).map((b) => Number(b.round) || 0);
  return Math.max(Number(c.round) || 0, 0, ...rounds);
}

/** The round a warrior joined in (0: with the warband, or unknown). */
export function joinedRound(m: Model): number {
  return Math.max(0, Number(m.joined) || 0);
}

/** Has this warrior fought his first battle? Then his list is closed: he
    trades at the Trading Post, and buys no more mutations. */
export function warriorHasFought(ctx: Ctx, m: Model): boolean {
  return warbandHasFought(ctx) && campaignRound(ctx) > joinedRound(m);
}

/** A new recruit after the warband's first battle: his list is open, but
    rare items on it only through the trading rules. */
export function isNewRecruit(ctx: Ctx, m: Model): boolean {
  return warbandHasFought(ctx) && !warriorHasFought(ctx, m);
}

/** Recruits a warrior (core addUnit) and notes the round he joined in, so
    his list stays open until his own first battle. */
export function recruitUnit(ctx: Ctx, id: string): WarbandState {
  const s = addUnit(ctx, id);
  if (s === ctx.s || !warbandHasFought(ctx)) return s;
  const known = new Set(ctx.s.models.map((m) => m.uid));
  const round = campaignRound(ctx);
  return update(ctxOf(ctx.data, s), (d) => {
    for (const m of d.models) if (!known.has(m.uid)) m.joined = round;
  });
}

/** Why the list may not set `key` to `qty` for this warrior now, or ''. */
export function listProblem(ctx: Ctx, uid: number, key: string, qty: number): string {
  const m = findModel(ctx.s, uid);
  if (!m) return 'no such warrior';
  if (warriorHasFought(ctx, m)) return 'after his first battle he trades at the Trading Post';
  const have = Number(m.eq?.[key]) || 0;
  if (qty > have && isNewRecruit(ctx, m) && tradeKind(ctx, key).kind === 'rare') return 'rare: only through a search at the Trading Post';
  return '';
}

/** Sets an item of a warrior's own list (core setEqQty) while the list is
    open to him: the founding warband, or a recruit before his first
    battle (rare items then only by searching). */
export function setListQty(ctx: Ctx, uid: number, key: string, qty: number): WarbandState {
  if (listProblem(ctx, uid, key, qty)) return ctx.s;
  return setEqQty(ctx, uid, key, qty);
}

/* ---- mutations ---- */

const ARM = ['Große Klaue', 'Tentakel'];
const EXTRA_ARM = 'Zusätzlicher Arm';
/** No effect that adds up: a second Daemon Soul saves nothing more, a
    second Hideous frightens no more; the Blessings of Nurgle are gifts of
    one kind each. Confirmed by Rob, 02.10.2026. */
export const ONCE = ['Dämonenseele', 'Scheußlich', 'Strom der Verderbnis', 'Nurgles Fäule', 'Fliegenschwarm', 'Aufgeblähte Fäulnis', 'Mal des Nurgle'];

const countOf = (mut: readonly string[], nm: string) => mut.filter((x) => x === nm).length;

/** How many of `nm` this warrior may have, given the rest he has. */
export function mutationMax(m: Model, nm: string): number {
  const mut = m.mut ?? [];
  if (ONCE.includes(nm)) return 1;
  if (ARM.includes(nm)) {
    const arms = 2 + countOf(mut, EXTRA_ARM);
    const others = ARM.filter((x) => x !== nm).reduce((n, x) => n + countOf(mut, x), 0);
    return Math.max(0, arms - others);
  }
  return 9;
}

/** The least number of Extra Arms the claws and tentacles still need. */
function extraArmsNeeded(mut: readonly string[]): number {
  return Math.max(0, ARM.reduce((n, x) => n + countOf(mut, x), 0) - 2);
}

/** Why `nm` may not be set to `n` for this warrior now, or ''. */
export function mutationProblem(ctx: Ctx, uid: number, nm: string, n: number): string {
  const m = findModel(ctx.s, uid);
  const kind = m ? mutKindFor(ctx, m) : null;
  if (!m || !kind) return 'he takes no mutations';
  const set = ctx.data.MUTSETS[kind] ?? ctx.data.MUTATIONS;
  if (!set.some(([x]) => x === nm)) return 'not on his list';
  if (!Number.isInteger(n) || n < 0) return 'not a number';
  const mut = m.mut ?? [];
  const have = countOf(mut, nm);
  if (n === have) return '';
  const viaSkill = !unitDef(ctx, m.uid_def)?.mut;
  if (viaSkill) {
    // the Mutant skill: "may buy one mutation" – at any time
    if (mut.length - have + n > 1) return 'the Mutant skill gives one mutation';
  } else if (warriorHasFought(ctx, m)) return 'mutations are bought when a warrior is hired';
  if (n > mutationMax(m, nm)) return ARM.includes(nm) ? 'he has no free arm for it' : 'once only';
  if (nm === EXTRA_ARM && n < have) {
    const rest = mut.filter((x) => x !== EXTRA_ARM);
    if (n < extraArmsNeeded(rest)) return 'a claw or tentacle grows from it';
  }
  return '';
}

/** Sets how many of one mutation a warrior has (core mutCost prices them:
    the dearest at its price, every further one double). */
export function setMutationCount(ctx: Ctx, uid: number, nm: string, n: number): WarbandState {
  if (mutationProblem(ctx, uid, nm, n)) return ctx.s;
  return update(ctx, (d) => {
    const m = findModel(d, uid) as Model;
    const mut = [...(m.mut ?? [])];
    let have = countOf(mut, nm);
    // more after the last of its kind, fewer from the end: the order stays
    while (have < n) { const at = mut.lastIndexOf(nm); mut.splice(at < 0 ? mut.length : at + 1, 0, nm); have++; }
    while (have > n) { mut.splice(mut.lastIndexOf(nm), 1); have--; }
    m.mut = mut;
  });
}

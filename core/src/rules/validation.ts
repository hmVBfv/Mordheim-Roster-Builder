/* Is the warband legal, and what may still be recruited? (legacy app.js:
   the warnings at the end of renderSidebar, renderAddMenu's limits,
   rangedModelCount, rerollItemCount, _modelHasRanged). The legacy app
   computed these while drawing its sidebar; they are rules, so they live
   here and the interface only shows them. The wording is the legacy app's. */
import type { UnitDef } from '../data/types.ts';
import type { Model } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { countOf, goldCurrent, modelsOf, totalHeroes, totalModels, unitMax, warbandMax } from './costs.ts';
import { eqWeaponLimit } from './equipment.ts';
import { eqListFor, itemFamily, unitDef, warbandDef } from './lookup.ts';
import { isMarauderSeer, leaderUid } from './profile.ts';
import { leaderUnitDied } from '../warband/roster.ts';

const RANGED = ['bow', 'crossbow', 'sling', 'thrown', 'blowpipe', 'sunweapon', 'pistol', 'longgun', 'swivel'];

/** Does this warrior carry a ranged weapon (list, fixed gear or rare)? */
export function modelHasRanged(ctx: Ctx, m: Model): boolean {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return false;
  if (def.eq) {
    const list = eqListFor(ctx, def);
    if (list) for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
      if ((Number((m.eq ?? {})[nm]) || 0) > 0 && RANGED.includes(itemFamily(ctx.data, nm) as string)) return true;
    }
  }
  if (def.gear) for (const g of def.gear) if (RANGED.includes(itemFamily(ctx.data, g) as string)) return true;
  const r = m.rare || {};
  for (const de of Object.keys(r)) { const it = ctx.data.CATALOG.find((x) => x.de === de); if (it && (it.cat === 'missile' || it.cat === 'bp')) return true; }
  return false;
}

const groupSize = (def: UnitDef | undefined, m: Model) => (def && def.t === 'hen') ? (Number(m.qty) || 1) : 1;

/** Men carrying a ranged weapon (house rule: ranged cap). */
export function rangedModelCount(ctx: Ctx): number {
  return ctx.s.models.reduce((s, m) => s + (modelHasRanged(ctx, m) ? groupSize(unitDef(ctx, m.uid_def), m) : 0), 0);
}

/** Re-roll items carried (house rule: one per warband). */
export function rerollItemCount(ctx: Ctx): number {
  const RX = /gl(ü|u)cksbringer|lucky charm|hasenpfote|rabbit|relikt|\brelic\b|familiar|vertrauter|gl(ü|u)cksklee/i;
  return ctx.s.models.reduce((s, m) => {
    const q = groupSize(unitDef(ctx, m.uid_def), m);
    let n = 0;
    for (const nm of Object.keys(m.eq || {})) if ((Number(m.eq![nm]) || 0) > 0 && RX.test(nm)) n++;
    for (const de of Object.keys(m.rare || {})) {
      const it = ctx.data.CATALOG.find((x) => x.de === de);
      const nm = it ? (it.de + ' ' + it.en) : de;
      if (RX.test(nm)) n += (Number(m.rare![de]!.q) || 1);
    }
    return s + n * q;
  }, 0);
}

/** Everything that makes the warband illegal right now, worded for the
    player. An empty list means legal and ready. */
export function warbandWarnings(ctx: Ctx): string[] {
  const s = ctx.s;
  const wb = warbandDef(ctx);
  if (!wb) return [];
  const gold = goldCurrent(ctx), mc = totalModels(ctx), hc = totalHeroes(ctx);
  const w: string[] = [];
  const h = houseRules(s);
  const minReq = (h.min !== '' && h.min != null) ? Number(h.min) : wb.min;
  const heroCap = Number(h.heroes) || 6;
  const has = (m: Model, nm: string) => !!m.eq && Number(m.eq[nm]) > 0;
  if (gold < 0) w.push(`Not enough gold — short by ${-gold} gc.`);
  if (mc < (minReq as number)) w.push(`At least ${minReq} models required (currently ${mc}).`);
  if (mc > warbandMax(ctx)) w.push(`At most ${warbandMax(ctx)} models allowed (currently ${mc}).`);
  if (hc > heroCap) w.push(`A warband may have at most ${heroCap} Heroes (currently ${hc}).`);
  if (h.rangedCapOn) {
    const rngM = rangedModelCount(ctx), cap = Math.floor(mc * Number(h.rangedCap) / 100);
    if (rngM > cap) w.push(`House rule: at most ${h.rangedCap}% of the warband may carry ranged weapons — max ${cap} of ${mc} (currently ${rngM}).`);
  }
  if (h.rerollOne) { const rr = rerollItemCount(ctx); if (rr > 1) w.push(`House rule: only one re-roll item per warband allowed (currently ${rr}).`); }
  if (s.wb === 'pirates') {
    const swivels = s.models.reduce((n, m) => n + (has(m, 'Swivel Gun') ? 1 : 0), 0);
    if (swivels > 1) w.push(`A Pirate warband may include only one Swivel Gun (currently ${swivels}).`);
  }
  if (s.wb === 'tombguardians') {
    const chariots = s.models.reduce((n, m) => n + ((m.rare && m.rare['Skelettstreitwagen']) ? (Number(m.rare['Skelettstreitwagen'].q) || 1) : 0), 0);
    if (chariots > 1) w.push(`A Tomb Guardian warband may include only one Skeleton Chariot (0-1, currently ${chariots}).`);
  }
  if (s.wb === 'outlaws') {
    const bows = ['Kurzbogen', 'Bogen', 'Langbogen'];
    let noBow = 0, multiMissile = 0;
    for (const m of s.models) {
      const d = unitDef(ctx, m.uid_def);
      if (!d || d.vehicle) continue;
      if (eqWeaponLimit(ctx, m).missile > 1) multiMissile++;
      if (d.id !== 'ocleric' && !bows.some((b) => has(m, b))) noBow++;
    }
    if (noBow > 0) w.push(`Bow duty: every warrior except the Cleric must carry a bow — ${noBow} model(s) have none.`);
    if (multiMissile > 0) w.push(`Outlaws may carry only one missile weapon each — ${multiMissile} model(s) carry more.`);
  }
  if (s.wb === 'bretonnian') {
    const ridesWarhorse = (id: string) => s.models.some((m) => m.uid_def === id && has(m, 'Warhorse'));
    const qkWH = ridesWarhorse('paladin');
    const errants = s.models.filter((m) => m.uid_def === 'errant');
    if (errants.some((m) => has(m, 'Warhorse')) && !qkWH) w.push('Bretonnian: a Knight Errant may not ride a warhorse unless the Questing Knight also rides one.');
    const allKnightsWH = qkWH && errants.every((m) => has(m, 'Warhorse'));
    if (s.models.some((m) => m.uid_def === 'squire' && has(m, 'Pferd')) && !allKnightsWH) w.push('Bretonnian: a Squire may not ride a horse unless the Questing Knight and every Knight Errant ride warhorses.');
  }
  if (h.eqLimitOn) {
    for (const m of s.models) {
      const d = unitDef(ctx, m.uid_def);
      if (!d || d.vehicle) continue;
      const lim = eqWeaponLimit(ctx, m);
      if (lim.cc > 2) w.push(`${m.name || d.name}: ${lim.cc} close combat weapons — max. 2 (in addition to the free dagger).`);
      if (lim.missile > 2) w.push(`${m.name || d.name}: ${lim.missile} missile weapons — max. 2 (a brace of pistols counts as 1).`);
    }
  }
  const req = wb.units.find((u) => u.req);
  const leaderDead = leaderUnitDied(ctx);
  const successorName = () => (s.models.find((m) => m.uid === leaderUid(ctx)) || { name: '' }).name || 'the successor';
  if (req && !leaderDead && countOf(ctx, req.id) < 1) w.push(`A ${req.name} is required.`);
  if (leaderDead) {
    if (s.wb === 'undead' && !s.models.some((m) => m.uid_def === 'necro')) {
      w.push('The Vampire is slain and no Necromancer remains to take over — the warband collapses into a pile of bones (you may buy a new Vampire after the next game).');
    } else if (['possessed', 'carnival'].includes(s.wb as string) && leaderUid(ctx)) {
      w.push(`Leader slain: ${successorName()} takes command and, the first time they would advance, may learn a spell/prayer instead of rolling on the Advance table.`);
    } else if (s.wb === 'caravans') {
      if (leaderUid(ctx)) w.push(`Merchant slain: ${successorName()} takes command, counts as the Merchant for all purposes and may choose from the Merchant's special skills.`);
      else w.push('The Merchant is lost and no model can become the leader — buy an Apprentice as soon as possible (after the next game) to take over as the new Merchant.');
    }
  }
  for (const u of wb.units) { const umx = unitMax(ctx, u); if (umx != null && modelsOf(ctx, u.id) > umx) w.push(`Too many ${u.name} (max. ${umx}).`); }
  for (const u of wb.units) if (u.min && modelsOf(ctx, u.id) < u.min) w.push(`At least ${u.min} ${u.name} required (currently ${modelsOf(ctx, u.id)}).`);
  for (const m of s.models) {
    const d = unitDef(ctx, m.uid_def);
    if (d && d.mutReq && (!m.mut || !m.mut.length)) w.push(`${m.name || d.name}: Mutant needs at least 1 mutation.`);
  }
  if (s.wb === 'maraudersofchaos' && !s.mark && s.models.some((x) => isMarauderSeer(ctx, unitDef(ctx, x.uid_def)))) {
    w.push('Seer without a Mark of Chaos — a Seer must choose one; the warband is not legal.');
  }
  return w;
}

export interface RecruitStatus {
  unitId: string;
  /** Warriors of this type now (men for henchmen). */
  count: number;
  /** Maximum, or null for any number (undefined where the data gives none). */
  max: number | null | undefined;
  /** "any", "=1" (exactly, for the leader) or "0–3". */
  limit: string;
  /** The leader has been slain and may not be replaced (house rule off). */
  leaderGone: boolean;
  /** Nothing more of this type may be recruited now. */
  atMax: boolean;
}

/** What the recruit menu shows for one unit type. */
export function recruitStatus(ctx: Ctx, unitId: string): RecruitStatus | null {
  const u = unitDef(ctx, unitId);
  if (!u) return null;
  const cnt = modelsOf(ctx, u.id);
  const umx = unitMax(ctx, u);
  const leaderGone = !!u.req && leaderUnitDied(ctx) && !houseRules(ctx.s).hireNewLeader;
  const atMax = leaderGone || (umx != null && cnt >= umx) || (u.t === 'hero' && !u.vehicle && totalHeroes(ctx) >= (Number(houseRules(ctx.s).heroes) || 6));
  return { unitId: u.id, count: cnt, max: umx, limit: umx === null ? 'any' : (u.req ? `=${umx}` : `0–${umx}`), leaderGone, atMax };
}

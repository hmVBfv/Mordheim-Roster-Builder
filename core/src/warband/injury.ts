/* An injury as rolled after a battle (V1, docs/behaviour-changes.md "V1 –
   Ablauf einer Verletzung"). New logic, not a port of the Roster Builder:
   the old app's two ways in (the casualty list's roll, "+ Injury" on the
   card) gave five results different effects. Here both take one action,
   `injure`, and every follow-up the chart asks for – the D6 of an Arm
   Wound, the D3 of a Deep Wound, a captive's fate, the pit fight, the
   results of Multiple Injuries – is an argument, asked by the interface
   before the call. Core never rolls.

   Sources: Ultimate FAQ 10.2, 10.3, 11.1, 19; mordheimer.net, Campaigns –
   Serious Injuries; rulebook pp. 80–81 and 107 (Hired Swords); the district
   effects of the campaign map (data/campaign.json). */
import type { Casualty, FallenRecord, Injury, Model, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { pendingCasualtyFor } from '../rules/casualties.ts';
import { goldTreasury, isHeroModel } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { memberCount, memberName } from '../rules/profile.ts';
import { bookOn, ensureLedger, syncTreasury } from '../trade/ledger.ts';
import { dismissHire } from '../trade/market.ts';
import { addCasualtyOn, killHenchMemberOn, killHeroOn, retypeCasualty, stripGearSettled } from './casualties.ts';
import { campState, logEvent } from './log.ts';
import { findModel, update, type WarbandDraft } from './update.ts';

/** The results of the Heroes' Serious Injuries chart, as the data keys them. */
export const HERO_CODES = ['11-15', '16-21', '22', '23', '24', '25', '26', '31', '32', '33', '34', '35', '36', '41-55', '56', '61', '62-63', '64', '65', '66'] as const;
export type HeroCode = (typeof HERO_CODES)[number];

/** The result a D66 lands on ("23", or 23 – tens die first), or null. */
export function heroCodeOf(d66: number | string): HeroCode | null {
  const t = String(d66).trim();
  if (!/^[1-6][1-6]$/.test(t)) return null;
  const v = Number(t);
  return HERO_CODES.find((c) => {
    const [a, b = a] = c.split('-').map(Number) as [number, number?];
    return v >= a && v <= (b as number);
  }) ?? null;
}

/** Results a further roll of Multiple Injuries may not be: they are rolled
    again (rulebook). */
export const NOT_IN_MULTIPLE: readonly HeroCode[] = ['11-15', '16-21', '61'];
/** A lost pit fight rolls again on 11–35 only. */
export const AFTER_PIT: readonly HeroCode[] = HERO_CODES.filter((c) => Number(c.slice(0, 2)) <= 35);

/** One result of the chart with what the follow-ups decided. */
export interface HeroRoll {
  code: HeroCode;
  /** Turned into Full Recovery, or ignored: the Temple of Morr (11–15, D6
      5+), the Temple of Sigmar (22–35, D6 5+), a Peg Leg (22, 25). The Gaol
      (61) and the Amphitheatre (65) need no roll; core applies them. */
  saved?: 'morr' | 'sigmar' | 'peg';
  /** 23 and 25: 1 lasting, 2–6 misses the next game. 24: 1–3 Stupidity,
      4–6 Frenzy. 56: 1–3 the one who did it, 4 his leader, 5 his warband,
      6 every warband of that kind. */
  d6?: number;
  /** 35: the D3, games he misses. */
  games?: number;
  /** 56: whom he hates, by name. */
  hates?: string;
  /** 61: what became of him. */
  captured?: { fate: 'exchanged' } | { fate: 'ransomed'; gold: number } | { fate: 'lost' };
  /** 65: the pit fight; lost, he rolls again on 11–35. */
  pit?: { won: true } | { won: false; then: HeroRoll };
  /** 16–21: the further results, as many as the D6. */
  more?: HeroRoll[];
}

/** What a warrior's injury roll was: the D66 chart for a Hero, a D6 for a
    Henchman (one man of the group) or a Hired Sword. */
export type InjuryRoll = { hero: HeroRoll } | { d6: number; member?: number };

/** Which districts the warband holds that change injuries. */
export interface InjuryDistricts { morr: boolean; sigmar: boolean; gaol: boolean; amphitheatre: boolean }

export function injuryDistricts(ctx: Ctx): InjuryDistricts {
  const held = ctx.s.campaign?.on ? ctx.s.campaign.districts ?? {} : {};
  const has = (id: string, control = false) => held[id] === 'control' || (!control && held[id] === 'foothold');
  return { morr: has('templemorr'), sigmar: has('templesigmar'), gaol: has('gaol', true), amphitheatre: has('amphitheatre') };
}

/** Does he carry a Peg Leg (Pirates)? */
export function hasPegLeg(m: Model | null | undefined): boolean {
  return Number(m?.eq?.['Holzbein']) > 0;
}

const SIGMAR = new Set<HeroCode>(['22', '23', '24', '25', '26', '31', '32', '33', '34', '35']);
const isInt = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;

/** What is missing or wrong in a roll for this warrior, or null. The
    interface shows it; `injure` refuses such a roll. */
export function heroRollProblem(ctx: Ctx, m: Model | null, r: HeroRoll, allowed: readonly HeroCode[] = HERO_CODES): string | null {
  if (!r || !HERO_CODES.includes(r.code)) return 'not a result of the chart';
  if (!allowed.includes(r.code)) return `${r.code} is rolled again here`;
  const dist = injuryDistricts(ctx);
  if (r.saved === 'morr' && !(r.code === '11-15' && dist.morr)) return 'the Temple of Morr saves only from 11–15, with a foothold there';
  if (r.saved === 'sigmar' && !(SIGMAR.has(r.code) && dist.sigmar)) return 'the Temple of Sigmar saves only from 22–35, with a foothold there';
  if (r.saved === 'peg' && !((r.code === '22' || r.code === '25') && hasPegLeg(m))) return 'a Peg Leg ignores only a Leg Wound or a Smashed Leg';
  if (r.saved) return null;
  switch (r.code) {
    case '16-21': {
      const more = r.more ?? [];
      if (!isInt(more.length, 1, 6)) return 'Multiple Injuries: one to six further results';
      for (const x of more) { const p = heroRollProblem(ctx, m, x, HERO_CODES.filter((c) => !NOT_IN_MULTIPLE.includes(c))); if (p) return p; }
      return null;
    }
    case '23': case '24': case '25': case '56':
      if (!isInt(r.d6, 1, 6)) return 'the D6 it asks for';
      if (r.code === '56' && !String(r.hates ?? '').trim()) return 'whom he hates';
      return null;
    case '35': return isInt(r.games, 1, 3) ? null : 'the D3: games he misses';
    case '61':
      if (dist.gaol) return null;
      if (!r.captured) return 'what became of him';
      if (r.captured.fate === 'ransomed' && !isInt(r.captured.gold, 0, 100000)) return 'the ransom, in gold';
      return null;
    case '65':
      if (dist.amphitheatre) return null;
      if (!r.pit) return 'the pit fight: won or lost';
      return r.pit.won ? null : heroRollProblem(ctx, m, r.pit.then, AFTER_PIT);
    default: return null;
  }
}

/* ---- applying (draft level) ---- */

type Outcome = 'dead' | 'injured' | 'recovered';

const injName = (c: Ctx, code: string) => c.data.INJEN[code] || c.data.INJURIES.find((j) => j.code === code)?.name || code;

function lasting(c: Ctx, m: Model, code: string, extra?: Partial<Injury>): void {
  const j = c.data.INJURIES.find((x) => x.code === code);
  if (!j) return;
  m.inj = m.inj || [];
  m.inj.push({ code: j.code, name: j.name, text: j.text, mod: j.mod || null, ...extra });
}

function missGames(m: Model, n: number, why: string): void {
  m.miss = (Number(m.miss) || 0) + n;
  m.missWhy = why;
}

/** Gold in or out because of an injury: booked when the ledger is kept,
    else straight into the treasury, as the Roster Builder does. */
function goldOn(d: WarbandDraft, c: Ctx, amount: number, text: string): void {
  if (Array.isArray(d.ledger)) bookOn(d, c, 'adjust', amount, { text });
  else {
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = Math.max(0, goldTreasury(c) + amount);
  }
}

/** The words a result leaves in the casualty record and the chronicle. */
export function heroRollText(ctx: Ctx, r: HeroRoll): string {
  const name = injName(ctx, r.code);
  const dist = injuryDistricts(ctx);
  if (r.saved === 'morr') return `${name}, but the Temple of Morr returned him: Full Recovery`;
  if (r.saved === 'sigmar') return `${name}, healed in the Temple of Sigmar: Full Recovery`;
  if (r.saved === 'peg') return `${name}, ignored: his Peg Leg`;
  switch (r.code) {
    case '16-21': return `${name}: ${(r.more ?? []).map((x) => heroRollText(ctx, x)).join('; ')}`;
    case '23': return r.d6 === 1 ? 'Arm Wound: arm amputated' : 'Arm Wound: misses the next game';
    case '24': return (r.d6 ?? 0) <= 3 ? 'Madness: Stupidity' : 'Madness: Frenzy';
    case '25': return r.d6 === 1 ? 'Smashed Leg: may not run' : 'Smashed Leg: misses the next game';
    case '35': return `Deep Wound: misses ${r.games} game${r.games === 1 ? '' : 's'}`;
    case '56': return `Bitter Enmity: hates ${String(r.hates ?? '').trim()}`;
    case '61':
      if (dist.gaol) return 'Captured, but freed from the Gaol: Full Recovery';
      if (r.captured?.fate === 'exchanged') return 'Captured, then exchanged';
      if (r.captured?.fate === 'ransomed') return `Captured, then ransomed for ${r.captured.gold} gc`;
      return 'Captured and never returned';
    case '65':
      if (dist.amphitheatre || r.pit?.won) return `Sold to the Pits: won the fight${dist.amphitheatre ? ' (the Amphitheatre)' : ''}, +50 gc, +2 experience`;
      return `Sold to the Pits: lost the fight, weapons and armour gone; then ${r.pit && !r.pit.won ? heroRollText(ctx, r.pit.then) : '?'}`;
    default: return name;
  }
}

/** Applies one result to a Hero (draft level). A death moves him to the
    Fallen at once; nothing after it applies. */
function applyHero(d: WarbandDraft, c: Ctx, uid: number, r: HeroRoll, cas: Casualty | null): Outcome {
  const m = findModel(d, uid);
  if (!m) return 'dead';
  const nm = m.name || unitDef(c, m.uid_def)?.name || 'He';
  const dist = injuryDistricts(c);
  if (r.saved) return 'recovered';
  switch (r.code) {
    case '11-15':
      killHeroOn(d, c, uid, null, cas);
      return 'dead';
    case '16-21': {
      let out: Outcome = 'recovered';
      for (const x of r.more ?? []) {
        const o = applyHero(d, c, uid, x, cas);
        if (o === 'dead') return 'dead';
        if (o === 'injured') out = 'injured';
      }
      return out;
    }
    case '22': case '26': case '31': case '32': case '33': case '34': case '62-63': case '64':
      lasting(c, m, r.code);
      return 'injured';
    case '23': if (r.d6 === 1) lasting(c, m, '23a'); else missGames(m, 1, injName(c, '23')); return 'injured';
    case '24': lasting(c, m, (r.d6 ?? 0) <= 3 ? '24a' : '24b'); return 'injured';
    case '25': if (r.d6 === 1) lasting(c, m, '25a'); else missGames(m, 1, injName(c, '25')); return 'injured';
    case '35': missGames(m, Number(r.games) || 1, injName(c, '35')); return 'injured';
    case '36': {
      const lost = stripGearSettled(d, c, m, false);
      logEvent(d, 'injury', `${nm} was Robbed — all his equipment is lost (${lost} gc).`, { uid: m.uid, uid_def: m.uid_def });
      return 'injured';
    }
    case '41-55': return 'recovered';
    case '56': {
      const who = String(r.hates ?? '').trim();
      lasting(c, m, '56', { name: `Bitter Enmity (hates ${who})`, text: `Hatred of ${who}.` });
      return 'injured';
    }
    case '61':
      if (dist.gaol) return 'recovered';
      if (r.captured?.fate === 'lost') {
        killHeroOn(d, c, uid, `${nm} was Captured and never returned. He and his equipment are lost.`, cas);
        return 'dead';
      }
      if (r.captured?.fate === 'ransomed' && r.captured.gold > 0) goldOn(d, c, -r.captured.gold, `Ransom for ${nm}`);
      return 'injured';
    case '65':
      if (dist.amphitheatre || r.pit?.won) {
        goldOn(d, c, 50, `${nm} won his pit fight`);
        m.exp = (Number(m.exp) || 0) + 2;
        logEvent(d, 'injury', `${nm} won his pit fight — +50 gc, +2 experience.`, { uid: m.uid, uid_def: m.uid_def });
        return 'injured';
      }
      {
        const lost = stripGearSettled(d, c, m, true);
        logEvent(d, 'injury', `${nm} lost his pit fight — his weapons and armour are gone (${lost} gc).`, { uid: m.uid, uid_def: m.uid_def });
        const o = r.pit && !r.pit.won ? applyHero(d, c, uid, r.pit.then, cas) : 'injured';
        return o === 'recovered' ? 'injured' : o;
      }
    case '66':
      m.exp = (Number(m.exp) || 0) + 1;
      logEvent(d, 'injury', `${nm} Survives Against the Odds — +1 experience.`, { uid: m.uid, uid_def: m.uid_def });
      return 'injured';
  }
  return 'recovered';
}

/** The casualty record a result closes: the one named, else the open one
    for this warrior (a man of a group by his name). */
function casualtyFor(d: WarbandDraft, c: Ctx, uid: number, who: string | null, id: number | null): Casualty | null {
  const list = campState(d).casualties as Casualty[];
  if (id != null) return list.find((x) => x.id === id) ?? null;
  const open = pendingCasualtyFor(c, uid, who);
  return open ? list.find((x) => x.id === open.id) ?? null : null;
}

/** Writes the outcome into the casualty record (creating one after the fact
    in a campaign, as the Roster Builder does) and links a death to its
    Fallen record. */
function closeCasualty(d: WarbandDraft, c: Ctx, cas: Casualty | null, before: number, victim: { uid: number; name: string }, outcome: Outcome, code: string, detail: string, roll: InjuryRoll): void {
  const camp = campState(d);
  const list = camp.casualties as Casualty[];
  let r = cas ?? (list.length > before ? list[list.length - 1] as Casualty : null);
  if (!r && camp.on) r = addCasualtyOn(d, c, { victim: { uid: victim.uid, name: victim.name, wb: d.wb ?? '' }, result: outcome, detail });
  if (!r) return;
  r.result = outcome;
  r.detail = detail;
  r.code = code;
  r.applied = true;
  r.injury = JSON.parse(JSON.stringify(roll)) as InjuryRoll;
  if (outcome === 'dead') {
    const fallen = d.fallen as FallenRecord[];
    const fe = fallen.length - 1;
    r.fallenId = fe;
    if (fallen[fe]) fallen[fe].casualtyId = r.id;
  }
  retypeCasualty(d, c, r);
}

export interface InjureOptions {
  /** The casualty record this roll resolves (from the casualty list);
      without it, the open record for this warrior, if any. */
  casualtyId?: number | null;
}

/** Applies an injury roll to one of our warriors – a model by uid (for a
    henchman group, `member` picks the man) or a Hired Sword by his uid.
    The same action for the casualty list and the card. Gold is booked in
    the ledger when it is kept; what a warrior loses is never refunded.
    An incomplete or wrong roll changes nothing. */
export function injure(ctx: Ctx, id: number | string, roll: InjuryRoll, opts: InjureOptions = {}): WarbandState {
  if (typeof id === 'string') return injureHire(ctx, id, roll);
  const m0 = findModel(ctx.s, id);
  if (!m0) return ctx.s;
  const hero = isHeroModel(ctx, m0);
  if (hero !== ('hero' in roll)) return ctx.s;
  if ('hero' in roll && heroRollProblem(ctx, m0, roll.hero)) return ctx.s;
  if ('d6' in roll && (!isInt(roll.d6, 1, 6) || !isInt(roll.member ?? 0, 0, memberCount(m0) - 1))) return ctx.s;
  const s0 = ensureLedger(ctx);
  return update(ctxOf(ctx.data, s0), (d, c) => {
    const m = findModel(d, id) as Model;
    const before = ((campState(d).casualties as Casualty[]) ?? []).length;
    if ('hero' in roll) {
      const victim = { uid: m.uid, name: m.name || unitDef(c, m.uid_def)?.name || '' };
      const cas = casualtyFor(d, c, m.uid, null, opts.casualtyId ?? null);
      const outcome = applyHero(d, c, m.uid, roll.hero, cas);
      closeCasualty(d, c, cas, before, victim, outcome, roll.hero.code, heroRollText(c, roll.hero), roll);
    } else {
      const i = roll.member ?? 0;
      const who = memberName(c, m, i);
      const cas = casualtyFor(d, c, m.uid, who, opts.casualtyId ?? null);
      const dead = roll.d6 <= 2;
      if (dead) killHenchMemberOn(d, c, m.uid, i, cas);
      closeCasualty(d, c, cas, before, { uid: m.uid, name: who }, dead ? 'dead' : 'recovered', dead ? '1-2' : '3-6', dead ? 'Dead' : 'fights on', roll);
    }
    syncTreasury(d, c);
  });
}

/** A Hired Sword out of action rolls a D6 like a Henchman (rulebook p. 107):
    1–2 he is dead and gone with his equipment, 3–6 he fights on. */
function injureHire(ctx: Ctx, uid: string, roll: InjuryRoll): WarbandState {
  const rec = (ctx.s.hired ?? []).find((h) => h.uid === uid);
  if (!rec || !('d6' in roll) || !isInt(roll.d6, 1, 6) || roll.d6 > 2) return ctx.s;
  const name = rec.name || ctx.data.HIREDSWORDS[rec.key]?.name || 'The Hired Sword';
  const gone = dismissHire(ctx, uid, 'hs');
  return update(ctxOf(ctx.data, gone), (d) => { logEvent(d, 'death', `${name} (Hired Sword) was slain.`, { name, hire: rec.key }); });
}

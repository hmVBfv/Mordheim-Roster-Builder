/* Injury and casualty parity, result by result.
 *
 * The random walk (walk.ts) reaches the injury chart and the casualty records
 * often, but some branches need a particular roster to show anything — a
 * Kislev heirloom lost in a pit fight, a named man falling from the middle of
 * his group. Here every result of the Serious Injuries chart, with every
 * answer to its questions, and every casualty roll is applied to prepared
 * rosters in the legacy app and in core, and the states compared after each
 * step. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { Casualty, WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { coreCanon, data, legacyCanon, useLegacy, withDialogs, withDom } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const ctx = (s: WarbandState) => core.ctxOf(data, s);

type Op = [label: string, legacy: () => unknown, next: (s: WarbandState) => WarbandState];

function run(label: string, start: WarbandState, ops: Op[]): void {
  L.load(start); L.state.resyncUid(); L.app.render();
  let s = core.normalizeState(ctx(structuredClone(start)));
  expect(coreCanon(ctx(s)), `${label}: start`).toEqual(legacyCanon());
  const done: string[] = [];
  for (const [what, legacyCall, coreCall] of ops) {
    done.push(what);
    legacyCall();
    s = coreCall(s);
    expect(coreCanon(ctx(s)), `${label}: ${done.join(' → ')}`).toEqual(legacyCanon());
  }
}

interface Base { s: WarbandState; hero: number; hench: number }

/** A roster with a Hero carrying everything his list offers plus a rare item
    (Kislev: an heirloom), a group of three henchmen with a veteran surcharge
    and a named man in the middle, and gold in the treasury. */
function base(wb: string, on: boolean): Base {
  let s = core.newWarband(data, wb);
  if (on) s = { ...s, campaign: { on: true, districts: {} } };
  const units = data.WARBANDS[wb]!.units;
  const heroDef = units.find((u) => u.t === 'hero' && u.eq)!;
  const henDef = units.find((u) => u.t === 'hen' && u.eq && !u.noxp)!;
  s = core.addUnit(ctx(s), heroDef.id);
  s = core.addUnit(ctx(s), henDef.id);
  const hero = s.models[0]!.uid, hench = s.models[1]!.uid;
  const list = core.eqListFor(ctx(s), heroDef) ?? {};
  for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) s = core.setEqQty(ctx(s), hero, nm, 1);
  // a rare weapon, rare armour and a rare trinket
  for (const cat of ['cc', 'armour', 'misc']) {
    const rare = core.rareEligibleItems(ctx(s), s.models[0]!).find((x) => x.cat === cat && !data.UPGRADES[x.de]);
    if (rare) s = core.addRare(ctx(s), hero, rare.de);
  }
  const melee = (list.Nahkampf ?? [])[0]?.[0];
  if (wb === 'kislev' && melee) s = core.setHeirloom(ctx(s), hero, melee);
  // a Gromril weapon (the upgrade goes with the weapon in a lost pit fight)
  s = core.addRare(ctx(s), hero, 'Gromril-Waffe');
  const target = core.upgradeTargets(ctx(s), s.models[0]!, 'Gromril-Waffe')[0];
  if (target) s = core.setRareTarget(ctx(s), hero, 'Gromril-Waffe', target.nm);
  // inline upgrades where the warband has them (Dark Elves: blade, venom)
  for (const w of core.eqWeaponsOf(ctx(s), s.models[0]!)) {
    for (const up of core.weaponUpgradesFor(ctx(s), s.models[0]!, w.nm)) {
      if (!(s.models[0]!.rare ?? {})[up.de]) s = core.toggleWeaponUpgrade(ctx(s), hero, up.de, w.nm, true);
    }
  }
  s = core.setModelExp(ctx(s), hench, 4);
  s = core.setQty(ctx(s), hench, 3);
  s = core.setMemberName(ctx(s), hench, 1, 'Hans');
  s = core.stashSet(ctx(s), 'gold', 600);
  // the setup must hold what the scenarios are about
  const h = s.models[0]!;
  expect(Object.keys(h.eq ?? {}).length, `${wb}: hero equipment`).toBeGreaterThan(1);
  expect(Object.keys(h.rare ?? {}).some((de) => data.UPGRADES[de]), `${wb}: weapon upgrade`).toBe(true);
  if (wb === 'kislev') expect(h.heirloom, 'kislev heirloom').toBeTruthy();
  if (wb === 'darkelves') expect(h.rare?.['Dunkles Gift'], 'dark venom').toBeTruthy();
  const cats = Object.keys(h.rare ?? {}).map((de) => data.CATALOG.find((x) => x.de === de)?.cat);
  expect(cats, `${wb}: rare categories`).toEqual(expect.arrayContaining(['cc', 'armour']));
  expect(s.models[1]!.qty).toBe(3);
  return { s, hero, hench };
}

/** Every answer worth trying for each result. */
function variants(code: string): { label: string; confirms: boolean[]; prompts: (string | null)[]; choices: core.InjuryChoices | null }[] {
  const one = (label: string, confirms: boolean[], prompts: (string | null)[], choices: core.InjuryChoices | null) => ({ label, confirms, prompts, choices });
  switch (code) {
    case '36': return [one('apply', [true], [], {}), one('declined', [false], [], null)];
    case '65': return [one('won', [true], [], { pitWon: true }), one('lost', [false], [], { pitWon: false })];
    case '61': return [
      one('exchanged', [true], ['0'], { captiveReturns: true, ransom: '0' }),
      one('ransomed', [true], ['40'], { captiveReturns: true, ransom: '40' }),
      one('prompt cancelled', [true], [null], { captiveReturns: true, ransom: null }),
      one('never returned', [false], [], { captiveReturns: false }),
    ];
    case '35': return ['1', '3', '9', null].map((v) => one(`D3=${v}`, [], [v], { deepWoundGames: v }));
    default: return [one('', [], [], {})];
  }
}

const lastCas = (s: WarbandState) => (s.campaign?.casualties ?? []).at(-1) as Casualty;
const lastCasL = () => ((L.state.S.campaign?.casualties ?? []) as Casualty[]).at(-1) as Casualty;

const WARBANDS = ['merc', 'kislev', 'skaven', 'possessed', 'orcmob', 'darkelves'];

describe('injury chart parity: every result on a Hero and a henchman', () => {
  for (const wb of WARBANDS) for (const on of [true, false]) {
    it(`${wb} campaign=${on}`, () => {
      for (const j of data.INJURIES) for (const v of variants(j.code)) for (const who of ['hero', 'hench'] as const) {
        const b = base(wb, on);
        const uid = who === 'hero' ? b.hero : b.hench;
        const apply: Op = [`addInj ${who} ${j.code} ${v.label}`,
          () => withDom({ [`inj-${uid}`]: j.code }, () => withDialogs(v.confirms, v.prompts, () => L.app.addInj(uid))),
          (s) => (v.choices ? core.addInjury(ctx(s), uid, j.code, v.choices) : s)];
        run(`${wb} ${on}`, b.s, [apply, ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))]]);
      }
    });
  }
});

describe('casualty roll parity: every code, ours and the enemy\'s', () => {
  for (const wb of WARBANDS) for (const on of [true, false]) {
    it(`${wb} campaign=${on}`, () => {
      // our Hero, put out of action by an enemy
      for (const j of data.INJURIES) {
        const b = base(wb, on);
        const cas: core.CasualtyInput = { victim: { uid: b.hero, name: 'Captain', wb }, attacker: { name: 'Rat', wb: 'skaven' } };
        run(`${wb} ${on} hero`, b.s, [
          ['addCasualty', () => L.app.addCasualty(structuredClone(cas)), (s) => core.addCasualty(ctx(s), structuredClone(cas))],
          [`roll ${j.code}`, () => L.app.resolveCasualtyRoll(lastCasL().id, j.code), (s) => core.resolveCasualtyRoll(ctx(s), lastCas(s).id, j.code)],
          ['roll again', () => L.app.resolveCasualtyRoll(lastCasL().id, j.code), (s) => core.resolveCasualtyRoll(ctx(s), lastCas(s).id, j.code)],
          ['back to pending', () => L.app.resolveCasualtyRoll(lastCasL().id, ''), (s) => core.resolveCasualtyRoll(ctx(s), lastCas(s).id, '')],
          ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))],
        ]);
      }
      // one man of the group: by index, by name, and the last one
      for (const j of core.HENCH_INJ) for (const victim of [{ memberIdx: 1, name: 'Hans' }, { name: 'Hans' }, { memberIdx: 2 }, {}]) {
        const b = base(wb, on);
        const cas: core.CasualtyInput = { victim: { uid: b.hench, wb, ...victim } };
        run(`${wb} ${on} hench ${JSON.stringify(victim)}`, b.s, [
          ['addCasualty', () => L.app.addCasualty(structuredClone(cas)), (s) => core.addCasualty(ctx(s), structuredClone(cas))],
          [`roll ${j.code}`, () => L.app.resolveCasualtyRoll(lastCasL().id, j.code), (s) => core.resolveCasualtyRoll(ctx(s), lastCas(s).id, j.code)],
          ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))],
          ['kill Hans', () => L.app.killHenchMember(b.hench, 1), (s) => core.killHenchMember(ctx(s), b.hench, 1)],
          ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))],
        ]);
      }
      // an enemy put out of action by our Hero, rolled on either table
      for (const grade of ['hero', 'hench', '']) for (const code of [...data.INJURIES.map((x) => x.code), ...core.HENCH_INJ.map((x) => x.code)]) {
        const b = base(wb, on);
        const cas: core.CasualtyInput = { victim: { name: 'Clanrat', wb: 'skaven', grade }, attacker: { uid: b.hero, name: 'Captain' } };
        run(`${wb} ${on} enemy ${grade}`, b.s, [
          ['addCasualty', () => L.app.addCasualty(structuredClone(cas)), (s) => core.addCasualty(ctx(s), structuredClone(cas))],
          [`roll ${code}`, () => L.app.resolveCasualtyRoll(lastCasL().id, code), (s) => core.resolveCasualtyRoll(ctx(s), lastCas(s).id, code)],
        ]);
      }
    });
  }
});

describe('battle results parity', () => {
  for (const wb of WARBANDS) for (const on of [true, false]) {
    it(`${wb} campaign=${on}`, () => {
      for (const won of [true, false]) {
        const b = base(wb, on);
        const heroCas: core.CasualtyInput = { victim: { uid: b.hero, name: 'Captain', wb } };
        const henchCas: core.CasualtyInput = { victim: { uid: b.hench, memberIdx: 1, name: 'Hans', wb } };
        const enemy: core.CasualtyInput = { victim: { name: 'Clanrat', wb: 'skaven' }, attacker: { uid: b.hero, name: 'Captain' } };
        run(`${wb} ${on} won=${won}`, b.s, [
          ['enemy down', () => L.app.addCasualty(structuredClone(enemy)), (s) => core.addCasualty(ctx(s), structuredClone(enemy))],
          ['hero down', () => L.app.addCasualty(structuredClone(heroCas)), (s) => core.addCasualty(ctx(s), structuredClone(heroCas))],
          ['hero dead', () => L.app.resolveCasualty(lastCasL().id, 'dead', 'Dead'), (s) => core.resolveCasualty(ctx(s), lastCas(s).id, 'dead', 'Dead')],
          ['Hans down', () => L.app.addCasualty(structuredClone(henchCas)), (s) => core.addCasualty(ctx(s), structuredClone(henchCas))],
          ['Hans dead', () => L.app.resolveCasualty(lastCasL().id, 'dead'), (s) => core.resolveCasualty(ctx(s), lastCas(s).id, 'dead')],
          ['award', () => L.app.awardBattleXp(null, { won }), (s) => core.awardBattleXp(ctx(s), null, { won })],
          ['apply', () => withDialogs([true], [], () => L.app.applyBattleResults()), (s) => core.applyBattleResults(ctx(s))],
          ['apply again', () => withDialogs([true], [], () => L.app.applyBattleResults()), (s) => core.applyBattleResults(ctx(s))],
          ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))],
          ['undoFallen', () => L.app.undoFallen(), (s) => core.undoFallen(ctx(s))],
        ]);
      }
    });
  }
});

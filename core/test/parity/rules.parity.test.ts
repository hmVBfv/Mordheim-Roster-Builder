/* Parity: core/src/rules must compute exactly what the legacy app computes.
 *
 * For every generated fixture (all warbands × subtypes × house-rule presets ×
 * seeds) a report of every rules value is built twice — once by the legacy
 * functions reading their global state, once by core with an explicit
 * context — and the two reports must be identical. A difference names the
 * fixture and the value that disagrees. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { HireEntry, HireRecord, Model, WarbandState } from '../../src/index.ts';
import { loadGameData } from '../../src/node.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { rng } from '../support/random.ts';

const data = loadGameData();
const fixtures = generateFixtures(data);
let L: Legacy;

beforeAll(async () => { L = await loadLegacy(); });

/* The same questions, asked of either implementation. */
interface Calc {
  models: Model[];
  hired: HireRecord[];
  dp: HireRecord[];
  unitDef(id: string): unknown;
  eqCost(m: Model): number; mutCost(m: Model): number; mutKindFor(m: Model): string | null;
  modelUnitCost(m: Model): number; modelTotalCost(m: Model): number;
  henchRecruitSurcharge(m: Model): number; henchRecruitCost(m: Model): number; lossValueOf(m: Model): number;
  eqMarketValue(m: Model): number; modelMarketValue(m: Model): number; worthAdvOf(m: Model | HireRecord): number;
  svOfModel(m: Model): number | null; eqWeaponLimit(m: Model): unknown; heirloomDiscount(m: Model): number; rareCost(m: Model): number;
  rareEligibleItems(m: Model): { de: string }[]; eqWeaponsOf(m: Model): { nm: string; price: number; fam: string | null }[];
  weaponUpgradesFor(m: Model, nm: string): { de: string }[]; upgradeTargets(m: Model, de: string): { nm: string }[];
  upgradePaid(m: Model, de: string, nm: string): number; daggerNameFor(id: string): string | null; freeDaggerEq(m: Model): unknown;
  isHeroModel(m: Model): boolean; modelRating(m: Model): number; unitMax(id: string): unknown; countOf(id: string): number; modelsOf(id: string): number;
  inlineUpgradeActive(de: string): boolean;
  totals(): Record<string, unknown>;
  hireRec(r: HireRecord): Record<string, unknown>;
  modelProfile(m: Model): Record<string, unknown>;
  warbandProfile(): Record<string, unknown>;
}

const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

/* Legacy renders the experience track as HTML; read the numbers back out. */
function parseXpBar(html: string): Record<string, unknown> {
  if (/Gains no experience/.test(html)) return { noxp: true };
  const next = /next at <b>(\d+)<\/b>/.exec(html)?.[1];
  return { noxp: false, earned: Number(/Advances earned: <b>(\d+)<\/b>/.exec(html)?.[1]), due: html.includes('Advance due!'), next: next ? Number(next) : null };
}

function legacyCalc(s: WarbandState): Calc {
  const S = L.load(s);
  const e = L.engine, a = L.app;
  const def = (id: string) => e.unitDef(id);
  return {
    models: S.models, hired: S.hired ?? [], dp: S.dp ?? [],
    unitDef: def,
    eqCost: (m) => e.eqCost(m), mutCost: (m) => e.mutCost(m), mutKindFor: (m) => e.mutKindFor(m),
    modelUnitCost: (m) => e.modelUnitCost(m), modelTotalCost: (m) => e.modelTotalCost(m),
    henchRecruitSurcharge: (m) => e.henchRecruitSurcharge(m), henchRecruitCost: (m) => e.henchRecruitCost(m), lossValueOf: (m) => e.lossValueOf(m),
    eqMarketValue: (m) => e.eqMarketValue(m), modelMarketValue: (m) => e.modelMarketValue(m), worthAdvOf: (m) => a.worthAdvOf(m),
    svOfModel: (m) => e.svOfModel(m), eqWeaponLimit: (m) => e.eqWeaponLimit(m), heirloomDiscount: (m) => e.heirloomDiscount(m), rareCost: (m) => e.rareCost(m),
    rareEligibleItems: (m) => e.rareEligibleItems(m), eqWeaponsOf: (m) => e.eqWeaponsOf(m),
    weaponUpgradesFor: (m, nm) => e.weaponUpgradesFor(m, nm), upgradeTargets: (m, de) => e.upgradeTargets(m, de),
    upgradePaid: (m, de, nm) => e.upgradePaid(m, de, nm), daggerNameFor: (id) => e.daggerNameFor(def(id)),
    freeDaggerEq: (m) => { const c = structuredClone(m); e.ensureFreeDagger(c); return c.eq; },
    isHeroModel: (m) => e.isHeroModel(m), modelRating: (m) => e.modelRating(m), unitMax: (id) => e.unitMax(def(id)),
    countOf: (id) => e.countOf(id), modelsOf: (id) => e.modelsOf(id), inlineUpgradeActive: (de) => e.inlineUpgradeActive(de),
    totals: () => ({
      totalSpent: e.totalSpent(), goldCurrent: e.goldCurrent(), goldTreasury: e.goldTreasury(), startGold: e.startGold(),
      totalLarge: e.totalLarge(), totalModels: e.totalModels(), totalHeroes: e.totalHeroes(), totalRating: a.totalRating(),
      warbandWorth: a.warbandWorth(), warbandMax: e.warbandMax(),
      hsHireTotal: a.hsHireTotal(), hsRatingTotal: a.hsRatingTotal(), hsUpkeepTotal: a.hsUpkeepTotal(), hsSizeBonus: a.hsSizeBonus(),
      hsEqTotal: a.hsEqTotal(), dpHireTotal: a.dpHireTotal(), dpUpkeepTotal: a.dpUpkeepTotal(), dpRatingTotal: a.dpRatingTotal(),
      hsEquipOn: a.hsEquipOn(), heroEqList: a.heroEqList(),
      hireEligibility: a.hireEligibility(S.wb), dpEligibility: a.dpEligibility(S.wb),
      activeDistrictEffects: a.activeDistrictEffects(),
      priceModHire: Object.keys({ ...data.HIREDSWORDS, ...data.DRAMATIS }).map((k) => a.priceMod('hire', k)),
      itemHalf: data.CATALOG.map((it) => a.itemHalfActive(it.en)),
      hsGrades: data.HS_GRADE_ORDER.map((g) => [a.hsGradeIdx(g), a.hsGradeAllowed(g)]),
      dpGrades: data.DP_GRADE_ORDER.map((g) => a.dpGradeAllowed(g)),
      house: L.state.HR(), houseActive: L.state.houseActive(),
    }),
    hireRec: (r) => {
      const ent: HireEntry | null = a.entryOf(r);
      return {
        upkeep: a.hsUpkeepFor(r.key), exp: a.hsExp(r), advDue: a.hsAdvancesDue(r), eqCost: a.hsEqCost(r), eqParts: a.hsEqParts(r),
        persona: a.hsPersona(r, ent)?.name ?? null, chosenEq: a.hsChosenEq(r, ent), sv: e.svOfEntry(ent, r),
        personas: ent ? a.hsPersonasAllowed(ent).map((p: { name: string }) => p.name) : [], worthAdv: a.worthAdvOf(r),
        effProfile: a.hsEffProfile(r, ent), canAdv: STATS.map((k) => a.hsCanAdv(r, ent, k)),
        skillCats: ent ? a.hsSkillCats(r, ent) : [], raceMax: a.hsRaceMax(ent), special: a.hsSpecialSkills(ent),
      };
    },
    modelProfile: (m) => {
      const d = def(m.uid_def);
      const p = a.effProfile(m);
      return {
        effProfile: p, dispMod: a.dispMod(m), aDisp: p ? a.aDisp(m, p) : null, maxInfo: a.maxInfo(m),
        canAdv: STATS.map((k) => a.canAdv(m, k)), xp: parseXpBar(a.xpBar(m)), injMods: a.injMods(m), netMod: a.netMod(m),
        skillLists: a.skillListsFor(d), promoted: a.promotedSkillLists(m), members: a.memberNames(m),
        canBeLeader: a.canBeLeader(m), isLeader: a.isLeaderModel(m), casterLore: a.casterLore(m), magic: a.magicOfModel(m),
        marauderStart: a.marauderStartSpells(m), spellStart: a.spellStartCount(d, m), casterMagic: a.casterMagic(d),
        seer: a.isMarauderSeer(d), chief: a.isMarauderChief(d),
      };
    },
    warbandProfile: () => ({
      defaultLeader: a.defaultLeaderUid(), leader: a.leaderUid(), heroCats: a.availHeroCats(), markLore: a.markLore(),
      markNames: data.MARAUDER_MARKS.map((x) => a.markName(x[0])),
    }),
  };
}

function coreCalc(s: WarbandState): Calc {
  const ctx = core.ctxOf(data, s);
  const def = (id: string) => core.unitDef(ctx, id);
  return {
    models: s.models, hired: s.hired ?? [], dp: s.dp ?? [],
    unitDef: def,
    eqCost: (m) => core.eqCost(ctx, m), mutCost: (m) => core.mutCost(ctx, m), mutKindFor: (m) => core.mutKindFor(ctx, m),
    modelUnitCost: (m) => core.modelUnitCost(ctx, m), modelTotalCost: (m) => core.modelTotalCost(ctx, m),
    henchRecruitSurcharge: (m) => core.henchRecruitSurcharge(ctx, m), henchRecruitCost: (m) => core.henchRecruitCost(ctx, m), lossValueOf: (m) => core.lossValueOf(ctx, m),
    eqMarketValue: (m) => core.eqMarketValue(ctx, m), modelMarketValue: (m) => core.modelMarketValue(ctx, m), worthAdvOf: (m) => core.worthAdvOf(m),
    svOfModel: (m) => core.svOfModel(ctx, m), eqWeaponLimit: (m) => core.eqWeaponLimit(ctx, m), heirloomDiscount: (m) => core.heirloomDiscount(ctx, m), rareCost: (m) => core.rareCost(m),
    rareEligibleItems: (m) => core.rareEligibleItems(ctx, m), eqWeaponsOf: (m) => core.eqWeaponsOf(ctx, m),
    weaponUpgradesFor: (m, nm) => core.weaponUpgradesFor(ctx, m, nm), upgradeTargets: (m, de) => core.upgradeTargets(ctx, m, de),
    upgradePaid: (m, de, nm) => core.upgradePaid(ctx, m, de, nm), daggerNameFor: (id) => core.daggerNameFor(ctx, def(id)),
    freeDaggerEq: (m) => core.withFreeDagger(ctx, m).eq, isHeroModel: (m) => core.isHeroModel(ctx, m), modelRating: (m) => core.modelRating(ctx, m),
    unitMax: (id) => { const d = def(id); return d ? core.unitMax(ctx, d) : undefined; },
    countOf: (id) => core.countOf(ctx, id), modelsOf: (id) => core.modelsOf(ctx, id), inlineUpgradeActive: (de) => core.inlineUpgradeActive(ctx, de),
    totals: () => ({
      totalSpent: core.totalSpent(ctx), goldCurrent: core.goldCurrent(ctx), goldTreasury: core.goldTreasury(ctx), startGold: core.startGold(ctx),
      totalLarge: core.totalLarge(ctx), totalModels: core.totalModels(ctx), totalHeroes: core.totalHeroes(ctx), totalRating: core.totalRating(ctx),
      warbandWorth: core.warbandWorth(ctx), warbandMax: core.warbandMax(ctx),
      hsHireTotal: core.hsHireTotal(ctx), hsRatingTotal: core.hsRatingTotal(ctx), hsUpkeepTotal: core.hsUpkeepTotal(ctx), hsSizeBonus: core.hsSizeBonus(ctx),
      hsEqTotal: core.hsEqTotal(ctx), dpHireTotal: core.dpHireTotal(ctx), dpUpkeepTotal: core.dpUpkeepTotal(ctx), dpRatingTotal: core.dpRatingTotal(ctx),
      hsEquipOn: core.hsEquipOn(ctx), heroEqList: core.heroEqList(ctx),
      hireEligibility: core.hireEligibility(ctx), dpEligibility: core.dpEligibility(ctx),
      activeDistrictEffects: core.activeDistrictEffects(ctx),
      priceModHire: Object.keys({ ...data.HIREDSWORDS, ...data.DRAMATIS }).map((k) => core.priceMod(ctx, 'hire', k)),
      itemHalf: data.CATALOG.map((it) => core.itemHalfActive(ctx, it.en)),
      hsGrades: data.HS_GRADE_ORDER.map((g) => [core.hsGradeIdx(ctx, g), core.hsGradeAllowed(ctx, g)]),
      dpGrades: data.DP_GRADE_ORDER.map((g) => core.dpGradeAllowed(ctx, g)),
      house: core.houseRules(s), houseActive: core.houseActive(s),
    }),
    hireRec: (r) => {
      const ent = core.entryOf(ctx, r);
      return {
        upkeep: core.hsUpkeepFor(ctx, r.key), exp: core.hsExp(r), advDue: core.hsAdvancesDue(r), eqCost: core.hsEqCost(ctx, r), eqParts: core.hsEqParts(ctx, r),
        persona: core.hsPersona(ctx, r, ent)?.name ?? null, chosenEq: core.hsChosenEq(ctx, r, ent), sv: core.svOfEntry(ctx, ent, r),
        personas: ent ? core.hsPersonasAllowed(ctx, ent).map((p) => p.name) : [], worthAdv: core.worthAdvOf(r),
        effProfile: core.hsEffProfile(r, ent), canAdv: STATS.map((k) => core.hsCanAdv(ctx, r, ent, k)),
        skillCats: ent ? core.hsSkillCats(ctx, r, ent) : [], raceMax: core.hsRaceMax(ctx, ent), special: core.hsSpecialSkills(ent),
      };
    },
    modelProfile: (m) => {
      const d = def(m.uid_def);
      const p = core.effProfile(ctx, m);
      const st = core.advanceStatus(ctx, m);
      return {
        effProfile: p, dispMod: core.dispMod(ctx, m), aDisp: p ? core.aDisp(ctx, m, p) : null, maxInfo: core.maxInfo(ctx, m),
        canAdv: STATS.map((k) => core.canAdv(ctx, m, k)),
        xp: st?.noxp ? { noxp: true } : { noxp: false, earned: st?.earned, due: st?.due, next: st?.next },
        injMods: core.injMods(m), netMod: core.netMod(m),
        skillLists: d ? core.skillListsFor(ctx, d) : [], promoted: core.promotedSkillLists(ctx, m), members: core.memberNames(ctx, m),
        canBeLeader: core.canBeLeader(ctx, m), isLeader: core.isLeaderModel(ctx, m), casterLore: core.casterLore(ctx, m), magic: core.magicOfModel(ctx, m),
        marauderStart: core.marauderStartSpells(ctx, m), spellStart: core.spellStartCount(ctx, d, m), casterMagic: d ? core.casterMagic(ctx, d) : null,
        seer: core.isMarauderSeer(ctx, d), chief: core.isMarauderChief(ctx, d),
      };
    },
    warbandProfile: () => ({
      defaultLeader: core.defaultLeaderUid(ctx), leader: core.leaderUid(ctx), heroCats: core.availHeroCats(ctx), markLore: core.markLore(ctx),
      markNames: data.MARAUDER_MARKS.map((x) => core.markName(ctx, x[0])),
    }),
  };
}

/* Everything the rules say about one warband, as plain data. */
function report(c: Calc): Record<string, unknown> {
  const upgradeKeys = Object.keys(data.UPGRADES);
  const models = c.models.map((m) => {
    const weapons = c.eqWeaponsOf(m);
    return {
      uid: m.uid,
      eqCost: c.eqCost(m), mutCost: c.mutCost(m), mutKind: c.mutKindFor(m),
      unitCost: c.modelUnitCost(m), totalCost: c.modelTotalCost(m),
      surcharge: c.henchRecruitSurcharge(m), recruitCost: c.henchRecruitCost(m), loss: c.lossValueOf(m),
      eqMarket: c.eqMarketValue(m), market: c.modelMarketValue(m), worthAdv: c.worthAdvOf(m),
      sv: c.svOfModel(m), limit: c.eqWeaponLimit(m), heirloom: c.heirloomDiscount(m), rareCost: c.rareCost(m),
      rareEligible: c.rareEligibleItems(m).map((it) => it.de),
      weapons,
      upgradesByWeapon: weapons.map((w) => c.weaponUpgradesFor(m, w.nm).map((x) => x.de)),
      upgradeTargets: upgradeKeys.map((de) => c.upgradeTargets(m, de).map((w) => w.nm)),
      upgradePaid: upgradeKeys.map((de) => weapons.map((w) => c.upgradePaid(m, de, w.nm))),
      dagger: c.daggerNameFor(m.uid_def), freeDaggerEq: c.freeDaggerEq(m),
      isHero: c.isHeroModel(m), rating: c.modelRating(m), unitMax: c.unitMax(m.uid_def),
      countOf: c.countOf(m.uid_def), modelsOf: c.modelsOf(m.uid_def),
      profile: c.modelProfile(m),
    };
  });
  return {
    models,
    totals: c.totals(),
    warbandProfile: c.warbandProfile(),
    inlineUpgrades: upgradeKeys.map((de) => c.inlineUpgradeActive(de)),
    hired: c.hired.map((r) => c.hireRec(r)),
    dp: c.dp.map((r) => c.hireRec(r)),
  };
}

describe('rules parity: legacy app vs core', () => {
  it('generates a fixture for every warband, subtype and preset', () => {
    expect(fixtures.length).toBeGreaterThan(49 * 3 * 2 - 1);
    const warbands = new Set(fixtures.map((f) => f.state.wb));
    expect(warbands.size).toBe(Object.keys(data.WARBANDS).length);
  });

  /* Parity only means something if the fixtures exercise the rules. These
     minimums fail loudly if a generator change quietly stops covering a
     feature (they are well below the current counts). */
  it('fixtures exercise every priced feature', () => {
    const n: Record<string, number> = {};
    const count = (k: string, c: boolean) => { if (c) n[k] = (n[k] ?? 0) + 1; };
    for (const f of fixtures) {
      const ctx = core.ctxOf(data, f.state);
      const effects = core.activeDistrictEffects(ctx);
      count('districtEffects', effects.length > 0);
      count('unitCostEffect', effects.some((e) => e.kind === 'unitCost'));
      count('hireHalf', effects.some((e) => e.kind === 'hireHalf'));
      count('itemHalf', data.CATALOG.some((it) => core.itemHalfActive(ctx, it.en)));
      count('kurgan', f.state.subtype === 'kurgan');
      for (const m of f.state.models) {
        count('eqCost', core.eqCost(ctx, m) > 0);
        count('mutCost', core.mutCost(ctx, m) > 0);
        count('heirloom', core.heirloomDiscount(ctx, m) > 0);
        count('rareCost', core.rareCost(m) > 0);
        count('surcharge', core.henchRecruitSurcharge(ctx, m) > 0);
        count('promoted', !!m.promoted);
        count('sv', core.svOfModel(ctx, m) != null);
        count('halves', core.modelMarketValue(ctx, m) % 1 !== 0);
        count('gunneryBrace', f.state.wb === 'gunnery' && Object.entries(m.eq ?? {}).some(([k, v]) => !!data.GSN_BRACE[k] && Number(v) >= 2));
      }
      for (const h of [...(f.state.hired ?? []), ...(f.state.dp ?? [])]) {
        const e = core.entryOf(ctx, h);
        count('hires', true);
        count('hireEq', core.hsEqCost(ctx, h) > 0);
        count('personas', !!e?.personas);
        count('options', !!e?.opts);
      }
    }
    const minimum: Record<string, number> = {
      districtEffects: 100, unitCostEffect: 5, hireHalf: 50, itemHalf: 40, kurgan: 6,
      eqCost: 1000, mutCost: 40, heirloom: 1, rareCost: 400, surcharge: 250, promoted: 100,
      sv: 500, halves: 400, gunneryBrace: 5, hires: 400, hireEq: 100, personas: 10, options: 20,
    };
    for (const [k, min] of Object.entries(minimum)) expect(n[k] ?? 0, k).toBeGreaterThanOrEqual(min);
  });

  it.each(fixtures.map((f) => [f.label, f] as const))('%s', (_label, f) => {
    const legacy = report(legacyCalc(f.state));
    const ours = report(coreCalc(structuredClone(f.state)));
    expect(ours).toEqual(legacy);
  });
});

describe('lookup parity: legacy app vs core', () => {
  it('itemFamily agrees on every list item and catalogue item', () => {
    const names = new Set<string>();
    for (const l of Object.values(data.LISTS)) for (const arr of Object.values(l)) for (const [nm] of arr) names.add(nm);
    for (const it of data.CATALOG) { names.add(it.de); names.add(it.en); }
    for (const nm of names) expect(core.itemFamily(data, nm), nm).toBe(L.app.itemFamily(nm));
  });

  it('catalogEligible and unitFamilies agree for every unit and catalogue item', () => {
    for (const wb of Object.keys(data.WARBANDS)) {
      const subs = [null, ...(data.WARBANDS[wb]?.subtypes ?? []).map((x) => x.key)];
      for (const subtype of subs) {
        const s: WarbandState = { wb, subtype, models: [] };
        L.load(s);
        const ctx = core.ctxOf(data, s);
        for (const u of data.WARBANDS[wb]?.units ?? []) {
          const legacyDef = L.engine.unitDef(u.id);
          expect([...core.unitFamilies(ctx, u)].sort(), `${wb}/${u.id}`).toEqual([...L.app.unitFamilies(legacyDef)].sort());
          expect(core.eqListFor(ctx, u), `${wb}/${subtype}/${u.id}`).toEqual(L.engine.eqListFor(legacyDef));
          for (const it of data.CATALOG) expect(core.catalogEligible(ctx, u, it), `${wb}/${u.id}/${it.de}`).toEqual(L.app.catalogEligible(legacyDef, it));
        }
      }
    }
  });

  it('svFromText, statNum, itemInfo and spellLabel agree on all texts', () => {
    const texts: string[] = [];
    for (const w of Object.values(data.WARBANDS)) for (const u of w.units) { if (u.sp) texts.push(u.sp); for (const v of Object.values(u.profile ?? {})) texts.push(String(v)); }
    for (const e of [...Object.values(data.HIREDSWORDS), ...Object.values(data.DRAMATIS)]) { if (e.sp) texts.push(e.sp); if (e.eq) texts.push(e.eq); }
    for (const t of texts) {
      expect(core.svFromText(t), t).toBe(L.engine.svFromText(t));
      expect(core.statNum(t), t).toBe(L.engine.statNum(t));
    }
    const names = [...data.CATALOG.map((x) => x.de), ...data.CATALOG.map((x) => x.en)];
    for (const nm of names) expect(core.itemInfo(data, nm)?.name ?? null, nm).toBe(L.info.itemInfo(nm)?.name ?? null);
    for (const sl of Object.values(data.SPELLS)) for (const [nm] of sl.spells) expect(core.spellLabel(nm)).toBe(L.app.spellLabel(nm));
    for (const v of [null, 2, 3, 4, 5, 6]) for (const w of [null, 2, 3, 4, 5, 6]) expect(core.svCombine(v, w)).toBe(L.engine._svCombine(v, w));
    for (const v of [null, undefined, 3, 7]) expect(core.svLabel(v)).toBe(L.engine.svLabel(v));
  });

  it('loadoutValue agrees on random loadouts', () => {
    const r = rng(42);
    for (let i = 0; i < 2000; i++) {
      const melee = Array.from({ length: r.int(0, 4) }, () => ({ p: r.int(0, 40), twoH: r.chance(0.3) }));
      const ranged = Array.from({ length: r.int(0, 3) }, () => r.int(0, 40));
      const shields = Array.from({ length: r.int(0, 2) }, () => r.int(0, 20));
      expect(core.loadoutValue(melee, ranged, shields)).toBe(L.engine._loadoutValue(melee, ranged, shields));
    }
  });
});

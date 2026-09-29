import type { HouseRules, WarbandState } from './types.ts';

/** House rules as the legacy app defines them (js/state.js houseDefaults):
    everything off, prices at 100 %. */
export function houseDefaults(): HouseRules {
  return {
    startGold: '', min: '', max: '', heroes: 6,
    priceAll: 100, priceArmour: 100, priceBP: 100, priceMissile: 100,
    clubSurcharge: 0, slingSurcharge: 0,
    armourBodyOnly: false, freeDagger: false, miscHench: false, freeMarket: false,
    allSkills: false, showRarity: false, rangedCapOn: false, rangedCap: 0,
    rerollOne: false, eqLimitOn: true, hireNewLeader: false,
    hsGrades: { '1a': true, '1b': true, '1c': true, '2a': true },
    dpGrades: { core: true, '1a': true, '1b': true, '1c': true, '2a': true },
    hsEquip: false, notes: '',
  };
}

/** The house rules in effect: the saved ones, with defaults for anything
    missing. Unlike legacy HR(), this never writes into the state. */
export function houseRules(s: WarbandState): HouseRules {
  // Legacy fills a key only when it is absent ("k in S.house"): a key that is
  // present wins even if its value is odd, exactly as a spread does.
  return { ...houseDefaults(), ...(s.house ?? {}) } as HouseRules;
}

/** True when any house rule differs from the default (legacy houseActive). */
export function houseActive(s: WarbandState): boolean {
  const h = houseRules(s) as unknown as Record<string, unknown>;
  const d = houseDefaults() as unknown as Record<string, unknown>;
  for (const k of Object.keys(d)) if (String(h[k]) !== String(d[k])) return true;
  return false;
}

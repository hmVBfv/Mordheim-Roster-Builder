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

/* ---- a campaign's house rules (phase 4a4) ----
   A campaign sets house rules for every warband in it; a warband whose own
   differ is marked (concept.md 4.4). Only the rules count: the notes are
   words, and "Show rarity" is a display setting. */

/** The keys that are rules – not the notes, not the display setting. */
export const HOUSE_RULE_KEYS: readonly string[] = Object.keys(houseDefaults()).filter((k) => k !== 'notes' && k !== 'showRarity');

/** House rules as they act: defaults for anything missing, the grades in
    full, a value that only counts with its switch (the ranged cap, armour
    for body armour only) cleared when the switch is off. */
export function effectiveHouse(raw: unknown): HouseRules {
  const d = houseDefaults();
  const h = { ...d, ...((raw && typeof raw === 'object' ? raw : {}) as Partial<HouseRules>) };
  h.hsGrades = { ...d.hsGrades, ...(h.hsGrades ?? {}) };
  h.dpGrades = { ...d.dpGrades, ...(h.dpGrades ?? {}) };
  if (!h.rangedCapOn) h.rangedCap = 0;
  if (Number(h.priceArmour) === 100) h.armourBodyOnly = false;
  return h;
}

/** The rules in which two sets of house rules differ (keys of houseDefaults). */
export function houseDifferences(a: unknown, b: unknown): string[] {
  const x = effectiveHouse(a) as unknown as Record<string, unknown>;
  const y = effectiveHouse(b) as unknown as Record<string, unknown>;
  const same = (p: unknown, q: unknown) => (p && typeof p === 'object' ? JSON.stringify(p) === JSON.stringify(q) : String(p) === String(q));
  return HOUSE_RULE_KEYS.filter((k) => !same(x[k], y[k]));
}

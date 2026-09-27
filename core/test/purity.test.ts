/* Core promises: no hidden state, no mutation of its inputs. These tests
   freeze the data and every fixture state before handing them to core; any
   write would throw (ES modules run in strict mode). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { createGameData } from '../src/index.ts';
import { DEFAULT_DATA_DIR, loadGameData } from '../src/node.ts';
import { readFileSync } from 'node:fs';
import { generateFixtures } from './support/fixtures.ts';

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const data = loadGameData();

describe('game data', () => {
  it('is deeply frozen', () => {
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.WARBANDS.merc?.units[0])).toBe(true);
    expect(Object.isFrozen(data.LISTS.merc?.Nahkampf?.[0])).toBe(true);
  });

  it('revives regular expressions and derives the WBHIRE classification', () => {
    expect(data._FAM[0]?.[0]).toBeInstanceOf(RegExp);
    expect(data.ITEMINFO[0]?.[0]).toBeInstanceOf(RegExp);
    expect(data.WBHIRE.merc?.human).toBe(true);
    expect(data.WBHIRE.possessed?.chaos).toBe(true);
    expect(data.WBHIRE.maraudersofchaos?.human && data.WBHIRE.maraudersofchaos?.chaos).toBe(true);
  });

  it('does not modify the raw input', () => {
    const raw = JSON.parse(readFileSync(`${DEFAULT_DATA_DIR}warbands.json`, 'utf8')) as Record<string, unknown>;
    const before = JSON.stringify(raw);
    const files = Object.fromEntries(core.DATA_FILES.map((f) => [f, JSON.parse(readFileSync(`${DEFAULT_DATA_DIR}${f}.json`, 'utf8')) as Record<string, unknown>]));
    files.warbands = raw;
    createGameData(files);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('refuses incomplete data', () => {
    expect(() => createGameData({})).toThrow(/Missing data file/);
  });
});

describe('rules never modify the warband', () => {
  const fixtures = generateFixtures(data, [7]);

  it.each(fixtures.map((f) => [f.label, f] as const))('%s', (_label, f) => {
    const s: WarbandState = deepFreeze(structuredClone(f.state));
    const ctx = core.ctxOf(data, s);
    expect(() => {
      core.houseRules(s); core.houseActive(s);
      core.totalSpent(ctx); core.goldCurrent(ctx); core.totalRating(ctx); core.warbandWorth(ctx); core.warbandMax(ctx);
      core.totalModels(ctx); core.totalHeroes(ctx); core.totalLarge(ctx);
      core.hireEligibility(ctx); core.dpEligibility(ctx); core.activeDistrictEffects(ctx);
      for (const m of s.models as Model[]) {
        core.modelTotalCost(ctx, m); core.lossValueOf(ctx, m); core.henchRecruitCost(ctx, m);
        core.modelMarketValue(ctx, m); core.svOfModel(ctx, m); core.rareEligibleItems(ctx, m);
        core.withFreeDagger(ctx, m);
        for (const w of core.eqWeaponsOf(ctx, m)) core.weaponUpgradesFor(ctx, m, w.nm);
      }
      for (const h of [...(s.hired ?? []), ...(s.dp ?? [])]) {
        core.hsEqCost(ctx, h); core.svOfEntry(ctx, core.entryOf(ctx, h), h); core.hsChosenEq(ctx, h, core.entryOf(ctx, h));
      }
    }).not.toThrow();
  });
});

describe('core-only behaviour', () => {
  it('houseRules fills defaults without writing into the state', () => {
    const s: WarbandState = { wb: 'merc', models: [], house: { priceAll: 150 } };
    const h = core.houseRules(s);
    expect(h.priceAll).toBe(150);
    expect(h.priceArmour).toBe(100);
    expect(s.house).toEqual({ priceAll: 150 });
  });

  it('withFreeDagger returns a new model and leaves the input alone', () => {
    const s: WarbandState = { wb: 'merc', models: [] };
    const ctx = core.ctxOf(data, s);
    const m: Model = { uid: 1, uid_def: 'capt', eq: {} };
    const out = core.withFreeDagger(ctx, m);
    expect(out).not.toBe(m);
    expect(m.eq).toEqual({});
    expect(out.eq?.[core.daggerNameFor(ctx, core.unitDef(ctx, 'capt')) as string]).toBe(1);
    expect(core.withFreeDagger(ctx, out)).toBe(out);
  });

  it('answers without a warband instead of throwing', () => {
    const ctx = core.ctxOf(data, { wb: null, models: [] });
    expect(core.warbandMax(ctx)).toBe(0);
    expect(core.startGold(ctx)).toBe(500);
    expect(core.totalSpent(ctx)).toBe(0);
    expect(core.modelUnitCost(ctx, { uid: 1, uid_def: 'nope' })).toBe(0);
  });
});

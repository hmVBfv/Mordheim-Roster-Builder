/* "May buy: …" is not a special rule (report of 5.11.2026, Rob's answers): the items are start equipment the unit may buy when the warband is
   founded, not in its price, and not found later. They are rows of the unit's list that hold at the founding only. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const ITEMS = ['Echsenhaut-Umhang', 'Schädelmaske', 'Slann-Kopfschmuck'];
const slayer = (afterBattle = false) => {
  let s = core.addUnit(ctx(core.newWarband(data, 'reavers')), 'slayer');
  if (afterBattle) { s = structuredClone(s); s.campaign = { ...s.campaign, on: true, round: 1 }; }
  return { s, m: s.models[0]! };
};

describe('"May buy" is no rule of a unit', () => {
  it('stands in no unit\'s rule text in any warband', () => {
    const found = Object.entries(data.WARBANDS).flatMap(([k, w]) => w.units.filter((u) => /\bMay buy\s*:/i.test(u.sp ?? '')).map((u) => `${k}/${u.id}`));
    expect(found).toEqual([]);
  });

  it('and so the Slayer\'s rules (and their tooltips) do not list it', () => {
    const def = core.unitDef(ctx(slayer().s), 'slayer')!;
    expect(core.ruleDefs(def.sp ?? '', 'x').map((r) => r.name)).not.toContain('May buy');
  });
});

describe('what the Saurus Slayer may buy when the warband is founded', () => {
  it('is rows of his list that hold at the founding only', () => {
    const rows = Object.values(data.LISTS.lrSlayer!).flatMap((g) => (Array.isArray(g) ? g : []));
    for (const nm of ITEMS) expect(rows.find((r) => r[0] === nm)?.[2], nm).toMatchObject({ start: true });
  });

  it('is not part of his price, and is bought at the list price', () => {
    const { s, m } = slayer();
    const before = core.modelUnitCost(ctx(s), m);
    const t = core.setEqQty(ctx(s), m.uid, 'Schädelmaske', 1);
    expect(core.modelUnitCost(ctx(t), t.models[0]!)).toBe(before + 15);
  });

  it('is not found later at the Trading Post, and the row is shut after the first battle', () => {
    const { s, m } = slayer(true);
    const later = core.rareEligibleItems(ctx(s), m).map((i) => i.de);
    for (const nm of [...ITEMS, 'Echsenschwert']) expect(later, nm).not.toContain(nm);
    expect(core.startOnlyRow(ctx(s), core.unitDef(ctx(s), 'slayer'), 'Schädelmaske')).toMatchObject({ start: true });
    expect(core.warbandHasFought(ctx(s))).toBe(true);
  });

  it('is not offered to the others as rare items either, and never before the first battle', () => {
    const { s, m } = slayer();
    expect(core.rareEligibleItems(ctx(s), m).map((i) => i.de)).not.toEqual(expect.arrayContaining(ITEMS));
    for (const nm of ITEMS) expect(core.rareEligibleItems(ctx(s), m).map((i) => i.de), nm).not.toContain(nm);
  });
});

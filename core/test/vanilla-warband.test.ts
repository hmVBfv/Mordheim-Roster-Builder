/* A warband that plays Vanilla Mordheim (wish #167, step 1; Rob, 30.10.2026): only the rulebook's items and skills. Only a warband of
   the rulebook (grade core) can; it is set when the warband is made and carried in the save. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { CatalogItem, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland Captain, with or without the vanilla option. */
function band(vanilla: boolean, wb = 'merc') {
  let s = core.newWarband(data, wb);
  if (vanilla) s = core.asVanillaWarband(ctx(s));
  return core.addUnit(ctx(s), wb === 'merc' ? 'capt' : (data.WARBANDS[wb]!.units.find((u) => u.t === 'hero')!.id));
}

/** A rare item of the catalogue that is not in the rulebook, found by an ordinary Mercenary Captain. */
const modern = (s: WarbandState): CatalogItem => {
  const hero = s.models[0]!.uid;
  const it = (data.CATALOG as CatalogItem[]).find((i) => !i.vanilla && core.rarityOf(ctx(s), i.de) != null && core.canReceive(ctx(s), hero, { key: i.de, rare: true }).ok);
  expect(it, 'a rare item outside the rulebook that a Captain may find').toBeTruthy();
  return it!;
};
const ruled = (s: WarbandState): CatalogItem => {
  const hero = s.models[0]!.uid;
  const it = (data.CATALOG as CatalogItem[]).find((i) => i.vanilla && core.rarityOf(ctx(s), i.de) != null && core.canReceive(ctx(s), hero, { key: i.de, rare: true }).ok);
  expect(it, 'a rare item of the rulebook that a Captain may find').toBeTruthy();
  return it!;
};

describe('the vanilla warband', () => {
  it('is a warband that says so; an ordinary one is not', () => {
    expect(core.isVanillaOnly(band(false))).toBe(false);
    expect(core.isVanillaOnly(band(true))).toBe(true);
    expect(band(true).vanilla).toBe(true);
    expect('vanilla' in band(false)).toBe(false);
  });

  it('only a warband of the rulebook can be one', () => {
    const other = Object.keys(data.WARBANDS).find((k) => !core.isVanillaWarband(data, k))!;
    const s = core.newWarband(data, other);
    expect(core.asVanillaWarband(ctx(s))).toBe(s);
    expect(core.isVanillaOnly(core.asVanillaWarband(ctx(s)))).toBe(false);
  });

  it('can be turned off again, and then is an ordinary warband', () => {
    const off = core.setVanillaWarband(ctx(band(true)), false);
    expect(core.isVanillaOnly(off)).toBe(false);
    expect('vanilla' in off).toBe(false);
  });

  it('may find the rulebook’s rare items and not the others', () => {
    const plain = band(false);
    const van = band(true);
    const out = modern(plain);
    const inn = ruled(van);
    expect(core.rarityOf(ctx(plain), out.de)).not.toBeNull();
    expect(core.rarityOf(ctx(van), out.de)).toBeNull();
    expect(core.rarityOf(ctx(van), inn.de)).not.toBeNull();
    const verdict = core.canReceive(ctx(van), van.models[0]!.uid, { key: out.de, rare: true });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/rulebook/i);
    expect(core.canReceive(ctx(van), van.models[0]!.uid, { key: inn.de, rare: true }).ok).toBe(true);
  });

  it('learns from the rulebook’s lists only – nothing has to be cut, the data has no other list for these warbands', () => {
    const lists = (s: WarbandState) => core.skillListsFor(ctx(s), core.unitDef(ctx(s), s.models[0]!.uid_def)!).map(([label]) => label);
    for (const wb of Object.keys(data.WARBANDS).filter((k) => core.isVanillaWarband(data, k))) {
      const van = band(true, wb);
      const names = lists(van).map((l) => l.replace(/[[\]]/g, ''));
      const allowed = new Set([...data.VANILLA.skillLists.map((k) => data.SKILLLISTS[k]!.name), ...Object.values(data.SKILLSETS).map((x) => x.name)]);
      for (const n of names) expect(allowed.has(n), `${wb}: ${n}`).toBe(true);
    }
  });

  it('keeps its option through a save', () => {
    const back = core.loadSave(data, JSON.parse(JSON.stringify(core.writeSave(ctx(band(true))))));
    expect(back.ok && core.isVanillaOnly(back.state)).toBe(true);
  });
});

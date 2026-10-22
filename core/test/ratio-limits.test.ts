/* Unit limits that hang on another unit (report #46, Rob 22.10.2026: "other
   warbands with a similar extra restriction"). mordheimer.net, the warband
   pages, "Choice of Warriors" / special rules:
   - Night Goblins: never more Cave Squigs than Night Goblins;
   - Black Orcs: only as many Shootaz as Boyz;
   - Bretonnian Knights: no more Squires than Knights (the Questing Knight is one);
   - Lizardmen: never more Saurus Braves than Skink Braves;
   - Pirates: never more Swabbies than Crew.
   The Orc Mob is in orc-mob-limits.test.ts. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const count = (s: WarbandState, id: string) => core.modelsOf(ctx(s), id);
const status = (s: WarbandState, id: string) => core.recruitStatus(ctx(s), id)!;

/** Recruits `n` men of a henchmen unit (as one group), or the Hero once. */
function recruit(s: WarbandState, id: string, n = 1): WarbandState {
  let t = s.models.some((m) => m.uid_def === id) ? s : core.addUnit(ctx(s), id);
  const m = t.models.find((x) => x.uid_def === id);
  if (m && core.unitDef(ctx(t), id)?.t === 'hen') t = core.setQty(ctx(t), m.uid, n);
  return t;
}
const start = (wb: string, leader: string) => core.addUnit(ctx(core.newWarband(data, wb)), leader);

describe('Night Goblins: Cave Squigs never above the Night Goblins', () => {
  it('no Night Goblin, no Squig; then as many as the Goblins, up to five', () => {
    let s = start('nightgoblins', 'bigboss');
    expect(status(s, 'squig')).toMatchObject({ max: 0, atMax: true });
    expect(core.addUnit(ctx(s), 'squig')).toBe(s);
    s = recruit(s, 'nightgob', 3);
    expect(status(s, 'squig').max).toBe(3);
    s = recruit(s, 'squig', 5);
    expect(count(s, 'squig')).toBe(3);
    s = recruit(s, 'nightgob', 5);
    expect(status(s, 'squig').max).toBe(5);
  });
});

describe('Black Orcs: Shootaz only as many as Boyz', () => {
  it('limits the Shootaz by the Boyz, with no ceiling of their own', () => {
    let s = start('blackorcs', 'bboss');
    expect(status(s, 'shootaz')).toMatchObject({ max: 0, atMax: true });
    s = recruit(s, 'boyz', 3);
    expect(status(s, 'shootaz')).toMatchObject({ max: 3, limit: '0–3' });
    s = recruit(s, 'shootaz', 5);
    expect(count(s, 'shootaz')).toBe(3);
    s = recruit(s, 'boyz', 5);
    expect(status(s, 'shootaz').max).toBe(5);
    expect(status(s, 'boyz')).toMatchObject({ max: null, limit: 'any' });
  });
});

describe('Bretonnian Knights: no more Squires than Knights', () => {
  it('counts the Questing Knight and the Knights Errant, and at most three', () => {
    let s = start('bretonnian', 'paladin');
    expect(status(s, 'squire').max).toBe(1);
    s = core.addUnit(ctx(s), 'squire');
    expect(status(s, 'squire').atMax).toBe(true);
    expect(core.addUnit(ctx(s), 'squire')).toBe(s);
    s = core.addUnit(ctx(s), 'errant');
    expect(status(s, 'squire').max).toBe(2);
    s = core.addUnit(ctx(s), 'errant');
    s = core.addUnit(ctx(s), 'squire');
    s = core.addUnit(ctx(s), 'squire');
    expect(count(s, 'squire')).toBe(3);
    expect(status(s, 'squire')).toMatchObject({ max: 3, atMax: true });
  });
});

describe('Lizardmen: no more Saurus Braves than Skink Braves', () => {
  it('limits the Saurus by the Skinks, and by four', () => {
    let s = start('lizardmen', 'skinkpriest');
    expect(status(s, 'saurusbrave')).toMatchObject({ max: 0, atMax: true });
    s = recruit(s, 'skinkbrave', 2);
    s = recruit(s, 'saurusbrave', 4);
    expect(count(s, 'saurusbrave')).toBe(2);
    s = recruit(s, 'skinkbrave', 5);
    s = recruit(s, 'saurusbrave', 5);
    expect(count(s, 'saurusbrave')).toBe(4);
    expect(status(s, 'saurusbrave').max).toBe(4);
  });

  it('warns when the Skinks fall below the Saurus', () => {
    let s = recruit(start('lizardmen', 'skinkpriest'), 'skinkbrave', 3);
    s = recruit(s, 'saurusbrave', 3);
    expect(core.warbandWarnings(ctx(s)).some((w) => /Saurus Brave/.test(w))).toBe(false);
    s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'skinkbrave')!.uid, 1);
    expect(core.warbandWarnings(ctx(s))).toContain('Too many Saurus Brave (max. 1).');
  });
});

describe('Pirates: no more Swabbies than Crew', () => {
  it('limits the Swabbies by the Crew, and by five', () => {
    let s = start('pirates', 'pcaptain');
    expect(status(s, 'swabbie')).toMatchObject({ max: 0, atMax: true });
    s = recruit(s, 'crew', 2);
    s = recruit(s, 'swabbie', 5);
    expect(count(s, 'swabbie')).toBe(2);
    s = recruit(s, 'crew', 5);
    s = recruit(s, 'swabbie', 5);
    expect(count(s, 'swabbie')).toBe(5);
  });
});

describe('the other warbands keep the maxima of their data', () => {
  it('Reikland Mercenaries, Undead and Skaven are as before', () => {
    const m = start('merc', 'capt');
    expect(status(m, 'warr')).toMatchObject({ max: null, limit: 'any' });
    expect(status(m, 'young').max).toBe(2);
    expect(status(start('undead', 'vamp'), 'wolf').max).toBe(5);
  });
});

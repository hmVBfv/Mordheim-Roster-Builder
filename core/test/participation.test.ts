/* Wish of 9.11.2026: a unit can be marked as not taking part – for the next battle, for N battles, or until it is switched back – and is greyed out.
   A unit that depends on another (the Beasthounds on the Beastmaster) stays behind with it; a unit whose master is not on the roster stays behind
   too. Whoever misses a battle still counts in the warband rating. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
const band = (wb: string, ...units: string[]) => {
  let s = core.newWarband(data, wb);
  for (const u of units) s = core.addUnit(ctx(s), u);
  return s;
};
const uidOf = (s: core.WarbandState, def: string) => s.models.find((m) => m.uid_def === def)!.uid;
const part = (s: core.WarbandState, def: string) => core.participation(ctx(s), s.models.find((m) => m.uid_def === def)!);

describe('who takes part in the next battle', () => {
  it('everybody, unless marked or kept away', () => {
    const s = band('merc', 'capt');
    expect(part(s, 'capt')).toEqual({ takesPart: true, text: 'Takes part in the next battle', own: false });
  });

  it('a unit that misses the next battle says so, for one battle or for several', () => {
    const s = band('merc', 'capt');
    const one = core.setParticipation(ctx(s), uidOf(s, 'capt'), { miss: 1 });
    expect(part(one, 'capt')).toMatchObject({ takesPart: false, text: 'Misses next battle', own: true });
    const three = core.setParticipation(ctx(one), uidOf(s, 'capt'), { miss: 3 });
    expect(part(three, 'capt')).toMatchObject({ takesPart: false, text: 'Misses next 3 battles' });
    const back = core.setParticipation(ctx(three), uidOf(s, 'capt'), { miss: 0 });
    expect(part(back, 'capt').takesPart).toBe(true);
  });

  it('a unit kept away until it is switched back says so, and the count does not tick', () => {
    const s = band('merc', 'capt');
    const away = core.setParticipation(ctx(s), uidOf(s, 'capt'), { sitsOut: true });
    expect(part(away, 'capt')).toMatchObject({ takesPart: false, text: 'Not taking part until switched back', own: true });
    const back = core.setParticipation(ctx(away), uidOf(s, 'capt'), { sitsOut: false });
    expect(part(back, 'capt').takesPart).toBe(true);
  });

  it('keeps the games a unit misses from an injury, as before', () => {
    const s = band('merc', 'capt');
    const hurt = core.adjustMiss(ctx(s), uidOf(s, 'capt'), 2);
    expect(part(hurt, 'capt').text).toBe('Misses next 2 battles');
  });
});

describe('a unit that depends on another', () => {
  it('stays behind where its master is not in the warband, and goes with him when he is there', () => {
    let s = band('darkelves', 'highborn', 'beastmaster', 'coldone');
    expect(part(s, 'coldone').takesPart).toBe(true);
    // the Beastmaster leaves (dies, is dismissed): the beasts have nobody
    s = core.removeUnit(ctx(s), uidOf(s, 'beastmaster'));
    expect(part(s, 'coldone')).toMatchObject({ takesPart: false, text: 'Stays behind: no Beastmaster in the warband', own: false });
  });

  it('stays behind while his master misses the battle', () => {
    let s = band('darkelves', 'highborn', 'beastmaster', 'coldone');
    s = core.setParticipation(ctx(s), uidOf(s, 'beastmaster'), { miss: 1 });
    expect(part(s, 'coldone')).toMatchObject({ takesPart: false, text: 'Stays behind: the Beastmaster misses the battle' });
    s = core.setParticipation(ctx(s), uidOf(s, 'beastmaster'), { miss: 0 });
    expect(part(s, 'coldone').takesPart).toBe(true);
  });

  it('is one of four in the data, each with a page that says so: Beasthounds, Scarecrows, Sabretusks and Wolves', () => {
    const needs = Object.entries(data.WARBANDS).flatMap(([wb, w]) => w.units.filter((u) => u.needs).map((u) => `${wb}/${u.id}:${u.needs}`));
    expect(needs.sort()).toEqual(['darkelves/coldone:beastmaster', 'maneaters/sabretusk:guide', 'norse/wolf:wulfen', 'restless/scarecrow:liche,necromancer']);
  });

  it('is satisfied by either of two possible masters (the Scarecrow: the Liche or the Necromancer)', () => {
    let s = band('restless', 'liche', 'necromancer', 'scarecrow');
    s = core.setParticipation(ctx(s), uidOf(s, 'liche'), { miss: 1 });
    expect(part(s, 'scarecrow').takesPart).toBe(true);
    s = core.setParticipation(ctx(s), uidOf(s, 'necromancer'), { sitsOut: true });
    expect(part(s, 'scarecrow')).toMatchObject({ takesPart: false, text: 'Stays behind: the Liche and the Necromancer miss the battle' });
  });

  it('is named by the master the page names, for the Wolves and the Sabretusks too', () => {
    const norse = band('norse', 'jarl', 'wulfen', 'wolf');
    expect(part(core.removeUnit(ctx(norse), uidOf(norse, 'wulfen')), 'wolf').text).toBe('Stays behind: no Wulfen in the warband');
    const ogres = band('maneaters', 'captain', 'guide', 'sabretusk');
    expect(part(core.removeUnit(ctx(ogres), uidOf(ogres, 'guide')), 'sabretusk').text).toBe('Stays behind: no Mountain Guide in the warband');
  });
});

describe('what staying out leaves unchanged', () => {
  it('still counts in the warband rating and the value', () => {
    const s = band('darkelves', 'highborn', 'beastmaster', 'coldone');
    const out = core.setParticipation(ctx(core.setParticipation(ctx(s), uidOf(s, 'beastmaster'), { miss: 2 })), uidOf(s, 'highborn'), { sitsOut: true });
    expect(core.totalRating(ctx(out))).toBe(core.totalRating(ctx(s)));
    expect(core.totalSpent(ctx(out))).toBe(core.totalSpent(ctx(s)));
  });

  it('is served by the battle: a missed battle ticks down, a unit kept away stays away', () => {
    let s = band('darkelves', 'highborn', 'beastmaster', 'coldone');
    s = { ...s, campaign: { ...s.campaign!, on: true, round: 1, districts: {} } };
    s = core.setParticipation(ctx(s), uidOf(s, 'beastmaster'), { miss: 2 });
    s = core.setParticipation(ctx(s), uidOf(s, 'highborn'), { sitsOut: true });
    s = core.advanceRound(ctx(s), '2026-11-09');
    expect(s.models.find((m) => m.uid_def === 'beastmaster')!.miss).toBe(1);
    expect(s.models.find((m) => m.uid_def === 'highborn')!.sitsOut).toBe(true);
    expect(s.models.find((m) => m.uid_def === 'coldone')!.miss ?? 0).toBe(0);
  });
});

/* Wish 258 (Rob, 12.11.2026): the racial maximum characteristics of mordheimer.net (Campaigns › Experience) are all in the data, and the new
   warbands of grade 2a use them – their own tables where a page prints one, a hard limit that only the house rule lifts. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const S = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;
const row = (k: string) => S.map((x) => (data.MAXPROF[k] as Record<string, number>)[x]);

/** The table of the page, row for row (the key is ours). */
const PAGE: Record<string, number[]> = {
  human: [4, 6, 6, 4, 4, 3, 6, 4, 9], elf: [5, 7, 7, 4, 4, 3, 9, 4, 10], dwarf: [3, 7, 6, 4, 5, 3, 5, 4, 10], ogre: [6, 6, 5, 5, 5, 5, 6, 5, 9],
  halfling: [4, 5, 7, 3, 3, 3, 9, 4, 10], possessed: [6, 8, 0, 6, 6, 4, 7, 5, 10], vampire: [6, 8, 6, 7, 6, 4, 9, 4, 10], skaven: [6, 6, 6, 4, 4, 3, 7, 4, 7],
  skavenpest: [5, 6, 6, 4, 5, 3, 7, 4, 7], ghoul: [5, 5, 2, 4, 5, 3, 5, 5, 7], saurus: [4, 6, 0, 5, 5, 3, 4, 4, 10], skink: [6, 5, 6, 4, 3, 3, 7, 4, 8],
  goblin: [4, 5, 6, 4, 4, 3, 6, 4, 7], orc: [4, 6, 6, 4, 5, 3, 5, 4, 9], blackorc: [4, 7, 6, 5, 6, 3, 5, 4, 9], werecreature: [8, 6, 0, 6, 5, 4, 7, 4, 9],
  tomblord: [4, 6, 6, 5, 5, 5, 5, 4, 9], lichepriest: [4, 6, 6, 4, 4, 3, 6, 4, 9], liche: [5, 4, 4, 4, 4, 8, 6, 3, 10], graveguard: [5, 5, 5, 4, 4, 4, 5, 4, 10],
  bullcentaurbd: [8, 7, 6, 5, 5, 4, 6, 5, 10], bullcentaur: [7, 7, 3, 5, 5, 4, 4, 5, 9], hobgoblin: [4, 5, 5, 4, 4, 3, 5, 3, 8], marauder: [4, 7, 7, 4, 4, 3, 7, 4, 9],
  woc: [4, 8, 8, 5, 5, 3, 8, 5, 9], ungor: [6, 6, 6, 4, 4, 3, 7, 4, 7], centigor: [9, 7, 6, 4, 5, 4, 6, 4, 9], minotaur: [6, 6, 5, 5, 5, 5, 6, 5, 9],
  gor: [5, 7, 6, 4, 5, 4, 6, 4, 9],
};

/** The warbands' own tables, as their pages print them. */
const OWN: Record<string, number[]> = {
  druchii: [5, 7, 7, 4, 3, 3, 9, 4, 10], necrarch: [6, 4, 4, 6, 6, 4, 9, 3, 10], ogrehunter: [6, 6, 4, 5, 5, 5, 4, 5, 9], gnoblar: [4, 5, 6, 3, 4, 3, 6, 4, 7],
  snotling: [4, 4, 4, 3, 3, 2, 9, 4, 6], wolfman: [6, 4, 3, 5, 4, 3, 7, 4, 8],
};

function unit(wb: string, id: string) {
  let s = core.newWarband(data, wb);
  const own = data.WARBANDS[wb]!.units.find((x) => x.id === id)!;
  // the leader first, and the master of a unit that needs one
  for (const u of [...data.WARBANDS[wb]!.units.filter((x) => x.req).map((x) => x.id), ...((own.needs as string[] | undefined) ?? [])]) if (u !== id) s = core.addUnit(ctx(s), u);
  s = core.addUnit(ctx(s), id);
  return { s, m: s.models.find((x) => x.uid_def === id)! };
}
const raceOf = (wb: string, id: string) => { const { s, m } = unit(wb, id); return core.maxInfo(ctx(s), m)?.key ?? null; };

describe('the racial maximum characteristics', () => {
  it('hold every row of the table on mordheimer.net', () => {
    for (const [k, v] of Object.entries(PAGE)) expect(row(k), k).toEqual(v);
  });

  it('hold the tables that the pages of the new warbands print, under a race of their own', () => {
    for (const [k, v] of Object.entries(OWN)) expect(row(k), k).toEqual(v);
    for (const k of Object.keys(OWN)) { expect(data.RACELABEL[k], k).toBeTruthy(); expect(data.RACE_EN[k], k).toBeTruthy(); }
  });

  it('are given to the units of the new warbands: their own table where the page prints one, the common one else, none to the animals and the dead', () => {
    expect(raceOf('druchii', 'noble')).toBe('druchii');
    expect(raceOf('druchii', 'slavehound')).toBeNull();
    expect(raceOf('necrarchs', 'necrarchva')).toBe('necrarch');
    expect(raceOf('necrarchs', 'thrall')).toBe('vampire');
    expect(raceOf('necrarchs', 'acolyte')).toBe('human');
    expect(raceOf('necrarchs', 'zomby')).toBeNull();
    expect(raceOf('ogrehunters', 'ogrehunter')).toBe('ogrehunter');
    expect(raceOf('ogrehunters', 'trapper')).toBe('gnoblar');
    expect(raceOf('ogrehunters', 'sabretuskc')).toBeNull();
    expect(raceOf('snotlings', 'bulliedgob')).toBe('goblin');
    expect(raceOf('snotlings', 'snotlingsc')).toBe('snotling');
    expect(raceOf('mastersofhorror', 'wolfman')).toBe('wolfman');
    expect(raceOf('mastersofhorror', 'thrall')).toBe('vampire');
    expect(raceOf('mastersofhorror', 'zomby')).toBeNull();
    expect(raceOf('halflings', 'villageogr')).toBe('ogre');
    expect(raceOf('halflings', 'piggy')).toBeNull();
    expect(raceOf('halflings', 'halflingel')).toBe('halfling');
    expect(raceOf('strigos', 'strigoivam')).toBe('vampire');
    expect(raceOf('strigos', 'ghoul')).toBe('ghoul');
    expect(raceOf('strigos', 'giantbat')).toBeNull();
    expect(raceOf('moulder', 'clanrat')).toBe('skaven');
    expect(raceOf('moulder', 'ratogre')).toBeNull();
    expect(raceOf('slayercult', 'giantslaye')).toBe('dwarf');
    expect(raceOf('graverobbers', 'graver')).toBe('human');
  });

  it('are a hard limit: a Druchii Noble stops at Toughness 3, the house rule lifts it', () => {
    const first = unit('druchii', 'noble');
    let s = first.s;
    const m = first.m;
    expect(core.canAdv(ctx(s), m, 'T')).toBe(false);          // base 3, the Druchii's maximum 3
    expect(core.canAdv(ctx(s), m, 'WS')).toBe(true);
    s = core.setHouseBool(ctx(s), 'noRacialMax', true);
    expect(core.canAdv(ctx(s), s.models.find((x) => x.uid_def === 'noble')!, 'T')).toBe(true);
  });

  it('are a hard limit for the Wolfman too: Strength 4 may rise to 5 and no further', () => {
    const first = unit('mastersofhorror', 'wolfman');
    let s = first.s;
    const m = first.m;
    s = core.addAdvance(ctx(s), m.uid, 'S');
    s = core.addAdvance(ctx(s), m.uid, 'S');
    expect(core.effProfile(ctx(s), s.models.find((x) => x.uid === m.uid)!)!.S).toBe(5);
  });
});

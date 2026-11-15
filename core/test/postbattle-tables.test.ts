/* N1: every table of the post-battle sequence, held against the values on mordheimer.net (Tools: Post-battle, Campaigns: Experience,
   Income) as read on 13.11.2026. A number that drifts from the page fails here; a change of the page is a decision for Rob. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('post-battle tables', () => {
  it('the wyrdstone price table: total gold for the lot, by warband size', () => {
    expect(core.WYRD_BANDS.map((b) => b[1])).toEqual(['1–3', '4–6', '7–9', '10–12', '13–15', '16+']);
    expect(core.WYRD_PRICE).toEqual([
      [45, 40, 35, 30, 30, 25], [60, 55, 50, 45, 40, 35], [75, 70, 65, 60, 55, 50], [90, 80, 70, 65, 60, 55],
      [110, 100, 90, 80, 70, 65], [120, 110, 100, 90, 80, 70], [145, 130, 120, 110, 100, 90], [155, 140, 130, 120, 110, 100],
    ]);
  });

  it('the exploration chart: dice total to shards', () => {
    expect(data.PB_EXPLORE_SHARDS).toEqual([['1–5', 1], ['6–11', 2], ['12–17', 3], ['18–24', 4], ['25–30', 5], ['31–35', 6], ['36+', 7]]);
  });

  it('the underdog bonus by the difference in warband rating', () => {
    expect(data.PB_UNDERDOG).toEqual([[0, 50, 0], [51, 75, 1], [76, 100, 2], [101, 150, 3], [151, 300, 4], [301, null, 5]]);
    const at = (d: number) => core.underdogBonus(data, d);
    expect([0, 50, 51, 75, 76, 100, 101, 150, 151, 300, 301, 999].map(at)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(at(-40)).toBe(0); // the stronger warband earns nothing
  });

  it('the hero advance table (2D6)', () => {
    expect(data.PB_HERO_ADVANCE.map((r) => [r[0], r[1]])).toEqual([
      ['2–5', 'New skill'], ['6', '+1 S or +1 A'], ['7', '+1 WS or +1 BS'], ['8', '+1 I or +1 Ld'], ['9', '+1 W or +1 T'], ['10–12', 'New skill'],
    ]);
  });

  it('the henchman advance table (2D6)', () => {
    expect(data.PB_HENCH_ADVANCE.map((r) => r[0])).toEqual(['2–4', '5', '6–7', '8', '9', '10–12']);
    expect(data.PB_HENCH_ADVANCE.map((r) => r[1])).toEqual([
      '+1 Initiative', '+1 Strength', '+1 BS or +1 WS', '+1 Attack', '+1 Leadership', expect.stringMatching(/talent/i),
    ]);
  });

  it('the henchman injury roll and the experience awards', () => {
    expect(data.PB_HENCH_INJURY.map((r) => [r[0], r[1]])).toEqual([['1–2', 'Dead'], ['3–6', 'Recovers']]);
    expect(data.PB_XP_AWARDS.map((r) => [r[0], r[1]])).toEqual([['Survives', '+1'], ['Winning leader', '+1'], ['Enemy out of action', '+1 each'], ['Scenario', 'varies']]);
  });

  it('the hero injury chart has every result of the D66 table', () => {
    // a result with a D6 inside it (Arm Wound 23, Madness 24, Smashed Leg 25) is held as two rows, 23a and 23b …
    expect([...new Set(data.INJURIES.map((j) => j.code.replace(/[ab]$/, '')))]).toEqual([
      '11-15', '16-21', '22', '23', '24', '25', '26', '31', '32', '33', '34', '35', '36', '41-55', '56', '61', '62-63', '64', '65', '66',
    ]);
  });

  it('the thirty locations: six doubles, six triples, … six of a kind, in the order of the chart', () => {
    const keys = data.PB_LOCATIONS.map((l) => l[0]);
    expect(keys).toHaveLength(30);
    expect(keys.filter((k) => k.split(' ').length === 2)).toEqual(['1 1', '2 2', '3 3', '4 4', '5 5', '6 6']);
    expect(keys.filter((k) => k.split(' ').length === 6)).toEqual(['1 1 1 1 1 1', '2 2 2 2 2 2', '3 3 3 3 3 3', '4 4 4 4 4 4', '5 5 5 5 5 5', '6 6 6 6 6 6']);
    expect(data.PB_LOCATIONS.map((l) => l[1])).toEqual([
      'Well', 'Shop', 'Corpse', 'Straggler', 'Overturned cart', 'Ruined hovels',
      'Tavern', 'Smithy', 'Prisoners', 'Fletcher', 'Market hall', 'Returning a favour',
      'Gunsmith', 'Shrine', 'Townhouse', 'Armourer', 'Graveyard', 'Catacombs',
      "Moneylender's house", "Alchemist's laboratory", 'Jewelsmith', "Merchant's house", 'Shattered building', 'Entrance to the catacombs',
      'The pit', 'Hidden treasure', 'Dwarf smithy', 'Slaughtered warband', 'Fighting arena', "Noble's villa",
    ]);
  });

  it('the ten steps in the rulebook order, each with its sentence', () => {
    expect(core.PB_ORDER).toEqual(['injuries', 'experience', 'exploration', 'wyrdstone', 'veterans', 'rare', 'dramatis', 'recruits', 'equipment', 'rating']);
    expect(data.PB_SEQUENCE.map((s) => s[0])).toEqual([...core.PB_ORDER]);
    for (const s of data.PB_SEQUENCE) expect(s[1].length).toBeGreaterThan(20);
  });
});

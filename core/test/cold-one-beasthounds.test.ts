/* Report of 9.11.2026: the Cold One Beasthounds lacked the rule "Beastmaster" of their page, and their other rules were shortened. The five rules of the
   unit are the words of mordheimer.net (Dark Elves, Grade 1b). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const rules = core.ruleDefs(data.WARBANDS.darkelves!.units.find((u) => u.id === 'coldone')!.sp ?? '', 'x');
const text = (name: string) => rules.find((r) => r.name === name)?.text;

describe('the rules of the Cold One Beasthounds', () => {
  it('are the five of their page, in this order', () => {
    expect(rules.map((r) => r.name)).toEqual(['Animals', 'Beastmaster', 'Stupidity', 'Scaly Skin', 'Fear']);
  });

  it('say all of the Beastmaster rule, also that the beasts stay away where he cannot fight', () => {
    expect(text('Beastmaster')).toBe('Cold One Beasthounds are nasty viscous brutes that are barely kept under control. If the Beastmaster dies the beasts will immediately escape from the warband and they are removed from the warband roster. If the Beastmaster is unable to participate in a battle, then neither will the beasts.');
  });

  it('give Stupidity, Scaly Skin and Animals in full', () => {
    expect(text('Stupidity')).toBe('Cold One Beasthounds may use the basic Leadership of the Beastmaster if they are within 6" of him. They may never use the Leadership of the warband leader, nor may they benefit from the Beastmaster’s increased Leadership if he is within 6" of the leader.');
    expect(text('Scaly Skin')).toMatch(/considered to have a 6\+ armour save\. This save cannot be modified beyond 6 due to strength modifiers but any result of ‘no save’ on the Critical Hit chart will negate the unmodified 6\+ save\.$/);
    expect(text('Animals')).toBe('Cold One Beasthounds are animals and all animal rules apply to them, they never gain experience.');
    expect(text('Fear')).toBe('Cold One Beasthounds cause Fear.');
  });
});

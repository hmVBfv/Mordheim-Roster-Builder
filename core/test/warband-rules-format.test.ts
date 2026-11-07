/* Report of 7.11.2026: the Black Orcs' Animosity stood without a heading and ran into the unit choice. In every warband each rule is
   "<b>Name:</b> what it says", one after the other; a sentence without a heading belongs to no rule, and shows with the one before it. */
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('the rules text of every warband', () => {
  it('has a colon at the end of every heading', () => {
    const bad: string[] = [];
    for (const [k, w] of Object.entries(data.WARBANDS)) for (const m of String(w.rules ?? '').matchAll(/<b>([^<]*)<\/b>/g)) if (!/:$/.test(m[1] as string)) bad.push(`${k}: ${m[1]}`);
    expect(bad).toEqual([]);
  });

  it('starts every line after a break with a heading', () => {
    const bad: string[] = [];
    for (const [k, w] of Object.entries(data.WARBANDS)) {
      String(w.rules ?? '').split(/<br\s*\/?>/).slice(1).forEach((line) => { if (!/^\s*<b>/.test(line)) bad.push(`${k}: ${line.slice(0, 50)}`); });
    }
    expect(bad).toEqual([]);
  });

  it('says something under each heading', () => {
    const bad: string[] = [];
    for (const [k, w] of Object.entries(data.WARBANDS)) for (const m of String(w.rules ?? '').matchAll(/<b>([^<]*)<\/b>\s*(<br\s*\/?>|<b>|$)/g)) bad.push(`${k}: ${m[1]}`);
    expect(bad).toEqual([]);
  });
});

/* Rob, 7.11.2026: two sentences at the end of the Lustrian Reavers' Hired Swords stood under the wrong rule: the one on the special equipment and the one on
   the War Beasts, who do not advance. Each stands with its own rule. */
describe('the rules text of the Lustrian Reavers', () => {
  const defs = () => Object.fromEntries([...String(data.WARBANDS.reavers!.rules).matchAll(/<b>([^<]*):<\/b>([^<]*)/g)].map((m) => [m[1], m[2]!.trim()]));

  it('keeps the War Beasts\' sentence and the special equipment with their own rules', () => {
    const d = defs();
    expect(d['War Beasts']).toMatch(/animals and do not advance/);
    expect(d['Special equipment']).toMatch(/special equipment \(noted below\) that cannot be replaced if lost/);
    expect(d['Hired Swords']).toBe('Only Ogre Bodyguard, Dwarf Trollslayer, Tilean Marksman or Big Game Hunter.');
  });
});

/* Report of 7.11.2026: "Max. 2 Black Orcs, 2 Young'uns" can be read as "2 Young'uns are needed". Every warband states its unit choice the same way:
   one line a unit, with its limit as exactly N, 0–N, any number or N or more – never as prose, in no warband and in all. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const choiceText = (wb: string) => core.ruleDefs(data.WARBANDS[wb]!.rules, 'x').find((d) => d.name === 'Choice')?.text ?? '';
const lines = (wb: string) => core.unitChoice(choiceText(wb))!.map((r) => `${r.name}: ${r.limit}${r.note ? ` (${r.note})` : ''}`);

describe('the unit choice of a warband', () => {
  it('reads the Black Orcs\' as 0–2 Young\'uns, not as two', () => {
    expect(lines('blackorcs')).toEqual([
      'Black Orc Boss: exactly 1', 'Black Orcs: 0–2', 'Young\'uns: 0–2', 'Boyz: any number', 'Shootaz: any number (never more than Boyz)', 'Nuttaz: 0–4', 'Troll: 0–1',
    ]);
  });

  it('keeps what a unit needs or is bound to as a note, with the same words everywhere', () => {
    expect(lines('lizardmen')).toContain('Saurus Braves: 0–4 (never more than Skink Braves)');
    expect(lines('darkelves')).toContain('Cold One Beasthounds: 0–2 (only with a Beastmaster)');
    expect(lines('amazons')).toContain('Amazon Warrior: 1 or more');
    expect(lines('amazonslustria')).toContain('Amazon Warriors: 1 or more');
    expect(lines('merc').at(-1)).toBe('Warriors: any number');
  });

  it('is a list for every warband that states one, and reads all of its text', () => {
    const bad: string[] = [];
    for (const wb of Object.keys(data.WARBANDS)) {
      const t = choiceText(wb);
      if (!t || wb === 'cppleasures') continue; // a draft whose "choice" is a rule about the Leader
      const rows = core.unitChoice(t);
      if (!rows || rows.length < 3) bad.push(`${wb}: ${t}`);
      else for (const r of rows) if (!/^(exactly \d+|0–\d+|any number|\d+ or more)$/.test(r.limit)) bad.push(`${wb}: ${r.name}: ${r.limit}`);
    }
    expect(bad).toEqual([]);
  });

  it('names units as the warband has them: every row is a unit of the warband (a plural counts)', () => {
    const words = (n: string) => n.toLowerCase().split(/[^a-z']+/).filter(Boolean).map((w) => w.replace(/['’]/g, '').replace(/men$/, 'man'));
    const same = (a: string, b: string) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return a === b || (l.startsWith(s.slice(0, -1)) && l.length - s.length <= 3); };
    // the words of one name run in the other, a plural ignored
    const within = (x: string[], y: string[]) => y.some((_, i) => x.every((w, j) => y[i + j] !== undefined && same(w, y[i + j]!)));
    const missing: string[] = [];
    for (const wb of Object.keys(data.WARBANDS)) {
      const t = choiceText(wb);
      if (!t || wb === 'cppleasures') continue;
      const units = data.WARBANDS[wb]!.units.map((u) => words(u.name));
      for (const r of core.unitChoice(t) ?? []) if (!units.some((u) => within(words(r.name), u) || within(u, words(r.name)))) missing.push(`${wb}: ${r.name}`);
    }
    expect(missing).toEqual([]);
  });
});

/* Wish of 7.11.2026: the unit choice divides into Heroes and Henchmen, as the roster does. */
describe('the unit choice, divided into Heroes and Henchmen', () => {
  const kinds = (wb: string) => {
    const def = data.WARBANDS[wb]!;
    return core.choiceWithKinds(core.unitChoice(choiceText(wb))!, def.units).map((r) => `${r.kind}: ${r.name}`);
  };

  it('puts each row among the Heroes or the Henchmen by the unit it names', () => {
    expect(kinds('blackorcs')).toEqual([
      'hero: Black Orc Boss', 'hero: Black Orcs', 'hero: Young\'uns', 'hench: Boyz', 'hench: Shootaz', 'hench: Nuttaz', 'hench: Troll',
    ]);
    expect(kinds('merc')[0]).toBe('hero: Captain');
    expect(kinds('merc').at(-1)).toBe('hench: Warriors');
  });

  it('gives every row of every warband a place', () => {
    const bad: string[] = [];
    for (const wb of Object.keys(data.WARBANDS)) {
      const t = choiceText(wb);
      if (!t || wb === 'cppleasures') continue;
      for (const r of core.choiceWithKinds(core.unitChoice(t)!, data.WARBANDS[wb]!.units)) if (r.kind !== 'hero' && r.kind !== 'hench') bad.push(`${wb}: ${r.name}`);
    }
    expect(bad).toEqual([]);
  });
});


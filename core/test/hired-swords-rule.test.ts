/* Report of 7.11.2026: "Hired Swords: Only Pit Fighter, Ogre Bodyguard, Warlock" can be read as "the only ones" or as "also these". Every warband that
   restricts its Hired Swords says so with one of five openings, the rule first and the names after it, the same in all of them. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

const OPENINGS = [
  /^May hire only these Hired Swords( or Dramatis Personae)?, no others – /,
  /^May hire any Hired Sword except /,
  /^May hire the Hired Swords of an? /,
  /^May hire the Hired Swords open to /,
  /^May hire no Hired Swords/,
];

/** The rules of the warbands that say whom the warband may hire. */
function hireRules() {
  const out: { wb: string; name: string; text: string }[] = [];
  for (const [wb, w] of Object.entries(data.WARBANDS)) {
    for (const d of core.ruleDefs(w.rules, 'x')) if (/Hired Sword/i.test(d.text) && /\bhire\b|\btake\b/i.test(d.text)) out.push({ wb, name: d.name, text: d.text });
  }
  return out;
}

describe('the Hired Swords of a warband', () => {
  it('are restricted in words that cannot be read two ways: one of five openings, in every warband', () => {
    const bad = hireRules().filter((r) => !OPENINGS.some((re) => re.test(r.text))).map((r) => `${r.wb}: ${r.name}: ${r.text.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it('are said under the heading "Hired Swords" wherever the rule has no name of its own', () => {
    const rules = hireRules();
    for (const wb of ['orcmob', 'reavers', 'maraudersofchaos', 'outriders', 'kislev', 'hochland', 'caravans', 'pirates', 'outlaws', 'pitfighters', 'sonsofhashut', 'blackdwarfs', 'beastmen', 'carnival', 'cavalcade']) {
      expect(rules.some((r) => r.wb === wb && r.name === 'Hired Swords'), wb).toBe(true);
    }
  });

  it('read for the Orc Mob: only three, no others', () => {
    expect(hireRules().find((r) => r.wb === 'orcmob')!.text).toBe('May hire only these Hired Swords, no others – Pit Fighter, Ogre Bodyguard, Warlock.');
  });
});

/* Report of 7.11.2026: the tooltip of "Oi Behave!" began in lower case ("if a Henchman fails Animosity …"). The data words many rules as
   "Name: what happens", sometimes in lower case after the colon; every bubble starts its text with a capital. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { itemTip, warbandRuleTexts, warriorFacts } from './tips.ts';

const lower = (t: string) => /^[a-z]/.test(t);

describe('the text of a bubble', () => {
  it('starts with a capital for the rules of every unit of every warband', () => {
    const bad: string[] = [];
    for (const wb of Object.keys(data.WARBANDS)) {
      for (const u of (data.WARBANDS[wb] as { units: { id: string }[] }).units) {
        const s = core.addUnit(core.ctxOf(data, core.newWarband(data, wb)), u.id);
        const m = s.models.at(-1);
        if (!m) continue;
        for (const r of warriorFacts(core.ctxOf(data, s), m).rules) for (const t of r.tips) if (lower(t.text)) bad.push(`${wb}/${u.id}: ${r.label}: ${t.text.slice(0, 30)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('starts with a capital for the rules of every warband and every item', () => {
    const bad: string[] = [];
    for (const wb of Object.keys(data.WARBANDS)) {
      for (const r of warbandRuleTexts(core.ctxOf(data, core.newWarband(data, wb))).rules) if (lower(r.text)) bad.push(`${wb}: ${r.name}`);
    }
    for (const it of data.CATALOG) for (const t of itemTip(data, it.de)) if (lower(t.text)) bad.push(`item ${it.de}: ${t.text.slice(0, 30)}`);
    expect(bad).toEqual([]);
  });
});

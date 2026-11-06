/* Report of 6.11.2026: the Lizardmen's page gives the Skinks two rules, Aquatic and Jungle born; the data ran them into one rule named "Skinks". */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { warbandRuleTexts } from './tips.ts';

describe('the rules of the Lizardmen', () => {
  const rules = warbandRuleTexts(core.ctxOf(data, core.newWarband(data, 'lizardmen'))).rules;

  it('name Aquatic and Jungle born each on their own, not one rule "Skinks"', () => {
    const labels = rules.map((r) => r.name);
    expect(labels).toEqual(expect.arrayContaining(['Aquatic', 'Jungle born']));
    expect(labels).not.toContain('Skinks');
    expect(rules.find((r) => r.name === 'Aquatic')!.text).toMatch(/water terrain with no penalty.*cover/i);
    expect(rules.find((r) => r.name === 'Jungle born')!.text).toMatch(/jungle terrain without penalty/i);
  });
});

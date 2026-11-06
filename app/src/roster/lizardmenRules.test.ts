/* Report of 6.11.2026: the Lizardmen's page gives the Skinks two rules, Aquatic and Jungle born; the data ran them into one rule named "Skinks". */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { warbandRuleFacts } from './tips.ts';

describe('the rules of the Lizardmen', () => {
  const facts = warbandRuleFacts(core.ctxOf(data, core.newWarband(data, 'lizardmen')));

  it('name Aquatic and Jungle born each on their own, not one rule "Skinks"', () => {
    const labels = facts.map((f) => f.label);
    expect(labels).toEqual(expect.arrayContaining(['Aquatic', 'Jungle born']));
    expect(labels).not.toContain('Skinks');
    expect(facts.find((f) => f.label === 'Aquatic')!.tips[0]!.text).toMatch(/water terrain with no penalty.*cover/i);
    expect(facts.find((f) => f.label === 'Jungle born')!.tips[0]!.text).toMatch(/jungle terrain without penalty/i);
  });
});

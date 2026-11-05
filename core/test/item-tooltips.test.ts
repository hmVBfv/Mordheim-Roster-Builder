/* Every item a list sells has a tooltip (report of 5.11.2026: the Warhound had none). The text comes from the item info; an item without one
   shows no bubble on a phone. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('the items of the lists', () => {
  it('all have an info text', () => {
    const names = new Set<string>();
    for (const lists of Object.values(data.LISTS)) for (const g of Object.values(lists as Record<string, unknown>)) if (Array.isArray(g)) for (const r of g) names.add(String(r[0]).replace(' (1. gratis)', ''));
    const none = [...names].filter((n) => !(core.itemInfo(data, n) ?? core.itemInfo(data, core.enItem(data, n)))?.text);
    expect(none).toEqual([]);
  });

  it('give the Warhound the three rules of the Lustrian Reavers page', () => {
    const info = core.itemInfo(data, 'Warhound');
    expect(info?.name).toBe('Warhound');
    expect(info?.text).toMatch(/equipment of the Hero who bought it/i);
    expect(info?.text).toMatch(/never gains? experience/i);
    expect(info?.text).toMatch(/same recovery chance as Henchmen/i);
    expect(info?.text).toMatch(/counts towards the maximum/i);
    expect(core.itemInfo(data, 'Wardog')?.name).toBe('Wardog'); // the rare Wardog keeps its own text
  });
});

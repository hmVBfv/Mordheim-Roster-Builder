/* The audit of a warband against its page (plan P9): a small page, a small file, and exactly the differences between them. */
import { describe, expect, it } from 'vitest';
import { audit, blocksOf, key, priceOf, render, type WarbandFile } from '../scripts/audit-lib.ts';

const PAGE = `<html><body><article><div class="theme-doc-markdown markdown">
<h1>Probes</h1>
<h2>Choice of warriors</h2>
<p>A Probes warband must include a minimum of three models. You have 500 gold crowns to recruit your initial warband. The maximum number of warriors in a warband may never exceed 12.</p>
<h2>Starting Experience</h2>
<p>A Noble starts with 20 experience. Scouts start with 0 experience.</p>
<h2>Equipment Lists</h2>
<h3>Noble Equipment List</h3>
<h4>Weapons</h4>
<table><tr><th>Weapon</th><th>Cost</th></tr><tr><td>Dagger</td><td>1st free/2 gc</td></tr><tr><td>Sword (Pilgrims only)</td><td>10 gc</td></tr><tr><td>Long&nbsp;bow *</td><td>15 gc</td></tr><tr><td>Chainsaw</td><td>15 + D6 gc</td></tr></table>
<h2>Heroes</h2>
<h3>1 Noble</h3>
<p>75 gold crowns to hire</p>
<table><tr><th>M</th><th>WS</th><th>BS</th><th>S</th><th>T</th><th>W</th><th>I</th><th>A</th><th>Ld</th></tr><tr><td>5</td><td>5</td><td>4</td><td>3</td><td>3</td><td>1</td><td>6</td><td>1</td><td>9</td></tr></table>
<h2>Henchmen</h2>
<h3>0 – 5 Scouts</h3>
<p>25 gold crowns to hire</p>
<table><tr><th>M</th><th>WS</th><th>BS</th><th>S</th><th>T</th><th>W</th><th>I</th><th>A</th><th>Ld</th></tr><tr><td>5</td><td>3</td><td>4</td><td>3</td><td>3</td><td>1</td><td>5</td><td>1</td><td>7</td></tr></table>
</div></article></body></html>`;

const unit = (id: string, name: string, t: 'hero' | 'hen', cost: number, exp: number, profile: number[]) => ({ id, name, t, cost, exp, eq: null, profile: Object.fromEntries(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'].map((s, i) => [s, profile[i]!])) });
const FILE: WarbandFile = {
  warband: { name: 'Probes', min: 3, max: 12, gold: 500, units: [unit('noble', 'Noble', 'hero', 75, 20, [5, 5, 4, 3, 3, 1, 6, 1, 9]), unit('scout', 'Scout', 'hen', 25, 0, [5, 3, 4, 3, 3, 1, 5, 1, 7])] },
  lists: { noble: { Nahkampf: [['Dolch (1. gratis)', 2], ['Schwert', 10], ['Langbogen', 15]] } },
};
const CATALOG = [{ de: 'Dolch', en: 'Dagger' }, { de: 'Schwert', en: 'Sword' }, { de: 'Langbogen', en: 'Long bow' }];

describe('audit of a warband against its page', () => {
  it('finds nothing where the file says what the page says (plurals, notes, brackets and the names of the catalogue aside)', () => {
    expect(audit({ page: blocksOf(PAGE), file: FILE, catalog: CATALOG })).toEqual([{ area: 'list Noble Equipment List (noble)', what: 'Chainsaw', page: '15 + D6 gc', data: 'missing' }]);
  });

  it('lists exactly what differs: the figures, the units, the starting experience, the prices and the items', () => {
    const file: WarbandFile = JSON.parse(JSON.stringify(FILE));
    file.warband.gold = 450;
    file.warband.units[0]!.cost = 80;
    file.warband.units[0]!.exp = 8;
    file.warband.units[1]!.profile.BS = 3;
    file.warband.units.push(unit('extra', 'Extra', 'hen', 10, 0, [4, 3, 3, 3, 3, 1, 3, 1, 6]));
    file.lists!.noble!.Nahkampf![1]![1] = 20;
    const found = audit({ page: blocksOf(PAGE), file, catalog: CATALOG }).map((f) => `${f.area}: ${f.what} ${f.page}/${f.data}`);
    expect(found).toEqual([
      'warband: starting gold 500/450',
      'unit Noble: cost 75/80',
      'unit Noble: starting experience 20/8',
      'unit Scout: BS 4/3',
      'unit Extra: unit none/Extra',
      'list Noble Equipment List (noble): Sword (Pilgrims only) price 10 gc/20',
      'list Noble Equipment List (noble): Chainsaw 15 + D6 gc/missing',
    ]);
  });

  it('reads a page: headings, a price, a profile; prices that are not one number are not compared', () => {
    expect(key('Witch Elves')).toBe(key('Witch Elf'));
    expect(key('The Bitten')).toBe(key('Bitten'));
    expect(key('Bowmen')).toBe(key('Bowman'));
    expect([priceOf('10 gc'), priceOf('1st free/2 gc'), priceOf('15 + D6 gc'), priceOf('3 x price'), priceOf(25)]).toEqual([10, 2, null, null, 25]);
    expect(render('x', [])).toBe('x: no differences\n');
  });
});

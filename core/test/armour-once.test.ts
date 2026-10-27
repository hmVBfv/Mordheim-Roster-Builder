/* One of a kind (report #111): a warrior wears one helmet, one shield, one suit of armour – the list stepper and the rare
   section must not give him nine. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

function band() {
  let s = core.newWarband(data, 'merc');
  s = core.addUnit(ctx(s), 'capt');
  return { s, uid: s.models[0]!.uid };
}

describe('armour once per kind (#111)', () => {
  it('the list gives one of each armour, and says why for the second', () => {
    const { s, uid } = band();
    expect(core.listProblem(ctx(s), uid, 'Helm', 1)).toBe('');
    const one = core.setListQty(ctx(s), uid, 'Helm', 1);
    expect(one.models[0]!.eq?.Helm).toBe(1);
    expect(core.listProblem(ctx(one), uid, 'Helm', 2)).toBe('one of each kind of armour');
    expect(core.setListQty(ctx(one), uid, 'Helm', 2)).toBe(one);
  });

  it('weapons are not limited', () => {
    const { s, uid } = band();
    expect(core.listProblem(ctx(s), uid, 'Schwert', 3)).toBe('');
  });

  it('a rare armour is had once; a second one is not added, and the stepper stays at one', () => {
    const { s, uid } = band();
    let t = core.addRare(ctx(s), uid, 'Gromril-Rüstung');
    t = core.addRare(ctx(t), uid, 'Gromril-Rüstung');
    expect(t.models[0]!.rare!['Gromril-Rüstung']!.q).toBe(1);
    t = core.setRareQty(ctx(t), uid, 'Gromril-Rüstung', 3);
    expect(t.models[0]!.rare!['Gromril-Rüstung']!.q).toBe(1);
  });

  it('other rare items still stack', () => {
    const { s, uid } = band();
    const item = data.CATALOG.find((x) => x.cat !== 'armour' && !core.isUpgrade(data, x.de))!;
    let t = core.addRare(ctx(s), uid, item.de);
    t = core.addRare(ctx(t), uid, item.de);
    expect(t.models[0]!.rare![item.de]!.q).toBe(2);
  });
});

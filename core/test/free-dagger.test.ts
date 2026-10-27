/* The free dagger (report #117, Rob, 28.10.2026): it can never be given away or sold, unless another rule says so outright. The
   trade code already keeps it when a warrior sells or leaves; the list could still put it back. */
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

describe('the free dagger stays (#117)', () => {
  it('has one at first, and the list will not take it back, nor go below one', () => {
    const { s, uid } = band();
    expect(s.models[0]!.eq?.['Dolch (1. gratis)']).toBe(1);
    expect(core.listProblem(ctx(s), uid, 'Dolch (1. gratis)', 0)).toBe('the free dagger stays');
    expect(core.setListQty(ctx(s), uid, 'Dolch (1. gratis)', 0)).toBe(s);
  });

  it('a second dagger is paid for and may go; the free one is still there', () => {
    const { s, uid } = band();
    const two = core.setListQty(ctx(s), uid, 'Dolch (1. gratis)', 2);
    expect(two.models[0]!.eq?.['Dolch (1. gratis)']).toBe(2);
    expect(core.listProblem(ctx(two), uid, 'Dolch (1. gratis)', 1)).toBe('');
    expect(core.setListQty(ctx(two), uid, 'Dolch (1. gratis)', 1).models[0]!.eq?.['Dolch (1. gratis)']).toBe(1);
  });

  it('other items are not held to it', () => {
    const { s, uid } = band();
    const t = core.setListQty(ctx(s), uid, 'Schwert', 1);
    expect(core.listProblem(ctx(t), uid, 'Schwert', 0)).toBe('');
  });
});

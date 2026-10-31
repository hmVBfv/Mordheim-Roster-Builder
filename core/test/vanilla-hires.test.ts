/* Hired Swords and Dramatis Personae of a warband that plays Vanilla Mordheim (wish #173, after #167): only those of the rulebook.
   The data already says which: a Hired Sword's `src` is "Rulebook", a Dramatis Persona's grade is `core`. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const plain = () => core.addUnit(ctx(core.newWarband(data, 'merc')), 'capt');
const vanilla = () => core.addUnit(ctx(core.asVanillaWarband(ctx(core.newWarband(data, 'merc')))), 'capt');

describe('what the rulebook has of Hired Swords and Dramatis Personae', () => {
  it('is seven Hired Swords and four Dramatis Personae', () => {
    expect(Object.keys(data.HIREDSWORDS).filter((k) => core.isVanillaHire(data.HIREDSWORDS[k]!)).sort()).toEqual(
      ['elfranger', 'freelancer', 'halfling', 'ogre', 'pitfighter', 'trollslayer', 'warlock']);
    expect(Object.keys(data.DRAMATIS).filter((k) => core.isVanillaHire(data.DRAMATIS[k]!)).length).toBe(4);
  });
});

describe('a vanilla warband hires', () => {
  it('only the Hired Swords of the rulebook, and says why not the others', () => {
    const el = core.hireEligibility(ctx(vanilla()));
    expect(el.allowed.length).toBeGreaterThan(0);
    for (const a of el.allowed) expect(core.isVanillaHire(data.HIREDSWORDS[a.key]!), a.key).toBe(true);
    const out = el.blocked.find((b) => !core.isVanillaHire(data.HIREDSWORDS[b.key]!) && /rulebook/i.test(b.reason));
    expect(out, 'a Hired Sword blocked for not being in the rulebook').toBeTruthy();
  });

  it('only the Dramatis Personae of the rulebook', () => {
    const el = core.dpEligibility(ctx(vanilla()));
    for (const a of el.allowed) expect(core.isVanillaHire(data.DRAMATIS[a.key]!), a.key).toBe(true);
    expect(el.blocked.some((b) => /rulebook/i.test(b.reason))).toBe(true);
  });

  it('refuses a Hired Sword from elsewhere and takes one of the rulebook', () => {
    const s = vanilla();
    const other = core.hireEligibility(ctx(plain())).allowed.find((a) => !core.isVanillaHire(data.HIREDSWORDS[a.key]!))!;
    const own = core.hireEligibility(ctx(plain())).allowed.find((a) => core.isVanillaHire(data.HIREDSWORDS[a.key]!) && !core.hireChoices(ctx(s), 'hs', a.key))!;
    expect(other, 'a Hired Sword from elsewhere that an ordinary Mercenary may hire').toBeTruthy();
    expect(own, 'a Hired Sword of the rulebook that needs no choice').toBeTruthy();
    expect(core.hireProblem(ctx(s), 'hs', other.key)).toMatch(/rulebook/i);
    expect(core.hire(ctx(s), 'hs', other.key)).toBe(s);
    expect(core.hireProblem(ctx(s), 'hs', own.key)).toBe('');
    expect(core.hire(ctx(s), 'hs', own.key).hired).toHaveLength(1);
  });

  it('leaves an ordinary warband all of them', () => {
    const el = core.hireEligibility(ctx(plain()));
    expect(el.allowed.some((a) => !core.isVanillaHire(data.HIREDSWORDS[a.key]!))).toBe(true);
    expect(el.blocked.some((b) => /rulebook/i.test(b.reason))).toBe(false);
  });
});

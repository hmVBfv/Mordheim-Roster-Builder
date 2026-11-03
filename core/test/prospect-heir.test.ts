/* The Lustrian Reavers' Prospect (report of 2.11.2026, Rob's answers): when a Hero dies, a Prospect may take his place. He keeps his own
   profile and experience, takes over everything the fallen Hero carried, and what he carried himself goes to the stash. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, id: string) => s.models.find((m) => m.uid_def === id)!;
const fallenId = (s: WarbandState) => s.fallen![s.fallen!.length - 1]!.id!;

/** A band with a Conqueror who bought a sword, a Prospect who has a sword too, after the Conqueror fell. */
function fallen() {
  let s = core.newWarband(data, 'reavers');
  for (const id of ['conqueror', 'slayer', 'prospect']) s = core.addUnit(ctx(s), id);
  s = core.setEqQty(ctx(s), model(s, 'conqueror').uid, 'Schwert', 1);
  s = core.setEqQty(ctx(s), model(s, 'prospect').uid, 'Schwert', 1);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1 };
  const before = core.goldCurrent(ctx(s));
  s = core.killHero(ctx(s), model(s, 'conqueror').uid);
  return { s, before, after: core.goldCurrent(ctx(s)) };
}

describe('a Prospect takes the place of a fallen Hero', () => {
  it('becomes a Hero with his own profile, carrying what the fallen Hero carried', () => {
    const { s: dead } = fallen();
    const p = model(dead, 'prospect');
    const s = core.promoteProspect(ctx(dead), p.uid, fallenId(dead));
    const h = s.models.find((m) => m.uid === p.uid)!;
    expect(h.promoted).toBe(true);
    expect(h.uid_def).toBe('prospect');
    expect(core.unitGear(ctx(s), h)).toEqual(expect.arrayContaining(['Masterwork Heavy Armour', 'Bec de Corbin', 'Helmet']));
    expect(h.eq).toMatchObject({ Schwert: 1 });
    expect(core.svOfModel(ctx(s), h)).toBe(4);
    // his own sword is in the stash, and the fallen Hero's record shows who took his place
    expect(s.stash?.items).toEqual(expect.arrayContaining([{ name: 'Sword', qty: 1 }]));
    expect(s.fallen![s.fallen!.length - 1]!.heir).toBe(p.uid);
  });

  it('costs and refunds nothing: the fallen Hero\'s worth stays lost, his gear is not paid for twice', () => {
    const { s: dead } = fallen();
    const s = core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, fallenId(dead));
    expect(core.goldCurrent(ctx(s))).toBe(core.goldCurrent(ctx(dead)));
  });

  it('keeps the kinds of gear the Hero had, so he finds and wears the same things at the Trading Post', () => {
    const { s: dead } = fallen();
    const s = core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, fallenId(dead));
    const h = s.models.find((m) => m.uid_def === 'prospect' && m.promoted)!;
    const fams = core.unitFamilies(ctx(s), core.unitDef(ctx(s), 'prospect'), h.gearHeld);
    expect(fams.has('heavyarmour')).toBe(true);
    expect(fams.has('twohanded')).toBe(true);
  });

  it('takes one man out of a group of Prospects', () => {
    let { s } = fallen();
    s = core.setQty(ctx(s), model(s, 'prospect').uid, 2); // a second one joins the group of the first
    const g = model(s, 'prospect');
    expect(g.qty).toBe(2);
    const t = core.promoteProspect(ctx(s), g.uid, fallenId(s), 1);
    const left = t.models.find((m) => m.uid === g.uid)!;
    expect(left.qty).toBe(1);
    expect(left.promoted).toBeFalsy();
    expect(t.models.filter((m) => m.promoted && m.uid_def === 'prospect')).toHaveLength(1);
  });

  it('is refused for anybody but a Prospect, for a record that is not a Hero, one already taken, and at the Hero limit', () => {
    const { s: dead } = fallen();
    const id = fallenId(dead);
    const slayer = model(dead, 'slayer');
    expect(core.promoteProspect(ctx(dead), slayer.uid, id)).toBe(dead);
    expect(core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, 99999)).toBe(dead);
    const taken = core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, id);
    expect(taken).not.toBe(dead);
    const again = core.addUnit(ctx(taken), 'prospect');
    expect(core.promoteProspect(ctx(again), again.models.find((m) => m.uid_def === 'prospect' && !m.promoted)!.uid, id)).toBe(again);
  });

  it('can be told apart from The Lad\'s Got Talent in the chronicle', () => {
    const { s: dead } = fallen();
    const s = core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, fallenId(dead));
    const log = (s.campaign?.log ?? []) as { type: string; text: string }[];
    expect(log.filter((e) => e.type === 'promote').map((e) => e.text).join('\n')).toMatch(/took the place of/);
    expect(log.some((e) => /Got Talent/.test(e.text))).toBe(false);
  });
});

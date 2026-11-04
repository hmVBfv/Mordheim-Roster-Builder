/* The Lustrian Reavers' Prospect (reports of 2.-3.11.2026, Rob's answers): when a Hero dies, a Prospect takes his place – and becomes that Hero
   (a Conqueror), no longer a Prospect. He keeps the profile he has, with the advances he made as a henchman, and his experience, and takes over
   the equipment of the fallen Hero. What he carried himself goes to the stash. A Prospect becomes a Hero in no other way. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, id: string) => s.models.find((m) => m.uid_def === id)!;
const fallenId = (s: WarbandState) => s.fallen![s.fallen!.length - 1]!.id!;

/** A band with a Conqueror who bought a sword (and has an advance of his own), a Prospect with a sword, an advance and experience, after the Conqueror fell. */
function fallen() {
  let s = core.newWarband(data, 'reavers');
  for (const id of ['conqueror', 'slayer', 'prospect']) s = core.addUnit(ctx(s), id);
  s = core.setEqQty(ctx(s), model(s, 'conqueror').uid, 'Schwert', 1);
  s = core.setEqQty(ctx(s), model(s, 'prospect').uid, 'Schwert', 1);
  s = core.addAdvance(ctx(s), model(s, 'conqueror').uid, 'WS');
  s = core.addAdvance(ctx(s), model(s, 'prospect').uid, 'S');
  s = core.setModelExp(ctx(s), model(s, 'prospect').uid, 9);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1 };
  s = core.killHero(ctx(s), model(s, 'conqueror').uid);
  return s;
}
const take = (s: WarbandState, i?: number) => core.promoteProspect(ctx(s), model(s, 'prospect').uid, fallenId(s), i);

describe('a Prospect takes the place of a fallen Hero', () => {
  it('becomes that Hero: the Conqueror, with his rules and his gear', () => {
    const dead = fallen();
    const p = model(dead, 'prospect');
    const s = take(dead);
    const h = s.models.find((m) => m.uid === p.uid)!;
    expect(h.uid_def).toBe('conqueror');
    expect(core.isHeroModel(ctx(s), h)).toBe(true);
    expect(s.models.some((m) => m.uid_def === 'prospect')).toBe(false);
    expect(core.unitGear(ctx(s), h)).toEqual(expect.arrayContaining(['Masterwork Heavy Armour', 'Bec de Corbin', 'Helmet']));
    expect(core.svOfModel(ctx(s), h)).toBe(4);
    expect(h.eq).toMatchObject({ Schwert: 1 });
  });

  it('keeps the profile of the Prospect and his own advances, not those of the fallen Hero, and his experience', () => {
    const dead = fallen();
    const s = take(dead);
    const h = s.models.find((m) => m.uid_def === 'conqueror')!;
    const prospect = data.WARBANDS.reavers!.units.find((u) => u.id === 'prospect')!.profile!;
    const conqueror = data.WARBANDS.reavers!.units.find((u) => u.id === 'conqueror')!.profile!;
    const p = core.effProfile(ctx(s), h)!;
    expect(p.WS).toBe(prospect.WS); // the Conqueror's own advance in WS is not taken over
    expect(p.WS).not.toBe(conqueror.WS);
    expect(p.S).toBe((prospect.S as number) + 1); // the advance he made as a henchman is
    expect(h.exp).toBe(9);
  });

  it('is not called "Prospect (Hero)": an unnamed man is the Conqueror, a named man keeps his name', () => {
    const dead = fallen();
    expect(take(dead).models.find((m) => m.uid_def === 'conqueror')!.name || '').toBe('');
    const named = core.setModelName(ctx(dead), model(dead, 'prospect').uid, 'Ixtl');
    expect(take(named).models.find((m) => m.uid_def === 'conqueror')!.name).toBe('Ixtl');
  });

  it('puts his own gear in the stash and costs nothing: the treasury stays as it was', () => {
    const dead = fallen();
    const s = take(dead);
    expect(s.stash?.items).toEqual(expect.arrayContaining([{ name: 'Sword', qty: 1 }]));
    expect(core.goldCurrent(ctx(s))).toBe(core.goldCurrent(ctx(dead)));
    expect(s.fallen![s.fallen!.length - 1]!.heir).toBe(model(dead, 'prospect').uid);
  });

  it('finds and wears what the Hero did, and can be replaced in turn when he falls himself', () => {
    const dead = fallen();
    let s = take(dead);
    const h = s.models.find((m) => m.uid_def === 'conqueror')!;
    expect(core.unitFamilies(ctx(s), core.unitDef(ctx(s), h.uid_def)).has('heavyarmour')).toBe(true);
    s = core.killHero(ctx(s), h.uid);
    s = core.addUnit(ctx(s), 'prospect');
    const next = core.promoteProspect(ctx(s), model(s, 'prospect').uid, fallenId(s));
    expect(next).not.toBe(s);
    expect(next.models.filter((m) => m.uid_def === 'conqueror')).toHaveLength(1);
  });

  it('takes one man out of a group of Prospects', () => {
    let s = fallen();
    s = core.setQty(ctx(s), model(s, 'prospect').uid, 2);
    const g = model(s, 'prospect');
    const t = take(s, 1);
    expect(t.models.find((m) => m.uid === g.uid)!.qty).toBe(1);
    expect(t.models.filter((m) => m.uid_def === 'conqueror')).toHaveLength(1);
    expect(t.models.filter((m) => m.uid_def === 'prospect')).toHaveLength(1);
  });

  it('is refused for anybody but a Prospect, for an unknown or a taken record, and at the Hero limit', () => {
    const dead = fallen();
    const id = fallenId(dead);
    expect(core.promoteProspect(ctx(dead), model(dead, 'slayer').uid, id)).toBe(dead);
    expect(core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, 99999)).toBe(dead);
    const s = take(dead);
    const again = core.addUnit(ctx(s), 'prospect');
    expect(core.promoteProspect(ctx(again), model(again, 'prospect').uid, id)).toBe(again);
    const full = core.setHouseNum(ctx(dead), 'heroes', 1);
    expect(core.promoteProspect(ctx(full), model(full, 'prospect').uid, id)).toBe(full);
  });

  it('is written in the chronicle as taking a place, not as The Lad\'s Got Talent', () => {
    const log = (take(fallen()).campaign?.log ?? []) as { type: string; text: string }[];
    expect(log.filter((e) => e.type === 'promote').map((e) => e.text).join('\n')).toMatch(/took the place of/);
    expect(log.some((e) => /Got Talent/.test(e.text))).toBe(false);
  });

  it('lists the fallen Heroes a Prospect may replace, and none when he may not', () => {
    const dead = fallen();
    const p = model(dead, 'prospect').uid;
    expect(core.replaceableHeroes(ctx(dead), p).map((r) => r.id)).toEqual([fallenId(dead)]);
    expect(core.replaceableHeroes(ctx(dead), model(dead, 'slayer').uid)).toEqual([]); // not a Prospect
    expect(core.replaceableHeroes(ctx(core.setHouseNum(ctx(dead), 'heroes', 1)), p)).toEqual([]); // the warband is full
    const taken = take(dead);
    expect(core.replaceableHeroes(ctx(core.addUnit(ctx(taken), 'prospect')), model(core.addUnit(ctx(taken), 'prospect'), 'prospect').uid)).toEqual([]); // the place is taken
  });
});

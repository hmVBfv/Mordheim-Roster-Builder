/* Generated warband states for the parity suites: every warband, every
   subtype, with default and with heavily modified house rules, and random but
   reproducible equipment, mutations, skills, rare items, injuries, hired
   swords, dramatis personae and campaign footholds. The generator is
   deliberately wider than what the UI allows (e.g. items outside a unit's
   eligibility), because the calculators must agree on any saved state. */
import type { GameData, HouseRules, Model, WarbandState } from '../../src/index.ts';
import { ctxOf, dpEligibility, eqListFor, heroEqList, hireEligibility } from '../../src/index.ts';
import { rng, type Rng } from './random.ts';

export interface Fixture {
  label: string;
  state: WarbandState;
}

export const HOUSE_MODIFIED: Partial<HouseRules> = {
  startGold: 650, max: '', priceAll: 120, priceArmour: 80, priceBP: 150, priceMissile: 90,
  clubSurcharge: 1, slingSurcharge: 2, armourBodyOnly: true, freeDagger: true,
  miscHench: true, freeMarket: false, hsEquip: true,
  hsGrades: { '1a': true, '1b': false, '1c': true, '2a': true },
  dpGrades: { core: true, '1a': false, '1b': true, '1c': true, '2a': true },
};
export const HOUSE_FREE_MARKET: Partial<HouseRules> = { freeMarket: true, max: 18, startGold: '' };

const SV_SKILLS = ["Well 'Ard", 'Shaggy Hide'];
/** Hire entries with options or personas. */
const SPECIAL_HIRES = ['emissary', 'luthorwolfenbaum', 'ogre', 'trollslayer', 'dwarftreasurehunter', 'chaoscentaur'];

function makeModel(r: Rng, data: GameData, s: WarbandState, uid: number, unitId: string): Model {
  const ctx = ctxOf(data, s);
  const def = data.WARBANDS[s.wb as string]?.units.find((u) => u.id === unitId);
  if (!def) throw new Error(`unknown unit ${unitId}`);
  const m: Model = {
    uid, uid_def: unitId, name: def.name,
    exp: (def.exp ?? 0) + (r.chance(0.5) ? r.int(0, 25) : 0),
    qty: def.t === 'hen' ? r.int(1, 5) : 1,
    eq: {}, rare: {}, mut: [], adv: {}, skills: [], inj: [], spells: [],
  };
  const list = eqListFor(ctx, def);
  if (list) for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
    if (/^Dolch/.test(nm)) { if (r.chance(0.85)) (m.eq as Record<string, number>)[nm] = r.chance(0.2) ? 2 : 1; continue; }
    const roll = r.next();
    if (roll < 0.22) (m.eq as Record<string, number>)[nm] = 1;
    else if (roll < 0.3) (m.eq as Record<string, number>)[nm] = 2;
    else if (roll < 0.33) (m.eq as Record<string, number>)[nm] = 3;
  }
  if (r.chance(0.05)) m._noDagger = true;
  const mutKind = def.mut ?? (r.chance(0.08) ? 'chaos' : null);
  if (!def.mut && mutKind && r.chance(0.5)) m.skills?.push('Mutant');
  if (mutKind) {
    const set = data.MUTSETS[mutKind] ?? data.MUTATIONS;
    m.mut = r.sample(set.map((x) => x[0]), r.int(0, 3));
  }
  for (const cat of def.sk ?? []) {
    const L = data.SKILLLISTS[cat];
    if (L && r.chance(0.3)) m.skills?.push(r.pick(L.skills)[0]);
  }
  if (r.chance(0.15)) m.skills?.push(r.pick(SV_SKILLS));
  if (r.chance(0.2)) m.spells = ['Spell A (7)', ...(r.chance(0.5) ? ['Spell B (auto)'] : [])];
  if (r.chance(0.3)) m.adv = { WS: 1, ...(r.chance(0.5) ? { S: 1 } : {}), ...(r.chance(0.2) ? { Ld: '1' } : {}) };
  if (r.chance(0.15)) m.inj = [{ name: 'Old Battle Wound' }, ...(r.chance(0.5) ? [{ name: 'Chest Wound', mod: { T: -1 } }] : [])];
  if (def.t === 'hen' && r.chance(0.15)) m.promoted = true;
  if (def.t === 'hen' && r.chance(0.25)) m.xpPaid = r.int(1, 12) * 2;
  // Rare items, eligible or not, with the price paid; upgrades sit on a weapon.
  const rareCount = r.chance(0.35) ? r.int(1, 3) : 0;
  for (const it of r.sample(data.CATALOG, rareCount)) {
    const hold: { q: number; paid: number; on?: string } = { q: r.chance(0.8) ? 1 : 2, paid: typeof it.cost === 'number' ? it.cost : r.int(0, 60) };
    if (data.UPGRADES[it.de]) { const w = Object.keys(m.eq ?? {})[0]; if (w) hold.on = w; }
    (m.rare as Record<string, typeof hold>)[it.de] = hold;
  }
  if (s.wb === 'kislev' && def.id === 'capt') {
    const owned = Object.keys(m.eq ?? {});
    if (owned.length && r.chance(0.7)) m.heirloom = r.pick(owned);
  }
  return m;
}

function makeState(r: Rng, data: GameData, wb: string, subtype: string | null, house: Partial<HouseRules> | undefined): WarbandState {
  const def = data.WARBANDS[wb];
  if (!def) throw new Error(`unknown warband ${wb}`);
  const s: WarbandState = {
    wb, subtype, name: `${def.name} test`, budget: 500, models: [], hired: [], dp: [],
    stash: { wyrd: 0, gold: r.chance(0.4) ? null : r.chance(0.2) ? '' : r.int(0, 900), items: [] },
    campaign: { on: true, districts: {} },
    leaderUid: null,
    ...(house ? { house: structuredClone(house) } : {}),
  };
  const districts = r.sample(data.DISTRICTS, r.chance(0.5) ? r.int(1, 5) : 0);
  for (const d of districts) (s.campaign as { districts: Record<string, string> }).districts[d.id] = r.pick(['foothold', 'control', 'none']);
  let uid = 1;
  for (const u of def.units) {
    const copies = u.t === 'hero' ? 1 : r.chance(0.3) ? 2 : 1;
    for (let i = 0; i < copies; i++) if (r.chance(0.85)) s.models.push(makeModel(r, data, s, uid++, u.id));
  }
  const ctx = ctxOf(data, s);
  const heroList = heroEqList(ctx);
  const heroItems = heroList ? Object.values(heroList).flat().map((e) => e[0]) : [];
  const hs = hireEligibility(ctx).allowed;
  // Entries with options or personas are rare in a random draw; give them a
  // fair chance whenever this warband may hire them.
  const special = hs.filter((a) => SPECIAL_HIRES.includes(a.key) && r.chance(0.5));
  const drawn = [...special, ...r.sample(hs.filter((a) => !special.includes(a)), r.int(0, 3))];
  for (const a of drawn) {
    const e = data.HIREDSWORDS[a.key];
    const opt = e?.personas ? r.pick(e.personas).name : e?.opts ? r.pick(e.opts.choices) : undefined;
    const eq: Record<string, number> = {};
    for (const nm of r.sample(heroItems, r.int(0, 3))) eq[nm] = r.int(1, 2);
    s.hired?.push({
      key: a.key, uid: `hs${uid++}`, exp: r.int(0, 20), skills: r.chance(0.3) ? ['Step Aside'] : [],
      ...(opt != null ? { opt } : {}), ...(r.chance(0.6) ? { eq } : {}),
      ...(r.chance(0.2) ? { adv: { A: 1 } } : {}),
    });
  }
  const dps = dpEligibility(ctx).allowed;
  const dpSpecial = dps.filter((a) => SPECIAL_HIRES.includes(a.key) && r.chance(0.5));
  for (const a of [...dpSpecial, ...r.sample(dps.filter((a) => !dpSpecial.includes(a)), r.int(0, 2))]) {
    const e = data.DRAMATIS[a.key];
    const opt = e?.personas ? r.pick(e.personas).name : undefined;
    s.dp?.push({ key: a.key, uid: `dp${uid++}`, ...(opt != null ? { opt } : {}) });
  }
  return s;
}

/** All fixtures: every warband × subtype (and none) × house-rule preset × seed. */
export function generateFixtures(data: GameData, seeds: number[] = [1, 2]): Fixture[] {
  const out: Fixture[] = [];
  const presets: [string, Partial<HouseRules> | undefined][] = [['default', undefined], ['modified', HOUSE_MODIFIED], ['freemarket', HOUSE_FREE_MARKET]];
  for (const wb of Object.keys(data.WARBANDS)) {
    const subs = [null, ...(data.WARBANDS[wb]?.subtypes ?? []).map((x) => x.key)];
    for (const sub of subs) for (const [pname, house] of presets) for (const seed of seeds) {
      const r = rng(hash(`${wb}|${sub}|${pname}|${seed}`));
      out.push({ label: `${wb}/${sub ?? '-'}/${pname}/seed${seed}`, state: makeState(r, data, wb, sub, house) });
    }
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

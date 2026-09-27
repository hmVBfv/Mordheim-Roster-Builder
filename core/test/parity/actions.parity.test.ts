/* Parity for roster-building actions: the same random sequence of actions is
 * applied to the legacy app (through its exported action functions, which
 * mutate its global S and re-render) and to core (pure functions returning a
 * new state). After every step both states must be identical, up to:
 *   - core-only bookkeeping (uidSeq, campaign.logSeq),
 *   - ids that legacy draws from a clock or a module-wide counter (Hired
 *     Sword/Dramatis record uids, chronicle ids), compared by position,
 *   - the canonical form legacy reached as a side effect of rendering, which
 *     core produces with normalizeState(). */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { Ctx, GameData, Model, WarbandState } from '../../src/index.ts';
import { loadGameData } from '../../src/node.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { rng, type Rng } from '../support/random.ts';

const data = loadGameData();
let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); });

const STEPS = 80;

/* ---- canonical form for comparison ---- */
function canon(s: unknown): unknown {
  const c = JSON.parse(JSON.stringify(s)) as Record<string, unknown> & { campaign?: Record<string, unknown>; hired?: { uid: string }[]; dp?: { uid: string }[] };
  delete c.uidSeq;
  if (c.campaign) {
    delete c.campaign.logSeq;
    const log = c.campaign.log as { id: number }[] | undefined;
    if (Array.isArray(log)) log.forEach((e, i) => { e.id = i + 1; });
  }
  (c.hired ?? []).forEach((h, i) => { h.uid = `H${i}`; });
  (c.dp ?? []).forEach((h, i) => { h.uid = `D${i}`; });
  return c;
}
/* Both sides go through normalizeState: when legacy reached the canonical
   form depended on what it happened to render (e.g. the campaign lists only
   appear once the campaign section or a log entry touched them). */
const canonOf = (s: unknown) => canon(core.normalizeState(core.ctxOf(data, JSON.parse(JSON.stringify(s)) as WarbandState)));
const coreCanon = (ctx: Ctx) => canonOf(ctx.s);
const legacyCanon = () => canonOf(L.state.S);

/* Legacy functions that read their input from the DOM get it from here. */
function withDom<T>(values: Record<string, string>, fn: () => T): T {
  const doc = (globalThis as unknown as { document: { getElementById: (id: string) => unknown } }).document;
  const orig = doc.getElementById;
  doc.getElementById = (id: string) => (id in values ? { value: values[id], style: {} } : orig(id));
  try { return fn(); } finally { doc.getElementById = orig; }
}

/* ---- one random step: [label, legacy call, core call] ---- */
type Step = [label: string, legacy: () => unknown, next: (ctx: Ctx) => WarbandState];

function pickModel(r: Rng, s: WarbandState): Model | undefined {
  return s.models.length ? r.pick(s.models) : undefined;
}

function randomStep(r: Rng, d: GameData, s: WarbandState): Step | null {
  const a = L.app, st = L.state;
  const ctx = core.ctxOf(d, s);
  const wb = d.WARBANDS[s.wb as string];
  if (!wb) return null;
  const m = pickModel(r, s);
  const list = m ? core.eqListFor(ctx, core.unitDef(ctx, m.uid_def)) : undefined;
  const items = list ? Object.values(list).flat().map((e) => e[0]) : [];
  const hired = s.hired ?? [], dps = s.dp ?? [];
  const kind = r.int(0, 36);
  switch (kind) {
    case 0: case 1: case 2: { const u = r.pick(wb.units); return [`addUnit ${u.id}`, () => a.addUnit(u.id), (c) => core.addUnit(c, u.id)]; }
    case 3: if (!m) return null; return [`removeUnit ${m.uid}`, () => a.removeUnit(m.uid), (c) => core.removeUnit(c, m.uid)];
    case 4: { if (!m) return null; const nm = `Name ${r.int(1, 99)}`; return [`setName ${m.uid}`, () => a.setName(m.uid, nm), (c) => core.setModelName(c, m.uid, nm)]; }
    case 5: { if (!m) return null; const v = r.pick([0, 3, 12, 25, '7', '', -4]); return [`setExp ${m.uid}=${v}`, () => a.setExp(m.uid, v), (c) => core.setModelExp(c, m.uid, v)]; }
    case 6: case 7: { if (!m) return null; const v = r.int(0, 6); return [`setQty ${m.uid}=${v}`, () => a.setQty(m.uid, v), (c) => core.setQty(c, m.uid, v)]; }
    case 8: { if (!m || !items.length) return null; const nm = r.pick(items), on = r.chance(0.6); return [`toggleEq ${m.uid} ${nm} ${on}`, () => a.toggleEq(m.uid, nm, on), (c) => core.toggleEq(c, m.uid, nm, on)]; }
    case 9: case 10: { if (!m || !items.length) return null; const nm = r.pick(items), q = r.pick([0, 1, 2, 3, 12, '2']); return [`setEqQty ${m.uid} ${nm}=${q}`, () => a.setEqQty(m.uid, nm, q), (c) => core.setEqQty(c, m.uid, nm, q)]; }
    case 11: case 12: {
      if (!m) return null;
      const owned = Object.keys(m.rare ?? {});
      if (owned.length && r.chance(0.3)) { const de = r.pick(owned); return [`addRare(again) ${m.uid} ${de}`, () => a.addRare(m.uid, de), (c) => core.addRare(c, m.uid, de)]; }
      const pool = r.chance(0.7) ? core.rareEligibleItems(ctx, m) : d.CATALOG;
      if (!pool.length) return null;
      const de = r.pick(pool).de;
      return [`addRare ${m.uid} ${de}`, () => a.addRare(m.uid, de), (c) => core.addRare(c, m.uid, de)];
    }
    case 13: {
      // among the models that carry an upgrade and a weapon to put it on
      const cands = s.models.filter((x) => Object.keys(x.rare ?? {}).some((de) => d.UPGRADES[de]) && core.eqWeaponsOf(ctx, x).length);
      if (!cands.length) return null;
      const mm = r.pick(cands);
      const de = r.pick(Object.keys(mm.rare ?? {}).filter((k) => d.UPGRADES[k])), nm = r.pick(core.eqWeaponsOf(ctx, mm)).nm;
      return [`setRareTarget ${mm.uid} ${de} ${nm}`, () => a.setRareTarget(mm.uid, de, nm), (c) => core.setRareTarget(c, mm.uid, de, nm)];
    }
    case 14: { const de = m && r.pick([...Object.keys(m.rare ?? {}), 'Axt']); if (!m || !de) return null; const q = r.pick([0, 1, 2, 11]); return [`setRareQty ${m.uid} ${de}=${q}`, () => a.setRareQty(m.uid, de, q), (c) => core.setRareQty(c, m.uid, de, q)]; }
    case 15: { const keys = Object.keys(m?.rare ?? {}); if (!m || !keys.length) return null; const de = r.pick(keys), v = r.pick([0, 5, 37, -3, 'x']); return [`setRarePaid ${m.uid} ${de}=${v}`, () => a.setRarePaid(m.uid, de, v), (c) => core.setRarePaid(c, m.uid, de, v)]; }
    case 16: { const keys = Object.keys(m?.rare ?? {}); if (!m || !keys.length) return null; const de = r.pick(keys); return [`removeRare ${m.uid} ${de}`, () => a.removeRare(m.uid, de), (c) => core.removeRare(c, m.uid, de)]; }
    case 17: {
      if (!m) return null;
      const kindMut = core.mutKindFor(ctx, m) ?? 'chaos';
      const set = d.MUTSETS[kindMut] ?? d.MUTATIONS;
      const nm = r.pick(set)[0], on = r.chance(0.6);
      return [`toggleMut ${m.uid} ${nm} ${on}`, () => a.toggleMut(m.uid, nm, on), (c) => core.toggleMutation(c, m.uid, nm, on)];
    }
    case 18: { if (!m) return null; const nm = r.chance(0.8) && items.length ? r.pick(items) : ''; return [`setHeirloom ${m.uid} ${nm}`, () => a.setHeirloom(m.uid, nm), (c) => core.setHeirloom(c, m.uid, nm)]; }
    case 19: {
      if (!m) return null;
      const ws = core.eqWeaponsOf(ctx, m);
      if (!ws.length) return null;
      const w = r.pick(ws);
      const ups = core.weaponUpgradesFor(ctx, m, w.nm);
      const de = ups.length ? r.pick(ups).de : r.pick(Object.keys(d.UPGRADES));
      const on = r.chance(0.6);
      return [`toggleWeaponUpgrade ${m.uid} ${de} ${w.nm} ${on}`, () => a.toggleWeaponUpgrade(m.uid, de, w.nm, on), (c) => core.toggleWeaponUpgrade(c, m.uid, de, w.nm, on)];
    }
    case 20: { const v = r.pick([0, 50, 123, -10, '80']); return [`setGoldCurrent ${v}`, () => a.setGoldCurrent(v), (c) => core.setGoldCurrent(c, v)]; }
    case 21: { const dv = r.pick([-15, 10, 40]); return [`adjGoldCurrent ${dv}`, () => a.adjGoldCurrent(dv), (c) => core.adjustGoldCurrent(c, dv)]; }
    case 22: { const f = r.pick(['wyrd', 'gold'] as const), dv = r.pick([-2, 1, 3]); return [`stashAdj ${f} ${dv}`, () => a.stashAdj(f, dv), (c) => core.stashAdjust(c, f, dv)]; }
    case 23: { const f = r.pick(['wyrd', 'gold'] as const), v = r.pick([0, 4, 2.6, -1, '9']); return [`stashSet ${f} ${v}`, () => a.stashSet(f, v), (c) => core.stashSet(c, f, v)]; }
    case 24: {
      const name = r.pick(['Rope', 'Lantern', ' Net ', '—', '']), qty = r.pick(['1', '3', '0', 'x']);
      return [`stashAddItem ${name} ${qty}`, () => withDom({ 'stash-free': name, 'stash-sel': '—', 'stash-qty': qty }, () => a.stashAddItem()), (c) => core.stashAddItem(c, name, qty)];
    }
    case 25: { const n = s.stash?.items?.length ?? 0; if (!n) return null; const i = r.int(0, n - 1); return [`stashRemItem ${i}`, () => a.stashRemItem(i), (c) => core.stashRemoveItem(c, i)]; }
    case 26: { const n = s.stash?.items?.length ?? 0; if (!n) return null; const i = r.int(0, n - 1), v = r.pick([0, 2, 7]); return [`stashItemQty ${i}=${v}`, () => a.stashItemQty(i, v), (c) => core.stashItemQty(c, i, v)]; }
    case 27: { if (!wb.subtypes?.length) return null; const k = r.pick(wb.subtypes).key; return [`pickSub ${k}`, () => a.pickSub(k), (c) => core.pickSubtype(c, k)]; }
    case 28: { const di = r.pick(d.DISTRICTS).id, h = r.pick(['none', 'foothold', 'control'] as const); return [`setDistrict ${di} ${h}`, () => a.setDistrict(di, h), (c) => core.setDistrict(c, di, h)]; }
    case 29: case 30: {
      const allowed = core.hireEligibility(ctx).allowed;
      const key = r.chance(0.9) && allowed.length ? r.pick(allowed).key : r.pick(Object.keys(d.HIREDSWORDS));
      return [`hireHS ${key}`, () => a.hireHS(key), (c) => core.hireHS(c, key)];
    }
    case 31: {
      if (!hired.length) return null;
      const i = r.int(0, hired.length - 1);
      const uidC = () => (s.hired ?? [])[i]?.uid as string;
      const uidL = () => (L.state.S.hired ?? [])[i]?.uid as string;
      const op = r.int(0, 6);
      if (op === 0) return [`unhireHS #${i}`, () => a.unhireHS(uidL()), (c) => core.unhireHS(c, uidC())];
      if (op === 1) { const v = r.pick([0, 5, 16, -1, '9']); return [`setHsExp #${i}=${v}`, () => a.setHsExp(uidL(), v), (c) => core.setHsExp(c, uidC(), v)]; }
      if (op === 2) { const sk = r.pick(['Step Aside', 'Dodge', '—', '']); return [`addHsSkill #${i} ${sk}`, () => withDom({ [`hssk-${uidL()}`]: sk }, () => a.addHsSkill(uidL())), (c) => core.addHsSkill(c, uidC(), sk)]; }
      if (op === 3) { const sk = r.pick(['Step Aside', 'Dodge']); return [`delHsSkill #${i} ${sk}`, () => a.delHsSkill(uidL(), sk), (c) => core.removeHsSkill(c, uidC(), sk)]; }
      if (op === 4) {
        const e = d.HIREDSWORDS[(s.hired ?? [])[i]?.key as string];
        const v = e?.personas ? r.pick(e.personas).name : e?.opts ? r.pick(e.opts.choices) : 'x';
        return [`hsOptSet #${i} ${v}`, () => a.hsOptSet(uidL(), v), (c) => core.setHsOption(c, uidC(), v)];
      }
      if (op === 5) {
        const heroList = core.heroEqList(ctx);
        const names = heroList ? Object.values(heroList).flat().map((x) => x[0]) : [];
        if (!names.length) return null;
        const nm = r.pick(names), q = r.pick([0, 1, 2, 10]);
        return [`setHsEq #${i} ${nm}=${q}`, () => a.setHsEq(uidL(), nm, q), (c) => core.setHsEq(c, uidC(), nm, q)];
      }
      { const nm = `Merc ${r.int(1, 9)}`; return [`hsSetName #${i}`, () => a.hsSetName(uidL(), nm), (c) => core.setHsName(c, uidC(), nm)]; }
    }
    case 32: {
      const allowed = core.dpEligibility(ctx).allowed;
      if (r.chance(0.6) || !dps.length) {
        const key = allowed.length && r.chance(0.9) ? r.pick(allowed).key : r.pick(Object.keys(d.DRAMATIS));
        return [`hireDP ${key}`, () => a.hireDP(key), (c) => core.hireDP(c, key)];
      }
      const i = r.int(0, dps.length - 1);
      const uidC = () => (s.dp ?? [])[i]?.uid as string;
      const uidL = () => (L.state.S.dp ?? [])[i]?.uid as string;
      if (r.chance(0.5)) return [`unhireDP #${i}`, () => a.unhireDP(uidL()), (c) => core.unhireDP(c, uidC())];
      const nm = `Hero ${r.int(1, 9)}`;
      return [`dpSetName #${i}`, () => a.dpSetName(uidL(), nm), (c) => core.setDpName(c, uidC(), nm)];
    }
    case 33: {
      if (r.chance(0.5)) { const g = r.pick(d.HS_GRADE_ORDER), on = r.chance(0.5); return [`setHsGrade ${g} ${on}`, () => a.setHsGrade(g, on), (c) => core.setHsGrade(c, g, on)]; }
      const g = r.pick(d.DP_GRADE_ORDER), on = r.chance(0.5);
      return [`setDpGrade ${g} ${on}`, () => a.setDpGrade(g, on), (c) => core.setDpGrade(c, g, on)];
    }
    case 34: {
      const key = r.pick(['startGold', 'min', 'max', 'priceAll', 'priceArmour', 'priceBP', 'priceMissile', 'clubSurcharge', 'slingSurcharge', 'rangedCap', 'heroes'] as const);
      const v = r.pick(['', null, 0, 5, 80, 130, -3, '45', 'abc']);
      return [`setHouseNum ${key}=${v}`, () => st.setHouseNum(key, v), (c) => core.setHouseNum(c, key, v)];
    }
    case 35: {
      const key = r.pick(['armourBodyOnly', 'freeDagger', 'miscHench', 'freeMarket', 'allSkills', 'hsEquip', 'hireNewLeader', 'eqLimitOn'] as const);
      const v = r.pick([true, false, 1, 0, 'yes']);
      return [`setHouseBool ${key}=${v}`, () => st.setHouseBool(key, v), (c) => core.setHouseBool(c, key, v)];
    }
    default: {
      if (r.chance(0.15)) return ['resetHouse', () => st.resetHouse(), (c) => core.resetHouse(c)];
      const v = r.pick(['No shields', '', 'x']);
      return [`setHouseNotes ${v}`, () => st.setHouseNotes(v), (c) => core.setHouseNotes(c, v)];
    }
  }
}

/* How often each action actually changed the state, over all sequences. */
const effective = new Map<string, number>();

function runSequence(label: string, start: { legacy: () => void; core: WarbandState }, seed: number): void {
  start.legacy();
  L.state.resyncUid();
  L.app.render();
  let s = core.normalizeState(core.ctxOf(data, start.core));
  expect(coreCanon(core.ctxOf(data, s)), `${label}: start`).toEqual(legacyCanon());
  const r = rng(seed);
  const done: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    const step = randomStep(r, data, s);
    if (!step) continue;
    const [what, legacyCall, coreCall] = step;
    done.push(what);
    legacyCall();
    const before = s;
    s = coreCall(core.ctxOf(data, s));
    if (s !== before) { const name = what.split(' ')[0] as string; effective.set(name, (effective.get(name) ?? 0) + 1); }
    const got = coreCanon(core.ctxOf(data, s)), want = legacyCanon();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      expect(got, `${label}: after ${done.slice(-6).join(' → ')}`).toEqual(want);
    }
  }
}

describe('roster action parity: legacy app vs core', () => {
  it.each(Object.keys(data.WARBANDS).map((wb) => [wb] as const))('fresh %s', (wb) => {
    for (const on of [false, true]) {
      const fresh = core.newWarband(data, wb);
      const start = on ? { ...fresh, campaign: { on: true, districts: {} } } : fresh;
      runSequence(`${wb} campaign=${on}`, {
        legacy: () => { L.app.chooseWb(wb); if (on) L.state.S.campaign.on = true; },
        core: start,
      }, hash(`${wb}|${on}`));
    }
  });

  const fixtures = generateFixtures(data, [3]).filter((_, i) => i % 3 === 0);
  it.each(fixtures.map((f) => [f.label, f] as const))('from %s', (label, f) => {
    runSequence(label, { legacy: () => { L.load(f.state); }, core: structuredClone(f.state) }, hash(label));
  });
});

describe('action coverage', () => {
  /* Parity only means something if the sequences exercise the actions: each
     must have changed a state a minimum number of times. */
  it('every action changed a state often enough', () => {
    const minimum = 15;
    const actions = ['addUnit', 'removeUnit', 'setName', 'setExp', 'setQty', 'toggleEq', 'setEqQty', 'addRare', 'addRare(again)',
      'setRareTarget', 'setRareQty', 'setRarePaid', 'removeRare', 'toggleMut', 'setHeirloom', 'toggleWeaponUpgrade',
      'setGoldCurrent', 'adjGoldCurrent', 'stashAdj', 'stashSet', 'stashAddItem', 'stashRemItem', 'stashItemQty', 'pickSub',
      'setDistrict', 'hireHS', 'unhireHS', 'setHsExp', 'addHsSkill', 'delHsSkill', 'hsOptSet', 'setHsEq', 'hsSetName',
      'hireDP', 'unhireDP', 'dpSetName', 'setHsGrade', 'setDpGrade', 'setHouseNum', 'setHouseBool', 'setHouseNotes', 'resetHouse'];
    const low = actions.filter((a) => (effective.get(a) ?? 0) < minimum).map((a) => `${a}: ${effective.get(a) ?? 0}`);
    expect(low).toEqual([]);
  });
});

describe('roster actions without a legacy counterpart', () => {
  it('setWarbandName renames the warband', () => {
    const s = core.newWarband(data, 'merc');
    expect(core.setWarbandName(core.ctxOf(data, s), 'Die Silberne Karavane').name).toBe('Die Silberne Karavane');
  });

  it('never reuses a model uid after a removal', () => {
    let s = core.newWarband(data, 'merc');
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.addUnit(ctx(), 'champ');
    const second = s.models[1]?.uid as number;
    s = core.removeUnit(ctx(), second);
    s = core.addUnit(ctx(), 'champ');
    expect(s.models.map((m) => m.uid)).not.toContain(undefined);
    expect(s.models[1]?.uid).toBeGreaterThan(second);
  });

  it('never reuses a chronicle id after a deletion', () => {
    let s: WarbandState = { ...core.newWarband(data, 'merc'), campaign: { on: true, districts: {} } };
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.addUnit(ctx(), 'champ');
    const ids = (s.campaign?.log ?? []).map((e) => e.id);
    s = { ...s, campaign: { ...s.campaign, log: (s.campaign?.log ?? []).slice(0, 1) } };
    s = core.addUnit(ctx(), 'champ');
    const last = (s.campaign?.log ?? []).at(-1)?.id as number;
    expect(last).toBeGreaterThan(Math.max(...ids));
  });

  it('actions return new states and leave the input untouched', () => {
    const s = Object.freeze(core.newWarband(data, 'merc')) as WarbandState;
    const next = core.addUnit(core.ctxOf(data, s), 'capt');
    expect(next).not.toBe(s);
    expect(s.models).toHaveLength(0);
    expect(next.models).toHaveLength(1);
  });

  it('a refused action returns the very same state', () => {
    const s = core.newWarband(data, 'merc');
    expect(core.addUnit(core.ctxOf(data, s), 'no-such-unit')).toBe(s);
    expect(core.hireHS(core.ctxOf(data, s), 'no-such-hs')).toBe(s);
  });
});

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

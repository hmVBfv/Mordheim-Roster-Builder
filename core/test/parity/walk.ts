/* The random walk behind the action parity suites (walk-*.parity.test.ts).
 *
 * Parity for warband actions: the same random sequence of actions is
 * applied to the legacy app (through its exported action functions, which
 * mutate its global S and re-render) and to core (pure functions returning a
 * new state). After every step both states must be identical, up to:
 *   - core-only bookkeeping (uidSeq, campaign.logSeq),
 *   - ids that legacy draws from a clock or a module-wide counter (Hired
 *     Sword/Dramatis record uids, chronicle ids), compared by position,
 *   - the canonical form legacy reached as a side effect of rendering, which
 *     core produces with normalizeState(). */
import { expect } from 'vitest';
import * as core from '../../src/index.ts';
import type { Ctx, GameData, Model, WarbandState } from '../../src/index.ts';
import { loadGameData } from '../../src/node.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures, type Fixture } from '../support/fixtures.ts';
import { rng, type Rng } from '../support/random.ts';

export const data = loadGameData();

/* Parity mode drives the legacy app alongside core; coverage mode replays the
   same walks with core alone (the steps depend only on the core state, so the
   sequence is identical) and is fast. */
const NO_LEGACY = { app: {}, state: { S: {} } } as unknown as Legacy;
let L: Legacy = NO_LEGACY;
export function useLegacy(l: Legacy | null): void { L = l ?? NO_LEGACY; }

const STEPS = 110;

/* ---- canonical form for comparison ---- */
type Rec = Record<string, unknown>;
type IdRef = [holder: Rec, key: string];

/* Every place a chronicle id (log entry, battle, casualty, experience entry
   — one shared sequence) is stored or referenced. */
function idRefs(c: Rec): IdRef[] {
  const out: IdRef[] = [];
  const camp = c.campaign as Rec | undefined;
  const list = (x: unknown) => (Array.isArray(x) ? x as Rec[] : []);
  const add = (h: unknown, k: string) => { if (h && typeof h === 'object' && typeof (h as Rec)[k] === 'number') out.push([h as Rec, k]); };
  if (camp) {
    for (const e of list(camp.log)) { add(e, 'id'); add(e.data, 'casualtyId'); add(e.data, 'battleId'); }
    for (const b of list(camp.battles)) add(b, 'id');
    for (const r of list(camp.casualties)) { add(r, 'id'); add(r, 'xpId'); add(r, 'battleId'); }
    for (const x of list(camp.xp)) add(x, 'id');
  }
  for (const f of list(c.fallen)) add(f, 'casualtyId');
  return out;
}

function canon(s: unknown): unknown {
  const c = JSON.parse(JSON.stringify(s)) as Rec & { campaign?: Rec; hired?: { uid: string }[]; dp?: { uid: string }[] };
  delete c.uidSeq;
  if (c.campaign) delete c.campaign.logSeq;
  // Chronicle ids by rank: legacy draws them from a module-wide counter,
  // core from the state; both hand them out in the same order.
  const refs = idRefs(c);
  const rank = new Map([...new Set(refs.map(([h, k]) => h[k] as number))].sort((x, y) => x - y).map((id, i) => [id, i + 1]));
  for (const [h, k] of refs) h[k] = rank.get(h[k] as number);
  (c.hired ?? []).forEach((h, i) => { h.uid = `H${i}`; });
  (c.dp ?? []).forEach((h, i) => { h.uid = `D${i}`; });
  // Open/closed panels are screen state that legacy kept in the save; core
  // does not model them.
  const fallenModels = ((c.fallen as { m?: Rec }[] | undefined) ?? []).map((f) => f.m).filter(Boolean) as Rec[];
  for (const x of [...((c.models as Rec[] | undefined) ?? []), ...(c.hired ?? []), ...(c.dp ?? []), ...fallenModels] as Rec[]) {
    for (const k of Object.keys(x)) if (/^_.*Open$/.test(k)) delete x[k];
  }
  return c;
}
/* Both sides go through normalizeState: when legacy reached the canonical
   form depended on what it happened to render (e.g. the campaign lists only
   appear once the campaign section or a log entry touched them). */
const canonOf = (s: unknown) => canon(core.normalizeState(core.ctxOf(data, JSON.parse(JSON.stringify(s)) as WarbandState)));
export const coreCanon = (ctx: Ctx) => canonOf(ctx.s);
export const legacyCanon = () => canonOf(L.state.S);

/* Legacy dialogs answered in order (confirm: default yes; prompt: default
   cancelled). Without a prompt function legacy uses its defaults. */
export function withDialogs<T>(confirms: boolean[], prompts: (string | null)[], fn: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const oc = g.confirm, op = g.prompt;
  const cq = [...confirms], pq = [...prompts];
  g.confirm = () => (cq.length ? cq.shift() : true);
  g.prompt = () => (pq.length ? pq.shift() : null);
  try { return fn(); } finally { g.confirm = oc; g.prompt = op; }
}

/* Legacy functions that read their input from the DOM get it from here. */
export function withDom<T>(values: Record<string, string>, fn: () => T): T {
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

export function randomStep(r: Rng, d: GameData, s: WarbandState): Step | null {
  const a = L.app, st = L.state;
  const ctx = core.ctxOf(d, s);
  const wb = d.WARBANDS[s.wb as string];
  if (!wb) return null;
  const m = pickModel(r, s);
  const list = m ? core.eqListFor(ctx, core.unitDef(ctx, m.uid_def)) : undefined;
  const items = list ? Object.values(list).flat().map((e) => e[0]) : [];
  const hired = s.hired ?? [], dps = s.dp ?? [];
  const roll = r.int(0, 38 + ADV_KINDS + INJ_KINDS);
  if (roll > 38 + ADV_KINDS) return injuryStep(r, d, s, m);
  if (roll > 38) return advanceStep(r, d, s, m);
  // two extra slots for the Hired Sword operations, which have many variants
  const kind = roll > 36 ? 31 : roll;
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
      const casters = allowed.filter((x) => d.HIREDSWORDS[x.key]?.magic);
      const key = casters.length && r.chance(0.35) ? r.pick(casters).key : r.chance(0.9) && allowed.length ? r.pick(allowed).key : r.pick(Object.keys(d.HIREDSWORDS));
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
/* How often each action actually changed the state. */
export const effective = new Map<string, number>();

const ADV_KINDS = 24;
const STAT_KEYS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

/* Experience and advancement steps. */
function advanceStep(r: Rng, d: GameData, s: WarbandState, m: Model | undefined): Step | null {
  const a = L.app;
  const ctx = core.ctxOf(d, s);
  const hired = s.hired ?? [];
  const op = r.int(0, 19);
  if (op >= 14) {
    // Hired Swords and Dramatis Personae
    const recs = [...hired.map((h, i) => ({ list: 'hired' as const, i, key: h.key })), ...(s.dp ?? []).map((h, i) => ({ list: 'dp' as const, i, key: h.key }))];
    if (!recs.length) return null;
    const sub = r.int(0, 5);
    const entryOf = (key: string) => d.HIREDSWORDS[key] ?? d.DRAMATIS[key];
    const recOf = (x: { list: 'hired' | 'dp'; i: number }) => (s[x.list] ?? [])[x.i];
    // aim each operation at a record it can act on, most of the time
    const fitting = recs.filter((x) =>
      sub === 2 ? (recOf(x)?.skills ?? []).length > 0
        : sub === 3 ? !!entryOf(x.key)?.magic
          : sub >= 4 ? (recOf(x)?.spells ?? []).length > 0 : true);
    const pick = fitting.length && r.chance(0.85) ? r.pick(fitting) : r.pick(recs);
    const uidC = () => ((s[pick.list] ?? [])[pick.i] as { uid: string }).uid;
    const uidL = () => ((L.state.S[pick.list] ?? [])[pick.i] as { uid: string }).uid;
    const e = d.HIREDSWORDS[pick.key] ?? d.DRAMATIS[pick.key];
    const fromLore = e?.magic && d.SPELLS[e.magic] ? d.SPELLS[e.magic]!.spells.map((x) => x[0]) : [];
    const spellNames = fromLore.length ? fromLore : ['Nope (5)'];
    if (sub === 0) { const k = r.pick(STAT_KEYS); return [`addHsAdv ${pick.list}#${pick.i} ${k}`, () => a.addHsAdv(uidL(), k), (c) => core.addHsAdvance(c, uidC(), k)]; }
    if (sub === 1) { const k = r.pick(STAT_KEYS); return [`remHsAdv ${pick.list}#${pick.i} ${k}`, () => a.remHsAdv(uidL(), k), (c) => core.removeHsAdvance(c, uidC(), k)]; }
    if (sub === 2) { const i = r.int(0, 2); return [`remHsSkillIdx ${pick.list}#${pick.i} ${i}`, () => a.remHsSkillIdx(uidL(), i), (c) => core.removeHsSkillAt(c, uidC(), i)]; }
    if (sub === 3) {
      const nm = r.chance(0.9) ? r.pick(spellNames) : '\u2014';
      if (r.chance(0.5)) return [`addHsSpell ${pick.list}#${pick.i} ${nm}`, () => withDom({ [`hssp-${uidL()}`]: nm }, () => a.addHsSpell(uidL())), (c) => core.addHsSpell(c, uidC(), nm)];
      return [`addHsSpellFromAdv ${pick.list}#${pick.i} ${nm}`, () => withDom({ [`hssp2-${uidL()}`]: nm }, () => a.addHsSpellFromAdv(uidL())), (c) => core.addHsSpell(c, uidC(), nm)];
    }
    if (sub === 4) { const i = r.int(0, 1); return [`delHsSpell ${pick.list}#${pick.i} ${i}`, () => a.delHsSpell(uidL(), i), (c) => core.removeHsSpell(c, uidC(), i)]; }
    { const i = r.int(0, 1), dv = r.pick([1, 1, -1, 3]); return [`hsSpellRed ${pick.list}#${pick.i} ${i} ${dv}`, () => a.hsSpellRed(uidL(), i, dv), (c) => core.hsSpellReduce(c, uidC(), i, dv)]; }
  }
  if (op === 13) { const v = r.pick(['', ...d.MARAUDER_MARKS.map((x) => x[0])]); return [`setMark ${v}`, () => a.setMark(v), (c) => core.setMark(c, v)]; }
  if (!m) return null;
  const def = core.unitDef(ctx, m.uid_def);
  const lore = core.casterLore(ctx, m) ?? core.magicOfModel(ctx, m) ?? r.pick(Object.keys(d.SPELLS));
  const fromLore = d.SPELLS[lore] ? d.SPELLS[lore]!.spells.map((x) => x[0]) : [];
  const spellNames = fromLore.length ? fromLore : ['Nope (5)'];
  const skillNames = def ? core.skillListsFor(ctx, def).flatMap(([, sk]) => sk.map((x) => x[0])) : [];
  switch (op) {
    case 0: { const dv = r.pick([1, 1, 2, -1, -5]); return [`incExp ${m.uid} ${dv}`, () => a.incExp(m.uid, dv), (c) => core.incExp(c, m.uid, dv)]; }
    case 1: { const v = r.pick([2, 5, 11, 0, '8']); return [`setExpJump ${m.uid}=${v}`, () => a.setExpJump(m.uid, v), (c) => core.setModelExp(c, m.uid, v)]; }
    case 2: case 3: { const k = r.pick(STAT_KEYS); return [`addAdv ${m.uid} ${k}`, () => a.addAdv(m.uid, k), (c) => core.addAdvance(c, m.uid, k)]; }
    case 4: {
      const withAdv = s.models.filter((x) => Object.keys(x.adv ?? {}).length);
      const mm = withAdv.length && r.chance(0.85) ? r.pick(withAdv) : m;
      const keys = Object.keys(mm.adv ?? {}) as (typeof STAT_KEYS)[number][];
      const k = keys.length ? r.pick(keys) : r.pick(STAT_KEYS);
      return [`remAdv ${mm.uid} ${k}`, () => a.remAdv(mm.uid, k), (c) => core.removeAdvance(c, mm.uid, k)];
    }
    case 5: {
      const v = skillNames.length && r.chance(0.8) ? r.pick(skillNames) : r.pick(['  Custom skill ', '', 'Mutant']);
      if (r.chance(0.5)) return [`addSkill ${m.uid} ${v}`, () => withDom({ [`sk-${m.uid}`]: v }, () => a.addSkill(m.uid)), (c) => core.addSkill(c, m.uid, v)];
      return [`addSkillFromSel ${m.uid} ${v}`, () => withDom({ [`sksel-${m.uid}`]: v }, () => a.addSkillFromSel(m.uid)), (c) => core.addSkillFromList(c, m.uid, v)];
    }
    case 6: { const i = r.int(0, 2); return [`remSkill ${m.uid} ${i}`, () => a.remSkill(m.uid, i), (c) => core.removeSkill(c, m.uid, i)]; }
    case 7: { const cat = r.pick(d.STD_CATS); return [`togglePromoCat ${m.uid} ${cat}`, () => a.togglePromoCat(m.uid, cat), (c) => core.togglePromoCat(c, m.uid, cat)]; }
    case 8: { const i = r.int(0, 4), v = r.pick(['Hans', '', ' Grim ']); return [`setMemberName ${m.uid} ${i}=${v}`, () => a.setMemberName(m.uid, i, v), (c) => core.setMemberName(c, m.uid, i, v)]; }
    case 9: {
      const promoted = s.models.filter((x) => x.promoted);
      if (promoted.length && r.chance(0.3)) { const mm = r.pick(promoted); return [`unpromote ${mm.uid}`, () => a.unpromote(mm.uid), (c) => core.unpromote(c, mm.uid)]; }
      const i = r.chance(0.5) ? null : r.int(0, 4);
      return [`promoteHench ${m.uid} ${i}`, () => a.promoteHench(m.uid, i), (c) => core.promoteHench(c, m.uid, i)];
    }
    case 10: {
      const nm = r.chance(0.9) ? r.pick(spellNames) : '\u2014';
      const own = s.models.filter((x) => core.magicOfModel(ctx, x));
      if (r.chance(own.length ? 0.35 : 0.5)) return [`addSpell ${m.uid} ${nm}`, () => withDom({ [`sp-${m.uid}`]: nm }, () => a.addSpell(m.uid)), (c) => core.addSpell(c, m.uid, nm)];
      const mm = own.length && r.chance(0.85) ? r.pick(own) : m;
      const ownLore = core.magicOfModel(ctx, mm);
      // mostly a spell he does not know yet
      const lore2 = ownLore ? (d.SPELLS[ownLore]?.spells ?? []).map((x) => x[0]) : [];
      const unknown = lore2.filter((x) => !(mm.spells ?? []).some((sp) => sp.name === x));
      const nm2 = unknown.length && r.chance(0.85) ? r.pick(unknown) : lore2.length ? r.pick(lore2) : nm;
      return [`addSpellFromAdv ${mm.uid} ${nm2}`, () => withDom({ [`spadv-${mm.uid}`]: nm2 }, () => a.addSpellFromAdv(mm.uid)), (c) => core.addSpellFromAdvance(c, mm.uid, nm2)];
    }
    case 11: {
      const withSpells = s.models.filter((x) => (x.spells ?? []).length);
      if (withSpells.length && r.chance(0.85)) {
        const mm = r.pick(withSpells), i = r.int(0, (mm.spells ?? []).length - 1);
        if (r.chance(0.5)) return [`remSpell2 ${mm.uid} ${i}`, () => a.remSpell2(mm.uid, i), (c) => core.removeSpell(c, mm.uid, i)];
        const dv = r.pick([1, 1, -1, 4]);
        return [`spellRed ${mm.uid} ${i} ${dv}`, () => a.spellRed(mm.uid, i, dv), (c) => core.spellReduce(c, mm.uid, i, dv)];
      }
      const i = r.int(0, 2);
      if (r.chance(0.5)) return [`remSpell2 ${m.uid} ${i}`, () => a.remSpell2(m.uid, i), (c) => core.removeSpell(c, m.uid, i)];
      const dv = r.pick([1, 1, -1, 4]);
      return [`spellRed ${m.uid} ${i} ${dv}`, () => a.spellRed(m.uid, i, dv), (c) => core.spellReduce(c, m.uid, i, dv)];
    }
    case 12: {
      const x = r.int(0, 2);
      if (x === 0) { const on = r.chance(0.6); return [`setCaster ${m.uid} ${on}`, () => a.setCaster(m.uid, on), (c) => core.setCaster(c, m.uid, on)]; }
      if (x === 1) { const v = r.pick(Object.keys(d.SPELLS)); return [`setLore ${m.uid} ${v}`, () => a.setLore(m.uid, v), (c) => core.setLore(c, m.uid, v)]; }
      return [`setLeader ${m.uid}`, () => a.setLeader(m.uid), (c) => core.setLeader(c, m.uid)];
    }
    default: return null;
  }
}

const INJ_KINDS = 16;

/* Injuries, deaths, the Fallen, casualty records and held experience. */
function injuryStep(r: Rng, d: GameData, s: WarbandState, m: Model | undefined): Step | null {
  const a = L.app;
  const ctx = core.ctxOf(d, s);
  const heroes = s.models.filter((x) => core.isHeroModel(ctx, x));
  const hench = s.models.filter((x) => !core.isHeroModel(ctx, x));
  const cas = s.campaign?.casualties ?? [];
  const pickCas = () => {
    const i = r.int(0, cas.length - 1);
    return { i, idC: () => (s.campaign?.casualties ?? [])[i]?.id as number, idL: () => ((L.state.S.campaign?.casualties ?? []) as { id: number }[])[i]?.id as number };
  };
  const op = r.int(0, 22);
  switch (op) {
    case 0: case 1: case 2: case 3: {
      const mm = heroes.length && r.chance(0.8) ? r.pick(heroes) : m;
      if (!mm) return null;
      const code = r.pick(d.INJURIES).code;
      const confirms: boolean[] = [], prompts: (string | null)[] = [];
      const choices: core.InjuryChoices = {};
      let declined = false;
      if (code === '36') { const yes = r.chance(0.85); confirms.push(yes); declined = !yes; }
      if (code === '65') { const won = r.chance(0.5); confirms.push(won); choices.pitWon = won; }
      if (code === '61') {
        const back = r.chance(0.6); confirms.push(back); choices.captiveReturns = back;
        if (back) { const v = r.pick(['0', '35', '200', null, 'x', '-5']); prompts.push(v); choices.ransom = v; }
      }
      if (code === '35') { const v = r.pick(['1', '2', '3', '7', null, '0']); prompts.push(v); choices.deepWoundGames = v; }
      return [`addInj ${mm.uid} ${code}`,
        () => withDom({ [`inj-${mm.uid}`]: code }, () => withDialogs(confirms, prompts, () => a.addInj(mm.uid))),
        (c) => (declined ? c.s : core.addInjury(c, mm.uid, code, choices))];
    }
    case 4: {
      const withInj = s.models.filter((x) => (x.inj ?? []).length);
      const mm = withInj.length && r.chance(0.85) ? r.pick(withInj) : m;
      if (!mm) return null;
      const i = r.int(0, 2);
      return [`remInj ${mm.uid} ${i}`, () => a.remInj(mm.uid, i), (c) => core.removeInjury(c, mm.uid, i)];
    }
    case 5: { if (!m) return null; const dv = r.pick([1, 1, -1, 2, -3]); return [`missAdj ${m.uid} ${dv}`, () => a.missAdj(m.uid, dv), (c) => core.adjustMiss(c, m.uid, dv)]; }
    case 6: {
      const mm = heroes.length && r.chance(0.85) ? r.pick(heroes) : m;
      if (!mm) return null;
      const msg = r.chance(0.2) ? 'He fell from the rooftops.' : undefined;
      return [`killHero ${mm.uid}`, () => a.killHero(mm.uid, msg), (c) => core.killHero(c, mm.uid, msg)];
    }
    case 7: case 8: {
      const mm = hench.length && r.chance(0.9) ? r.pick(hench) : m;
      if (!mm) return null;
      if (r.chance(0.5)) { const i = r.chance(0.5) ? null : r.int(0, 4); return [`killHench ${mm.uid} ${i}`, () => a.killHench(mm.uid, i ?? undefined), (c) => core.killHench(c, mm.uid, i)]; }
      const i = r.int(0, Math.max(0, core.memberCount(mm) - 1));
      return [`killHenchMember ${mm.uid} ${i}`, () => a.killHenchMember(mm.uid, i), (c) => core.killHenchMember(c, mm.uid, i)];
    }
    case 9: case 10: return ['undoFallen', () => a.undoFallen(), (c) => core.undoFallen(c)];
    case 11: {
      const n = s.fallen?.length ?? 0;
      if (!n) return null;
      const i = r.int(0, n - 1);
      return [`removeFallenAt ${i}`, () => withDialogs([true], [], () => a.removeFallenAt(i)), (c) => core.removeFallenAt(c, i)];
    }
    case 12: case 13: case 14: {
      // a casualty: ours or an enemy's, by our Hero, an enemy or nobody
      const victim: Partial<core.CasualtySide> = {};
      const ours = m && r.chance(0.7) ? m : undefined;
      if (ours) {
        const i = r.int(0, core.memberCount(ours) - 1);
        victim.uid = ours.uid; victim.name = core.isHeroModel(ctx, ours) ? (ours.name || core.unitDef(ctx, ours.uid_def)?.name || '') : core.memberName(ctx, ours, i);
        victim.wb = s.wb as string;
        if (r.chance(0.5)) victim.memberIdx = i;
      } else { victim.name = `Foe ${r.int(1, 5)}`; victim.wb = r.pick(Object.keys(d.WARBANDS)); if (r.chance(0.3)) victim.value = r.pick([35, '20', 0]) as number; }
      const attacker: Partial<core.CasualtySide> = {};
      const hero = heroes.length && r.chance(0.6) ? r.pick(heroes) : undefined;
      if (hero && !ours) { attacker.uid = hero.uid; attacker.name = hero.name || core.unitDef(ctx, hero.uid_def)?.name || ''; }
      else if (r.chance(0.5)) { attacker.name = `Foe ${r.int(1, 5)}`; attacker.wb = r.pick(Object.keys(d.WARBANDS)); }
      const input: core.CasualtyInput = { victim, attacker, result: r.chance(0.8) ? 'pending' : r.pick(['dead', 'injured', 'recovered']), noXp: r.chance(0.15) };
      if (r.chance(0.2)) input.round = r.int(0, 2);
      if (r.chance(0.2)) input.note = 'ambush';
      return [`addCasualty ${victim.uid ?? victim.name}`, () => a.addCasualty(structuredClone(input)), (c) => core.addCasualty(c, structuredClone(input))];
    }
    case 15: case 16: {
      if (!cas.length) return null;
      const { i, idC, idL } = pickCas();
      const rec = cas[i] as core.Casualty;
      const hero = core.casualtyIsHero(ctx, rec);
      const codes = hero ? d.INJURIES.map((x) => x.code) : core.HENCH_INJ.map((x) => x.code);
      const code = r.chance(0.1) ? r.pick(['', 'zz']) : r.pick(codes);
      return [`resolveCasualtyRoll #${i} ${code}`, () => a.resolveCasualtyRoll(idL(), code), (c) => core.resolveCasualtyRoll(c, idC(), code)];
    }
    case 17: {
      if (!cas.length) return null;
      const { i, idC, idL } = pickCas();
      if (r.chance(0.5)) { const v = r.pick(['bled out', '', 'x']); return [`setCasNote #${i}`, () => a.setCasNote(idL(), v), (c) => core.setCasualtyNote(c, idC(), v)]; }
      const res = r.pick(['dead', 'injured', 'recovered', 'pending', '']), det = r.pick([null, '', 'by hand']);
      return [`resolveCasualty #${i} ${res}`, () => a.resolveCasualty(idL(), res, det), (c) => core.resolveCasualty(c, idC(), res, det)];
    }
    case 18: {
      if (!cas.length) return null;
      const { i, idC, idL } = pickCas();
      const silent = r.chance(0.5);
      return [`removeCasualty #${i}`, () => withDialogs([true], [], () => a.removeCasualty(idL(), silent)), (c) => core.removeCasualty(c, idC())];
    }
    case 19: {
      if (!m) return null;
      const amt = r.pick([1, 1, 2, 0, '3']) as number, round = r.chance(0.3) ? r.int(0, 3) : undefined;
      return [`grantXp ${m.uid} ${amt}`, () => a.grantXp(m.uid, amt, 'survived', round), (c) => core.grantXp(c, m.uid, amt, 'survived', round)];
    }
    case 20: case 21: {
      const x = r.int(0, 3);
      if (x === 0) return ['applyPendingXp', () => a.applyPendingXp(), (c) => core.applyPendingXp(c)];
      if (x === 1) return ['applyBattleResults', () => withDialogs([true], [], () => a.applyBattleResults()), (c) => core.applyBattleResults(c)];
      if (x === 2) return ['clearPendingXp', () => withDialogs([true], [], () => a.clearPendingXp()), (c) => core.clearPendingXp(c)];
      const opts = { survives: r.pick([1, 1, 5]), won: r.pick([true, false, null]) };
      return ['awardBattleXp', () => a.awardBattleXp(null, { ...opts }), (c) => core.awardBattleXp(c, null, { ...opts })];
    }
    default: {
      // Heroes put enemies out of action and apply their battle: the
      // sequence the post-battle screen runs.
      if (!heroes.length) return null;
      const h = r.pick(heroes);
      const input: core.CasualtyInput = { victim: { name: `Foe ${r.int(1, 5)}`, wb: r.pick(Object.keys(d.WARBANDS)) }, attacker: { uid: h.uid, name: h.name || '' }, result: 'recovered' };
      return [`addCasualty(byHero) ${h.uid}`, () => a.addCasualty(structuredClone(input)), (c) => core.addCasualty(c, structuredClone(input))];
    }
  }
}

/* What the read-only rules say about the Fallen, casualties and held
   experience — compared after every step, since the generated fixtures hold
   none of these and only the walk produces them. Ids are left out (they are
   compared by rank in the state). */
function casualtyReport(ctx: Ctx): unknown {
  const s = ctx.s;
  const cas = s.campaign?.casualties ?? [];
  return {
    goldLost: core.fallenGoldLost(ctx), expLost: core.fallenExpLost(ctx),
    fallen: (s.fallen ?? []).map((e) => [core.fallenGoldOf(ctx, e), core.fallenExpEarned(ctx, e), core.fallenEqSig(e.m)]),
    stats: core.casualtyStats(ctx),
    cas: cas.map((r) => [core.casualtyText(ctx, r), core.casualtyType(r), core.casualtyIsOurs(r), core.casualtyIsHero(ctx, r),
      core.casualtyRollOptions(ctx, r).map((o) => o.label).join('|'), core.casualtyModel(ctx, r)?.uid ?? null]),
    xp: core.pendingXpTotal(ctx),
    models: s.models.map((m) => [core.modelLabel(ctx, m), core.canEarnXp(ctx, m), core.pendingXpFor(ctx, m.uid),
      cas.indexOf(core.pendingCasualtyFor(ctx, m.uid) as core.Casualty)]),
    outstanding: core.outstandingCasualties(ctx).length, unrolled: core.unrolledCasualties(ctx).length,
    round: core.roundLabel(s.campaign?.round), wb: core.wbName(ctx, s.wb),
  };
}

function legacyCasualtyReport(): unknown {
  const a = L.app, S = L.state.S as WarbandState;
  const cas = (S.campaign?.casualties ?? []) as core.Casualty[];
  return {
    goldLost: a.fallenGoldLost(), expLost: a.fallenExpLost(),
    fallen: (S.fallen ?? []).map((e) => [a.fallenGoldOf(e), a.fallenExpEarned(e), a.fallenEqSig(e.m)]),
    stats: a.casualtyStats(),
    cas: cas.map((r) => [a.casualtyText(r), a.casualtyType(r), a.casualtyIsOurs(r), a.casualtyIsHero(r),
      (a.casualtyRollOptions(r) as { label: string }[]).map((o) => o.label).join('|'), a.casualtyModel(r)?.uid ?? null]),
    xp: a.pendingXpTotal(),
    models: S.models.map((m) => [a.modelLabel(m), a.canEarnXp(m), a.pendingXpFor(m.uid), cas.indexOf(a.pendingCasualtyFor(m.uid))]),
    outstanding: a.outstandingCasualties().length, unrolled: a.unrolledCasualties().length,
    round: a.roundLabel(S.campaign?.round), wb: a.wbName(S.wb),
  };
}

export type WalkStart = { legacy: () => void; core: WarbandState };

export function runSequence(label: string, start: WalkStart, seed: number, withLegacy = true): void {
  if (withLegacy) { start.legacy(); L.state.resyncUid(); L.app.render(); }
  let s = core.normalizeState(core.ctxOf(data, start.core));
  if (withLegacy) expect(coreCanon(core.ctxOf(data, s)), `${label}: start`).toEqual(legacyCanon());
  const r = rng(seed);
  const done: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    const step = randomStep(r, data, s);
    if (!step) continue;
    const [what, legacyCall, coreCall] = step;
    done.push(what);
    if (withLegacy) legacyCall();
    const before = s;
    s = coreCall(core.ctxOf(data, s));
    if (s !== before) { const name = what.split(' ')[0] as string; effective.set(name, (effective.get(name) ?? 0) + 1); }
    if (!withLegacy) continue;
    const got = coreCanon(core.ctxOf(data, s)), want = legacyCanon();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      expect(got, `${label}: after ${done.slice(-6).join(' → ')}`).toEqual(want);
    }
    expect(casualtyReport(core.ctxOf(data, s)), `${label}: rules after ${done.slice(-6).join(' → ')}`).toEqual(legacyCasualtyReport());
  }
}

/* ---- the walks ---- */

export interface Walk { label: string; start: WalkStart; seed: number }

/** A fresh roster of every warband type, with and without the campaign on. */
export function freshWalks(): Walk[] {
  const out: Walk[] = [];
  for (const wb of Object.keys(data.WARBANDS)) for (const on of [false, true]) {
    const fresh = core.newWarband(data, wb);
    out.push({
      label: `${wb} campaign=${on}`, seed: hash(`${wb}|${on}`),
      start: {
        legacy: () => { L.app.chooseWb(wb); if (on) L.state.S.campaign.on = true; },
        core: on ? { ...fresh, campaign: { on: true, districts: {} } } : fresh,
      },
    });
  }
  return out;
}

/** Every third generated state (seed 3). */
export function fixtureWalks(): Walk[] {
  return generateFixtures(data, [3]).filter((_, i) => i % 3 === 0).map((f: Fixture) => ({
    label: f.label, seed: hash(f.label),
    start: { legacy: () => { L.load(f.state); }, core: structuredClone(f.state) },
  }));
}

/** Half of a list, for splitting a suite over parallel files. */
export const half = <T>(xs: T[], which: 0 | 1): T[] => xs.filter((_, i) => i % 2 === which);

/** Every action the walk can take, as labelled in steps. */
export const ACTIONS = ['addUnit', 'removeUnit', 'setName', 'setExp', 'setQty', 'toggleEq', 'setEqQty', 'addRare', 'addRare(again)',
  'setRareTarget', 'setRareQty', 'setRarePaid', 'removeRare', 'toggleMut', 'setHeirloom', 'toggleWeaponUpgrade',
  'setGoldCurrent', 'adjGoldCurrent', 'stashAdj', 'stashSet', 'stashAddItem', 'stashRemItem', 'stashItemQty', 'pickSub',
  'setDistrict', 'hireHS', 'unhireHS', 'setHsExp', 'addHsSkill', 'delHsSkill', 'hsOptSet', 'setHsEq', 'hsSetName',
  'hireDP', 'unhireDP', 'dpSetName', 'setHsGrade', 'setDpGrade', 'setHouseNum', 'setHouseBool', 'setHouseNotes', 'resetHouse',
  'incExp', 'setExpJump', 'addAdv', 'remAdv', 'addSkill', 'addSkillFromSel', 'remSkill', 'togglePromoCat', 'setMemberName',
  'promoteHench', 'unpromote', 'addSpell', 'addSpellFromAdv', 'remSpell2', 'spellRed', 'setCaster', 'setLore', 'setLeader', 'setMark',
  'addHsAdv', 'remHsAdv', 'remHsSkillIdx', 'addHsSpell', 'addHsSpellFromAdv', 'delHsSpell', 'hsSpellRed',
  'addInj', 'remInj', 'missAdj', 'killHero', 'killHench', 'killHenchMember', 'undoFallen', 'removeFallenAt',
  'addCasualty', 'addCasualty(byHero)', 'resolveCasualtyRoll', 'setCasNote', 'resolveCasualty', 'removeCasualty',
  'grantXp', 'applyPendingXp', 'applyBattleResults', 'clearPendingXp', 'awardBattleXp'];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

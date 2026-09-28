/* Parity of the campaign file, territory and the battle and casualty forms.
 *
 * The legacy app keeps the open campaign file in a module variable and the
 * half-filled forms inside the save; core treats all three as values. This
 * walk drives both through the same random operations — importing and
 * merging warbands, correcting the map, filling in and saving forms, with
 * ordinary roster actions from walk.ts in between — and compares after every
 * step: the warband, the campaign file, the open drafts, and what the
 * read-only functions (territory, sides, statistics, merged history) say. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { rng, type Rng } from '../support/random.ts';
import { cfCanon, draftCanon } from '../support/canon.ts';
import { coreCfReport, legacyCfReport } from './cfReport.ts';
import { coreCanon, data, hash, legacyCanon, randomStep, useLegacy, withDialogs } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const TODAY = '2026-09-27';
const STEPS = 120;
const ctx = (s: WarbandState) => core.ctxOf(data, s);
type Rec = Record<string, unknown>;

/* Other players' warbands, as their exports would arrive. */
const OTHERS: WarbandState[] = generateFixtures(data, [5]).filter((_, i) => i % 23 === 0)
  .map((f, i) => ({ ...f.state, name: `Rival ${i % 6}` }));

interface World { s: WarbandState; cf: core.CampaignFile | null; bd: core.BattleDraft | null; cd: core.CasualtyDraft | null }
type Op = [label: string, legacy: () => unknown, next: (w: World) => World];

function compare(label: string, w: World): void {
  expect(coreCanon(ctx(w.s)), `${label}: warband`).toEqual(legacyCanon());
  expect(cfCanon(w.cf), `${label}: campaign file`).toEqual(cfCanon(L.app.cfGet()));
  const camp = (L.state.S.campaign ?? {}) as Rec;
  expect(draftCanon(w.bd, w.s), `${label}: battle form`).toEqual(draftCanon(camp._draft, L.state.S as WarbandState));
  expect(w.cd ?? null, `${label}: casualty form`).toEqual(camp._cas ?? null);
  expect(coreCfReport(ctx(w.s), w.cf), `${label}: reports`).toEqual(legacyCfReport(L));
}

/* ---- random operations ---- */

function battleInput(r: Rng, names: string[]): Rec {
  const sides = Array.from({ length: r.int(1, 3) }, () => ({ key: '', name: r.pick(names), wb: r.pick(Object.keys(data.WARBANDS)), outcome: r.pick(['Victory', 'Defeat', 'Routed', 'Draw', '']) }));
  return { round: r.int(0, 3), district: r.chance(0.6) ? r.pick(data.DISTRICTS).id : '', sides, opponents: sides.map((x) => ({ name: x.name, wb: x.wb })), notes: '' };
}

function mergeInput(r: Rng): unknown {
  const k = r.int(0, 4);
  if (k === 0) return r.pick(['not json', '42', 'null']);
  if (k === 1) return { hello: 'world' };
  if (k === 2) {
    const o = structuredClone(r.pick(OTHERS));
    o.campaign = { ...(o.campaign ?? {}), battles: Array.from({ length: r.int(0, 3) }, () => ({ id: r.int(1, 9), ...battleInput(r, ['Rival 1', 'Rival 2', 'Us']) })) } as WarbandState['campaign'];
    return r.chance(0.5) ? JSON.stringify(o) : o;
  }
  const file = {
    type: core.CF_TYPE, version: 1, name: 'Theirs', round: 1,
    warbands: Array.from({ length: r.int(0, 2) }, () => ({ id: 1, player: r.pick(['', 'Cleo']), name: 'x', wb: 'x', updated: '', roster: structuredClone(r.pick(OTHERS)) })),
    battles: Array.from({ length: r.int(0, 3) }, () => ({ id: r.int(1, 9), ...battleInput(r, ['Rival 1', 'Rival 3', 'Us']) })),
    log: [],
  };
  return r.chance(0.5) ? JSON.stringify(file) : file;
}

/* A value for a draft casualty field, mostly one the form would offer. */
function casValue(r: Rng, w: World, f: keyof core.DraftCasualty, row: core.DraftCasualty | undefined): string {
  if (f === 'vSide' || f === 'aSide') return r.pick(['0', '1', '2', 'env', '']);
  if (f === 'vPick' || f === 'aPick') {
    const sideIdx = row ? (f === 'vPick' ? row.vSide : row.aSide) : 0;
    const side = w.bd?.sides[sideIdx as number];
    const opts = side ? core.sideModels(ctx(w.s), w.cf, side.key) : [];
    if (!opts.length || r.chance(0.15)) return r.pick(['', '999:0', 'f9']);
    const o = r.pick(opts);
    return o.dead ? `f${o.fallenIdx}` : `${o.uid}:${o.idx}`;
  }
  return r.pick(['', 'Grim', 'fell off a roof']);
}

function randomOp(r: Rng, w: World): Op | null {
  const a = L.app;
  const c = ctx(w.s);
  const districts = data.DISTRICTS.map((x) => x.id);
  // an open form is mostly filled in before anything else happens
  const op = w.bd && r.chance(0.45) ? 13 : w.cd && r.chance(0.3) ? 23 : r.int(0, 30);
  switch (op) {
    case 0: { const nm = r.pick(['Autumn', '']); return [`cfNew`, () => a.cfNew(nm), (x) => ({ ...x, cf: core.cfNew(nm) })]; }
    case 1: case 2: {
      const save = r.chance(0.9) ? structuredClone(r.pick(OTHERS)) : { wb: 'nope', models: [] };
      const player = r.pick(['', 'Anna', ' Ben ', 'Player 1']);
      return [`cfImportWarband ${save.name}`, () => a.cfImportWarband(structuredClone(save), player),
        (x) => ({ ...x, cf: core.cfImportWarband(data, x.cf, structuredClone(save), player, TODAY).cf })];
    }
    case 3: { const player = r.pick(['', 'Rob']); return ['cfAddCurrent', () => a.cfAddCurrent(player), (x) => ({ ...x, cf: core.cfAddCurrent(ctx(x.s), x.cf, player, TODAY).cf })]; }
    case 4: {
      if (!w.cf?.warbands.length) return null;
      const id = r.pick(w.cf.warbands).id;
      return [`cfRemoveWarband ${id}`, () => withDialogs([true], [], () => a.cfRemoveWarband(id)), (x) => ({ ...x, cf: x.cf ? core.cfRemoveWarband(x.cf, id) : x.cf })];
    }
    case 5: {
      if (r.chance(0.5)) { const v = r.pick(['Winter', '']); return ['cfSetName', () => a.cfSetName(v), (x) => ({ ...x, cf: x.cf ? core.cfSetName(x.cf, v) : x.cf })]; }
      const v = r.pick([0, 2, '3', -1]); return ['cfSetRound', () => a.cfSetRound(v), (x) => ({ ...x, cf: x.cf ? core.cfSetRound(x.cf, v) : x.cf })];
    }
    case 6: case 7: {
      const input = mergeInput(r);
      return ['cfMergeFrom', () => a.cfMergeFrom(structuredClone(input)), (x) => ({ ...x, cf: core.cfMergeFrom(ctx(x.s), x.cf, structuredClone(input), TODAY).cf })];
    }
    case 8: case 9: {
      const id = r.pick(districts);
      const cfId = w.cf?.warbands.length && r.chance(0.6) ? r.pick(w.cf.warbands).id : null;
      const on = r.chance(0.6);
      return [`cfToggleFoothold ${id} ${cfId} ${on}`, () => a.cfToggleFoothold(id, cfId, on), (x) => { const t = core.cfToggleFoothold(ctx(x.s), x.cf, id, cfId, on); return { ...x, s: t.s, cf: t.cf }; }];
    }
    case 10: {
      const terr = core.cfTerritory(c, w.cf);
      const id = terr.length && r.chance(0.8) ? r.pick(terr).id : r.pick(districts);
      return [`cfClearDistrict ${id}`, () => withDialogs([true], [], () => a.cfClearDistrict(id)), (x) => { const t = core.cfClearDistrict(ctx(x.s), x.cf, id); return { ...x, s: t.s, cf: t.cf }; }];
    }
    case 11: return ['openBattleForm', () => a.openBattleForm(), (x) => ({ ...x, bd: core.newBattleDraft(ctx(x.s)) })];
    case 12: {
      const bs = w.s.campaign?.battles ?? [];
      if (!bs.length) return null;
      const i = r.int(0, bs.length - 1);
      const idL = () => ((L.state.S.campaign?.battles ?? []) as { id: number }[])[i]?.id;
      return [`editBattleForm #${i}`, () => a.editBattleForm(idL()), (x) => ({ ...x, bd: core.battleDraftFor(ctx(x.s), (x.s.campaign?.battles ?? [])[i]!.id) ?? x.bd })];
    }
    case 13: case 14: case 15: case 16: case 17: case 18: {
      if (!w.bd) return null;
      const bd = w.bd;
      const k = r.int(0, 8);
      if (k === 0) return ['addDraftSideMe', () => a.addDraftSideMe(), (x) => ({ ...x, bd: x.bd && core.draftAddSideMe(ctx(x.s), x.bd) })];
      if (k === 1) {
        const keys = core.battleSides(c, w.cf).map((x) => x.key);
        const key = r.chance(0.3) ? '' : r.pick(keys);
        return [`addDraftSide ${key}`, () => a.addDraftSide(key), (x) => ({ ...x, bd: x.bd && core.draftAddSide(ctx(x.s), x.cf, x.bd, key) })];
      }
      if (k === 2) { const i = r.chance(0.3) ? 0 : r.int(0, bd.sides.length); return [`remDraftSide ${i}`, () => a.remDraftSide(i), (x) => ({ ...x, bd: x.bd && core.draftRemoveSide(x.bd, i) })]; }
      if (k === 3) {
        const i = r.int(0, bd.sides.length);
        const f = r.pick(['key', 'name', 'wb', 'outcome'] as const);
        const v = f === 'key' ? r.pick([...core.battleSides(c, w.cf).map((x) => x.key), 'cf99']) : f === 'wb' ? r.pick(Object.keys(data.WARBANDS)) : f === 'outcome' ? r.pick(['Victory', 'Defeat', 'Routed', '']) : r.pick(['Reikland Raiders', '']);
        return [`setDraftSide ${i} ${f}`, () => a.setDraftSide(i, f, v), (x) => ({ ...x, bd: x.bd && core.draftSetSide(ctx(x.s), x.cf, x.bd, i, f, v) })];
      }
      if (k === 4) return ['addDraftCas', () => a.addDraftCas(), (x) => ({ ...x, bd: x.bd && core.draftAddCasualty(x.bd) })];
      if (k === 5) { const i = r.int(0, bd.cas.length); return [`remDraftCas ${i}`, () => a.remDraftCas(i), (x) => ({ ...x, bd: x.bd && core.draftRemoveCasualty(x.bd, i) })]; }
      if (k === 6 || k === 7) {
        if (!bd.cas.length) return null;
        const i = r.int(0, bd.cas.length - 1);
        const f = r.pick(['vSide', 'vPick', 'vPick', 'vName', 'aSide', 'aPick', 'aPick', 'aName', 'note'] as const);
        const v = casValue(r, w, f, bd.cas[i]);
        return [`setDraftCas ${i} ${f}`, () => a.setDraftCas(i, f, v), (x) => ({ ...x, bd: x.bd && core.draftSetCasualty(x.bd, i, f, v) })];
      }
      const f = r.pick(['district', 'notes', 'round'] as const);
      const v = f === 'district' ? r.pick(['', ...districts]) : f === 'round' ? r.pick(['0', '1', '2']) : r.pick(['', 'Fog.']);
      return [`setDraftField ${f}`, () => a.setDraftField(f, v), (x) => ({ ...x, bd: x.bd && core.draftSetField(x.bd, f, v) })];
    }
    case 19: case 20: {
      if (!w.bd) return null;
      return ['saveBattleForm', () => a.saveBattleForm(), (x) => { const t = core.saveBattleDraft(ctx(x.s), x.cf, x.bd as core.BattleDraft); return { ...x, s: t.s, cf: t.cf, bd: null }; }];
    }
    case 21: return w.bd ? ['cancelBattleForm', () => a.cancelBattleForm(), (x) => ({ ...x, bd: null })] : null;
    case 22: return ['openCasForm', () => a.openCasForm(), (x) => ({ ...x, cd: core.newCasualtyDraft() })];
    case 23: case 24: {
      if (!w.cd) return null;
      const f = r.pick(['vSideKey', 'vPick', 'vPick', 'vName', 'aSideKey', 'aPick', 'aPick', 'aName', 'detail'] as const);
      const keys = ['me', 'env', '', ...core.battleSides(c, w.cf).map((x) => x.key)];
      let v: string;
      if (f === 'vSideKey' || f === 'aSideKey') v = r.pick(keys);
      else if (f === 'vPick' || f === 'aPick') {
        const opts = core.sideModels(c, w.cf, f === 'vPick' ? w.cd.vSideKey : w.cd.aSideKey);
        v = opts.length && r.chance(0.85) ? (() => { const o = r.pick(opts); return o.dead ? `f${o.fallenIdx}` : `${o.uid}:${o.idx}`; })() : r.pick(['', '1:0']);
      } else v = r.pick(['', 'Grim', 'a misfire']);
      return [`setCasField ${f}`, () => a.setCasField(f, v), (x) => ({ ...x, cd: x.cd && core.casualtyDraftSet(x.cd, f, v) })];
    }
    case 25: {
      if (!w.cd) return null;
      return ['saveCasForm', () => a.saveCasForm(), (x) => ({ ...x, s: core.saveCasualtyDraft(ctx(x.s), x.cf, x.cd as core.CasualtyDraft), cd: null })];
    }
    case 26: return w.cd ? ['cancelCasForm', () => a.cancelCasForm(), (x) => ({ ...x, cd: null })] : null;
    case 27: { const on = r.chance(0.8); return [`campToggle ${on}`, () => a.campToggle(on), (x) => ({ ...x, s: core.setCampaignOn(ctx(x.s), on) })]; }
    case 28: {
      const v = r.pick(['', 'x', 'null', '5', '{"districts":{"merchantsquarter":"foothold"}}', '{"campaign":{"on":false,"round":2}}', '{"campaign":7}']);
      // Legacy kept its open forms inside the campaign part of the save, so a
      // successful import replaced them too; the interface does the same.
      return [`importCampaignText ${v}`, () => a.importCampaignText(v), (x) => {
        const res = core.importCampaignData(ctx(x.s), v);
        return res.ok ? { ...x, s: res.s, bd: null, cd: null } : { ...x, s: res.s };
      }];
    }
    default: {
      // an ordinary roster action, so there is something to record
      const st = randomStep(r, data, w.s);
      if (!st) return null;
      const [label, legacyCall, coreCall] = st;
      return [`main ${label}`, legacyCall, (x) => ({ ...x, s: coreCall(ctx(x.s)) })];
    }
  }
}

const effective = new Map<string, number>();

function run(label: string, start: WarbandState, seed: number): void {
  L.load(start); L.state.resyncUid(); L.app.cfClose();
  let w: World = { s: core.normalizeState(ctx(structuredClone(start))), cf: null, bd: null, cd: null };
  compare(`${label}: start`, w);
  const r = rng(seed);
  const done: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    const op = randomOp(r, w);
    if (!op) continue;
    const [what, legacyCall, next] = op;
    done.push(what);
    legacyCall();
    const before = JSON.stringify(w);
    w = next(w);
    if (JSON.stringify(w) !== before) { const k = what.split(' ')[0] as string; effective.set(k, (effective.get(k) ?? 0) + 1); }
    compare(`${label}: after ${done.slice(-6).join(' → ')}`, w);
  }
}

function starts(): { label: string; state: WarbandState }[] {
  const out = generateFixtures(data, [3]).filter((_, i) => i % 11 === 0).map((f) => ({ label: f.label, state: f.state }));
  for (const wb of ['merc', 'skaven', 'possessed', 'orcmob', 'kislev', 'darkelves', 'undead', 'wh']) {
    let s: WarbandState = { ...core.newWarband(data, wb), campaign: { on: true, districts: {} } };
    for (const u of data.WARBANDS[wb]!.units.slice(0, 4)) s = core.addUnit(ctx(s), u.id);
    out.push({ label: `${wb} fresh`, state: s });
  }
  return out;
}

/* ---- scenarios: branches the walk reaches too rarely ---- */

function runOps(label: string, start: WarbandState, ops: Op[]): World {
  L.load(start); L.state.resyncUid(); L.app.cfClose();
  let w: World = { s: core.normalizeState(ctx(structuredClone(start))), cf: null, bd: null, cd: null };
  compare(`${label}: start`, w);
  const done: string[] = [];
  for (const [what, legacyCall, next] of ops) {
    done.push(what);
    legacyCall();
    w = next(w);
    compare(`${label}: ${done.join(' → ')}`, w);
  }
  return w;
}

/* Operations by name, for writing scenarios. */
const A = () => L.app;
const O = {
  rename: (v: string): Op => [`rename ${v}`, () => { L.state.S.name = v; }, (x) => ({ ...x, s: core.setWarbandName(ctx(x.s), v) })],
  cfNew: (): Op => ['cfNew', () => A().cfNew('C'), (x) => ({ ...x, cf: core.cfNew('C') })],
  addCurrent: (p = ''): Op => ['cfAddCurrent', () => A().cfAddCurrent(p), (x) => ({ ...x, cf: core.cfAddCurrent(ctx(x.s), x.cf, p, TODAY).cf })],
  importWb: (save: WarbandState, p = ''): Op => [`import ${save.name}`, () => A().cfImportWarband(structuredClone(save), p), (x) => ({ ...x, cf: core.cfImportWarband(data, x.cf, structuredClone(save), p, TODAY).cf })],
  merge: (input: unknown): Op => ['merge', () => A().cfMergeFrom(structuredClone(input)), (x) => ({ ...x, cf: core.cfMergeFrom(ctx(x.s), x.cf, structuredClone(input), TODAY).cf })],
  addBattle: (b: core.BattleInput): Op => ['addBattle', () => A().addBattle(structuredClone(b)), (x) => ({ ...x, s: core.addBattle(ctx(x.s), structuredClone(b)) })],
  toggle: (id: string, cfId: number | null, on: boolean): Op => [`toggle ${id} ${cfId} ${on}`, () => A().cfToggleFoothold(id, cfId, on), (x) => { const t = core.cfToggleFoothold(ctx(x.s), x.cf, id, cfId, on); return { ...x, s: t.s, cf: t.cf }; }],
  open: (): Op => ['openBattleForm', () => A().openBattleForm(), (x) => ({ ...x, bd: core.newBattleDraft(ctx(x.s)) })],
  edit: (i: number): Op => [`edit #${i}`, () => A().editBattleForm(((L.state.S.campaign?.battles ?? []) as { id: number }[])[i]?.id), (x) => ({ ...x, bd: core.battleDraftFor(ctx(x.s), (x.s.campaign?.battles ?? [])[i]!.id) ?? x.bd })],
  addSide: (key: string): Op => [`addSide ${key}`, () => A().addDraftSide(key), (x) => ({ ...x, bd: x.bd && core.draftAddSide(ctx(x.s), x.cf, x.bd, key) })],
  setSide: (i: number, f: keyof core.DraftSide, v: string): Op => [`setSide ${i} ${f}=${v}`, () => A().setDraftSide(i, f, v), (x) => ({ ...x, bd: x.bd && core.draftSetSide(ctx(x.s), x.cf, x.bd, i, f, v) })],
  remSide: (i: number): Op => [`remSide ${i}`, () => A().remDraftSide(i), (x) => ({ ...x, bd: x.bd && core.draftRemoveSide(x.bd, i) })],
  addCas: (): Op => ['addCas', () => A().addDraftCas(), (x) => ({ ...x, bd: x.bd && core.draftAddCasualty(x.bd) })],
  setCas: (i: number, f: keyof core.DraftCasualty, v: string): Op => [`setCas ${i} ${f}=${v}`, () => A().setDraftCas(i, f, v), (x) => ({ ...x, bd: x.bd && core.draftSetCasualty(x.bd, i, f, v) })],
  field: (f: 'round' | 'district' | 'notes', v: string): Op => [`field ${f}=${v}`, () => A().setDraftField(f, v), (x) => ({ ...x, bd: x.bd && core.draftSetField(x.bd, f, v) })],
  save: (): Op => ['saveBattleForm', () => A().saveBattleForm(), (x) => { const t = core.saveBattleDraft(ctx(x.s), x.cf, x.bd as core.BattleDraft); return { ...x, s: t.s, cf: t.cf, bd: null }; }],
  openCas: (): Op => ['openCasForm', () => A().openCasForm(), (x) => ({ ...x, cd: core.newCasualtyDraft() })],
  casField: (f: keyof core.CasualtyDraft, v: string): Op => [`casField ${f}=${v}`, () => A().setCasField(f, v), (x) => ({ ...x, cd: x.cd && core.casualtyDraftSet(x.cd, f, v) })],
  saveCas: (): Op => ['saveCasForm', () => A().saveCasForm(), (x) => ({ ...x, s: core.saveCasualtyDraft(ctx(x.s), x.cf, x.cd as core.CasualtyDraft), cd: null })],
  kill: (uid: number): Op => [`killHero ${uid}`, () => A().killHero(uid), (x) => ({ ...x, s: core.killHero(ctx(x.s), uid) })],
  advance: (): Op => ['advanceRound', () => A().advanceRound(), (x) => ({ ...x, s: core.advanceRound(ctx(x.s), TODAY) })],
};

function scenarioStart(): WarbandState {
  let s: WarbandState = { ...core.newWarband(data, 'merc'), name: 'Silver Caravan', campaign: { on: true, districts: {} } };
  for (const u of ['capt', 'champ', 'warr', 'mark']) s = core.addUnit(ctx(s), u);
  s = core.setQty(ctx(s), s.models[2]!.uid, 3);
  expect(s.models.map((m) => m.uid_def)).toEqual(['capt', 'champ', 'warr', 'mark']);
  expect(s.models[2]!.qty).toBe(3);
  return s;
}
const RIVAL = { ...(OTHERS[0] as WarbandState), name: 'Rival Band' };
const DISTRICT = data.DISTRICTS[0]!.id;

describe('campaign file parity: scenarios', () => {
  it('re-importing a warband under a differently cased name updates it', () => {
    runOps('case', scenarioStart(), [O.importWb(RIVAL, 'Anna'), O.importWb({ ...RIVAL, name: 'RIVAL band' }), O.importWb({ ...RIVAL, name: 'rival band ' }, 'Ben')]);
  });

  it('our own warband is not offered twice, whatever the case of its name', () => {
    runOps('self', scenarioStart(), [O.cfNew(), O.addCurrent('Rob'), O.rename('SILVER CARAVAN'), O.importWb(RIVAL), O.open(), O.addSide('cf2')]);
  });

  it('a battle both sides wrote down is merged once', () => {
    const ours: core.BattleInput = { round: 1, district: DISTRICT, sides: [{ key: 'me', name: 'Silver Caravan', wb: 'merc', outcome: 'Victory' }, { key: '', name: 'Rival Band', wb: RIVAL.wb as string, outcome: 'Defeat' }] };
    const theirs = { round: 1, district: DISTRICT, sides: [{ key: 'me', name: 'rival band', outcome: 'Victory' }, { key: '', name: 'SILVER CARAVAN', outcome: 'Defeat' }] };
    const other = { round: 2, district: '', sides: [{ name: 'Rival Band' }, { name: 'Third' }] };
    const file = { type: core.CF_TYPE, version: 1, name: 'x', round: 1, warbands: [], battles: [theirs, other, { ...other, sides: [{ name: 'third' }, { name: 'rival band' }] }], log: [] };
    runOps('merge', scenarioStart(), [O.addBattle(ours), O.merge(file), O.merge(file), O.merge({ ...RIVAL, campaign: { battles: [theirs, other] } })]);
  });

  it('the map follows every outcome, for us and for others', () => {
    for (const outcome of ['Victory', 'Defeat', 'Routed', 'Draw']) for (const theirs of ['Victory', 'Routed']) {
      runOps(`map ${outcome}/${theirs}`, scenarioStart(), [
        O.cfNew(), O.importWb(RIVAL), O.toggle(DISTRICT, null, true), O.toggle(DISTRICT, 1, true),
        O.open(), O.addSide('cf1'), O.setSide(0, 'outcome', outcome), O.setSide(1, 'outcome', theirs), O.field('district', DISTRICT), O.save(),
        // a battle between others only
        O.open(), O.addSide('cf1'), O.addSide(''), O.setSide(2, 'name', 'Third'), O.setSide(1, 'outcome', outcome), O.remSide(0), O.field('district', DISTRICT), O.save(),
      ]);
    }
  });

  it('removing a side renumbers the casualties that name later sides', () => {
    for (const i of [0, 1, 2]) {
      runOps(`remSide ${i}`, scenarioStart(), [
        O.cfNew(), O.importWb(RIVAL), O.open(), O.addSide('cf1'), O.addSide(''), O.setSide(2, 'name', 'Third'),
        O.addCas(), O.setCas(0, 'vSide', '2'), O.setCas(0, 'aSide', '1'), O.setCas(0, 'vName', 'Stranger'),
        O.addCas(), O.setCas(1, 'vSide', '1'), O.setCas(1, 'aSide', '0'), O.setCas(1, 'aPick', `${scenarioStart().models[0]!.uid}:0`),
        O.addCas(), O.setCas(2, 'vSide', '0'), O.setCas(2, 'vPick', `${scenarioStart().models[2]!.uid}:1`), O.setCas(2, 'aSide', 'env'), O.setCas(2, 'note', 'fell'),
        O.remSide(i), O.save(),
      ]);
    }
  });

  it('editing a battle corrects its casualties', () => {
    const st = scenarioStart();
    runOps('edit', st, [
      O.open(), O.addSide(''), O.setSide(1, 'name', 'Raiders'), O.addCas(), O.setCas(0, 'vSide', '0'), O.setCas(0, 'vPick', `${st.models[1]!.uid}:0`),
      O.setCas(0, 'aSide', '1'), O.setCas(0, 'aName', 'Big Orc'), O.setCas(0, 'note', 'first'), O.addCas(), O.setCas(1, 'vName', 'Goblin'), O.save(),
      O.edit(0), O.setCas(0, 'note', 'second'), O.setCas(0, 'aName', ''), O.setSide(1, 'name', 'Raiders of the Rock'), O.save(),
      O.edit(0), O.remSide(1), O.save(),
    ]);
  });

  it('a casualty picked from the Fallen is recorded dead and tied to the battle of the round', () => {
    const st = scenarioStart();
    runOps('fallen', st, [
      O.addBattle({ round: 0, sides: [{ key: 'me', name: 'Silver Caravan', wb: 'merc', outcome: 'Defeat' }] }), O.advance(),
      O.addBattle({ round: 1, sides: [{ key: 'me', name: 'Silver Caravan', wb: 'merc', outcome: 'Victory' }] }),
      O.kill(st.models[1]!.uid), O.openCas(), O.casField('vPick', 'f0'), O.casField('detail', 'bled out'), O.saveCas(),
      O.openCas(), O.casField('vSideKey', ''), O.casField('vName', 'Nobody'), O.casField('aSideKey', 'me'), O.casField('aPick', `${st.models[0]!.uid}:0`), O.saveCas(),
    ]);
  });
});

describe('campaign file parity: legacy app vs core', () => {
  it.each(starts().map((x) => [x.label, x] as const))('%s', (_l, x) => { run(x.label, x.state, hash(`cf|${x.label}`)); });

  it('exercised every operation', () => {
    const ops = ['cfNew', 'cfImportWarband', 'cfAddCurrent', 'cfRemoveWarband', 'cfSetName', 'cfSetRound', 'cfMergeFrom',
      'cfToggleFoothold', 'cfClearDistrict', 'openBattleForm', 'editBattleForm', 'addDraftSideMe', 'addDraftSide', 'remDraftSide',
      'setDraftSide', 'addDraftCas', 'remDraftCas', 'setDraftCas', 'setDraftField', 'saveBattleForm', 'cancelBattleForm',
      'openCasForm', 'setCasField', 'saveCasForm', 'cancelCasForm', 'campToggle', 'importCampaignText'];
    const low = ops.filter((o) => (effective.get(o) ?? 0) < 5).map((o) => `${o}: ${effective.get(o) ?? 0}`);
    expect(low).toEqual([]);
  });
});

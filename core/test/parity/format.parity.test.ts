/* Loading saves: core's loadSave and readSaveText against the legacy app's
 * applyState and importText — on every generated warband, on its exports,
 * on the frozen old save of test/compat.mjs, and on saves with keys torn
 * out at random, since files written by older versions lack them. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { rng, type Rng } from '../support/random.ts';
import { canonOf, data, hash, useLegacy } from './walk.ts';

let L: Legacy;
/* What legacy flashed last (its messages go to a toast element). */
let flashed = '';
beforeAll(async () => {
  L = await loadLegacy(); useLegacy(L);
  const doc = (globalThis as unknown as { document: { createElement: (t: string) => unknown } }).document;
  const orig = doc.createElement;
  doc.createElement = (t: string) => {
    const el = orig(t) as Record<string, unknown>;
    return new Proxy(el, { set(o, k, v) { if (k === 'textContent') flashed = String(v); o[k as string] = v; return true; } });
  };
});

/* Frozen copy of the old save in test/compat.mjs. */
const OLD_SAVE = {
  wb: 'skaven', subtype: null, name: 'Alte Bande', budget: 500,
  models: [
    { uid: 1, uid_def: 'adept', name: 'Assassin Adept', exp: 20, qty: 1, eq: { Schwert: 1 }, mut: [], adv: {}, skills: [], inj: [], spells: [] },
    { uid: 2, uid_def: 'vermin', name: 'Verminkin', exp: 5, qty: 3, eq: { 'Dolch (1. gratis)': 1 }, mut: [], adv: {}, skills: [], inj: [], spells: [] },
  ],
  hired: [], dp: [], leaderUid: 1,
  campaign: { on: false, districts: {} },
  stash: { wyrd: 0, gold: 120, items: [] },
  house: { startGold: '', min: '', max: '', heroes: 6, priceAll: 100 },
};

function legacyLoad(save: unknown): unknown {
  L.app.applyState(structuredClone(save));
  return canonOf(L.state.S);
}

function coreLoad(save: unknown): unknown {
  const r = core.loadSave(data, structuredClone(save));
  if (!r.ok) throw new Error(r.msg);
  return canonOf(r.state);
}

/* A save as an older or damaged file might have it. */
function tear(r: Rng, save: Record<string, unknown>): Record<string, unknown> {
  const s = structuredClone(save) as Record<string, unknown> & { models: Record<string, unknown>[] };
  const top = ['subtype', 'name', 'budget', 'hired', 'dp', 'leaderUid', 'campaign', 'stash', 'fallen', 'house', 'mark', 'goldNow'];
  for (const k of top) if (r.chance(0.2)) delete s[k];
  if (r.chance(0.1)) s.leaderUid = 0;
  if (r.chance(0.1)) s.stash = 'gold';
  if (r.chance(0.15) && s.stash && typeof s.stash === 'object') delete (s.stash as Record<string, unknown>).items;
  if (r.chance(0.15) && s.house && typeof s.house === 'object') for (const k of Object.keys(s.house as object)) if (r.chance(0.5)) delete (s.house as Record<string, unknown>)[k];
  if (r.chance(0.3)) s.goldNow = r.pick([0, 55, '120', 'x', null]);
  for (const m of s.models ?? []) for (const k of ['eq', 'mut', 'adv', 'skills', 'inj', 'spells', 'rare', 'names']) if (r.chance(0.1)) delete m[k];
  return s;
}

const fixtures = generateFixtures(data, [1]);

describe('loading saves: legacy applyState vs core loadSave', () => {
  it('the frozen old save of test/compat.mjs', () => {
    expect(coreLoad(OLD_SAVE)).toEqual(legacyLoad(OLD_SAVE));
  });

  it.each(fixtures.filter((_, i) => i % 2 === 0).map((f) => [f.label, f] as const))('%s', (_l, f) => {
    // as generated, as legacy exports it (with goldNow), and torn at random
    expect(coreLoad(f.state), 'as generated').toEqual(legacyLoad(f.state));
    L.load(f.state); L.state.resyncUid(); L.app.render();
    const exported = JSON.parse(JSON.stringify(L.app.exportState())) as Record<string, unknown>;
    expect(coreLoad(exported), 'legacy export').toEqual(legacyLoad(exported));
    const r = rng(hash(f.label));
    for (let i = 0; i < 4; i++) {
      const torn = tear(r, exported);
      expect(coreLoad(torn), `torn ${i}: ${JSON.stringify(Object.keys(torn))}`).toEqual(legacyLoad(torn));
    }
  });

  /* A treasury still at "starting gold" (null) comes back as that amount:
     loading adopts the gold in hand the file states. Same value, so the
     round trip compares the treasury as a number. */
  const withTreasury = (st: WarbandState) => canonOf({ ...st, stash: { ...st.stash, gold: core.goldTreasury(core.ctxOf(data, st)) } });

  it('round trip: what core writes, core reads back unchanged', () => {
    for (const f of fixtures.filter((_, i) => i % 5 === 0)) {
      const first = core.loadSave(data, structuredClone(f.state));
      if (!first.ok) throw new Error(first.msg);
      const s = first.state;
      const written = JSON.parse(JSON.stringify(core.writeSave(core.ctxOf(data, s), 'test'))) as Record<string, unknown>;
      expect(written.format).toBe(core.FORMAT);
      const back = core.loadSave(data, written);
      expect(back.ok && withTreasury(back.state), f.label).toEqual(withTreasury(s));
      // and the legacy app reads it the same way
      L.app.applyState(structuredClone(written));
      expect(withTreasury(JSON.parse(JSON.stringify(L.state.S)) as WarbandState), `${f.label} in legacy`).toEqual(withTreasury(s));
    }
  });
});

describe('reading pasted text: legacy importText vs core readSaveText', () => {
  const cases = (): [string, string][] => {
    const f = fixtures[7]!;
    L.load(f.state); L.state.resyncUid(); L.app.render();
    const text = L.app.buildText() as string;
    const json = JSON.stringify(L.app.exportState());
    return [
      ['readable text', text], ['raw JSON', json], ['JSON in chatter', `here it is: ${json} thanks`],
      ['text with broken data line', text.replace(/MORDHEIM-DATA: \{/, 'MORDHEIM-DATA: {{')],
      ['old save as text', 'Roster text\nMORDHEIM-DATA: ' + JSON.stringify(OLD_SAVE)],
      ['empty', '   '], ['garbage', 'hello'], ['broken JSON', '{ "wb": '],
      ['BattleScribe', JSON.stringify({ roster: { forces: [] } })], ['unknown warband', JSON.stringify({ wb: 'nope', models: [] })],
    ];
  };

  it('agrees on every kind of input', () => {
    for (const [label, input] of cases()) {
      L.load(OLD_SAVE); L.state.resyncUid();
      const before = JSON.stringify(L.state.S);
      flashed = '';
      L.app.importText(input);
      const res = core.readSaveText(data, input);
      if (res.ok) {
        expect(flashed, label).toBe('Imported.');
        expect(canonOf(res.state), label).toEqual(canonOf(L.state.S));
      } else {
        expect(res.msg, label).toBe(flashed);
        expect(JSON.stringify(L.state.S), `${label}: legacy unchanged`).toBe(before);
      }
    }
  });
});

describe('the schema', () => {
  it('accepts every generated warband and its export without notes', () => {
    for (const f of fixtures.filter((_, i) => i % 3 === 0)) {
      const s = core.normalizeState(core.ctxOf(data, structuredClone(f.state)));
      expect(core.schemaNotes(core.warbandSaveSchema, JSON.parse(JSON.stringify(core.writeSave(core.ctxOf(data, s))))), f.label).toEqual([]);
    }
    expect(core.loadSave(data, OLD_SAVE).ok && (core.loadSave(data, OLD_SAVE) as { notes: string[] }).notes).toEqual([]);
  });

  it('reports what does not fit, and still loads it', () => {
    const odd = { ...structuredClone(OLD_SAVE), models: [{ ...OLD_SAVE.models[0], uid: 'one' }] };
    const r = core.loadSave(data, odd);
    expect(r.ok).toBe(true);
    expect(r.ok && r.notes.some((n) => n.startsWith('models.0.uid'))).toBe(true);
  });

  it('accepts a campaign file as core writes it', () => {
    let s: WarbandState = { ...core.newWarband(data, 'merc'), campaign: { on: true, districts: {} } };
    s = core.addUnit(core.ctxOf(data, s), 'capt');
    const cf = core.cfAddCurrent(core.ctxOf(data, s), null, 'Rob', '2026-09-27').cf;
    expect(core.schemaNotes(core.campaignFileSchema, JSON.parse(JSON.stringify(cf)))).toEqual([]);
  });
});

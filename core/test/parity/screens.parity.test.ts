/* The rules behind the screens: warnings, unit list, recruit menu,
   abilities (screens.ts), plus the pure helpers the lists use — on every
   generated warband, and on every text and entry in the data. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { HireEntry, WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { rng } from '../support/random.ts';
import { coreScreens, coreTip, coreWarbandOptions, legacyScreens, parseTip, parseWarbandOptions } from './screens.ts';
import { data, useLegacy } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const fixtures = generateFixtures(data, [1, 2]);

describe('screen rules parity: legacy app vs core', () => {
  it.each(fixtures.map((f) => [f.label, f] as const))('%s', (_l, f) => {
    L.load(f.state); L.state.resyncUid(); L.app.render();
    const s = core.normalizeState(core.ctxOf(data, structuredClone(f.state) as WarbandState));
    expect(coreScreens(core.ctxOf(data, s))).toEqual(legacyScreens(L));
  });

  it('the fixtures raise warnings of every kind the data can', () => {
    const seen = new Set<string>();
    for (const f of fixtures) for (const w of core.warbandWarnings(core.ctxOf(data, core.normalizeState(core.ctxOf(data, structuredClone(f.state)))))) seen.add(w.replace(/[\d]+/g, 'N').slice(0, 30));
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});

describe('list helpers', () => {
  it('skillChipsIn finds the same skills in every rules text', () => {
    const texts = [
      ...Object.values(data.WARBANDS).flatMap((w) => w.units.map((u) => u.sp ?? '')),
      ...Object.values(data.HIREDSWORDS).map((e) => e.sp ?? ''), ...Object.values(data.DRAMATIS).map((e) => e.sp ?? ''),
    ];
    for (const t of texts) expect(core.skillChipsIn(data, t), t.slice(0, 60)).toEqual(L.app.skillChipsIn(t));
    expect(core.skillNameList(data)).toEqual(L.app.skillNameList());
  });

  it('abilityMentioned agrees on every ability in every rules text', () => {
    const texts = Object.values(data.WARBANDS).flatMap((w) => w.units.map((u) => u.sp ?? ''));
    for (const t of texts) for (const [re] of data.ABILITYINFO) expect(core.abilityMentioned(re, t)).toBe(L.app.abilityMentioned(re, t));
  });

  it('the warband picker groups and orders alike', () => {
    expect(coreWarbandOptions(data)).toEqual(parseWarbandOptions(L.app.warbandOptions('') as string));
  });

  it('a tooltip shows the same entry for every name the app can show one for', () => {
    const names = new Set<string>(['', 'Nimble', 'Skink Hunter', 'Wyrdstone Hunter', 'Fear', '___no_such_thing___']);
    for (const it of data.CATALOG) { names.add(it.de); if (it.en) names.add(it.en); }
    for (const nm of core.skillNameList(data)) names.add(nm);
    for (const set of Object.values(data.SKILLSETS)) for (const [nm] of set.skills ?? []) names.add(nm);
    for (const lore of Object.values(data.SPELLS)) for (const [nm] of lore.spells) names.add(nm);
    for (const [, info] of data.ABILITYINFO) names.add(info.name);
    for (const nm of names) expect(coreTip(data, nm), nm).toEqual(parseTip(L.info.itipBuild(nm)));
  });

  it('the Hired Sword filters agree on random filters', () => {
    const r = rng(11);
    const entries: HireEntry[] = [...Object.values(data.HIREDSWORDS), ...Object.values(data.DRAMATIS)];
    for (let i = 0; i < 400; i++) {
      const f: core.HireFilter = { q: r.pick(['', 'o', 'dwarf', 'X']), stat: r.pick(['', 'WS', 'S', 'M', 'Ld']), op: r.pick(['>=', '>', '=', '<=', '<'] as const), val: r.pick(['', '3', 4, 'x']) };
      for (const e of entries) expect(core.passStatFilter(e, f), `${e.name} ${JSON.stringify(f)}`).toBe(L.app.passStatFilter(e, f));
    }
  });

  it('fixedSkills agree for every hire with a persona', () => {
    for (const f of fixtures.filter((x) => (x.state.hired ?? []).length)) {
      L.load(f.state); L.state.resyncUid(); L.app.render();
      const s = core.normalizeState(core.ctxOf(data, structuredClone(f.state)));
      for (const rec of s.hired ?? []) {
        const e = data.HIREDSWORDS[rec.key];
        if (!e) continue;
        const lrec = (L.state.S.hired as { key: string; opt?: string }[]).find((x) => x.key === rec.key && x.opt === rec.opt);
        expect(core.fixedSkills(core.ctxOf(data, s), e, rec), rec.key).toEqual(L.app.fixedSkills(e, lrec));
      }
    }
  });
});

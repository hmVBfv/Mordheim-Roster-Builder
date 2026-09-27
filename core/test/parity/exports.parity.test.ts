/* Export parity on the generated fixtures: the readable text with its
   embedded save, the Tabletop Simulator cards, equipment and rule texts,
   declared house rules, the chronicle text and file names must read the same
   in the legacy app and in core. The walk (walk.ts) checks the same report
   on the campaign states it reaches. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { coreExportReport, legacyExportReport } from './exportReport.ts';
import { canonOf, data, useLegacy } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const fixtures = generateFixtures(data, [1]);

describe('export parity: legacy app vs core', () => {
  it.each(fixtures.map((f) => [f.label, f] as const))('%s', (_l, f) => {
    L.load(f.state); L.state.resyncUid(); L.app.render();
    const s = core.normalizeState(core.ctxOf(data, structuredClone(f.state) as WarbandState));
    expect(coreExportReport(core.ctxOf(data, s), canonOf)).toEqual(legacyExportReport(L, data, canonOf));
  });
});

describe('rule text parity', () => {
  it('enRules, translateTerms and ruleNameEN agree on every unit and hire', () => {
    const sps = [
      ...Object.values(data.WARBANDS).flatMap((w) => w.units.map((u) => u.sp ?? '')),
      ...Object.values(data.HIREDSWORDS).map((e) => e.sp ?? ''), ...Object.values(data.DRAMATIS).map((e) => e.sp ?? ''),
    ];
    for (const sp of sps) expect(core.enRules(data, sp), sp).toEqual(L.app.enRules(sp));
  });

  it('item, skill, ability, spell and mutation names agree', () => {
    const items = [...new Set([...Object.values(data.LISTS).flatMap((l) => Object.values(l).flat().map((e) => e[0])), ...data.CATALOG.map((c) => c.de)])];
    for (const nm of items) expect(core.enItem(data, nm), nm).toBe(L.app.enItem(nm));
    const skills = [...Object.values(data.SKILLLISTS), ...Object.values(data.SKILLSETS)].flatMap((l) => l.skills.map((x) => x[0]));
    for (const nm of [...skills, 'Nope']) {
      expect(core.skillInfo(data, nm), nm).toEqual(L.info.skillInfo(nm));
      expect(core.skillText(data, nm), nm).toBe(L.app.skillText(nm));
      expect(core.abilityInfo(data, nm), nm).toEqual(L.info.abilityInfo(nm));
    }
    for (const lore of Object.values(data.SPELLS)) for (const [nm] of lore.spells) expect(core.spellInfo(data, nm), nm).toEqual(L.info.spellInfo(nm));
    for (const [nm] of data.MUTATIONS) expect(core.mutEN(data, nm)).toBe(L.app.mutEN(nm));
    for (const k of Object.keys(data.MAXPROF)) expect(core.raceEN(data, k)).toBe(L.app.raceEN(k));
    for (const j of data.INJURIES) expect(core.injModText(j)).toBe(L.app.injModText(j));
  });
});

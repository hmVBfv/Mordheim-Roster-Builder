/* Parity on saves from the running campaign (phase 1d).
 *
 * The generated fixtures cover every warband and feature, but only in the
 * shapes the generator knows. The files in core/test/saves/ are what players
 * actually have: warband saves as the legacy app wrote them, at every age,
 * and the leader's campaign file. Each one is loaded by both apps and
 * compared; every warband then takes random walks from where the campaign
 * left it; a campaign file is opened next to each warband it holds.
 *
 * The files are cleaned with core/scripts/sanitize-save.ts before they are
 * committed. The first test fails on any file that is not, so no note a
 * player wrote reaches the public repository unnoticed. */
import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { cfCanon } from '../support/canon.ts';
import { coreCfReport, legacyCfReport } from './cfReport.ts';
import { canonOf, data, hash, runSequence, useLegacy } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const DIR = new URL('../saves/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ file: f, raw: JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Record<string, unknown> }));
const isCampaignFile = (raw: Record<string, unknown>) => raw.type === core.CF_TYPE;
const saves = files.filter((x) => !isCampaignFile(x.raw));
const campaigns = files.filter((x) => isCampaignFile(x.raw)).map((x) => ({ ...x, cf: x.raw as unknown as core.CampaignFile }));

/* Walks per warband, each from its own seed. */
const WALKS = 2;

function coreLoad(raw: unknown): WarbandState {
  const r = core.loadSave(data, structuredClone(raw));
  if (!r.ok) throw new Error(r.msg);
  return r.state;
}

function legacyLoad(raw: unknown): void {
  L.app.applyState(structuredClone(raw));
}

describe('saves from the running campaign', () => {
  it('holds warband saves and a campaign file', () => {
    expect(saves.length).toBeGreaterThan(0);
    expect(campaigns.length).toBeGreaterThan(0);
  });

  it.each(files.map((x) => [x.file, x.raw] as const))('%s is sanitized', (_f, raw) => {
    expect(core.sanitizeSave(data, raw)).toEqual(raw);
  });
});

describe('saves from the running campaign: legacy app vs core', () => {
  it.each(saves.map((x) => [x.file, x.raw] as const))('%s loads the same', (_f, raw) => {
    legacyLoad(raw);
    expect(canonOf(coreLoad(raw))).toEqual(canonOf(L.state.S));
  });

  const walks = saves.flatMap((x) => Array.from({ length: WALKS }, (_, k) => [`${x.file} walk ${k + 1}`, x.raw] as const));
  it.each(walks)('%s', (label, raw) => {
    runSequence(label, { legacy: () => legacyLoad(raw), core: coreLoad(raw) }, hash(label));
  });
});

describe('campaign files from the running campaign: legacy app vs core', () => {
  it.each(campaigns.map((x) => [x.file, x.raw] as const))('%s opens the same', (_f, raw) => {
    const r = core.cfReadFile(structuredClone(raw));
    expect(r.ok).toBe(true);
    expect(L.app.cfImportFile(structuredClone(raw))).toEqual({ ok: true });
    expect(cfCanon(r.cf)).toEqual(cfCanon(L.app.cfGet()));
  });

  /* Every warband of the file as the one open in the builder. */
  const members = campaigns.flatMap((x) => x.cf.warbands.map((w) => [`${x.file}: ${w.name}`, x.raw, w.roster] as const));
  it.each(members)('%s', (label, raw, roster) => {
    legacyLoad(roster);
    L.state.resyncUid(); L.app.render();
    L.app.cfImportFile(structuredClone(raw));
    const s = coreLoad(roster);
    const cf = core.cfReadFile(structuredClone(raw)).cf;
    expect(canonOf(s), `${label}: warband`).toEqual(canonOf(L.state.S));
    expect(coreCfReport(core.ctxOf(data, s), cf), `${label}: reports`).toEqual(legacyCfReport(L));
    runSequence(label, { legacy: () => legacyLoad(roster), core: s }, hash(label));
  });
});

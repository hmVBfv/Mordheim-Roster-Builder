/* What the exports say about a warband, asked of either implementation:
   the readable text (with its embedded save compared in canonical form),
   the Tabletop Simulator cards, the equipment and rule texts, the house
   rules as declared, the chronicle text and the file names. Used by
   exports.parity.test.ts on the generated fixtures and by the walk on the
   states it reaches. */
import * as core from '../../src/index.ts';
import type { Ctx, GameData, HireRecord, Model, WarbandState } from '../../src/index.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';

const TODAY = '2026-09-27';

/* The embedded save is compared through `canon`; the date legacy stamps from
   the clock is replaced. */
export function splitText(t: string, canon: (s: unknown) => unknown): { lines: string[]; save: unknown } {
  const lines = t.split('\n');
  const last = lines.pop() as string;
  const json = last.replace(/^MORDHEIM-DATA: /, '');
  const save = JSON.parse(json) as Record<string, unknown>;
  const goldNow = save.goldNow;
  delete save.goldNow;
  return { lines, save: { goldNow, state: canon(save) } };
}

const undated = (name: string) => name.replace(/\d{4}-\d{2}-\d{2}$/, 'DATE');

export function coreExportReport(ctx: Ctx, canon: (s: unknown) => unknown): unknown {
  const s = ctx.s;
  const models = s.models;
  const rec = (list: HireRecord[] | undefined, tab: 'HIREDSWORDS' | 'DRAMATIS') => (list ?? []).map((r) => {
    const e = ctx.data[tab][r.key];
    return e ? core.ttsTextHS(ctx, e, r.name, r) : null;
  });
  return {
    text: splitText(core.buildText(ctx), canon),
    tts: models.map((m) => [core.ttsName(ctx, m), core.ttsText(ctx, m)]),
    hs: rec(s.hired, 'HIREDSWORDS'), dp: rec(s.dp, 'DRAMATIS'),
    eq: models.map((m: Model) => [core.eqDisplayParts(ctx, m), core.eqSummaryParts(ctx, m), core.rareDisplayParts(ctx, m), core.markRulesFor(ctx, m)]),
    fallen: core.fallenEqAgg(ctx, (s.fallen ?? []).map((f) => f.m)),
    house: core.houseDeviations(ctx),
    names: [core.wbTypeSlug(ctx), core.safeName(ctx), undated(core.stampedName(ctx, TODAY))],
    narrative: core.narrativeReport(ctx),
    campaign: [JSON.parse(core.campaignJSON(ctx)).name, core.campaignTextReport(ctx)],
  };
}

export function legacyExportReport(L: Legacy, data: GameData, canon: (s: unknown) => unknown): unknown {
  const a = L.app, t = L.tts, S = L.state.S as WarbandState;
  // the entries are handed in as the data defines them; legacy only reads them
  const rec = (list: HireRecord[] | undefined, tab: Record<string, unknown>) => (list ?? []).map((r) => {
    const e = tab[r.key];
    return e ? t.ttsTextHS(e, r.name, r) : null;
  });
  return {
    text: splitText(a.buildText(), canon),
    tts: S.models.map((m) => [t.ttsName(m), t.ttsText(m)]),
    hs: rec(S.hired, data.HIREDSWORDS), dp: rec(S.dp, data.DRAMATIS),
    eq: S.models.map((m) => [a.eqDisplayParts(m), a.eqSummaryParts(m), a.rareDisplayParts(m), a.markRulesFor(m)]),
    fallen: a.fallenEqAgg((S.fallen ?? []).map((f) => f.m)),
    house: a.houseDeviations(),
    names: [a.wbTypeSlug(), a.safeName(), undated(a.stampedName())],
    narrative: a.narrativeReport(),
    campaign: [JSON.parse(a.campaignJSON()).name, a.campaignTextReport()],
  };
}

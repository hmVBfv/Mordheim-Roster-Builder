/* What the read-only functions say about an open campaign file, asked of
   either implementation: the sides a battle can name and their warriors,
   territory and control, statistics, experience, the merged history and the
   hiring discounts. Used by the campaign-file walk and by the suite over
   saves from the running campaign. */
import * as core from '../../src/index.ts';
import type { Ctx, WarbandState } from '../../src/index.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';

type Rec = Record<string, unknown>;

/* A list compared as a multiset, without chronicle ids. */
function bag(xs: Rec[]): string[] {
  return xs.map((x) => {
    const rest = { ...x };
    delete rest.id;
    delete rest.data;
    return JSON.stringify(rest);
  }).sort();
}

const HIRE_KEYS = ['ogre', 'elfranger', 'warlock', 'halflingscout'];

/* Experience overview without the entries' chronicle ids. */
const xpRows = (xs: { rows: Rec[] }[]) => xs.map((o) => ({ ...o, rows: o.rows.map((x) => { const y = { ...x }; delete y.id; return y; }) }));

export function coreCfReport(c: Ctx, cf: core.CampaignFile | null): unknown {
  const sides = core.battleSides(c, cf);
  const terr = core.cfTerritory(c, cf);
  return {
    sides, models: sides.map((x) => core.sideModels(c, cf, x.key)),
    terr, status: terr.map((t) => core.districtStatus(c, cf, t.id)),
    stats: core.cfStats(cf), xp: xpRows(core.cfXpOverview(cf, c.s.campaign?.round ?? 0) as unknown as { rows: Rec[] }[]),
    log: bag(core.cfMergedLog(cf) as unknown as Rec[]), battles: bag(core.cfAllBattles(cf)), merged: bag(core.cfAllBattlesMerged(c, cf)),
    disc: HIRE_KEYS.map((k) => core.hireDiscounted(c, k)),
  };
}

export function legacyCfReport(L: Legacy): unknown {
  const a = L.app, S = L.state.S as WarbandState;
  const sides = a.battleSides() as { key: string }[];
  const terr = a.cfTerritory() as { id: string }[];
  return {
    sides, models: sides.map((x) => a.sideModels(x.key)),
    terr, status: terr.map((t) => a.districtStatus(t.id)),
    stats: a.cfStats(), xp: xpRows(a.cfXpOverview(S.campaign?.round ?? 0)),
    log: bag(a.cfMergedLog()), battles: bag(a.cfAllBattles()), merged: bag(a.cfAllBattlesMerged()),
    disc: HIRE_KEYS.map((k) => !!a.hireDiscounted(k)),
  };
}

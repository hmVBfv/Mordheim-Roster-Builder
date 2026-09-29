/* The campaign file: one document gathering several players' warbands, the
   battles only the others fought, and a shared history (legacy app.js
   CF_TYPE … cfStats). One person collects the others' warband exports into
   it and passes the file back — no server, no accounts; this is what the
   Quick Build keeps using.

     { type: 'mordheim-campaign-file', version: 1, name, round,
       warbands: [{ id, player, name, wb, updated, roster }],
       battles: [...], log: [...] }

   Legacy kept the open file in a module variable; here it is a value like a
   warband, and every function takes it and returns a new one (Immer). */
import { produce } from 'immer';
import type { GameData } from '../data/types.ts';
import type { LogEntry, WarbandState, XpEntry } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import type { BattleSide } from './chronicle.ts';

export const CF_TYPE = 'mordheim-campaign-file';

export interface CampaignFileWarband {
  id: number;
  player: string;
  name: string;
  wb: string;
  /** Date of the last import (YYYY-MM-DD). */
  updated: string;
  /** The warband's save as it was imported. */
  roster: WarbandState;
  [key: string]: unknown;
}

export interface CampaignFileBattle {
  id: number;
  round: number;
  district?: string;
  notes?: string;
  sides?: BattleSide[];
  opponents?: { name?: string; wb?: string }[];
  outcome?: string;
  [key: string]: unknown;
}

export interface CampaignFile {
  type: typeof CF_TYPE;
  version: number;
  name: string;
  round: number;
  warbands: CampaignFileWarband[];
  battles: CampaignFileBattle[];
  log: LogEntry[];
  [key: string]: unknown;
}

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const wbNameOf = (data: GameData, key: string | null | undefined) => (key && data.WARBANDS[key]?.name) || key || 'unknown warband';

export function cfNew(name?: string): CampaignFile {
  return { type: CF_TYPE, version: 1, name: String(name || 'New campaign'), round: 0, warbands: [], battles: [], log: [] };
}

export function cfSetName(cf: CampaignFile, v: string): CampaignFile {
  return produce(cf, (d) => { d.name = String(v || ''); });
}

export function cfSetRound(cf: CampaignFile, n: unknown): CampaignFile {
  return produce(cf, (d) => { d.round = Math.max(0, Number(n) || 0); });
}

export interface CfImportResult { cf: CampaignFile; ok: boolean; updated?: boolean; entry?: CampaignFileWarband; msg?: string }

/** Takes a warband save into the campaign. A warband already there (same
    name and type) is updated in place, so re-importing after a game night
    refreshes it instead of duplicating the player. Without a file, one is
    started. `today` stamps the import (YYYY-MM-DD). */
export function cfImportWarband(data: GameData, cf: CampaignFile | null, save: unknown, player: string | null | undefined, today: string): CfImportResult {
  const base = cf ?? cfNew('Campaign');
  const sv = save as WarbandState | null | undefined;
  if (!sv || !sv.wb || !data.WARBANDS[sv.wb]) return { cf: base, ok: false, msg: 'Unknown format or unknown warband.' };
  let result: CfImportResult = { cf: base, ok: true };
  const next = produce(base, (d) => {
    // an unnamed player gets a number, so two of them can be told apart
    const autoPlayer = () => {
      let n = d.warbands.length + 1;
      const taken = d.warbands.map((w) => w.player);
      while (taken.includes('Player ' + n)) n++;
      return 'Player ' + n;
    };
    const nm = String(sv.name || '').trim() || wbNameOf(data, sv.wb);
    const existing = d.warbands.find((w) => w.name.toLowerCase() === nm.toLowerCase() && w.wb === sv.wb);
    const entry: CampaignFileWarband = {
      id: existing ? existing.id : d.warbands.reduce((m, w) => Math.max(m, Number(w.id) || 0), 0) + 1,
      player: String(player || (existing && existing.player) || '').trim() || (existing && existing.player) || autoPlayer(),
      name: nm, wb: sv.wb as string, updated: today,
      roster: copy(sv),
    };
    if (existing) Object.assign(existing, entry); else d.warbands.push(entry);
    result = { cf: base, ok: true, updated: !!existing, entry: copy(entry) };
  });
  return { ...result, cf: next };
}

/** Puts the warband open in the builder into the campaign. */
export function cfAddCurrent(ctx: Ctx, cf: CampaignFile | null, player: string | null | undefined, today: string): CfImportResult {
  return cfImportWarband(ctx.data, cf, copy(ctx.s), player, today);
}

/** Removes a warband from the campaign (its own file is untouched). The
    interface asks first. */
export function cfRemoveWarband(cf: CampaignFile, id: number): CampaignFile {
  const i = cf.warbands.findIndex((w) => w.id === Number(id));
  if (i < 0) return cf;
  return produce(cf, (d) => { d.warbands.splice(i, 1); });
}

/** Reads a campaign file (text or parsed). */
export function cfReadFile(json: unknown): { cf: CampaignFile | null; ok: boolean; msg?: string } {
  let d = json as Record<string, unknown> | null;
  if (typeof json === 'string') { try { d = JSON.parse(json) as Record<string, unknown>; } catch { return { cf: null, ok: false, msg: 'Could not read the file.' }; } }
  if (!d || d.type !== CF_TYPE) return { cf: null, ok: false, msg: 'That is not a campaign file.' };
  return {
    ok: true,
    cf: copy({
      type: CF_TYPE, version: Number(d.version) || 1, name: String(d.name || 'Campaign'), round: Number(d.round) || 0,
      warbands: Array.isArray(d.warbands) ? d.warbands : [], battles: Array.isArray(d.battles) ? d.battles : [],
      log: Array.isArray(d.log) ? d.log : [],
    }) as CampaignFile,
  };
}

/** Every warband's chronicle merged into one history, tagged with whose it
    is, by stage. */
export function cfMergedLog(cf: CampaignFile | null): (LogEntry & { who: string | null; wbKey?: string })[] {
  if (!cf) return [];
  const out: (LogEntry & { who: string | null; wbKey?: string })[] = [];
  (cf.log || []).forEach((e) => out.push(Object.assign({}, e, { who: null })));
  cf.warbands.forEach((w) => {
    const c = (w.roster && w.roster.campaign) || {};
    (c.log || []).forEach((e) => out.push(Object.assign({}, e, { who: w.name, wbKey: w.wb })));
  });
  return out.sort((a, b) => (a.round - b.round) || ((a.id || 0) - (b.id || 0)));
}

/** All battles the campaign knows: the file's own and each warband's. */
export function cfAllBattles(cf: CampaignFile | null): Record<string, unknown>[] {
  if (!cf) return [];
  const out: Record<string, unknown>[] = (cf.battles || []).map((b) => Object.assign({}, b, { who: null }));
  cf.warbands.forEach((w) => {
    const c = (w.roster && w.roster.campaign) || {};
    (c.battles || []).forEach((b) => out.push(Object.assign({}, b, { who: w.name, wbKey: w.wb })));
  });
  return out.sort((a, b) => ((a.round as number) - (b.round as number)) || (((a.id as number) || 0) - ((b.id as number) || 0)));
}

/** A battle is recognised by its stage, the warbands that fought and where:
    the same battle entered by two players is one battle. */
export function battleSignature(b: { round?: unknown; sides?: BattleSide[]; opponents?: { name?: string; wb?: string }[]; district?: unknown }): string {
  const who = (b.sides && b.sides.length ? b.sides.map((x) => x.name || x.wb) : (b.opponents || []).map((o) => o.name || o.wb))
    .map((x) => String(x).toLowerCase().trim()).sort();
  return JSON.stringify([Number(b.round) || 0, who, String(b.district || '')]);
}

export interface CfMergeResult { cf: CampaignFile | null; ok: boolean; added?: number; warbands?: number; seen?: number; msg?: string }

/** Merges another player's campaign file or warband file: its warbands are
    imported, and battles not yet known (here or in our own chronicle) are
    added. */
export function cfMergeFrom(ctx: Ctx, cf: CampaignFile | null, json: unknown, today: string): CfMergeResult {
  let d = json as Record<string, unknown> | null;
  if (typeof json === 'string') { try { d = JSON.parse(json) as Record<string, unknown>; } catch { return { cf, ok: false, msg: 'Could not read the file.' }; } }
  if (!d || typeof d !== 'object') return { cf, ok: false, msg: 'Could not read the file.' };
  let file = cf ?? cfNew('Campaign');
  const have = new Set((file.battles || []).map(battleSignature));
  for (const b of ctx.s.campaign?.battles ?? []) have.add(battleSignature(b as CampaignFileBattle));
  let incoming: CampaignFileBattle[] = [];
  let warbands = 0;
  if (d.type === CF_TYPE) {
    incoming = ((d.battles as CampaignFileBattle[]) || []).slice();
    for (const w of (d.warbands as CampaignFileWarband[]) || []) {
      if (w && w.roster) {
        incoming = incoming.concat(((w.roster.campaign || {}).battles as CampaignFileBattle[]) || []);
        file = cfImportWarband(ctx.data, file, w.roster, w.player || '', today).cf;
        warbands++;
      }
    }
  } else if (d.wb) {
    incoming = ((((d.campaign || {}) as Record<string, unknown>).battles) as CampaignFileBattle[]) || [];
    file = cfImportWarband(ctx.data, file, d, (d.player as string) || '', today).cf;
    warbands++;
  } else return { cf: file, ok: false, msg: 'That is neither a campaign file nor a warband file.' };
  let added = 0;
  file = produce(file, (f) => {
    f.battles = f.battles || [];
    for (const b of incoming) {
      const sig = battleSignature(b);
      if (have.has(sig)) continue;
      have.add(sig);
      f.battles.push(Object.assign({}, copy(b), { id: f.battles.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1 }));
      added++;
    }
  });
  return { cf: file, ok: true, added, warbands, seen: incoming.length };
}

/** Every battle of the campaign: ours and those only the others were in. */
export function cfAllBattlesMerged(ctx: Ctx, cf: CampaignFile | null): Record<string, unknown>[] {
  const mine = (ctx.s.campaign?.battles ?? []).map((b) => ({ ...b, mine: true }));
  const seen = new Set(mine.map((b) => battleSignature(b as unknown as CampaignFileBattle)));
  const theirs = ((cf && cf.battles) || []).filter((b) => !seen.has(battleSignature(b))).map((b) => ({ ...b, mine: false }));
  return ([...mine, ...theirs] as Record<string, unknown>[]).sort((a, b) => ((a.round as number) - (b.round as number)) || (Number(a.id) - Number(b.id)));
}

/** The experience each other warband earned this round, to read out at the
    table (only our own can be applied). */
export function cfXpOverview(cf: CampaignFile | null, round: number): { name: string; player: string; rows: XpEntry[] }[] {
  if (!cf) return [];
  return cf.warbands.map((w) => {
    const c = ((w.roster || {}) as WarbandState).campaign || {};
    const rows = (c.xp || []).filter((x) => x.round === round);
    return { name: w.name, player: w.player, rows };
  }).filter((x) => x.rows.length);
}

/** Campaign-wide tallies per warband. The rating is the one stored with the
    warband's latest stage, never recomputed. */
export function cfStats(cf: CampaignFile | null): Record<string, unknown>[] | null {
  if (!cf) return null;
  return cf.warbands.map((w) => {
    const r = (w.roster || {}) as WarbandState;
    const c = r.campaign || {};
    const log = c.log || [];
    const snaps = (c.snapshots && typeof c.snapshots === 'object' ? c.snapshots : {}) as Record<string, { totals?: { rating?: number } }>;
    const latest = Object.keys(snaps).map(Number).sort((a, b) => b - a)[0];
    const rating = (latest != null && snaps[String(latest)] && snaps[String(latest)]!.totals) ? snaps[String(latest)]!.totals!.rating : null;
    const battles = (c.battles || []) as { outcome?: string }[];
    return {
      id: w.id, player: w.player, name: w.name, wb: w.wb, rating,
      warriors: (r.models || []).reduce((s, m) => s + (Number(m.qty) || 1), 0),
      fallen: (r.fallen || []).length,
      battles: battles.length,
      wins: battles.filter((b) => /victor/i.test(b.outcome || '')).length,
      advances: log.filter((e) => e.type === 'advance').length,
      items: log.filter((e) => e.type === 'item').length,
    };
  });
}

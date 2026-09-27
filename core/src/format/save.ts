/* Loading and writing a warband save (legacy app.js applyState, importText,
   exportState).

   The format number lives in the file: saves without one were written by
   the legacy app (format 0). Loading fills in every key an older file may
   lack — the defaults test/compat.mjs pins — then brings the state into its
   canonical form. Rules for the format stay those of test/compat.mjs: only
   add keys, give every new key a default here, never rename or remove. */
import type { GameData } from '../data/types.ts';
import type { Model, WarbandState } from '../state/types.ts';
import { houseDefaults } from '../state/house.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { totalSpent } from '../rules/costs.ts';
import { campState } from '../warband/log.ts';
import { normalizeState } from '../warband/normalize.ts';
import { exportState } from '../export/text.ts';
import { schemaNotes, warbandSaveSchema } from './schema.ts';

/** The format this version writes. */
export const FORMAT = 1;

export type LoadResult =
  | { ok: true; state: WarbandState; format: number; notes: string[] }
  | { ok: false; msg: string };

/* Keys a save carries at the top level beyond the legacy set: core's uid
   counter and the narrative fields of the new builder (data-model.md). */
const KEPT = ['uidSeq', 'canon', 'story'] as const;

/** Loads a parsed save. Refuses only what cannot be a warband of a known
    type; everything else loads, with defaults filled in, and departures from
    the schema are reported as notes. */
export function loadSave(data: GameData, raw: unknown): LoadResult {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || !d.wb || !data.WARBANDS[d.wb as string]) return { ok: false, msg: 'Unknown format or unknown warband.' };
  const notes = schemaNotes(warbandSaveSchema, d);
  const format = Number(d.format) || 0;
  const copy = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
  // the legacy loader, key by key (applyState)
  const s = {
    wb: copy.wb, subtype: copy.subtype, name: copy.name || '', budget: copy.budget || data.WARBANDS[copy.wb as string]!.gold,
    models: copy.models || [], hired: copy.hired || [], dp: copy.dp || [], leaderUid: copy.leaderUid || null,
    campaign: copy.campaign || { on: false, districts: {} }, stash: copy.stash || { wyrd: 0, gold: null, items: [] },
    fallen: copy.fallen || [],
  } as unknown as WarbandState;
  for (const k of KEPT) if (copy[k] !== undefined) (s as Record<string, unknown>)[k] = copy[k];
  s.house = Object.assign(houseDefaults(), (copy.house as object) || {});
  s.mark = (copy.mark as string) || '';
  if (!s.stash || typeof s.stash !== 'object') s.stash = { wyrd: 0, gold: 0, items: [] };
  if (!Array.isArray(s.stash.items)) s.stash.items = [];
  if (!s.fallen) s.fallen = [];
  campState(s);
  for (const m of s.models as Model[]) {
    if (!m.eq) m.eq = {};
    if (!m.mut) m.mut = [];
    if (!m.adv) m.adv = {};
    if (!m.skills) m.skills = [];
    if (!m.inj) m.inj = [];
    if (!m.spells) m.spells = [];
  }
  // Saved gold is adopted verbatim: gold in hand = goldNow, whatever the
  // models would re-price to now. Older saves without it keep the treasury.
  if (copy.goldNow != null && isFinite(Number(copy.goldNow))) s.stash.gold = Number(copy.goldNow) + totalSpent(ctxOf(data, s));
  return { ok: true, state: normalizeState(ctxOf(data, s)), format, notes };
}

/** Reads a pasted or opened save: the JSON file, or the readable text
    export with its `MORDHEIM-DATA:` line. */
export function readSaveText(data: GameData, text: unknown): LoadResult {
  const str = String(text || '').trim();
  if (!str) return { ok: false, msg: 'Nothing to import — paste a Tool-file JSON or the readable-text export.' };
  let parsed: Record<string, unknown> | null = null;
  const mk = str.match(/MORDHEIM-DATA:\s*(\{[\s\S]*\})\s*$/);
  if (mk) { try { parsed = JSON.parse(mk[1] as string) as Record<string, unknown>; } catch { /* try the raw JSON next */ } }
  if (!parsed) {
    const a = str.indexOf('{'), b = str.lastIndexOf('}');
    if (a >= 0 && b > a) { try { parsed = JSON.parse(str.slice(a, b + 1)) as Record<string, unknown>; } catch { /* not JSON */ } }
  }
  if (!parsed) return { ok: false, msg: 'Could not read the text. Paste either a Tool-file (JSON) export or the full readable-text export.' };
  const roster = parsed.roster as { forces?: unknown } | undefined;
  if (roster && roster.forces) return { ok: false, msg: 'Newrecruit/BattleScribe format is not supported here.' };
  return loadSave(data, parsed);
}

/** The save as written to a file: the state, the gold in hand as displayed
    (`goldNow`), the format number and the app version that wrote it. */
export function writeSave(ctx: Ctx, appVersion?: string): Record<string, unknown> {
  return { ...exportState(ctx), format: FORMAT, ...(appVersion ? { appVersion } : {}) };
}

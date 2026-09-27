import { DATA_FILES, type GameData, type RawGameData } from './types.ts';

/* Regex fields are stored in JSON as {"__re": "pattern", "__f": "flags"}
   (JSON has no regex type). */
function revive(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.__re === 'string') return new RegExp(o.__re, typeof o.__f === 'string' ? o.__f : '');
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = revive(o[k]);
    return out;
  }
  return v;
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

/* Warband classification that the legacy app adds to WBHIRE when app.js loads
   (js/app.js, "human/chaos-Klassifikation"). It drives Hired Sword rules such
   as 'human', 'nonChaosHuman' and 'humanOrDwarf'. Kept here so that the data
   core works with is identical to what the legacy app works with. */
const HUMAN_WARBANDS = ['merc', 'wh', 'sos', 'averland', 'kislev', 'ostlander', 'ostermark', 'bretonnian', 'bretchapel', 'hochland', 'gunnery', 'outriders', 'outlaws', 'pirates', 'tileans', 'norse', 'arabian', 'reavers', 'caravans', 'battlemonks', 'pitfighters', 'maraudersofchaos', 'cavalcade'];
const CHAOS_WARBANDS = ['possessed', 'carnival', 'beastmen', 'hornedhunters', 'maraudersofchaos', 'sonsofhashut', 'blackdwarfs', 'cppleasures', 'cavalcade'];

/**
 * Turns the parsed data files into the game data the rules work with.
 * The input is not modified; the result is deeply frozen, so no rule can
 * change the data by accident.
 */
export function createGameData(raw: RawGameData): GameData {
  const merged: Record<string, unknown> = {};
  for (const f of DATA_FILES) {
    const file = raw[f];
    if (!file) throw new Error(`Missing data file: ${f}.json`);
    for (const [k, v] of Object.entries(file)) merged[k] = revive(v);
  }
  const data = merged as unknown as GameData;
  for (const k of HUMAN_WARBANDS) { const w = data.WBHIRE[k]; if (w) w.human = true; }
  for (const k of CHAOS_WARBANDS) { const w = data.WBHIRE[k]; if (w) w.chaos = true; }
  return deepFreeze(data);
}

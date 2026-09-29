/* Node-only helpers (server, tests, scripts). Everything else in core/src is
   free of Node and DOM APIs. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGameData } from './data/gameData.ts';
import { DATA_FILES, type GameData, type RawGameData } from './data/types.ts';

/** The repository's data/ directory. */
export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));

/** Reads data/*.json from disk and builds the game data. */
export function loadGameData(dataDir: string = DEFAULT_DATA_DIR): GameData {
  const raw: RawGameData = {};
  for (const f of DATA_FILES) {
    raw[f] = JSON.parse(readFileSync(`${dataDir.replace(/\/?$/, '/')}${f}.json`, 'utf8')) as Record<string, unknown>;
  }
  return createGameData(raw);
}

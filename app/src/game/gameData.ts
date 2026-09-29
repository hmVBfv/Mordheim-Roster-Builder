/* The rules data (data/*.json) for the browser. It is a large part of the
   download, so it is fetched on first use, not with the app shell, and the
   service worker keeps it for offline use. */
import { createGameData, DATA_FILES } from '@mordheim/core';
import type { GameData, RawGameData } from '@mordheim/core';

const files = import.meta.glob<Record<string, unknown>>('../../../data/*.json', { import: 'default' });

let loading: Promise<GameData> | null = null;

export function loadGameData(): Promise<GameData> {
  loading ??= (async () => {
    const raw: RawGameData = {};
    await Promise.all(DATA_FILES.map(async (f) => {
      const load = files[`../../../data/${f}.json`];
      if (!load) throw new Error(`Missing data file: ${f}.json`);
      raw[f] = await load();
    }));
    return createGameData(raw);
  })();
  return loading;
}

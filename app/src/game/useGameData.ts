import { use } from 'react';
import type { GameData } from '@mordheim/core';
import { loadGameData } from './gameData.ts';

/** The rules data; suspends until it has arrived (wrap in <Suspense>). */
export function useGameData(): GameData {
  return use(loadGameData());
}

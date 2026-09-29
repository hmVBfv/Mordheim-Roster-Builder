/* The rules data (through the app's own loader) and warbands to test with:
   the same generated fixtures the core parity suites use. */
import { loadGameData } from '../game/gameData.ts';
import type { WarbandState } from '@mordheim/core';
import { generateFixtures } from '../../../core/test/support/fixtures.ts';

export const data = await loadGameData();
export const fixtures = generateFixtures(data, [1]);

/** A small Reikland-style roster as the Roster Builder saves it. */
export function sampleSave(): WarbandState {
  const f = fixtures.find((x) => x.state.wb === 'merc' && x.state.models.length >= 3) ?? fixtures[0]!;
  return structuredClone({ ...f.state, name: 'The Silver Caravan' });
}

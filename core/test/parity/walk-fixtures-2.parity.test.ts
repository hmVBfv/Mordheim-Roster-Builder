/* Action parity, generated states, part 2: see walk.ts. Split over several files so the
   slow legacy side runs in parallel workers. */
import { beforeAll, describe, it } from 'vitest';
import { loadLegacy } from '../legacy/loadLegacy.ts';
import { fixtureWalks, half, runSequence, useLegacy } from './walk.ts';

beforeAll(async () => { useLegacy(await loadLegacy()); });

describe('action parity: legacy app vs core (generated states, part 2)', () => {
  it.each(half(fixtureWalks(), 1).map((w) => [w.label, w] as const))('%s', (_l, w) => {
    runSequence(w.label, w.start, w.seed);
  });
});

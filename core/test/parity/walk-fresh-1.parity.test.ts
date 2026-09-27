/* Action parity, fresh rosters, part 1: see walk.ts. Split over several files so the
   slow legacy side runs in parallel workers. */
import { beforeAll, describe, it } from 'vitest';
import { loadLegacy } from '../legacy/loadLegacy.ts';
import { freshWalks, half, runSequence, useLegacy } from './walk.ts';

beforeAll(async () => { useLegacy(await loadLegacy()); });

describe('action parity: legacy app vs core (fresh rosters, part 1)', () => {
  it.each(half(freshWalks(), 0).map((w) => [w.label, w] as const))('%s', (_l, w) => {
    runSequence(w.label, w.start, w.seed);
  });
});

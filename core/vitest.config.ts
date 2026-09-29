import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The parity suites load the legacy app, which keeps its state in module
    // singletons. Every test file gets its own module graph.
    isolate: true,
    testTimeout: 180_000,
    // The action parity walks are split over several files so the slow
    // legacy side runs in parallel; use every core for them.
    maxWorkers: Math.max(2, availableParallelism()),
  },
  server: {
    fs: { allow: ['..'] },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The parity suites load the legacy app, which keeps its state in module
    // singletons. Every test file gets its own module graph.
    isolate: true,
    testTimeout: 60_000,
  },
  server: {
    fs: { allow: ['..'] },
  },
});

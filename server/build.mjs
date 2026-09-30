/* Bundles the server's TypeScript into server/dist/ (for the image):
     dist/server.js       the server
     dist/cli.js          roster-cli
     dist/healthcheck.js  the container's healthcheck
   Packages stay external (installed in the image with npm ci --omit=dev);
   the workspace's own code – later also @mordheim/core – is bundled. Every
   file lands directly in dist/, so paths relative to import.meta.url
   (../migrations/, ../../app/dist/campaign/) hold for all of them. */
import { rmSync } from 'node:fs';
import { rolldown } from 'rolldown';

const here = new URL('.', import.meta.url).pathname;
rmSync(`${here}dist`, { recursive: true, force: true });

const bundle = await rolldown({
  cwd: here,
  input: {
    server: 'src/server.ts',
    cli: 'src/cli-main.ts',
    healthcheck: 'src/healthcheck-main.ts',
  },
  platform: 'node',
  external: (id) => id.startsWith('node:') || (/^[^./]/.test(id) && !id.startsWith('@mordheim/')),
});
await bundle.write({
  dir: `${here}dist`,
  format: 'esm',
  entryFileNames: '[name].js',
  chunkFileNames: '[name]-[hash].js',
  sourcemap: true,
});
await bundle.close();

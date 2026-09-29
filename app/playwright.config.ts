/* End-to-end checks on the built app at phone size (docs/ui.md): both
   flavours, both themes, no horizontal scrolling, touch targets, offline
   start and the start-up budgets; the legacy Roster Builder with the
   group's warbands; and the mockups in docs/mockups/. Needs `npm run build` first. Screenshots go
   to test-results/screens/ (uploaded by the CI) — look at them.

   CHROMIUM_PATH runs a Chromium other than Playwright's own download (e.g.
   the one preinstalled in a cloud session). */
import { defineConfig } from '@playwright/test';

const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/output',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // in the CI a failing test also becomes an annotation of the run, readable
  // on its summary page without opening the log
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, launchOptions },
  projects: [
    { name: 'campaign', testIgnore: /legacy|mockups/, use: { baseURL: 'http://localhost:4173/' } },
    { name: 'quickbuild', testIgnore: /legacy|mockups/, use: { baseURL: 'http://localhost:4174/' } },
    // the legacy Roster Builder (repo root), still live until phase 3
    { name: 'legacy', testMatch: /legacy\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4175/' } },
    // the mockups of the new app (docs/mockups/), from the same server
    { name: 'mockups', testMatch: /mockups\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4175/docs/mockups/' } },
  ],
  webServer: [
    { command: 'npx vite preview --mode campaign --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
    { command: 'npx vite preview --mode quickbuild --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI },
    { command: 'python3 -m http.server 4175 --bind 127.0.0.1 --directory ..', url: 'http://127.0.0.1:4175/index.html', reuseExistingServer: !process.env.CI, stdout: 'ignore', stderr: 'ignore' },
  ],
});

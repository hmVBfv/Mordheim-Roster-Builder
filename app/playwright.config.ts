/* End-to-end checks on the built app at phone size (docs/ui.md): both
   flavours, both themes, no horizontal scrolling, touch targets, offline
   start and the start-up budgets. Needs `npm run build` first. Screenshots go
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
  reporter: [['list']],
  use: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, launchOptions },
  projects: [
    { name: 'campaign', use: { baseURL: 'http://localhost:4173/' } },
    { name: 'quickbuild', use: { baseURL: 'http://localhost:4174/' } },
  ],
  webServer: [
    { command: 'npx vite preview --mode campaign --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
    { command: 'npx vite preview --mode quickbuild --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI },
  ],
});

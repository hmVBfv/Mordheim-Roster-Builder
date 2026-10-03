/// <reference types="vitest/config" />
/* Two flavours from one code base, chosen by the build mode:
 *   campaign    served by the Pi, with login, sync and campaigns (phase 2 on)
 *   quickbuild  GitHub Pages, local warbands only
 * Each builds into dist/<flavour>/ with its own manifest name. */
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

type Flavour = 'campaign' | 'quickbuild';

const NAMES: Record<Flavour, { name: string; short: string }> = {
  campaign: { name: 'Mordheim Campaign', short: 'Campaign' },
  quickbuild: { name: 'Mordheim Quick Build', short: 'Quick Build' },
};

/* Strict, and only in production: the dev server injects inline scripts. */
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join('; ');

export default defineConfig(({ mode, command }) => {
  const flavour: Flavour = mode === 'quickbuild' ? 'quickbuild' : 'campaign';
  const names = NAMES[flavour];
  return {
    base: process.env.APP_BASE ?? '/',
    define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev') },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      {
        name: 'mordheim-html',
        transformIndexHtml: (html: string) => html
          .replace('%APP_NAME%', names.name)
          .replace('<!--CSP-->', command === 'build' ? `<meta http-equiv="Content-Security-Policy" content="${CSP}">` : ''),
      },
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['icon.svg'],
        manifest: {
          name: names.name,
          short_name: names.short,
          description: flavour === 'quickbuild'
            ? 'Build and keep Mordheim warbands on this device.'
            : 'Warbands, battles and the story of a Mordheim campaign.',
          lang: 'en',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          theme_color: '#16181a',
          background_color: '#16181a',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // everything the app needs offline; fonts only in the Latin subsets
          // the roster sheet's template too, so a sheet can be made offline
          globPatterns: ['**/*.{js,css,html,svg,png,pdf}', '**/*-latin-*.woff2'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    build: {
      outDir: `dist/${flavour}`,
      emptyOutDir: true,
      target: 'es2022',
    },
    server: { fs: { allow: ['..'] } },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      // the contrast test reads the design tokens
      css: { include: [/tokens\.css/] },
    },
  };
});

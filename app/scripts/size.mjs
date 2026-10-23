#!/usr/bin/env node
/* The budget "JavaScript on first load, compressed" (docs/ui.md, ADR 0014 and
   0021), measured as the browser loads it: the entry script of each
   flavour's index.html and every chunk the page preloads with it. A glob
   over file names (as size-limit had it) misses a chunk the bundler splits
   off and the entry imports – that happened when the sync shared the store
   with the entry, and the first load looked 16 KB smaller than it was.
   Workbox's window part counts too: the update banner fetches it right
   after the start. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Per flavour (ADR 0021, ADR 0025): one limit each, so that one can move
    without the other. Both 250 kB since 23.10.2026 (the Quick Build had 200). */
export const LIMITS = { campaign: 250 * 1024, quickbuild: 250 * 1024 };

/** The line printed for one flavour, and whether it is over its own limit. */
export function verdict(flavour, total) {
  const limit = LIMITS[flavour];
  if (limit === undefined) throw new Error(`no first-load limit for the flavour "${flavour}"`);
  return { over: total > limit, line: `${flavour}: JavaScript on first load ${(total / 1024).toFixed(1)} kB gzipped (limit ${limit / 1024} kB)` };
}

/** The scripts index.html loads at once: the module entry and its preloads, each once. */
export function firstLoad(html) {
  const files = [];
  for (const m of html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)) files.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)) files.push(m[1]);
  return [...new Set(files)];
}

function measure(flavour) {
  const dir = new URL(`../dist/${flavour}/`, import.meta.url).pathname;
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const files = [...firstLoad(html), ...readdirSync(join(dir, 'assets')).filter((f) => f.startsWith('workbox-window')).map((f) => `/assets/${f}`)];
  if (!files.length) throw new Error(`${flavour}: index.html loads no module script`);
  const sizes = files.map((f) => ({ f, gz: gzipSync(readFileSync(join(dir, f.replace(/^\//, '')))).length }));
  return { flavour, total: sizes.reduce((n, s) => n + s.gz, 0), sizes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let over = false;
  for (const flavour of Object.keys(LIMITS)) {
    const r = measure(flavour);
    const v = verdict(flavour, r.total);
    over ||= v.over;
    console.log(v.line);
    for (const s of r.sizes.sort((a, b) => b.gz - a.gz)) console.log(`  ${(s.gz / 1024).toFixed(1).padStart(6)} kB  ${s.f}`);
  }
  if (over) { console.error('over the budget (docs/ui.md)'); process.exit(1); }
}

/* Draws the PNG icons of the manifest from public/icon.svg with the
   Chromium that Playwright uses, so no image library is needed.
   node scripts/icons.mjs  →  public/icon-192.png, icon-512.png,
   icon-maskable-512.png (full bleed, artwork inside the safe zone). */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = new URL('../public/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', dir), 'utf8');
const art = svg.match(/<defs>[\s\S]*?<\/defs>/)[0] + svg.match(/<g id="art">[\s\S]*?<\/g>/)[0];
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#16181a"/><g transform="translate(76.8 76.8) scale(0.7)">${art}</g></svg>`;

// CHROMIUM_PATH: a Chromium other than Playwright's own download (e.g. a preinstalled one)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
async function draw(source, size, file) {
  await page.setViewportSize({ width: size, height: size });
  const src = 'data:image/svg+xml;base64,' + Buffer.from(source).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`);
  writeFileSync(new URL(file, dir), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await draw(svg, 192, 'icon-192.png');
await draw(svg, 512, 'icon-512.png');
await draw(maskable, 512, 'icon-maskable-512.png');
await browser.close();

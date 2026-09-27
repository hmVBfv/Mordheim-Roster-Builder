/* The official roster sheet: legacy js/pdf.js and core's buildOfficialSheet
   are handed the same stand-in for pdf-lib, which records every text and
   box drawn, page by page. The two recordings must be identical. A second
   test fills the real template with the real pdf-lib (vendor/), so core's
   function is known to work with the library it will be given. */
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { PdfFont, PdfLib, WarbandState } from '../../src/index.ts';
import { loadLegacy, type Legacy } from '../legacy/loadLegacy.ts';
import { generateFixtures } from '../support/fixtures.ts';
import { data, useLegacy } from './walk.ts';

let L: Legacy;
beforeAll(async () => { L = await loadLegacy(); useLegacy(L); });

const ROOT = new URL('../../../', import.meta.url);
const TEMPLATE = new Uint8Array(readFileSync(new URL('assets/sheet.pdf', ROOT)));

/* A stand-in for pdf-lib that records what is drawn. Text widths follow a
   fixed rule, so wrapping and centring are exercised. */
function recorder(log: unknown[]): PdfLib {
  let pageNo = 0;
  const font = (name: string) => ({ name, widthOfTextAtSize: (t: string, size: number) => t.length * size * 0.5 });
  return {
    PDFDocument: {
      load: async () => ({ template: true }),
      create: async () => ({
        embedFont: async (n: unknown) => font(String(n)),
        copyPages: async (_src: unknown, idx: number[]) => idx.map((i) => {
          const no = pageNo++;
          return {
            drawText: (t: string, o: { x: number; y: number; size: number; font: PdfFont }) => { log.push(['text', no, i, t, o.x, o.y, o.size, (o.font as unknown as { name: string }).name]); },
            drawRectangle: (o: { x: number; y: number; width: number; height: number }) => { log.push(['box', no, i, o.x, o.y, o.width, o.height]); },
          };
        }),
        addPage: () => { log.push(['page']); },
        save: async () => new Uint8Array([37, 80, 68, 70]),
      }),
    },
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
    rgb: (r: number, g: number, b: number) => ({ r, g, b }),
  };
}

async function legacySheet(s: WarbandState): Promise<unknown[]> {
  const log: unknown[] = [];
  L.load(s); L.state.resyncUid(); L.app.render();
  (globalThis as Record<string, unknown>).PDFLib = recorder(log);
  await L.pdf.exportOfficialSheet();
  return log;
}

async function coreSheet(s: WarbandState): Promise<unknown[]> {
  const log: unknown[] = [];
  await core.buildOfficialSheet(core.ctxOf(data, core.normalizeState(core.ctxOf(data, structuredClone(s)))), recorder(log), TEMPLATE);
  return log;
}

const fixtures = generateFixtures(data, [2]).filter((_, i) => i % 2 === 0);
/* The same warbands hired in reverse: the sheet prints in the warband's list
   order, not in the order the warriors were hired. */
const reversed = fixtures.filter((_, i) => i % 5 === 0)
  .map((f) => ({ label: `${f.label} (hired in reverse)`, state: { ...f.state, models: [...f.state.models].reverse() } }));

describe('official sheet parity: legacy app vs core', () => {
  it.each([...fixtures, ...reversed].map((f) => [f.label, f] as const))('%s', async (_l, f) => {
    expect(await coreSheet(f.state)).toEqual(await legacySheet(f.state));
  });

  it('fills the real template with the real pdf-lib', async () => {
    // the library as the app loads it: a script that defines PDFLib
    runInThisContext(readFileSync(new URL('vendor/pdf-lib.min.js', ROOT), 'utf8'));
    const pdfLib = (globalThis as Record<string, unknown>).PDFLib as PdfLib;
    const load = pdfLib.PDFDocument.load as unknown as (b: Uint8Array) => Promise<{ getPageCount(): number }>;
    const f = fixtures.find((x) => x.state.models.length > 8) ?? fixtures[0]!;
    const out = await core.buildOfficialSheet(core.ctxOf(data, core.normalizeState(core.ctxOf(data, structuredClone(f.state)))), pdfLib, TEMPLATE);
    expect(new TextDecoder().decode(out.bytes.slice(0, 5))).toBe('%PDF-');
    expect((await load(out.bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
    expect(out.filename).toMatch(/_official_sheet\.pdf$/);
  });
});

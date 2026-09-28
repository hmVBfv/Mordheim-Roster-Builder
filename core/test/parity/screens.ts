/* The rules the legacy app computed while drawing its screens — the
   sidebar's warnings and unit list, the recruit menu, the abilities panel —
   read back out of the HTML it drew, and the same from core. Used by
   screens.parity.test.ts on the fixtures and by the walk on its states. */
import * as core from '../../src/index.ts';
import type { Ctx, GameData, WarbandState } from '../../src/index.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';

type El = { style: Record<string, unknown>; innerHTML: string; textContent: string; value: string; className: string; [k: string]: unknown };

/** Runs `fn` with a DOM whose elements remember what is written to them. */
export function withStore(fn: () => void): Record<string, El> {
  const doc = (globalThis as unknown as { document: { getElementById: (id: string) => unknown } }).document;
  const orig = doc.getElementById;
  const store: Record<string, El> = {};
  doc.getElementById = (id: string) => (store[id] ??= {
    style: {}, innerHTML: '', textContent: '', value: '', className: '',
    appendChild() {}, addEventListener() {}, querySelectorAll: () => [], click() {}, focus() {}, select() {}, remove() {},
  } as unknown as El);
  try { fn(); } finally { doc.getElementById = orig; }
  return store;
}

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

function parseWarnings(html: string): string[] {
  return [...html.matchAll(/<div class="warn">⚠ ([\s\S]*?)<\/div>/g)].map((m) => m[1] as string);
}

function parseUnitList(html: string): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  let cur = '';
  for (const m of html.matchAll(/<div class="ulsec">([^<]*)<\/div>|<div class="ulrow"(?: title="([^"]*)")?><span>([^<]*)<\/span>(?:<span class="ulg">(-?\d+) gc<\/span>)?<span class="uln">×(\d+)<\/span><\/div>|<div class="ulrow ultot"><span><b>Total spent<\/b><\/span><span class="ulg"><b>(-?\d+) gc<\/b><\/span>/g)) {
    if (m[1] != null) { cur = m[1]; out[cur] = []; continue; }
    if (m[6] != null) { out.total = [Number(m[6])]; continue; }
    (out[cur] ??= []).push([m[3], Number(m[5]), m[4] != null ? Number(m[4]) : null, m[2] != null ? unescape(m[2]) : undefined]);
  }
  return out;
}

function coreUnitList(ctx: Ctx): Record<string, unknown[]> {
  const u = core.unitSummary(ctx);
  const out: Record<string, unknown[]> = {};
  const add = (label: string, rows: core.SummaryRow[]) => { if (rows.length) out[label] = rows.map((r) => [r.name, r.n, r.gold, r.title]); };
  add('Heroes', u.heroes); add('Dramatis Personae', u.dramatis); add('Hired Swords', u.hired); add('Henchmen', u.henchmen); add('Vehicles', u.vehicles);
  if (Object.keys(out).length) out.total = [u.totalSpent];
  return out;
}

function parseAddMenu(html: string): unknown[] {
  return [...html.matchAll(/<div class="addrow">\s*<span class="nm">([^<]*?)(?: <span class="rec">×(\d+)<\/span>)?<\/span>\s*<span class="lim"[^>]*>([^<]*)<\/span>[\s\S]*?<button class="tiny blood" (disabled)? ?(title="[^"]*")? ?onclick="addUnit\('([^']*)'\)">/g)]
    .map((m) => [m[6], Number(m[2] ?? 0), m[3], !!m[4], !!m[5]]);
}

function coreAddMenu(ctx: Ctx): unknown[] {
  const wb = ctx.data.WARBANDS[ctx.s.wb as string]!;
  const out: unknown[] = [];
  for (const t of ['hero', 'hen', 'vehicle']) {
    for (const u of wb.units.filter((x) => (t === 'vehicle' ? !!x.vehicle : (x.t === t && !x.vehicle)))) {
      const r = core.recruitStatus(ctx, u.id)!;
      out.push([u.id, r.count, r.limit, r.atMax, r.leaderGone]);
    }
  }
  return out;
}

/* The abilities panel: the chips and the special skill lists. */
export function parseAbilities(html: string): unknown {
  const kw = html.match(/<div class="abil-kw no-print">([\s\S]*?)<\/div>/);
  const chips = kw && !/kwlbl/.test(kw[1] as string) ? [...(kw[1] as string).matchAll(/toggleItip\(event,this,'((?:[^'\\]|\\.)*)'\)">/g)].map((m) => (m[1] as string).replace(/\\'/g, "'")) : [];
  const sets = html.match(/<b>Special skill lists?:<\/b> ([^<]*)\./);
  return { chips, sets: sets ? (sets[1] as string).split(', ') : [] };
}

export function coreAbilities(ctx: Ctx, m: WarbandState['models'][number] | null, def = core.unitDef(ctx, m?.uid_def ?? '')!): unknown {
  const a = core.modelAbilities(ctx, def, m);
  return { chips: a.abilities.map((x) => x.name), sets: a.isHero ? a.skillSets.map((x) => x.name) : [] };
}

/* The warband picker (legacy warbandOptions): its groups and entries. */
export function parseWarbandOptions(html: string): unknown {
  return [...html.matchAll(/<optgroup label="([^"]+)">([\s\S]*?)<\/optgroup>/g)]
    .map((g) => ({ label: g[1], warbands: [...(g[2] as string).matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)].map((o) => ({ key: o[1], name: (o[2] as string).replace(/&lt;/g, '<') })) }));
}

export function coreWarbandOptions(data: GameData): unknown {
  return core.warbandPickerGroups(data).map((g) => ({ label: g.label, warbands: g.warbands }));
}

export function coreScreens(ctx: Ctx): unknown {
  return {
    warnings: core.warbandWarnings(ctx),
    units: coreUnitList(ctx),
    menu: coreAddMenu(ctx),
    abilities: ctx.s.models.map((m) => coreAbilities(ctx, m)),
  };
}

export function legacyScreens(L: Legacy): unknown {
  const a = L.app;
  const store = withStore(() => { a.renderSidebar(); a.renderAddMenu(); });
  const S = L.state.S as WarbandState;
  return {
    warnings: parseWarnings(store.warns?.innerHTML ?? ''),
    units: parseUnitList(store.unitlist?.innerHTML ?? ''),
    menu: parseAddMenu(store.addmenu?.innerHTML ?? ''),
    abilities: S.models.map((m) => parseAbilities(a.abilitySection(L.engine.unitDef(m.uid_def), m))),
  };
}

/* A tooltip (legacy info.js itipBuild) as its parts, and the same from core. */
export function parseTip(html: unknown): unknown {
  if (html == null) return null;
  const m = String(html).match(/^<div class="itip-h">([\s\S]*?)<\/div>(?:<div class="itip-l">([\s\S]*?)<\/div>)?<div class="itip-b">([\s\S]*)<\/div>$/);
  return m ? { name: m[1], line: m[2] ?? null, text: m[3] } : { unparsed: html };
}

export function coreTip(data: GameData, nm: string): unknown {
  const i = core.tooltipInfo(data, nm);
  return i && { name: i.name || nm, line: i.line || null, text: i.text };
}

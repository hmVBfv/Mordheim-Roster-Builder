/* The data of every warband in one file (ADR 0030): data/warbands/<grade>/<key>.json holds a warband's rules, units and profiles, its
   opening, the description of each unit, its hire rule and the equipment and skill lists only it uses. data/warbands/_shared.json holds
   the lists several warbands use, _index.json the order of the warbands. The files the game reads (data/warbands.json, warbandintro.json,
   unitlore.json) are made from them, so the legacy app, the core, the app and the server stay as they are.

     npm run data          writes the files the game reads
     npm run data -- check says whether they are what the sources make (the tests do the same) */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));

type Json = Record<string, unknown>;

/** The sources of one warband. */
export interface WarbandFile {
  warband: Json & { grade?: string };
  extra?: unknown;
  race?: string;
  /** The race of some of its units by unit id (UNITRACE). */
  unitRace?: Record<string, string>;
  hire?: unknown;
  /** Equipment lists and skill sets that only this warband uses. */
  lists?: Record<string, unknown>;
  skillSets?: Record<string, unknown>;
  intro?: unknown;
  /** The description of each unit on its page, by unit id. */
  unitLore?: Record<string, string>;
}

interface Index {
  /** "<grade>/<key>" in the order of WARBANDS. */
  order: string[];
  pending1a: unknown[];
  introNote: string;
  loreNote: string;
}

interface Shared { lists: Record<string, unknown>; skillSets: Record<string, unknown> }

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const text = (v: unknown, indent: number): string => `${JSON.stringify(v, null, indent)}\n`;

export const keyOf = (path: string): string => path.split('/').pop() as string;

/** The files the game reads, made from the sources: file name → content. Throws where the sources contradict each other. */
export function buildWarbandData(dir: string = DATA_DIR): Record<string, string> {
  const index = readJson<Index>(`${dir}warbands/_index.json`);
  const shared = readJson<Shared>(`${dir}warbands/_shared.json`);
  const out = { warbands: {} as Json, extra: {} as Json, race: {} as Json, unitRace: {} as Json, hire: {} as Json, lists: { ...shared.lists } as Json, skillSets: { ...shared.skillSets } as Json, intro: {} as Json, lore: {} as Json };
  const merge = (into: Json, from: Record<string, unknown> | undefined, what: string) => {
    for (const [k, v] of Object.entries(from ?? {})) {
      if (k in into) throw new Error(`${what} "${k}" is in two places`);
      into[k] = v;
    }
  };
  for (const path of index.order) {
    const file = `${dir}warbands/${path}.json`;
    if (!existsSync(file)) throw new Error(`${path}: no such file`);
    const w = readJson<WarbandFile>(file);
    const key = keyOf(path);
    if (path.split('/')[0] !== (w.warband.grade ?? 'core')) throw new Error(`${path}: the folder is not the grade of the warband (${w.warband.grade})`);
    out.warbands[key] = w.warband;
    if (w.extra !== undefined) out.extra[key] = w.extra;
    if (w.race !== undefined) out.race[key] = w.race;
    for (const [u, r] of Object.entries(w.unitRace ?? {})) out.unitRace[`${key}/${u}`] = r;
    if (w.hire !== undefined) out.hire[key] = w.hire;
    merge(out.lists, w.lists, `${path}: equipment list`);
    merge(out.skillSets, w.skillSets, `${path}: skill set`);
    if (w.intro !== undefined) out.intro[key] = w.intro;
    if (w.unitLore && Object.keys(w.unitLore).length) out.lore[key] = w.unitLore;
  }
  return {
    'warbands.json': text({ PENDING_1A: index.pending1a, UNITRACE: out.unitRace, WARBANDS: out.warbands, WBEXTRA: out.extra, WBRACE: out.race, WBHIRE: out.hire, LISTS: out.lists, SKILLSETS: out.skillSets }, 1),
    'warbandintro.json': text({ '//': index.introNote, INTRO: out.intro }, 2),
    'unitlore.json': text({ '//': index.loreNote, LORE: out.lore }, 1),
  };
}

/** The files that differ from what the sources make. */
export function staleFiles(dir: string = DATA_DIR): string[] {
  const made = buildWarbandData(dir);
  return Object.keys(made).filter((f) => !existsSync(`${dir}${f}`) || readFileSync(`${dir}${f}`, 'utf8') !== made[f]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv[2] === 'check';
  const stale = staleFiles();
  if (check) {
    if (stale.length) { console.error(`Out of date: ${stale.join(', ')} – run: npm run data`); process.exit(1); }
    console.log('The files the game reads are what data/warbands/ makes.');
  } else {
    const made = buildWarbandData();
    for (const f of stale) writeFileSync(`${DATA_DIR}${f}`, made[f] as string);
    console.log(stale.length ? `Written: ${stale.join(', ')}` : 'Nothing to write: up to date.');
  }
}

/* ADR 0030: the data of a warband is in one file, data/warbands/<grade>/<key>.json. The files the game reads are made from them
   (npm run data) and must be what the sources make – a change made by hand in a made file would be lost with the next run. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildWarbandData, DATA_DIR, keyOf, staleFiles } from '../scripts/warband-data.ts';

const DIR = `${DATA_DIR}warbands/`;
const index = JSON.parse(readFileSync(`${DIR}_index.json`, 'utf8')) as { order: string[] };
const GRADES = ['core', '1a', '1b', '1c', '2a'];

describe('the files of the warbands', () => {
  it('make exactly the files the game reads (run npm run data after a change)', () => {
    expect(staleFiles()).toEqual([]);
  });

  it('are all listed in the index, in a folder of their grade, and every listed one exists', () => {
    const onDisk = GRADES.flatMap((g) => (existsSync(`${DIR}${g}`) ? readdirSync(`${DIR}${g}`).filter((f) => f.endsWith('.json')).map((f) => `${g}/${f.slice(0, -5)}`) : []));
    expect([...onDisk].sort()).toEqual([...index.order].sort());
    expect(new Set(index.order.map(keyOf)).size).toBe(index.order.length);
    expect(readdirSync(DIR).filter((f) => !f.endsWith('.json') && !GRADES.includes(f))).toEqual([]);
  });

  it('hold what only they use: a list or skill set of one warband is not repeated in the shared file', () => {
    const shared = JSON.parse(readFileSync(`${DIR}_shared.json`, 'utf8')) as { lists: Record<string, unknown>; skillSets: Record<string, unknown> };
    const made = JSON.parse(buildWarbandData()['warbands.json'] as string) as { LISTS: Record<string, unknown>; SKILLSETS: Record<string, unknown>; WARBANDS: Record<string, unknown> };
    // a name in two places would have thrown while making; here: nothing is lost on the way
    for (const n of Object.keys(shared.lists)) expect(n in made.LISTS, n).toBe(true);
    expect(Object.keys(made.WARBANDS)).toEqual(index.order.map(keyOf));
  });

  it('leave the shared data files without what moved', () => {
    const has = (f: string, k: string) => k in (JSON.parse(readFileSync(`${DATA_DIR}${f}.json`, 'utf8')) as Record<string, unknown>);
    expect(has('equipment', 'LISTS')).toBe(false);
    expect(has('skills', 'SKILLSETS')).toBe(false);
    expect(has('hiredswords', 'WBHIRE')).toBe(false);
  });
});

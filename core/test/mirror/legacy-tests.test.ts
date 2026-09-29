/* Phase 1d: the legacy tests run against core.
 *
 * Every file in test/ runs as it is, against the legacy app, with the mirror
 * installed (register.mjs → hooks.mjs → recorder.ts): each call the test
 * makes into the legacy app is repeated in core from the same state, and the
 * results must agree (table.ts says what each call means in core). So
 * whatever a legacy test asserts about a call holds for core too.
 *
 * Here: each legacy test must still pass under the mirror, every function it
 * calls must be known to the table, and no call may come out differently. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MirrorReport } from './recorder.ts';
import { TABLE } from './table.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REGISTER = fileURLToPath(new URL('./register.mjs', import.meta.url));
const FILES = readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.mjs') && f !== 'run.mjs').sort();

/* Tests of the rules data alone (core reads the same files) or of the legacy
   source itself (inline handlers, which core does not have): there is no
   call into the app to mirror. */
const DATA_ONLY = ['blessings.mjs', 'catalogue-complete.mjs', 'data-integrity.mjs', 'inline-handlers.mjs'];

interface Run { code: number | null; out: string; report: MirrorReport | null }
const runs = new Map<string, Run>();

function runOne(file: string, dir: string): Promise<void> {
  const reportFile = path.join(dir, `${file}.json`);
  return new Promise((done) => {
    const p = spawn(process.execPath, ['--import', REGISTER, path.join('test', file)], { cwd: ROOT, env: { ...process.env, MIRROR_REPORT: reportFile } });
    let out = '';
    p.stdout.on('data', (d) => { out += String(d); });
    p.stderr.on('data', (d) => { out += String(d); });
    p.on('close', (code) => {
      let report: MirrorReport | null = null;
      try { report = JSON.parse(readFileSync(reportFile, 'utf8')) as MirrorReport; } catch { /* the mirror never loaded */ }
      runs.set(file, { code, out, report });
      done();
    });
  });
}

beforeAll(async () => {
  expect(process.features.typescript, 'Node must run TypeScript (type stripping) for the mirror to load core').toBeTruthy();
  // parity.mjs compares the single-file build with the modules
  const b = spawnSync(process.execPath, [path.join(ROOT, 'build.js')], { cwd: ROOT, encoding: 'utf8' });
  expect(b.status, b.stderr || b.stdout).toBe(0);
  const dir = mkdtempSync(path.join(tmpdir(), 'mirror-'));
  const queue = [...FILES];
  const lanes = Math.max(2, Math.floor(availableParallelism() / 2));
  await Promise.all(Array.from({ length: lanes }, async () => { while (queue.length) await runOne(queue.shift() as string, dir); }));
}, 900_000);

describe('the legacy tests, mirrored onto core', () => {
  it.each(FILES)('%s', (file) => {
    const r = runs.get(file) as Run;
    expect(r.code, `the legacy test fails under the mirror:\n${r.out}`).toBe(0);
    if (DATA_ONLY.includes(file)) {
      expect(r.report, 'a data-only test that now calls the app belongs in the mirror').toBeNull();
      return;
    }
    const rep = r.report as MirrorReport;
    expect(rep, 'the mirror did not load').not.toBeNull();
    expect(rep.unmapped, 'functions the mirror does not know (add them to table.ts)').toEqual({});
    expect(rep.findings, 'calls where core and legacy differ').toEqual([]);
    expect(rep.differences).toBe(0);
  });

  it('every entry of the table is exercised by some legacy test', () => {
    const called = new Set([...runs.values()].flatMap((r) => Object.keys(r.report?.calls ?? {})));
    expect(Object.keys(TABLE).filter((k) => !called.has(k))).toEqual([]);
  });

  it('the mirror compared the bulk of the legacy tests', () => {
    let total = 0, actions = 0;
    for (const r of runs.values()) {
      for (const [k, n] of Object.entries(r.report?.calls ?? {})) {
        total += n;
        if (TABLE[k]?.kind === 'action') actions += n;
      }
    }
    // about 1500 calls, 400 of them actions, when this was written
    expect(total).toBeGreaterThan(1400);
    expect(actions).toBeGreaterThan(350);
  });
});

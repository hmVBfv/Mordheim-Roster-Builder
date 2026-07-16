/* Runs every test/*.mjs (except this file) as a separate Node process and prints
   a summary. Kept deliberately simple — no test framework dependency, so it works
   the same in CI as on a dev machine with plain `node test/run.mjs`. */
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(dir);

// Build the single-file first, so parity.mjs runs against a current bundle.
const b = spawnSync(process.execPath, [path.join(root, 'build.js')], { encoding: 'utf8' });
if (b.status !== 0) { console.log('build failed:\n' + (b.stderr || b.stdout)); process.exit(1); }

const files = readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'run.mjs').sort();

let pass = 0, fail = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  if (r.status === 0) {
    pass++;
    console.log(`\u2713 ${f}`);
    if (r.stdout.trim()) console.log('  ' + r.stdout.trim().split('\n').join('\n  '));
  } else {
    fail++;
    console.log(`\u2717 ${f}`);
    console.log('  ' + (r.stderr || r.stdout).trim().split('\n').join('\n  '));
  }
}
console.log(`\n${pass} pass / ${fail} fail (${files.length} test files)`);
process.exit(fail ? 1 : 0);

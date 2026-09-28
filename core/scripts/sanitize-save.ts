/* Cleans a save from the running campaign so it can become a test fixture:

     node core/scripts/sanitize-save.ts <save.json | export.txt> [out.json]

   Reads a warband save, a campaign file or the readable text export (its
   MORDHEIM-DATA line), takes out everything players wrote themselves
   (core/src/format/sanitize.ts) and writes it as JSON: to out.json, or else
   to core/test/saves/<name>.json. Never overwrites a file. Lists what it
   replaced; names stay, as they are public in the chronicle — read the
   result before committing it. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSave } from '../src/format/sanitize.ts';
import { loadGameData } from '../src/node.ts';

const SAVES = fileURLToPath(new URL('../test/saves/', import.meta.url));

function parse(text: string): unknown {
  const marked = text.match(/MORDHEIM-DATA:\s*(\{[\s\S]*\})\s*$/);
  try { return JSON.parse(marked ? marked[1]! : text); } catch { return null; }
}

/* Paths whose value differs, for the report. */
function changes(a: unknown, b: unknown, at = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changes((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], at ? `${at}.${k}` : k));
  }
  return [at || '(top)'];
}

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('usage: node core/scripts/sanitize-save.ts <save.json | export.txt> [out.json]');
  process.exit(2);
}
const raw = parse(readFileSync(input, 'utf8'));
if (!raw || typeof raw !== 'object') {
  console.error(`${input}: neither a save, a campaign file nor a text export with a MORDHEIM-DATA line`);
  process.exit(1);
}
const clean = sanitizeSave(loadGameData(), raw);
const target = resolve(output ?? `${SAVES}${basename(input, extname(input)).replace(/[^\w-]+/g, '_')}.json`);
if (existsSync(target)) {
  console.error(`${target} exists; not overwritten`);
  process.exit(1);
}
writeFileSync(target, `${JSON.stringify(clean, null, 1)}\n`);
const changed = changes(raw, clean);
console.log(`${target}\n${changed.length} value(s) replaced or removed${changed.length ? ':' : '.'}`);
for (const p of changed) console.log(`  ${p}`);

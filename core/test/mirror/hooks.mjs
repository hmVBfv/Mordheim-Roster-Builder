/* Module hooks for the mirror (see recorder.ts).
 *
 * Every legacy module under js/ is replaced by a thin module that re-exports
 * the original (loaded under the same URL with "?orig") and wraps each
 * function it defines, so the recorder sees every call a legacy test makes.
 *
 * The legacy modules import each other in cycles, and their top level
 * touches imported functions (e.g. to put them on `window`). So the wrappers
 * are hoisted function declarations, like the originals. A name a module
 * only re-exports is the other module's wrapper already, so `app.abilityInfo
 * === info.abilityInfo` stays true; variables (S, uid, …) stay live bindings
 * through `export *`. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WRAPPED = /\/js\/(app|state|engine|info|tts|pdf)\.js$/;
const RECORDER = new URL('./recorder.ts', import.meta.url).href;

/* The functions a module defines. What it merely re-exports (an import from
   another legacy module) is already that module's wrapper, since the
   original imports it by its plain URL. */
function ownFunctions(src) {
  const out = new Set([...src.matchAll(/^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
  // functions declared here and exported in a list (pdf.js, tts.js)
  const declared = new Set([...src.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*;/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim();
      if (declared.has(name)) out.add(name);
    }
  }
  return [...out];
}

export async function load(url, context, nextLoad) {
  const u = new URL(url);
  const hit = u.protocol === 'file:' && !u.search && u.pathname.match(WRAPPED);
  if (!hit) return nextLoad(url, context);
  const src = readFileSync(fileURLToPath(u), 'utf8');
  const orig = url + '?orig';
  const mod = JSON.stringify(hit[1]);
  const lines = [
    // first, so it is evaluated before the cycle of legacy modules starts
    `import { callWrapped as __call, registerModule as __reg } from ${JSON.stringify(RECORDER)};`,
    `import * as M from ${JSON.stringify(orig)};`,
    `__reg(${mod}, M);`,
    `export * from ${JSON.stringify(orig)};`,
    ...ownFunctions(src).map((n) => `export function ${n}(...a) { return __call(${mod}, ${JSON.stringify(n)}, M.${n}, this, a); }`),
  ];
  return { format: 'module', shortCircuit: true, source: lines.join('\n') };
}

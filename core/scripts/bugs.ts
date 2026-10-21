/* Problem reports from a Claude session (ADR 0019, docs/security.md section 7):

     node core/scripts/bugs.ts list [--status open|all|new|confirmed|in_progress|fixed|closed|duplicate]
     node core/scripts/bugs.ts show <number>
     node core/scripts/bugs.ts set <number> [--status S] [--severity S1..S4|none] [--kind K] [--area TEXT] [--headline TEXT] [--fixed-in VERSION]
     node core/scripts/bugs.ts fixture <number> [out.json]

   Needs ROSTER_URL (the server's address, https) in the environment – the
   cloud environment's settings, never a file in the repository – and the bug
   token: as ROSTER_BUG_TOKEN, or kept out of the session as a network secret
   the environment's proxy adds to requests for that host. The token opens
   GET and PATCH /bugs and nothing else. `fixture`
   takes the warband copy a reporter attached, cleans it as `sanitize-save`
   does (core/src/format/sanitize.ts) and writes it to core/test/saves/bug-<n>.json,
   or to the path given; it never overwrites a file. Names stay, as in the
   chronicle: read the result before committing it (public repository). */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedPaths, sanitizeSave } from '../src/format/sanitize.ts';
import { loadGameData } from '../src/node.ts';
import { BugsError, call, configFrom, isNumber, listLine, patchFrom, renderReport, type Summary } from './bugs-lib.ts';

const SAVES = fileURLToPath(new URL('../test/saves/', import.meta.url));
const USAGE = `usage: npm run bugs -- list [--status open|all|<status>]
       npm run bugs -- show <number>
       npm run bugs -- set <number> [--status <s>] [--severity S1..S4|none] [--kind <k>] [--area <text>] [--headline <text>] [--fixed-in <version>]
       npm run bugs -- fixture <number> [out.json]`;

const fail = (message: string, code = 1): never => {
  console.error(message);
  return process.exit(code);
};

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !['list', 'show', 'set', 'fixture'].includes(cmd)) return fail(USAGE, 2);
  const cfg = configFrom(process.env);
  if (!cfg.ok) return fail(`bugs: ${cfg.problem}`, 2);
  const { config } = cfg;

  if (cmd === 'list') {
    let status = 'open';
    if (rest.length === 2 && rest[0] === '--status') status = rest[1]!;
    else if (rest.length) return fail(USAGE, 2);
    const r = (await call(config, 'GET', `/bugs?status=${encodeURIComponent(status)}&limit=200`)) as { bugs: Summary[] };
    if (!r.bugs.length) console.log(status === 'open' ? 'Nothing open.' : 'Nothing here.');
    for (const b of r.bugs) console.log(listLine(b));
    return;
  }

  const number = rest[0];
  if (!isNumber(number)) return fail(USAGE, 2);

  if (cmd === 'show') {
    if (rest.length !== 1) return fail(USAGE, 2);
    const r = (await call(config, 'GET', `/bugs/${number}`)) as { bug: Record<string, unknown> };
    console.log(renderReport(r.bug));
    return;
  }

  if (cmd === 'set') {
    const p = patchFrom(rest.slice(1));
    if (!p.ok) return fail(`bugs set: ${p.problem}`, 2);
    const r = (await call(config, 'PATCH', `/bugs/${number}`, p.body)) as { bug: Summary };
    console.log(listLine(r.bug));
    return;
  }

  // fixture
  if (rest.length > 2) return fail(USAGE, 2);
  const r = (await call(config, 'GET', `/bugs/${number}`)) as { bug: { attachment: unknown } };
  const attachment = r.bug.attachment;
  if (!attachment || typeof attachment !== 'object') return fail(`bugs fixture: report #${number} has no warband copy (the reporter did not attach one, or the report was closed)`, 3);
  const clean = sanitizeSave(loadGameData(), attachment);
  const target = resolve(rest[1] ?? `${SAVES}bug-${number}.json`);
  if (existsSync(target)) return fail(`bugs fixture: ${target} exists; not overwritten`, 1);
  writeFileSync(target, `${JSON.stringify(clean, null, 1)}\n`);
  const changed = changedPaths(attachment, clean);
  console.log(`${target}\n${changed.length} value(s) replaced or removed${changed.length ? ':' : '.'}`);
  for (const p of changed.slice(0, 60)) console.log(`  ${p}`);
  if (changed.length > 60) console.log(`  … and ${changed.length - 60} more`);
  console.log('Names stay. Read the file before committing: rename anything not public in the chronicle (public repository).');
}

main().catch((e: unknown) => {
  if (e instanceof BugsError) fail(`bugs: ${e.message}`, 1);
  // anything else may be a surprise, but never one that carries the token: it is only ever in a header
  fail(`bugs: ${(e as Error).message}`, 1);
});

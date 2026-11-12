/* Compare a warband's data with its page on mordheimer.net and list the differences (plan P9; docs/rules-audit.md):

     node core/scripts/audit-warband.ts <key> [<key> …]      e.g. 2a/druchii, or only druchii
     node core/scripts/audit-warband.ts all [--grade 2a]

   Reads the page with curl (CLAUDE.md: the built-in fetch tools do not get through from a cloud session) into a cache directory that is not in the
   repository (--cache <dir>, else the system's temporary directory) and prints only what differs. It never changes data: what a difference means
   is Rob's call, and a rule he has not agreed to is not entered. The pages are not kept. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, blocksOf, render, type Catalog, type WarbandFile } from './audit-lib.ts';

const DATA = fileURLToPath(new URL('../../data/', import.meta.url));
/** The page of each warband of grade 2a (https://mordheimer.net/docs/warbands/grade-2a-warbands/<slug>); other grades: pass the slug as key=slug. */
const SLUGS: Record<string, string> = {
  dreamwalkers: 'dreamwalkers-cult-of-morr', druchii: 'druchii', graverobbers: 'grave-robbers', halflings: 'halflings', mastersofhorror: 'masters-of-horror', mazzalupo: 'mazzalupo',
  moulder: 'skaven-of-clan-moulder', necrarchs: 'necrarchs-the-soul-stealers', nippon: 'nipponese-expedition', ogrehunters: 'ogre-hunting-party', orderofthemare: 'order-of-the-mare',
  protectorate: 'protectorate-of-sigmar', slayercult: 'dwarf-slayer-cult', snotlings: 'snotlings', sorcerous: 'sorcerous-society', stirwood: 'outlaws-of-stirwood-forest-redux',
  strigos: 'survivors-of-strigos', vampirehunters: 'vampire-hunters-of-sylvania', woodelf: 'wood-elves-of-athel-loren',
};

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const cache = flag('--cache') ?? join(tmpdir(), 'mordheimer-audit');
const grade = flag('--grade') ?? '2a';
mkdirSync(cache, { recursive: true });

function page(g: string, slug: string): string {
  const file = join(cache, `${g}-${slug}.html`);
  if (!existsSync(file)) execFileSync('curl', ['-sSL', '-m', '30', '-o', file, `https://mordheimer.net/docs/warbands/grade-${g}-warbands/${slug}`], { stdio: 'inherit' });
  return readFileSync(file, 'utf8');
}

const keys = args.length === 1 && args[0] === 'all' ? readdirSync(join(DATA, 'warbands', grade)).map((f) => `${grade}/${f.replace(/\.json$/, '')}`) : args.map((k) => (k.includes('/') ? k : `${grade}/${k}`));
if (!keys.length) { console.error('usage: npm run audit -- <key> … | all [--grade 2a] [--cache dir]'); process.exit(2); }
const catalog = (JSON.parse(readFileSync(join(DATA, 'equipment.json'), 'utf8')) as { CATALOG: Catalog[] }).CATALOG;
const maxprof = (JSON.parse(readFileSync(join(DATA, 'races.json'), 'utf8')) as { MAXPROF: Record<string, Record<string, number>> }).MAXPROF;
let total = 0;
for (const k of keys) {
  const [g, name] = k.split('/') as [string, string];
  const slug = SLUGS[name];
  if (!slug) { console.error(`${k}: no page address known (add it to SLUGS)`); process.exitCode = 1; continue; }
  const file = JSON.parse(readFileSync(join(DATA, 'warbands', g, `${name}.json`), 'utf8')) as WarbandFile;
  const found = audit({ page: blocksOf(page(g, slug)), file, catalog, maxprof });
  total += found.length;
  process.stdout.write(render(`${k} (${file.warband.name})`, found));
}
process.stdout.write(`\n${total} differences in ${keys.length} warbands\n`);

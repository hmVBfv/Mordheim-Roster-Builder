/* Entry point: node server/dist/healthcheck.js */
import { parseArgs, probe } from './healthcheck.ts';

const { url, print } = parseArgs(process.argv.slice(2), process.env);
const r = await probe(url);
if (print) process.stdout.write(r.body + '\n');
process.exitCode = r.ok ? 0 : 1;

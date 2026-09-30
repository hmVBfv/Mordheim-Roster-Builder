/* Entry point of roster-cli: node server/dist/cli.js <command> */
import { runCli } from './cli.ts';

process.exitCode = runCli(process.argv.slice(2), process.env, {
  out: (l) => process.stdout.write(l + '\n'),
  err: (l) => process.stderr.write(l + '\n'),
});

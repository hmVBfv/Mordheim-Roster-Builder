/* roster-cli, as roster-deploy and the backup timer use it. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.ts';
import { getMeta } from '../src/db.ts';
import { clock, dataDir, startServer, tmpDir } from './helpers.ts';

function cli(args: string[], data: string, now = clock().now) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli(args, { DATA_DIR: data, ROSTER_VERSION: 'cli-test' }, { out: (l) => out.push(l), err: (l) => err.push(l) }, now);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('roster-cli', () => {
  it('refuses to work without the marker file, and creates nothing', () => {
    const empty = tmpDir();
    for (const args of [['backup'], ['schema-version'], ['info'], ['epoch', 'renew']]) {
      const r = cli(args, empty);
      expect(r.code, args.join(' ')).toBe(1);
      expect(r.err).toMatch(/\.roster-volume is missing/);
    }
    expect(readdirSync(empty)).toEqual([]);
  });

  it('before the first start: schema 0, nothing to back up', () => {
    const data = dataDir();
    expect(cli(['schema-version'], data)).toMatchObject({ code: 0, out: '0' });
    expect(cli(['backup'], data)).toMatchObject({ code: 3 });
    expect(JSON.parse(cli(['info'], data).out)).toEqual({ version: 'cli-test', database: null, snapshots: [] });
    expect(existsSync(join(data, 'roster.sqlite'))).toBe(false);
  });

  it('backs up the running database and prints the file name', async () => {
    const s = await startServer();
    const r = cli(['backup', '--label', 'pre-deploy-9cfc4ab'], s.data);
    expect(r.code).toBe(0);
    expect(r.out).toBe('20260930T120000Z-pre-deploy-9cfc4ab.sqlite');
    expect(readdirSync(join(s.data, 'snapshots'))).toEqual([r.out]);
    expect(cli(['backup', '--label', '../../etc'], s.data).code).toBe(1);
    expect(cli(['backup', '--nonsense'], s.data).code).toBe(2);
  });

  it('schema-version and info', async () => {
    const s = await startServer();
    expect(cli(['schema-version'], s.data)).toMatchObject({ code: 0, out: '1' });
    const info = JSON.parse(cli(['info'], s.data).out) as { database: { schema: number; expected: number; epoch: string } };
    expect(info.database).toMatchObject({ schema: 1, expected: 1, epoch: getMeta(s.db, 'epoch') });
  });

  it('epoch renew changes what health reports', async () => {
    const s = await startServer();
    const before = getMeta(s.db, 'epoch');
    const r = cli(['epoch', 'renew'], s.data);
    expect(r.code).toBe(0);
    expect(r.out).not.toBe(before);
    const health = (await (await fetch(`${s.url}/api/v1/health`)).json()) as { epoch: string };
    expect(health.epoch).toBe(r.out);
    expect(cli(['epoch'], s.data).code).toBe(2);
  });

  it('usage', () => {
    expect(cli([], dataDir()).code).toBe(2);
    expect(cli(['help'], dataDir())).toMatchObject({ code: 0 });
    expect(cli(['drop-everything'], dataDir()).code).toBe(2);
  });
});

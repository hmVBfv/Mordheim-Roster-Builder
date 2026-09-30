import { describe, expect, it } from 'vitest';
import { parseArgs, probe } from '../src/healthcheck.ts';
import { dataDir, startServer } from './helpers.ts';
import { writeFileSync } from 'node:fs';
import { dbPath } from '../src/db.ts';

describe('healthcheck', () => {
  it('ok for a healthy server, not ok for 503 or nobody', async () => {
    const s = await startServer();
    expect((await probe(`${s.url}/api/v1/health`)).ok).toBe(true);
    const data = dataDir();
    writeFileSync(dbPath(data), 'not a database');
    const broken = await startServer({ data });
    const r = await probe(`${broken.url}/api/v1/health`);
    expect(r.ok).toBe(false);
    expect(JSON.parse(r.body)).toMatchObject({ status: 'error' });
    await s.close();
    expect((await probe(`${s.url}/api/v1/health`, 1000)).ok).toBe(false);
  });

  it('asks the local port by default', () => {
    expect(parseArgs([], {})).toEqual({ url: 'http://127.0.0.1:3000/api/v1/health', print: false });
    expect(parseArgs(['--print', '--url', 'http://x/h'], { PORT: '1' })).toEqual({ url: 'http://x/h', print: true });
  });
});

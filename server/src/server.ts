/* Entry point of the container: node server/dist/server.js */
import { start } from './start.ts';
import { VolumeError } from './volume.ts';

try {
  const s = await start();
  const stop = (signal: string) => {
    s.app.log.info({ event: 'stopping', signal }, 'shutting down');
    s.close().then(
      () => { process.exitCode = 0; },
      (err: unknown) => { s.app.log.error({ event: 'stop_failed', err }, 'shutdown failed'); process.exitCode = 1; },
    );
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
} catch (err) {
  // before the logger exists or when the volume is missing: one JSON line, exit 1
  const e = err as Error;
  process.stdout.write(JSON.stringify({ level: 'fatal', time: new Date().toISOString(), event: e instanceof VolumeError ? 'volume_missing' : 'start_failed', msg: e.message }) + '\n');
  process.exitCode = 1;
}

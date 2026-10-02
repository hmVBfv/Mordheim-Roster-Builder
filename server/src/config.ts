/* The server's configuration, from the environment (app.env on the Pi, see
   docs/operations.md). Only what phase 2 needs; secrets arrive with the
   features that use them (TOTP_KEY, BUGS_TOKEN_HASH in phase 3). */
import { fileURLToPath } from 'node:url';

export interface Config {
  /** The SSD volume: roster.sqlite, snapshots/, and the marker file. */
  dataDir: string;
  uploadDir: string;
  /** The campaign build of the app (app/dist/campaign); '' serves no files. */
  staticDir: string;
  host: string;
  port: number;
  /** https://mordheim.<domain> – checked against Origin on writes (phase 3). */
  publicOrigin: string | null;
  logLevel: string;
  /** The commit the image was built from (Docker build argument). */
  version: string;
  /** Addresses whose X-Forwarded-For is believed; null: loopback and the container's gateway. */
  trustProxy: string[] | null;
}

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  // 0: any free port (tests)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ConfigError(`PORT is not a port: ${env.PORT}`);
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!LEVELS.includes(logLevel)) throw new ConfigError(`LOG_LEVEL must be one of ${LEVELS.join(', ')}`);
  let publicOrigin: string | null = null;
  if (env.PUBLIC_ORIGIN) {
    let u: URL;
    try {
      u = new URL(env.PUBLIC_ORIGIN);
    } catch {
      throw new ConfigError(`PUBLIC_ORIGIN is not a URL: ${env.PUBLIC_ORIGIN}`);
    }
    if (u.origin !== env.PUBLIC_ORIGIN.replace(/\/$/, '')) throw new ConfigError('PUBLIC_ORIGIN must be an origin only (scheme, host, port)');
    publicOrigin = u.origin;
  }
  return {
    dataDir: env.DATA_DIR ?? '/data',
    uploadDir: env.UPLOAD_DIR ?? '/uploads',
    staticDir: env.STATIC_DIR ?? fileURLToPath(new URL('../../app/dist/campaign/', import.meta.url)),
    host: env.HOST ?? '0.0.0.0',
    port,
    publicOrigin,
    logLevel,
    version: env.ROSTER_VERSION || 'dev',
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY.split(',').map((s) => s.trim()).filter(Boolean) : null,
  };
}

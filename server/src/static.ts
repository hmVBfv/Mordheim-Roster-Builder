/* The app's campaign build, served as static files (docs/architecture.md:
   "Auslieferung: statische Dateien des campaign-Builds"). The file list is
   read once at start and only those exact paths are served – a request can
   never name a path outside the build, whatever it contains. Hashed assets
   are cached for a year; everything else is revalidated, so an update reaches
   the service worker (the app then shows its update banner). */
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import type { ReadStream } from 'node:fs';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

export interface StaticFile {
  path: string;
  type: string;
  size: number;
  etag: string;
  cache: string;
}

export interface StaticFiles {
  get(urlPath: string): StaticFile | undefined;
  index: StaticFile | undefined;
  count: number;
  open(f: StaticFile): ReadStream;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/** Reads the build directory; a missing directory serves nothing (development, tests). */
export function loadStatic(root: string): StaticFiles {
  const files = new Map<string, StaticFile>();
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        const type = TYPES[extname(e.name).toLowerCase()];
        if (!type) continue;
        const st = statSync(full);
        const url = '/' + relative(root, full).split(sep).join('/');
        files.set(url, {
          path: full,
          type,
          size: st.size,
          etag: `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`,
          cache: url.startsWith('/assets/') ? IMMUTABLE : REVALIDATE,
        });
      }
    }
  };
  if (root) walk(root);
  return {
    get: (urlPath) => files.get(urlPath === '/' ? '/index.html' : urlPath),
    index: files.get('/index.html'),
    count: files.size,
    open: (f) => createReadStream(f.path),
  };
}

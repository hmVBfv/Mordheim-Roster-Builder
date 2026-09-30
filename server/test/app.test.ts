/* The HTTP side: every route checked by can(), the app's files served and
   nothing else, the real client address behind Caddy. */
import { describe, expect, it } from 'vitest';
import { buildApp, UncheckedRouteError } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import { Health } from '../src/health.ts';
import { loadStatic } from '../src/static.ts';
import { captureLog, clock, staticDir } from './helpers.ts';

function app(opts: { files?: string; trust?: string[] } = {}) {
  const log = captureLog();
  const db = openDb(':memory:');
  const health = new Health(db, { version: 't', expected: 1, startedAt: clock().now(), now: clock().now, log: log.logger });
  const a = buildApp({ config: { version: 't' }, health, files: loadStatic(opts.files ?? ''), trustProxy: opts.trust ?? ['127.0.0.1'], logger: log.logger });
  return { app: a, log };
}

describe('routes and can()', () => {
  it('a route without an action cannot be registered', async () => {
    const { app: a } = app();
    expect(() => a.get('/api/v1/secret', async () => ({ hidden: true }))).toThrow(UncheckedRouteError);
    expect(() => a.get('/api/v1/secret', { config: { action: 'nope' as never } }, async () => ({}))).toThrow(UncheckedRouteError);
  });

  it('an unknown API path is 404 JSON, never the app page', async () => {
    const { app: a } = app({ files: staticDir() });
    for (const url of ['/api/v1/nope', '/api/', '/api/v1/health/../../index.html']) {
      const res = await a.inject({ url, headers: { accept: 'text/html' } });
      expect(res.statusCode, url).toBe(404);
      expect(res.json(), url).toEqual({ error: 'not_found' });
    }
  });

  it('other methods on the app are 404', async () => {
    const { app: a } = app({ files: staticDir() });
    expect((await a.inject({ method: 'POST', url: '/index.html' })).statusCode).toBe(404);
    expect((await a.inject({ method: 'DELETE', url: '/api/v1/health' })).statusCode).toBe(404);
  });
});

describe("the app's files", () => {
  it('serves the build with the right types and caching', async () => {
    const { app: a } = app({ files: staticDir() });
    const index = await a.inject({ url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.body).toContain('Mordheim Campaign');
    const js = await a.inject({ url: '/assets/index-abc123.js' });
    expect(js.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(js.headers['x-content-type-options']).toBe('nosniff');
    expect((await a.inject({ url: '/sw.js' })).headers['cache-control']).toBe('no-cache');
    expect((await a.inject({ url: '/manifest.webmanifest' })).headers['content-type']).toBe('application/manifest+json');
    expect((await a.inject({ url: '/assets/font-latin-400.woff2' })).headers['content-type']).toBe('font/woff2');
  });

  it('answers a page of the app with index.html, a missing file with 404', async () => {
    const { app: a } = app({ files: staticDir() });
    const page = await a.inject({ url: '/warbands/17?tab=roster', headers: { accept: 'text/html,application/xhtml+xml' } });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Mordheim Campaign');
    expect((await a.inject({ url: '/warbands/17' })).statusCode).toBe(404);
    expect((await a.inject({ url: '/assets/gone-123.js', headers: { accept: 'text/html' } })).statusCode).toBe(404);
  });

  it('never serves a path outside the build, nor a file of an unknown type', async () => {
    const { app: a } = app({ files: staticDir() });
    for (const url of ['/../package.json', '/%2e%2e/package.json', '/assets/..%2f..%2fpackage.json', '/notes.xyz', '/index.html%00.js', '/%E0%A4%A', '//etc/passwd']) {
      const res = await a.inject({ url });
      // a malformed escape is refused by Fastify itself (400)
      expect([400, 404], url).toContain(res.statusCode);
      expect(res.body, url).not.toContain('"name"');
    }
  });

  it('HEAD and a matching ETag', async () => {
    const { app: a } = app({ files: staticDir() });
    const head = await a.inject({ method: 'HEAD', url: '/sw.js' });
    expect(head.statusCode).toBe(200);
    expect(head.body).toBe('');
    expect(Number(head.headers['content-length'])).toBeGreaterThan(0);
    const again = await a.inject({ url: '/sw.js', headers: { 'if-none-match': String(head.headers.etag) } });
    expect(again.statusCode).toBe(304);
  });

  it('without a build only the API answers', async () => {
    const { app: a } = app();
    expect((await a.inject({ url: '/', headers: { accept: 'text/html' } })).statusCode).toBe(404);
    expect((await a.inject({ url: '/api/v1/health' })).statusCode).toBe(503);
  });
});

describe('the client address (Fail2Ban, the login brake)', () => {
  it('X-Forwarded-For counts only from a trusted proxy', async () => {
    const { app: a, log } = app({ trust: ['127.0.0.1', '172.18.0.1'] });
    await a.inject({ url: '/api/v1/nope', remoteAddress: '172.18.0.1', headers: { 'x-forwarded-for': '203.0.113.9' } });
    await a.inject({ url: '/api/v1/nope', remoteAddress: '198.51.100.7', headers: { 'x-forwarded-for': '203.0.113.9' } });
    const ips = log.entries().filter((e) => e.event === 'request').map((e) => e.ip);
    expect(ips).toEqual(['203.0.113.9', '198.51.100.7']);
  });

  it('the request log has the route, never a query string', async () => {
    const { app: a, log } = app({ files: staticDir() });
    await a.inject({ url: '/api/v1/nope?token=secret-token' });
    await a.inject({ url: '/?invite=secret-token', headers: { accept: 'text/html' } });
    expect(log.lines.join('\n')).not.toContain('secret-token');
  });
});

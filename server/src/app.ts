/* The HTTP side: Fastify with the API under /api/v1 and the app's files.
   Every route names an action; a hook asks can() before any handler runs
   (policy.ts). Before that the same hook finds who is asking – the session
   cookie – and refuses a write that does not come from the app itself
   (Origin; JSON only), so another site cannot act in a player's name
   (docs/security.md, CSRF). */
import Fastify, { LogController, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { Config } from './config.ts';
import type { DB } from './db.ts';
import type { Health } from './health.ts';
import type { HashCost } from './passwords.ts';
import { can, isAction, type Action, type Actor } from './policy.ts';
import { readActor, registerAccountRoutes } from './routes-accounts.ts';
import { registerCampaignRoutes } from './routes-campaigns.ts';
import { registerShareRoutes } from './routes-shares.ts';
import { registerWarbandRoutes } from './routes-warbands.ts';
import type { StaticFiles } from './static.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    action?: Action;
  }
  interface FastifyInstance {
    /** Every route as registered, with its action (for the leak-test matrix). */
    registeredRoutes: RegisteredRoute[];
  }
  interface FastifyRequest {
    /** Who is asking (the session cookie); null: nobody signed in. */
    actor: Actor | null;
  }
}

export interface RegisteredRoute {
  method: string;
  url: string;
  action: Action;
}

export interface AppDeps {
  config: Pick<Config, 'version'> & Partial<Pick<Config, 'publicOrigin'>>;
  health: Health;
  /** The database once it is checked and migrated; null keeps every data endpoint closed. */
  db?: DB | null;
  now?: () => Date;
  /** TOTP_KEY: encrypts the authenticators' secrets; null: they cannot be set up. */
  totpKey?: Buffer | null;
  /** scrypt's cost (tests pass a small one). */
  hashCost?: HashCost | undefined;
  files: StaticFiles;
  trustProxy: string[];
  /** false: silent (tests that do not look at the log). */
  logger: Logger | false;
}

/** Request body limit for the whole request (docs/security.md: 3 MB). */
export const BODY_LIMIT = 3 * 1024 * 1024;

export class UncheckedRouteError extends Error {
  override name = 'UncheckedRouteError';
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    ...(deps.logger ? { loggerInstance: deps.logger } : { logger: false }),
    trustProxy: deps.trustProxy,
    bodyLimit: BODY_LIMIT,
    // our own single line per request (onResponse below)
    logController: new LogController({ disableRequestLogging: true }),
    return503OnClosing: true,
    // HEAD only where a route asks for it
    exposeHeadRoutes: false,
  }) as unknown as FastifyInstance;

  // only JSON is parsed: a form or text/plain from another site cannot carry a write
  app.removeContentTypeParser('text/plain');

  // no route without an action: the check cannot be forgotten
  app.decorate('registeredRoutes', [] as RegisteredRoute[]);
  app.decorateRequest('actor', null);
  const now = deps.now ?? (() => new Date());
  const db = deps.db ?? null;
  app.addHook('onRoute', (route) => {
    const action = route.config?.action;
    if (!isAction(action)) {
      throw new UncheckedRouteError(`${String(route.method)} ${route.url}: every route names its action for can() (server/src/policy.ts)`);
    }
    for (const method of [route.method].flat()) app.registeredRoutes.push({ method, url: route.url, action });
  });

  app.addHook('onRequest', async (req, reply) => {
    const action = req.routeOptions.config.action;
    // unmatched requests end in the not-found handler, which serves nothing
    if (action === undefined) return;
    const infra = action === 'health.read' || action === 'app.files';
    if (!infra) {
      // the data endpoints stay closed while the database is not ready (start.ts)
      if (!db) return reply.code(503).send({ error: 'unavailable' });
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req, deps.config.publicOrigin ?? null)) {
        return reply.code(403).send({ error: 'cross_origin' });
      }
      req.actor = readActor(db, req, now());
    }
    if (!can(req.actor, action)) return reply.code(req.actor ? 403 : 401).send({ error: req.actor ? 'forbidden' : 'sign_in' });
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });

  // one line per request: the route's pattern, never its raw URL (tokens)
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url;
    const status = reply.statusCode;
    const action = req.routeOptions.config.action;
    if (action === 'health.read' && status === 200) return;
    const entry = {
      event: 'request',
      ip: req.ip,
      method: req.method,
      route: route && route !== '/*' ? route : req.url.split('?')[0]!.slice(0, 200),
      status,
      ms: Math.round(reply.elapsedTime),
    };
    if (action === 'app.files' && status < 400) req.log.debug(entry, 'request');
    else req.log.info(entry, 'request');
  });

  app.get('/api/v1/health', { config: { action: 'health.read' } }, async (_req, reply) => {
    const report = deps.health.report();
    return reply.code(report.status === 'ok' ? 200 : 503).send(report);
  });

  registerAccountRoutes(app, { db, now, config: { publicOrigin: deps.config.publicOrigin ?? null }, totpKey: deps.totpKey ?? null, hashCost: deps.hashCost });
  registerWarbandRoutes(app, { db, now });
  registerShareRoutes(app, { db, now });
  registerCampaignRoutes(app, { db, now });

  const serveFile = (req: FastifyRequest, reply: FastifyReply) => {
    const path = decodePath(req.url);
    if (path === null || path.startsWith('/api/')) return notFound(reply);
    let file = deps.files.get(path);
    // the app routes by path (BrowserRouter): an unknown page is the app's to answer
    if (!file && acceptsHtml(req) && !/\.[a-z0-9]+$/i.test(path)) file = deps.files.index;
    if (!file) return notFound(reply);
    reply.header('Cache-Control', file.cache).header('ETag', file.etag).type(file.type);
    if (req.headers['if-none-match'] === file.etag) return reply.code(304).send();
    reply.header('Content-Length', file.size);
    return req.method === 'HEAD' ? reply.send() : reply.send(deps.files.open(file));
  };
  app.route({ method: ['GET', 'HEAD'], url: '/*', config: { action: 'app.files' }, handler: serveFile });

  app.setNotFoundHandler((_req, reply) => notFound(reply));
  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error({ event: 'error', err }, 'request failed');
    return reply.code(status).send({ error: status >= 500 ? 'internal' : 'bad_request' });
  });

  return app;
}

function notFound(reply: FastifyReply) {
  return reply.code(404).type('application/json; charset=utf-8').send({ error: 'not_found' });
}

/** A write comes from the app itself: its Origin is the public origin (or,
    without one configured, the host it was sent to). Browsers always send
    Origin with a cross-site or any non-GET fetch. */
function sameOrigin(req: FastifyRequest, publicOrigin: string | null): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  if (publicOrigin) return origin === publicOrigin;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function acceptsHtml(req: FastifyRequest) {
  return (req.headers.accept ?? '').includes('text/html');
}

/** The URL's path, decoded; null if it cannot be (then nothing is served). */
function decodePath(url: string): string | null {
  const raw = url.split(/[?#]/)[0]!;
  try {
    const p = decodeURIComponent(raw);
    return p.includes('\0') ? null : p;
  } catch {
    return null;
  }
}

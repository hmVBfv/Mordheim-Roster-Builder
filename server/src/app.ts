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
import { countContainers, MAX_JSON_CONTAINERS } from './json-limits.ts';
import { ACTIONS, can, isAction, type Action, type Actor } from './policy.ts';
import { readActor, registerAccountRoutes, sessionCookie } from './routes-accounts.ts';
import { HashBusyError } from './passwords.ts';
import { registerBattleRoutes } from './routes-battles.ts';
import { registerNoteRoutes } from './routes-notes.ts';
import { registerAttachmentRoutes } from './routes-attachments.ts';
import { registerTimelineRoutes } from './routes-timeline.ts';
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
  config: Pick<Config, 'version'> & Partial<Pick<Config, 'publicOrigin' | 'dataDir' | 'uploadDir'>>;
  /** What one campaign may keep in pictures (tests set it small). */
  pictureQuota?: number;
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
/** Without an account (sign-in, an invite) a body is a few fields (security review INPUT-2). */
export const ANONYMOUS_BODY_LIMIT = 64 * 1024;
const tooManyContainers = (text: string) => countContainers(text, MAX_JSON_CONTAINERS) > MAX_JSON_CONTAINERS;

const tooLarge = (message: string) => Object.assign(new Error(message), { statusCode: 413 });

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
  // JSON as Fastify parses it (prototype poisoning refused), after two checks
  // on the text: small without an account, and not a pile of tiny objects.
  // Parsing comes after onRequest, so the actor is known here.
  const json = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const text = body as string;
    if (!req.actor && text.length > ANONYMOUS_BODY_LIMIT) return done(tooLarge('body too large without an account'), undefined);
    if (tooManyContainers(text)) return done(tooLarge('too many objects in one body'), undefined);
    json(req, text, done);
  });

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
    // open to everybody (signing in, an invite, the code after the password): no more than 64 KB is even read (INPUT-2)
    const who = ACTIONS[action].who;
    if ((who === 'public' || who === 'pending') && route.bodyLimit === undefined) route.bodyLimit = ANONYMOUS_BODY_LIMIT;
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
      // a session in use lives on – its cookie with it (security review AUTH-14)
      req.actor = readActor(db, req, now(), (token) => reply.header('Set-Cookie', sessionCookie(token, (deps.config.publicOrigin ?? '').startsWith('https:'), 90)));
      // the account the app made the request for: another than the cookie's is refused, never answered for the cookie
      // (a tab where somebody else signed in meanwhile; its unsent items stay its author's – independent review of CLIENT-1)
      const claimed = req.headers['x-roster-user'];
      if (typeof claimed === 'string' && req.actor && claimed !== req.actor.id) return reply.code(409).send({ error: 'other_user' });
    }
    if (!can(req.actor, action)) return reply.code(req.actor ? 403 : 401).send({ error: req.actor ? 'forbidden' : 'sign_in' });
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    // answers are not kept – unless a route says otherwise (a picture's bytes never change under its id)
    if (req.url.startsWith('/api/') && !reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
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
  registerBattleRoutes(app, { db, now, dataDir: deps.config.dataDir ?? null, log: app.log });
  registerNoteRoutes(app, { db, now });
  registerAttachmentRoutes(app, { db, now, uploadDir: deps.config.uploadDir ?? null, ...(deps.pictureQuota ? { quota: deps.pictureQuota } : {}) });
  registerTimelineRoutes(app, { db, now });

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
    // a crowd of password checks: try again in a moment (passwords.ts)
    if (err instanceof HashBusyError) return reply.code(503).header('Retry-After', '5').send({ error: 'busy' });
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

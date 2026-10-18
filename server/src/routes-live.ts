/* GET /api/v1/events: the live stream (ADR 0020, live.ts). One per open app,
   for whoever is signed in. It carries signals only – "campaign <id> has
   news", "your warbands have" – and the app asks the usual endpoints for the
   rest, so what a signal reaches is decided by live.ts and what an answer
   shows by the endpoint, as ever. */
import type { FastifyInstance } from 'fastify';
import type { Hub } from './live.ts';

export function registerLiveRoutes(app: FastifyInstance, deps: { hub: Hub | null }): void {
  app.get('/api/v1/events', {
    config: { action: 'events.read' },
    // an EventSource cannot send X-Roster-User; the account it is opened for comes in the address instead
    schema: { querystring: { type: 'object', properties: { user: { type: 'string', maxLength: 64 } }, additionalProperties: false } },
  }, (req, reply) => {
    const actor = req.actor!;
    const hub = deps.hub;
    if (!hub) return reply.code(503).send({ error: 'unavailable' });
    const claimed = (req.query as { user?: string }).user;
    if (claimed !== undefined && claimed !== actor.id) return reply.code(409).send({ error: 'other_user' });
    if (hub.open >= hub.opts.total) return reply.code(503).header('Retry-After', '30').send({ error: 'busy' });

    // the stream is written by hand from here on: no hook runs after this, so its headers are set here
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
      // a proxy that buffers (nginx) is told not to
      'X-Accel-Buffering': 'no',
    });
    raw.socket?.setNoDelay(true);
    raw.socket?.setKeepAlive(true, 30_000);
    raw.flushHeaders();
    if (hub.add(actor.id, actor.sessionId, raw) === 'busy') raw.end();
    return reply;
  });
  // before the server stops listening and waits for its connections: a stream never ends by itself
  app.addHook('preClose', async () => deps.hub?.closeAll());
  app.addHook('onClose', async () => deps.hub?.closeAll());
}

/* Live updates (ADR 0020): a stream per open app that says "something
   changed" and nothing more. The app then asks for what is new through the
   endpoints it uses anyway, so every rule about who may see what stays where
   it is (policy.ts, ADR 0011) and nothing hidden can travel in a signal.

   What is signalled is decided by the audit log, which already carries the
   visibility of every change: a public entry reaches every member of its
   campaign, a leaders' entry only the leaders, a sealed one only its author,
   an admin entry nobody. A warband's draft reaches the owner's own devices
   only (the sync); a new version, in a campaign, its members as well. A
   signal names a campaign or the sync, never a sequence number (the number
   counts every campaign's activity), a title or a name.

   The hub lives in memory: one per database, found by `audit()` through
   `notifyAudit`. After a restart the apps reconnect and fetch everything they
   show (the stream does not replay). */
import type { ServerResponse } from 'node:http';
import type { AuditEntry } from './accounts.ts';
import type { DB } from './db.ts';

/** What a signal says: this campaign has news, or: the user's own warbands have (the sync). */
export type Signal = { campaign: string } | { sync: true };

export interface LiveOptions {
  /** A line every so often keeps proxies from closing the stream, and the session is looked at again. */
  heartbeatMs: number;
  /** A stream ends after this long; the app reconnects (and asks for everything it shows). */
  maxAgeMs: number;
  /** More streams than this for one account: the oldest ends. */
  perUser: number;
  /** More than this in all: a new one is told to wait. */
  total: number;
  /** Changes that follow each other within this are told as one. */
  settleMs: number;
}

export const LIVE_DEFAULTS: LiveOptions = { heartbeatMs: 20_000, maxAgeMs: 15 * 60_000, perUser: 6, total: 150, settleMs: 40 };

/** A slow reader is let go rather than kept in memory. */
const MAX_BACKLOG = 64 * 1024;

type Route =
  | { to: 'members'; campaign: string }
  | { to: 'leaders'; campaign: string }
  | { to: 'user'; user: string; signal: Signal };

/** A warband's own actions that also change what the members of its campaign see. */
const CAMPAIGN_WARBAND = new Set(['warband.create', 'warband.version', 'warband.archive', 'warband.unarchive']);

/** Who an entry of the audit log concerns (the whole rule, in one place). */
export function routesOf(db: DB, e: AuditEntry): Route[] {
  if (e.campaignId) {
    const visibility = e.visibility ?? 'admin';
    if (visibility === 'public') return [{ to: 'members', campaign: e.campaignId }];
    if (visibility === 'leader') return [{ to: 'leaders', campaign: e.campaignId }];
    // a sealed note or picture: the author alone is told (the others see a placeholder at best, and ask again when it opens)
    if (visibility === 'sealed' && e.actorId) return [{ to: 'user', user: e.actorId, signal: { campaign: e.campaignId } }];
    return [];
  }
  if (e.targetType === 'warband' && e.targetId && e.actorId) {
    const routes: Route[] = [{ to: 'user', user: e.actorId, signal: { sync: true } }];
    if (CAMPAIGN_WARBAND.has(e.action)) {
      const w = db.prepare('SELECT campaign_id FROM warbands WHERE id = ?').get(e.targetId) as { campaign_id: string | null } | undefined;
      if (w?.campaign_id) routes.push({ to: 'members', campaign: w.campaign_id });
    }
    return routes;
  }
  return [];
}

/** Who is told, for a route: users of the campaign, or the one. */
function recipients(db: DB, r: Route): string[] {
  if (r.to === 'user') return [r.user];
  const rows = db.prepare(`SELECT user_id FROM members WHERE campaign_id = ? AND left_at IS NULL${r.to === 'leaders' ? " AND role = 'leader'" : ''}`).all(r.campaign) as { user_id: string }[];
  return rows.map((x) => x.user_id);
}

const signalOf = (r: Route): Signal => (r.to === 'user' ? r.signal : { campaign: r.campaign });

interface Conn {
  userId: string;
  sessionId: string;
  res: ServerResponse;
  born: number;
  timer: NodeJS.Timeout;
  done: boolean;
}

export class Hub {
  private readonly conns = new Map<string, Set<Conn>>();
  private count = 0;
  private readonly queued = new Map<string, Route>();
  private flushing: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(private readonly db: DB, private readonly now: () => Date, readonly opts: LiveOptions = LIVE_DEFAULTS) {}

  /** How many streams are open (for tests and the log). */
  get open(): number {
    return this.count;
  }

  /** The audit log wrote an entry: tell those it concerns, in a moment. */
  changed(e: AuditEntry): void {
    if (this.closed || this.count === 0) return;
    for (const r of routesOf(this.db, e)) this.queued.set(JSON.stringify(r), r);
    if (!this.flushing && this.queued.size > 0) {
      // after the write is committed: this runs when the transaction's code has returned
      this.flushing = setTimeout(() => this.flush(), this.opts.settleMs);
      this.flushing.unref();
    }
  }

  private flush(): void {
    this.flushing = null;
    const routes = [...this.queued.values()];
    this.queued.clear();
    for (const r of routes) {
      const text = `event: change\ndata: ${JSON.stringify(signalOf(r))}\n\n`;
      for (const user of recipients(this.db, r)) for (const c of this.conns.get(user) ?? []) this.write(c, text);
    }
  }

  /** Takes a stream whose headers are out. `busy`: too many, the app is to wait. */
  add(userId: string, sessionId: string, res: ServerResponse): 'ok' | 'busy' {
    if (this.closed || this.count >= this.opts.total) return 'busy';
    const mine = this.conns.get(userId) ?? new Set<Conn>();
    // the oldest makes room: a reconnect after a lost connection must not be refused by its own ghost
    while (mine.size >= this.opts.perUser) this.end([...mine][0]!);
    this.conns.set(userId, mine);
    const c: Conn = { userId, sessionId, res, born: this.now().getTime(), done: false, timer: setInterval(() => this.beat(c), this.opts.heartbeatMs) };
    c.timer.unref();
    mine.add(c);
    this.count++;
    res.on('close', () => this.end(c));
    this.write(c, `retry: 5000\n: connected\n\n`);
    return 'ok';
  }

  private beat(c: Conn): void {
    const t = this.now();
    if (t.getTime() - c.born > this.opts.maxAgeMs || !this.sessionOpen(c.sessionId, t)) return this.end(c);
    // an event, not a comment: a comment never reaches the app's code, and the app must hear that the line is alive
    this.write(c, 'event: ping\ndata: 0\n\n');
  }

  /** The session behind a stream is still open: not signed out, not expired, the account not disabled. */
  private sessionOpen(sessionId: string, t: Date): boolean {
    return !!this.db.prepare(`SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.stage = 'full' AND s.revoked_at IS NULL AND s.expires_at > ? AND u.disabled_at IS NULL`).get(sessionId, t.toISOString());
  }

  private write(c: Conn, text: string): void {
    if (c.done) return;
    try {
      if (c.res.writableLength > MAX_BACKLOG) return this.end(c);
      c.res.write(text);
    } catch {
      this.end(c);
    }
  }

  private end(c: Conn): void {
    if (c.done) return;
    c.done = true;
    clearInterval(c.timer);
    const mine = this.conns.get(c.userId);
    mine?.delete(c);
    if (mine?.size === 0) this.conns.delete(c.userId);
    this.count--;
    try {
      if (!c.res.writableEnded) c.res.end();
    } catch {
      /* the socket is gone */
    }
  }

  /** Every stream ends (the server is closing). */
  closeAll(): void {
    this.closed = true;
    if (this.flushing) clearTimeout(this.flushing);
    this.flushing = null;
    this.queued.clear();
    for (const mine of [...this.conns.values()]) for (const c of [...mine]) this.end(c);
  }
}

const hubs = new WeakMap<DB, Hub>();

export function createHub(db: DB, now: () => Date, opts?: Partial<LiveOptions>): Hub {
  const hub = new Hub(db, now, { ...LIVE_DEFAULTS, ...opts });
  hubs.set(db, hub);
  return hub;
}

/** `audit()` calls this for every entry it writes; a database without a hub (the CLI, a test) is not signalled. */
export function notifyAudit(db: DB, e: AuditEntry): void {
  hubs.get(db)?.changed(e);
}

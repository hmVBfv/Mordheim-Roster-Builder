/* Live updates in the app (ADR 0020, docs/architecture.md section 6). One
   stream to the server while someone is signed in: it says "campaign X has
   news" or "your warbands have", never what. A screen that shows a campaign
   subscribes and asks its usual endpoint again; so no screen needs its own
   clock, the rules about who sees what stay on the server, and a signal that
   is lost costs nothing worse than the old wait.

   The old waiting stays as the fallback: while the stream is not open the
   screens ask on their own timers as before; while it is, those timers only
   check now and then (`pollWhileVisible`). Everything a screen shows is
   asked for again when the stream opens, when the app comes back to the
   front and when the connection has been silent too long – a signal missed
   in between would otherwise stay missed. */
import { useEffect, useRef } from 'react';
import { apiUrl } from '../account/api.ts';
import { note } from '../bugs/trail.ts';

export type LiveState =
  /** Nobody signed in, or no stream in this browser. */
  | 'off'
  | 'connecting'
  | 'live'
  /** The stream is closed or being re-opened; the screens ask on their timers. */
  | 'down';

/** Signals that follow each other within this are one round of questions. */
export const SETTLE_MS = 150;
/** … but never kept waiting longer than this, so a busy night does not starve a screen. */
export const SETTLE_MAX_MS = 1000;
/** The server writes a line every 20 s; this much silence means the connection is dead although the browser has not noticed. */
export const SILENT_MS = 70_000;
const WATCH_MS = 15_000;
/** While the stream is open, a screen's own timer asks on every sixth round only: a safety net. */
export const SAFETY_EVERY = 6;
const RETRY_FIRST_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

let state: LiveState = 'off';
let user: string | null = null;
let source: EventSource | null = null;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;
let heard = 0;

type Call = () => unknown;
const ofCampaign = new Map<string, Set<Call>>();
const ofAnyCampaign = new Set<Call>();
const ofSync = new Set<Call>();

const setState = (s: LiveState) => {
  if (s === state) return;
  // a change goes into the trail of a problem report, under the sync's kind (the report format stays as it is)
  note('sync', `stream ${s}`);
  state = s;
};

export const getLiveState = () => state;

function run(calls: Iterable<Call>): void {
  for (const f of [...calls]) {
    try {
      void Promise.resolve(f()).catch(() => undefined);
    } catch {
      /* one screen failing does not stop the others */
    }
  }
}

/* ---------- what was signalled, told in one round after a moment ---------- */

let pendingCampaigns = new Set<string>();
let pendingSync = false;
let pendingAll = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let firstPending = 0;

function flush(): void {
  settleTimer = null;
  const campaigns = pendingCampaigns, sync = pendingSync, all = pendingAll;
  pendingCampaigns = new Set();
  pendingSync = pendingAll = false;
  firstPending = 0;
  if (all) {
    for (const calls of ofCampaign.values()) run(calls);
    run(ofAnyCampaign);
    run(ofSync);
    return;
  }
  for (const cid of campaigns) run(ofCampaign.get(cid) ?? []);
  if (campaigns.size > 0) run(ofAnyCampaign);
  // an enrolment confirmed, a battle closed: what a campaign changes in one's own warbands comes with the sync
  if (sync || campaigns.size > 0) run(ofSync);
}

function later(): void {
  const now = Date.now();
  if (firstPending === 0) firstPending = now;
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(flush, Math.max(0, Math.min(SETTLE_MS, firstPending + SETTLE_MAX_MS - now)));
}

/** Everything that is shown is asked for again (the stream opened, the app came back, the connection was lost for a while). */
function catchUp(): void {
  pendingAll = true;
  later();
}

function onSignal(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const s = data as { campaign?: unknown; sync?: unknown };
  if (typeof s.campaign === 'string' && s.campaign) pendingCampaigns.add(s.campaign);
  else if (s.sync === true) pendingSync = true;
  else return;
  later();
}

/* ---------- the connection ---------- */

function close(): void {
  if (source) { source.close(); source = null; }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
}

function reconnectLater(): void {
  if (retryTimer || !user) return;
  const wait = Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** failures) * (0.75 + Math.random() * 0.5);
  failures++;
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, wait);
}

function connect(): void {
  if (!user || typeof EventSource === 'undefined') return;
  close();
  setState('connecting');
  heard = Date.now();
  // the account goes in the address: an EventSource cannot send X-Roster-User (the server refuses another account's cookie)
  const es = new EventSource(apiUrl(`/events?user=${encodeURIComponent(user)}`));
  source = es;
  es.onopen = () => {
    if (source !== es) return;
    failures = 0;
    heard = Date.now();
    setState('live');
    catchUp();
  };
  es.addEventListener('change', (e) => {
    if (source !== es) return;
    heard = Date.now();
    try {
      onSignal(JSON.parse((e as MessageEvent<string>).data) as unknown);
    } catch {
      /* not a signal */
    }
  });
  es.addEventListener('ping', () => { heard = Date.now(); });
  es.onerror = () => {
    if (source !== es) return;
    setState('down');
    // closed for good (a refusal, a proxy page): the browser does not retry then, we do – more slowly each time
    if (es.readyState === EventSource.CLOSED) { es.close(); source = null; reconnectLater(); }
  };
}

const onVisible = () => {
  if (document.visibilityState !== 'visible' || !user) return;
  if (state === 'live') catchUp();
  else { failures = 0; connect(); }
};
const onOnline = () => { if (user && state !== 'live') { failures = 0; connect(); } };

/** Opens the stream for this account (called with the sync, when someone is signed in). */
export function startLive(userId: string): void {
  if (user === userId && (source || retryTimer)) return;
  stopLive();
  user = userId;
  failures = 0;
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  watchTimer = setInterval(() => {
    // silence on an open stream: the connection is gone although nobody told the browser (a phone that slept)
    if (state === 'live' && Date.now() - heard > SILENT_MS) { failures = 0; connect(); }
  }, WATCH_MS);
  connect();
}

export function stopLive(): void {
  user = null;
  close();
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = null;
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = null;
  pendingCampaigns = new Set();
  pendingSync = pendingAll = false;
  firstPending = 0;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  setState('off');
}

/* ---------- what a screen uses ---------- */

function subscribe<K>(map: Map<K, Set<Call>>, key: K, call: Call): () => void {
  const set = map.get(key) ?? new Set<Call>();
  map.set(key, set);
  set.add(call);
  return () => {
    set.delete(call);
    if (set.size === 0 && map.get(key) === set) map.delete(key);
  };
}

/** `call` runs when this campaign has news, and when everything is to be asked for again. */
export const onCampaign = (cid: string, call: Call) => subscribe(ofCampaign, cid, call);

/** `call` runs when any campaign has news (the lists: Home, Campaigns). */
export function onAnyCampaign(call: Call): () => void {
  ofAnyCampaign.add(call);
  return () => { ofAnyCampaign.delete(call); };
}

/** `call` runs when the user's own warbands have news, and after any campaign's (the sync). */
export function onSync(call: Call): () => void {
  ofSync.add(call);
  return () => { ofSync.delete(call); };
}

/** A screen of one campaign asks again when it has news. */
export function useOnCampaign(cid: string | undefined, refresh: Call): void {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; });
  useEffect(() => (cid ? onCampaign(cid, () => latest.current()) : undefined), [cid]);
}

/** A list of campaigns asks again when any has news. */
export function useOnAnyCampaign(refresh: Call): void {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; });
  useEffect(() => onAnyCampaign(() => latest.current()), []);
}

/** The screens' own timer, kept as the fallback: it asks every `every` ms while the screen is visible, and on every sixth round only while the stream is open. Returns the way to stop it. */
export function pollWhileVisible(refresh: Call, every: number): () => void {
  let round = 0;
  const t = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    round++;
    if (state === 'live' && round % SAFETY_EVERY !== 0) return;
    void refresh();
  }, every);
  return () => clearInterval(t);
}

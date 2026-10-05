/* When the sync runs (docs/architecture.md section 6): when a user is
   signed in, at once, whenever the app comes back to the front or online,
   every ten seconds while it is visible, and a moment after each change
   here. One round at a time. The status is what the header shows
   (SyncState). This module is light: the engine – and with it the rules
   data – is loaded only for the first round. */
import { useSyncExternalStore } from 'react';
import { deviceLabel } from '../account/device.ts';
import { ApiError } from '../account/api.ts';
import { FLAVOUR } from '../flavour.ts';
import { countPending } from './pending.ts';

export type SyncStatus =
  /** No sync: the Quick Build, or nobody signed in. */
  | { state: 'off' }
  | { state: 'syncing'; waiting: number; conflicts: number }
  | { state: 'idle'; waiting: number; conflicts: number; at: string }
  /** The server did not answer; changes wait on this device. */
  | { state: 'offline'; waiting: number; conflicts: number }
  | { state: 'error'; waiting: number; conflicts: number; message: string };

export const EVERY_MS = 10_000;
export const AFTER_CHANGE_MS = 1500;

let status: SyncStatus = { state: 'off' };
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => { status = s; for (const l of listeners) l(); };

export const getSyncStatus = () => status;
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, getSyncStatus, getSyncStatus);
}

let user: string | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let every: ReturnType<typeof setInterval> | null = null;
const counts = () => ('waiting' in status ? { waiting: status.waiting, conflicts: status.conflicts } : { waiting: 0, conflicts: 0 });

async function round(): Promise<void> {
  const me = user;
  if (!me) return;
  setStatus({ state: 'syncing', ...counts() });
  try {
    const [{ syncOnce }, { loadGameData }] = await Promise.all([import('./engine.ts'), import('../game/gameData.ts')]);
    await syncOnce({ userId: me, data: loadGameData, appVersion: __APP_VERSION__, device: deviceLabel() });
    // what the game night gathered goes after the warbands (phase 4a2)
    const { flushOutbox } = await import('../battle/outbox.ts');
    await flushOutbox(me);
    const r = await countPending(me);
    if (user !== me) return;
    setStatus({ state: 'idle', waiting: r.waiting, conflicts: r.conflicts, at: new Date().toISOString() });
  } catch (e) {
    // what waits is counted here, so the header says so without the server
    const c = await countPending(me).catch(() => counts());
    if (user !== me) return;
    if (e instanceof ApiError && e.unreachable) setStatus({ state: 'offline', ...c });
    else setStatus({ state: 'error', ...c, message: e instanceof Error ? e.message : String(e) });
  }
}

/** A round now – or right after the one running. */
export function syncNow(): Promise<void> {
  if (!user) return Promise.resolve();
  if (running) { again = true; return running; }
  running = round().finally(() => {
    running = null;
    if (again) { again = false; void syncNow(); }
  });
  return running;
}

/** A round soon: after a change here (the editor, a new warband, a removal). */
export function requestSync(delay = AFTER_CHANGE_MS): void {
  if (FLAVOUR !== 'campaign' || !user) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, delay);
}

const onVisible = () => { if (document.visibilityState === 'visible') void syncNow(); };
const onOnline = () => void syncNow();

/** Starts syncing for this user (called when someone is signed in). */
export function startSync(userId: string): void {
  if (FLAVOUR !== 'campaign' || user === userId) return;
  stopSync();
  user = userId;
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onVisible);
  every = setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, EVERY_MS);
  void syncNow();
}

export function stopSync(): void {
  user = null;
  if (timer) clearTimeout(timer);
  if (every) clearInterval(every);
  timer = every = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('focus', onVisible);
  setStatus({ state: 'off' });
}

/** Whose warbands this device syncs now (null: nobody's). */
export const syncingFor = () => user;

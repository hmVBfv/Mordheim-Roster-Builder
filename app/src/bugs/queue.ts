/* A problem report written without a connection (wish #177, Rob, 1.11.2026): it is kept on the device, for the person who wrote it, and
   goes out by itself – by every round of the sync – once the server answers. The id of a report comes from the device, so a report that
   went out and was kept anyway is still one report. The warband a reporter ticked, and the screens before, are taken when the report is
   written, not when it is sent. */
import { useLiveQuery } from 'dexie-react-hooks';
import { api, ApiError } from '../account/api.ts';
import { db } from '../db/db.ts';
import type { ReportBody } from './api.ts';
import { notifyReportSent } from './api.ts';

const PREFIX = 'bug-outbox:';
const keyOf = (userId: string, id: string) => `${PREFIX}${userId}:${id}`;

interface Waiting { body: ReportBody; at: string }

/** Keeps a report on the device until it can go. */
export async function queueReport(userId: string, body: ReportBody): Promise<void> {
  await db.meta.put({ key: keyOf(userId, body.id), value: { body, at: new Date().toISOString() } satisfies Waiting });
}

/** What waits for this person, oldest first. */
export async function waitingReports(userId: string): Promise<ReportBody[]> {
  const rows = await db.meta.where('key').startsWith(`${PREFIX}${userId}:`).toArray();
  return rows.map((r) => r.value as Waiting).sort((a, b) => a.at.localeCompare(b.at)).map((w) => w.body);
}

/** What waits for this person, live: the reporter's own list says so. */
export function useWaitingReports(userId: string | null): ReportBody[] {
  return useLiveQuery(() => (userId ? waitingReports(userId) : []), [userId]) ?? [];
}

let flushing: Promise<number> | null = null;

/** Sends what waits, oldest first, each for its author; stops where the server does not answer. Returns how many went. */
export function flushReports(userId: string): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    try {
      for (const body of await waitingReports(userId)) {
        try {
          await api('/bugs', { body, as: userId });
        } catch (e) {
          // not there, signed out, or the device belongs to another account now: it waits for its author, and so does everything after it
          if (e instanceof ApiError && (e.unreachable || e.code === 'sign_in' || e.code === 'other_user')) break;
          // the daily limit: tomorrow
          if (e instanceof ApiError && (e.code === 'too_many' || e.code === 'busy')) continue;
          // refused for good (not a report, an id that is taken): it would never go, and must not block the rest
          await db.meta.delete(keyOf(userId, body.id));
          continue;
        }
        await db.meta.delete(keyOf(userId, body.id));
        sent++;
      }
    } finally {
      flushing = null;
    }
    if (sent) notifyReportSent();
    return sent;
  })();
  return flushing;
}

/* Problem reports on the campaign server (phase 4c1; server/src/routes-bugs.ts).
   Sending and the reporter's own list need the connection; so does the
   admin's. What the reporter reads of a report is its words and its status;
   what the admin reads is all of it. */
import { api } from '../account/api.ts';
import type { CapturedError } from './trail.ts';
import type { ReportContext } from './context.ts';

export type BugKind = 'bug' | 'wish' | 'rules';
export type BugStatus = 'new' | 'confirmed' | 'in_progress' | 'fixed' | 'closed' | 'duplicate';
export type Severity = 'S1' | 'S2' | 'S3' | 'S4';

export const KIND_NAMES: Record<BugKind, string> = { bug: 'Bug', wish: 'Wish', rules: 'Rules issue' };
export const KIND_HINTS: Record<BugKind, string> = { bug: 'something does not work', wish: 'an idea', rules: 'a rule is wrong' };
export const STATUS_NAMES: Record<BugStatus, string> = { new: 'New', confirmed: 'Confirmed', in_progress: 'In progress', fixed: 'Fixed', closed: 'Closed', duplicate: 'Duplicate' };
export const STATUS_ORDER: BugStatus[] = ['new', 'confirmed', 'in_progress', 'fixed', 'closed', 'duplicate'];

/** What the reporter reads of their own report. */
export interface MyBug { id: string; kind: BugKind; title: string; text: string; sourceRef: string; status: BugStatus; fixedIn: string; createdAt: string; updatedAt: string }

/** One line of the admin's list. */
export interface BugSummary {
  id: string; reporterId: string; reporterName: string; kind: BugKind; title: string; status: BugStatus; severity: Severity | null; area: string;
  appVersion: string; view: string; fixedIn: string; consent: boolean; attached: boolean; createdAt: string; updatedAt: string;
}

/** The admin's whole report. */
export interface BugDetail extends BugSummary {
  text: string; sourceRef: string; device: string; jsErrors: CapturedError[]; context: ReportContext | null; warbandId: string | null; rev: number | null; attachment: Record<string, unknown> | null;
}

/** What a report sends (server/src/bugs.ts ReportBody). */
export interface ReportBody {
  id: string;
  kind: BugKind;
  title: string;
  text: string;
  sourceRef: string;
  appVersion: string;
  device: string;
  view: string;
  context: ReportContext | null;
  jsErrors: CapturedError[];
  attach: { warbandId: string; rev: number | null; save: Record<string, unknown> } | null;
}

/** Whoever shows the reporter's own list wants to know when a report went out. */
const listeners = new Set<() => void>();
export const onReportSent = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const sendReport = (body: ReportBody) => api<{ bug: MyBug }>('/bugs', { body }).then((r) => { for (const l of listeners) l(); return r.bug; });
export const myReports = () => api<{ bugs: MyBug[] }>('/bugs/mine').then((r) => r.bugs);

export type ListFilter = 'open' | 'fixed' | 'all';
export const reportList = (status: ListFilter) => api<{ bugs: BugSummary[] }>(`/bugs?status=${status}&limit=200`).then((r) => r.bugs);
export const oneReport = (id: string) => api<{ bug: BugDetail }>(`/bugs/${id}`).then((r) => r.bug);
export interface Sorting { status?: BugStatus; severity?: Severity | null; area?: string; kind?: BugKind; fixedIn?: string }
export const sortReport = (id: string, change: Sorting) => api<{ bug: BugDetail }>(`/bugs/${id}`, { method: 'PATCH', body: change }).then((r) => r.bug);

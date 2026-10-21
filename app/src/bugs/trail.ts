/* What the app remembers of the last minutes, so that a report of "it does
   not work" still says where the reporter was and what went wrong
   (concept.md 4.12; Rob, 09.10.2026). Kept in memory only, for this visit.

   It is structure and fixed words, never anything typed or written by a
   player: screens as patterns (no ids), the names of the sheets the app
   gives itself, that a change was made (not which), the state of the sync
   and the network, failed calls as a pattern with the status, and the last
   JavaScript errors. Whatever a name, a note or a title could be never
   enters here – a hidden title in a heading must not travel into a report
   (ADR 0002). The form shows all of it before anything is sent. */

export type StepKind = 'screen' | 'sheet' | 'edit' | 'sync' | 'online' | 'api' | 'error';
export interface Step { at: string; kind: StepKind; what: string; n: number }
export interface CapturedError { at: string; message: string; where: string }

export const MAX_STEPS = 30;
export const MAX_ERRORS = 5;

let steps: Step[] = [];
let errors: CapturedError[] = [];

/** Notes a step. The same step again right after is counted, not listed twice. */
export function note(kind: StepKind, what: string, now: Date = new Date()): void {
  const text = what.slice(0, 160);
  const at = now.toISOString();
  const last = steps[steps.length - 1];
  if (last && last.kind === kind && last.what === text) {
    last.n = Math.min(999, last.n + 1);
    last.at = at;
    return;
  }
  steps.push({ at, kind, what: text, n: 1 });
  if (steps.length > MAX_STEPS) steps.shift();
}

export const recentSteps = (): Step[] => steps.map((s) => ({ ...s }));
export const recentErrors = (): CapturedError[] => errors.map((e) => ({ ...e }));

export function resetTrail(): void {
  steps = [];
  errors = [];
}

/* ---- screens: a pattern, never an address with its ids ---- */

/** Every fixed word of the app's routes (App.tsx) and the campaign's tabs; anything else in an address is an id, a code or a token. */
export const SCREEN_WORDS: ReadonlySet<string> = new Set([
  'warbands', 'new', 'export', 'trade', 'hire', 'house', 'districts', 'story', 'versions', 'aftermath', 'campaign', 'battles', 'house-rules', 'notes', 'sign-in', 'invite', 'reset',
  'admin', 'import', 'more', 'users', 'invites', 'logins', 'audit', 'bugs', 'reports',
  'manage', 'timeline', 'chronicle', 'questions', 'world', 'background', 'as-player',
]);

/** `/warbands/3f2a…/trade` → `/warbands/:id/trade`. */
export function routePattern(pathname: string): string {
  const parts = pathname.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  return `/${parts.map((p) => (SCREEN_WORDS.has(p) ? p : ':id')).join('/')}`;
}

/** A call to the server as a pattern: only plain lower-case words stay (`/warbands/:id/versions/:id`), a query and every id, code or token go. */
export function callPattern(path: string): string {
  const parts = path.split('?')[0]!.split('/').filter(Boolean);
  return `/${parts.map((p) => (/^[a-z]{2,20}(-[a-z]{2,20})*$/.test(p) ? p : ':id')).join('/')}`;
}

/* ---- JavaScript errors ---- */

const fileOf = (url: string) => {
  try { return new URL(url).pathname.split('/').pop() ?? ''; } catch { return url.split('/').pop() ?? ''; }
};

/** `index-abc.js:12:3` from the first frame of a stack. */
export function frameOf(stack: string | undefined): string {
  const m = /\(?((?:https?:\/\/|\/)[^\s()]+):(\d+):(\d+)\)?/.exec(stack ?? '');
  return m ? `${fileOf(m[1]!)}:${m[2]}:${m[3]}` : '';
}

export function addError(message: string, where = '', now: Date = new Date()): void {
  const text = message.slice(0, 300);
  const last = errors[errors.length - 1];
  if (last && last.message === text && last.where === where) return;
  errors.push({ at: now.toISOString(), message: text, where: where.slice(0, 200) });
  if (errors.length > MAX_ERRORS) errors.shift();
  note('error', text.slice(0, 80), now);
}

let started = false;

/** Listens for errors and for the network coming and going. Once; harmless to call again. */
export function startTrail(target: Window = window): void {
  if (started) return;
  started = true;
  target.addEventListener('error', (e: ErrorEvent) => {
    addError(e.message || 'Script error', e.filename ? `${fileOf(e.filename)}:${e.lineno}:${e.colno}` : frameOf((e.error as Error | undefined)?.stack));
  });
  target.addEventListener('unhandledrejection', (e: Event) => {
    const reason = (e as PromiseRejectionEvent).reason as unknown;
    if (reason instanceof Error) addError(`${reason.name}: ${reason.message}`, frameOf(reason.stack));
    // a rejection that is no Error may carry anything: only its kind is noted
    else addError(`Unhandled rejection (${typeof reason})`);
  });
  target.addEventListener('online', () => note('online', 'back online'));
  target.addEventListener('offline', () => note('online', 'went offline'));
}

/** For tests: forget that the listeners are on (they stay on the old window). */
export function stopTrailForTests(): void {
  started = false;
}

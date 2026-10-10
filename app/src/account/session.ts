/* Who is signed in on this device (campaign flavour). Asked once when the
   app starts and again when the device comes back online. The builder never
   waits for it: warbands live on the device until phase 3h. The last known
   user is kept on the device so that offline the app still knows whose it
   is – only the name and flags, never a token (the cookie is HttpOnly). */
import { useSyncExternalStore } from 'react';
import { api, ApiError, bindAccount, type Me } from './api.ts';

export type Session =
  | { status: 'loading' }
  /** Nobody signed in. */
  | { status: 'out' }
  /** Password right, the authenticator's code is due. */
  | { status: 'pending' }
  | { status: 'in'; user: Me }
  /** The server did not answer; the user last known on this device, if any. */
  | { status: 'unreachable'; user: Me | null };

const KEY = 'mordheim-me';
let state: Session = { status: 'loading' };
const listeners = new Set<() => void>();

function set(next: Session) {
  state = next;
  try {
    if (next.status === 'in') localStorage.setItem(KEY, JSON.stringify(next.user));
    else if (next.status === 'out') localStorage.removeItem(KEY);
  } catch { /* storage may be unavailable; the session still works */ }
  // signed out: the campaign data kept here goes; signed in: everybody else's (security review CLIENT-1)
  if (next.status === 'out' || next.status === 'in') {
    const keep = next.status === 'in' ? next.user.id : null;
    void import('./owner.ts').then((m) => m.forgetCampaignData(keep)).catch(() => undefined);
  }
  for (const l of listeners) l();
}

/** The user last known on this device (kept until a sign-out), for the moment before the server has answered. */
export function knownUser(): Me | null {
  return cached();
}

function cached(): Me | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export const getSession = () => state;

/** The account this tab acts for: signed in, out of reach, or still being asked (the last one known) – null for nobody. */
export function accountId(): string | null {
  const s = state;
  const u = s.status === 'in' || s.status === 'unreachable' ? s.user : s.status === 'loading' ? cached() : null;
  return u?.id ?? null;
}

// every request says whose it is; the server's "another account" means the session changed elsewhere: ask again
bindAccount(accountId, () => { void refreshSession(); });
// another tab signed in or out (it keeps the last user under KEY): ask again
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) void refreshSession(); });

export function subscribeSession(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

/** Asks the server who this device belongs to. */
export async function refreshSession(): Promise<Session> {
  try {
    const me = await api<{ user: Me | null; pending: boolean }>('/auth/me', { as: null });
    set(me.user ? { status: 'in', user: me.user } : me.pending ? { status: 'pending' } : { status: 'out' });
  } catch (e) {
    // a refusal means nobody signed in; anything else, that the server is not there
    set(e instanceof ApiError && !e.unreachable && e.status >= 400 && e.status < 500 ? { status: 'out' } : { status: 'unreachable', user: cached() });
  }
  return state;
}

/** After a sign-in, a code, a link: what the server answered. */
export function signedIn(answer: { stage: 'totp' } | { stage: 'full'; user: Me }): void {
  set(answer.stage === 'full' ? { status: 'in', user: answer.user } : { status: 'pending' });
}

export function signedOut(): void {
  set({ status: 'out' });
}

let started = false;
/** Once per app start; again whenever the device is back online. */
export function startSession(): void {
  if (started) return;
  started = true;
  void refreshSession();
  window.addEventListener('online', () => void refreshSession());
}

/** For tests: back to the start. */
export function resetSession(): void {
  started = false;
  state = { status: 'loading' };
  for (const l of listeners) l();
}

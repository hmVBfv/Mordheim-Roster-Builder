/* Talking to the campaign server (server/src/routes-accounts.ts; phase 3g).
   Only the campaign flavour does: the Quick Build has no server. Every
   request goes to the app's own origin with its cookie; a write is JSON, as
   the server demands (docs/security.md, CSRF). The server's answer is
   always JSON – anything else means it is not there (offline, a proxy page,
   the dev server without the API). */

/** The signed-in user, as GET /auth/me tells it. */
export interface Me {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  /** The authenticator is set up. */
  totp: boolean;
  /** An admin without the authenticator: only the own account until it is set up. */
  mustSetUpTotp: boolean;
}

export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    /** 0: the server could not be reached. */
    readonly status: number,
    /** The server's error code (`invalid_login`, `too_many_attempts` …), or `offline` / `unavailable`. */
    readonly code: string,
    /** Why a value was refused, in the server's words. */
    readonly problem?: string,
    /** Seconds to wait (the brake). */
    readonly retryAfter?: number,
    /** The whole answer, for refusals that carry more (a conflict's other state). */
    readonly body?: Record<string, unknown>,
  ) {
    super(problem ?? code);
  }

  /** The server did not answer at all. */
  get unreachable(): boolean {
    return this.status === 0 || this.code === 'unavailable';
  }
}

const BASE = `${import.meta.env.BASE_URL}api/v1`;

/** The address of an endpoint, for what the browser fetches itself (a picture in an <img>). */
export const apiUrl = (path: string) => `${BASE}${path}`;

/** The server's answer as JSON, or the error it means. */
async function answer<T>(res: Response): Promise<T> {
  const parsed: unknown = (res.headers.get('content-type') ?? '').includes('application/json') ? await res.json().catch(() => null) : null;
  if (!parsed || typeof parsed !== 'object') throw new ApiError(res.status, 'unavailable');
  const json = parsed as Record<string, unknown>;
  if (!res.ok) {
    const retry = Number(json.retryAfter);
    throw new ApiError(res.status, String(json.error ?? 'error'), typeof json.problem === 'string' ? json.problem : undefined, Number.isFinite(retry) ? retry : undefined, json);
  }
  return json as T;
}

/** Sends bytes as they are (a picture, phase 4a3): the one write that is not JSON. */
export async function apiBytes<T>(path: string, bytes: ArrayBuffer, type: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': type }, body: bytes });
  } catch {
    throw new ApiError(0, 'offline');
  }
  return answer<T>(res);
}

export async function api<T>(path: string, init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const write = method !== 'GET';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: write ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      // a write always carries a JSON body: the server reads nothing else
      ...(write ? { body: JSON.stringify(init.body ?? {}) } : {}),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  return answer<T>(res);
}

/** What to tell the player when a request failed. */
export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong.';
  if (e.unreachable) return navigator.onLine ? 'The campaign server does not answer. Try again in a moment.' : 'You are offline – this needs the connection.';
  switch (e.code) {
    case 'invalid_login': return 'Username or password is not right.';
    case 'invalid_code': return 'That code is not right. Codes change every 30 seconds – check the time on your phone.';
    case 'too_many_attempts': return `Too many attempts. Try again in ${waitText(e.retryAfter ?? 30)}.`;
    case 'unknown_share_code': return 'No warband goes with that code. It may have been taken back or have run out (codes last 7 days).';
    case 'gone': return 'That is no longer open: it was taken back, answered or has run out.';
    case 'not_found': return 'That is not there (any more), or not for you.';
    case 'invalid_link': return 'This link is no longer valid: it was used, revoked or has expired. Ask for a new one.';
    case 'sign_in': return 'Please sign in again.';
    case 'forbidden': return 'Your account may not do that.';
    case 'cross_origin': return 'The request did not come from the app. Reload the page and try again.';
    case 'totp_unavailable': return 'The server cannot set up authenticators yet (TOTP_KEY is missing).';
    case 'invalid': return e.problem ? sentence(e.problem) : 'That was not accepted.';
    case 'quota': return 'The campaign has no room for more pictures.';
    default: return 'Something went wrong.';
  }
}

export function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

/** The server's lower-case reasons as a sentence. */
const sentence = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? '' : '.'}`;

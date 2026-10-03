/* A stand-in for the campaign server in the tests: answers by "METHOD
   /path" (without /api/v1 and the query), records what was sent. */
import { vi } from 'vitest';

type Handler = (body: Record<string, unknown>, url: URL) => [number, unknown] | unknown;

export function fakeServer(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; body: Record<string, unknown>; url: URL }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ method, path, body, url });
    const h = routes[`${method} ${path}`];
    if (!h) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    const out = h(body, url);
    const [status, json] = Array.isArray(out) && typeof out[0] === 'number' ? (out as [number, unknown]) : [200, out];
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const ME = { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: false, mustSetUpTotp: false };
export const ADMIN = { id: 'a1', username: 'rob', displayName: 'Rob', isAdmin: true, totp: true, mustSetUpTotp: false };

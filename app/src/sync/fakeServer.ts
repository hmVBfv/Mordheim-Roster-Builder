/* The stand-in server (fakeSync.ts) behind the global fetch, for Vitest. */
import { vi } from 'vitest';
import { createFakeSync } from './fakeSync.ts';

export function fakeSyncServer() {
  const f = createFakeSync();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (f.state.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://localhost/');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api\/v1/, '');
    f.state.calls.push(`${method} ${path}`);
    return f.handle(method, path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  return f;
}

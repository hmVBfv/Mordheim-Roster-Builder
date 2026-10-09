/* The campaign server as the browser sees it in the specs of the campaign
   app: the stand-in of the Vitest suites (src/sync/fakeSync.ts), answered
   by Playwright itself, signed in as Kai. */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { battleEvidence, ctxOf, diffWarbands, loadSave, reconcile, stageTotals } from '@mordheim/core';
import { loadGameData } from '@mordheim/core/node';
import { createFakeSync } from '../src/sync/fakeSync.ts';

export const SAVE = JSON.parse(readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const KAI = { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: false, mustSetUpTotp: false };
const T0 = '2026-10-04T10:00:00.000Z';
const rules = loadGameData();
const totals = (save: unknown) => {
  const r = loadSave(rules, save);
  return r.ok ? stageTotals(ctxOf(rules, r.state)) : { rating: 0, spent: 0, models: 0, heroes: 0, gold: 0, fallen: 0 };
};

/** What changed between two saves, as the server finds and explains it when a warband is marked (server/src/aftermath.ts). */
const changes = (before: unknown, after: unknown, b: { id: string; round: number }) => {
  const sb = loadSave(rules, before), sa = loadSave(rules, after);
  if (!sb.ok || !sa.ok) return [];
  return reconcile(diffWarbands(rules, sb.state, sa.state, b.round), battleEvidence(sa.state, b.id, b.round));
};

/** The server: signed in as Kai, the warband endpoints from the stand-in. */
export async function playServer(page: Page, signedIn = true, o: { totp?: boolean } = {}) {
  const f = createFakeSync({ totals, changes, wbName: (wb) => rules.WARBANDS[wb]?.name ?? wb, districtName: (id) => rules.DISTRICTS.find((d) => d.id === id)?.name ?? id });
  let me = signedIn;
  const user = { ...KAI, totp: !!o.totp };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (f.state.down) return route.abort('internetdisconnected');
    if (path === '/auth/me') return route.fulfill({ json: { user: me ? user : null, pending: false } });
    if (path === '/auth/sessions') return route.fulfill({ json: { sessions: [] } });
    f.state.calls.push(`${req.method()} ${path}`);
    const type = (await req.headerValue('content-type')) ?? '';
    // a picture's bytes arrive as they are
    const body = type.startsWith('image/') ? { raw: new Uint8Array(req.postDataBuffer() ?? Buffer.alloc(0)), type } : ((req.postDataJSON() ?? {}) as Record<string, unknown>);
    const res = f.handle(req.method(), path, url.searchParams, body);
    return route.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }, body: Buffer.from(await res.arrayBuffer()) });
  });
  return { ...f, signIn: () => { me = true; } };
}

export function serverWarband(f: ReturnType<typeof createFakeSync>, name: string, draft?: { name: string; device: string }) {
  const id = crypto.randomUUID();
  const seq = ++f.state.seq;
  f.state.warbands.set(id, {
    id, headRev: 1, versions: [{ rev: 1, data: { ...SAVE, name }, createdAt: T0, source: 'save' }], archivedAt: null, seq,
    draft: draft ? { baseRev: 1, data: { ...SAVE, name: draft.name }, device: draft.device, updatedAt: T0, seq: ++f.state.seq } : null,
    copiedFrom: null, createdAt: T0,
  });
  return id;
}


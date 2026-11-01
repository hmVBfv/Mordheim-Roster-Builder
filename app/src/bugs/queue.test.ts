/* A problem report written without a connection (wish #177, Rob, 1.11.2026): it waits on the device and goes out by itself once the
   server answers. The id comes from the device, so a report sent twice is one report. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db.ts';
import type { ReportBody } from './api.ts';
import { flushReports, queueReport, waitingReports } from './queue.ts';

const body = (id: string, over: Partial<ReportBody> = {}): ReportBody => ({
  id, kind: 'bug', title: 'It hangs', text: 'It hangs.', sourceRef: '', appVersion: 'abc1234', device: '', view: '', context: null, jsErrors: [], attach: null, ...over,
});
const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const bug = { id: 'x', number: 7, kind: 'bug', title: 'It hangs', text: 'It hangs.', sourceRef: '', status: 'new', fixedIn: '', createdAt: '', updatedAt: '' };

beforeEach(async () => { await db.meta.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('the reports that wait', () => {
  it('are kept for the person who wrote them, oldest first', async () => {
    await queueReport('kai', body('11111111-1111-4111-8111-111111111111'));
    await queueReport('ben', body('22222222-2222-4222-8222-222222222222'));
    await queueReport('kai', body('33333333-3333-4333-8333-333333333333'));
    expect((await waitingReports('kai')).map((r) => r.id)).toEqual(['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333']);
    expect((await waitingReports('ben')).length).toBe(1);
  });

  it('go out when the server answers, each for its author, and are gone from the device', async () => {
    const f = vi.fn(async () => json(201, { bug }));
    vi.stubGlobal('fetch', f);
    await queueReport('kai', body('11111111-1111-4111-8111-111111111111'));
    await queueReport('kai', body('33333333-3333-4333-8333-333333333333'));
    expect(await flushReports('kai')).toBe(2);
    expect(await waitingReports('kai')).toEqual([]);
    const sent = (f.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => ({ id: (JSON.parse(String(init.body)) as { id: string }).id, as: new Headers(init.headers).get('x-roster-user') }));
    expect(sent).toEqual([{ id: '11111111-1111-4111-8111-111111111111', as: 'kai' }, { id: '33333333-3333-4333-8333-333333333333', as: 'kai' }]);
  });

  it('wait on while the server does not answer, and nothing after the first that could not go', async () => {
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', f);
    await queueReport('kai', body('11111111-1111-4111-8111-111111111111'));
    await queueReport('kai', body('33333333-3333-4333-8333-333333333333'));
    expect(await flushReports('kai')).toBe(0);
    expect((await waitingReports('kai')).length).toBe(2);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('are dropped when the server refuses them for good, so they never block the others, and kept when it is only the daily limit', async () => {
    const answers = [json(400, { error: 'invalid', problem: 'not a report' }), json(429, { error: 'too_many' }), json(201, { bug })];
    vi.stubGlobal('fetch', vi.fn(async () => answers.shift()!));
    await queueReport('kai', body('11111111-1111-4111-8111-111111111111'));
    await queueReport('kai', body('22222222-2222-4222-8222-222222222222'));
    await queueReport('kai', body('33333333-3333-4333-8333-333333333333'));
    expect(await flushReports('kai')).toBe(1);
    expect((await waitingReports('kai')).map((r) => r.id)).toEqual(['22222222-2222-4222-8222-222222222222']);
  });

  it('are not sent as another account: the server refuses it and they wait for their author', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'other_user' })));
    await queueReport('kai', body('11111111-1111-4111-8111-111111111111'));
    expect(await flushReports('kai')).toBe(0);
    expect((await waitingReports('kai')).length).toBe(1);
  });
});

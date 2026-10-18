/* The live client (ADR 0020): one stream while someone is signed in, signals
   told to the screens that show the campaign, and the old waiting as the
   fallback. The EventSource is a stand-in the test drives by hand. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recentSteps, resetTrail } from '../bugs/trail.ts';
import { getLiveState, onAnyCampaign, onCampaign, onSync, pollWhileVisible, SAFETY_EVERY, SETTLE_MAX_MS, SETTLE_MS, SILENT_MS, startLive, stopLive, useOnAnyCampaign, useOnCampaign } from './live.ts';

class FakeSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static all: FakeSource[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly handlers = new Map<string, ((e: { data: string }) => void)[]>();
  constructor(readonly url: string) { FakeSource.all.push(this); }
  addEventListener(type: string, f: (e: { data: string }) => void) { this.handlers.set(type, [...(this.handlers.get(type) ?? []), f]); }
  close() { this.readyState = FakeSource.CLOSED; }
  // what the test does to it
  open() { this.readyState = FakeSource.OPEN; this.onopen?.(); }
  say(type: string, data: string) { for (const f of this.handlers.get(type) ?? []) f({ data }); }
  signal(s: unknown) { this.say('change', JSON.stringify(s)); }
  fail(closedForGood: boolean) { this.readyState = closedForGood ? FakeSource.CLOSED : FakeSource.CONNECTING; this.onerror?.(); }
}
const last = () => FakeSource.all[FakeSource.all.length - 1]!;
const settle = () => vi.advanceTimersByTime(SETTLE_MS + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', FakeSource);
  // no jitter in the waits between attempts
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  FakeSource.all = [];
  resetTrail();
});
afterEach(() => {
  stopLive();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Opens the stream and lets the catch-up that follows the opening go by. */
function live(user = 'u1') {
  startLive(user);
  last().open();
  settle();
  return last();
}

describe('the connection', () => {
  it('opens one stream for the account, and is live once it has opened', () => {
    expect(getLiveState()).toBe('off');
    startLive('u1');
    expect(FakeSource.all).toHaveLength(1);
    expect(last().url).toMatch(/\/events\?user=u1$/);
    expect(getLiveState()).toBe('connecting');
    last().open();
    expect(getLiveState()).toBe('live');
  });

  it('puts the account in the address, escaped (an EventSource cannot send a header)', () => {
    startLive('a b&c');
    expect(last().url).toMatch(/\/events\?user=a%20b%26c$/);
  });

  it('does not open a second stream for the same account, and replaces it for another', () => {
    startLive('u1');
    startLive('u1');
    expect(FakeSource.all).toHaveLength(1);
    const first = last();
    startLive('u2');
    expect(FakeSource.all).toHaveLength(2);
    expect(first.readyState).toBe(FakeSource.CLOSED);
    expect(last().url).toMatch(/user=u2$/);
  });

  it('closes on stop, and what comes in afterwards is ignored', () => {
    const s = live();
    const calls = vi.fn();
    const off = onCampaign('c1', calls);
    stopLive();
    expect(getLiveState()).toBe('off');
    expect(s.readyState).toBe(FakeSource.CLOSED);
    s.signal({ campaign: 'c1' });
    settle();
    expect(calls).not.toHaveBeenCalled();
    off();
  });

  it('does nothing in a browser without EventSource', () => {
    vi.stubGlobal('EventSource', undefined);
    startLive('u1');
    expect(FakeSource.all).toHaveLength(0);
    expect(getLiveState()).toBe('off');
  });

  it('notes the state in the trail of a problem report, as fixed words under the sync', () => {
    live();
    stopLive();
    expect(recentSteps().map((s) => `${s.kind}: ${s.what}`)).toEqual(['sync: stream connecting', 'sync: stream live', 'sync: stream off']);
  });
});

describe('what a signal does', () => {
  it('asks every screen again when the stream opens (what came in meanwhile is not replayed)', () => {
    const one = vi.fn(), any = vi.fn(), sync = vi.fn();
    const offs = [onCampaign('c1', one), onAnyCampaign(any), onSync(sync)];
    startLive('u1');
    last().open();
    expect(one).not.toHaveBeenCalled();
    settle();
    expect(one).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(1);
    offs.forEach((f) => f());
  });

  it('tells a campaign signal to that campaign, to the lists and to the sync – not to another campaign', () => {
    const s = live();
    const one = vi.fn(), other = vi.fn(), any = vi.fn(), sync = vi.fn();
    const offs = [onCampaign('c1', one), onCampaign('c2', other), onAnyCampaign(any), onSync(sync)];
    s.signal({ campaign: 'c1' });
    settle();
    expect(one).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(any).toHaveBeenCalledTimes(1);
    // what a campaign changes in one's own warbands (an enrolment, a closed battle) comes with the sync
    expect(sync).toHaveBeenCalledTimes(1);
    offs.forEach((f) => f());
  });

  it('tells a sync signal to the sync only', () => {
    const s = live();
    const one = vi.fn(), any = vi.fn(), sync = vi.fn();
    const offs = [onCampaign('c1', one), onAnyCampaign(any), onSync(sync)];
    s.signal({ sync: true });
    settle();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(one).not.toHaveBeenCalled();
    expect(any).not.toHaveBeenCalled();
    offs.forEach((f) => f());
  });

  it('makes one round of many signals that follow each other', () => {
    const s = live();
    const one = vi.fn(), two = vi.fn();
    const offs = [onCampaign('c1', one), onCampaign('c2', two)];
    for (let i = 0; i < 5; i++) { s.signal({ campaign: 'c1' }); vi.advanceTimersByTime(50); }
    s.signal({ campaign: 'c2' });
    settle();
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
    offs.forEach((f) => f());
  });

  it('never keeps a screen waiting longer than the maximum, however busy the night is', () => {
    const s = live();
    const one = vi.fn();
    const off = onCampaign('c1', one);
    // a signal every 100 ms keeps pushing the round back (150 ms) …
    for (let t = 0; t < SETTLE_MAX_MS - 100; t += 100) { s.signal({ campaign: 'c1' }); vi.advanceTimersByTime(100); }
    expect(one).not.toHaveBeenCalled();
    // … but not past the maximum
    for (let t = 0; t < 300; t += 100) { s.signal({ campaign: 'c1' }); vi.advanceTimersByTime(100); }
    expect(one.mock.calls.length).toBeGreaterThanOrEqual(1);
    off();
  });

  it('ignores what is not a signal', () => {
    const s = live();
    const one = vi.fn(), any = vi.fn(), sync = vi.fn();
    const offs = [onCampaign('c1', one), onAnyCampaign(any), onSync(sync)];
    s.say('change', 'not json');
    s.say('change', 'null');
    s.say('change', '"c1"');
    s.signal({});
    s.signal({ campaign: '' });
    s.signal({ campaign: 7 });
    s.signal({ sync: 'yes' });
    settle();
    expect(one).not.toHaveBeenCalled();
    expect(any).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    offs.forEach((f) => f());
  });

  it('stops telling a screen that has gone, and one screen failing does not stop the others', async () => {
    const s = live();
    const good = vi.fn();
    const offs = [
      onCampaign('c1', () => { throw new Error('boom'); }),
      onCampaign('c1', () => Promise.reject(new Error('later'))),
      onCampaign('c1', good),
    ];
    s.signal({ campaign: 'c1' });
    settle();
    expect(good).toHaveBeenCalledTimes(1);
    offs[2]!();
    s.signal({ campaign: 'c1' });
    settle();
    expect(good).toHaveBeenCalledTimes(1);
    offs.forEach((f) => f());
    await Promise.resolve();
  });
});

describe('when the connection is lost', () => {
  it('is down while the browser tries again by itself, and asks everything again when it is back', () => {
    const s = live();
    const one = vi.fn();
    const off = onCampaign('c1', one);
    one.mockClear();
    s.fail(false);
    expect(getLiveState()).toBe('down');
    expect(FakeSource.all).toHaveLength(1);
    s.open();
    expect(getLiveState()).toBe('live');
    settle();
    expect(one).toHaveBeenCalledTimes(1);
    off();
  });

  it('opens a new stream after a refusal, waiting longer each time, and starts over after a success', () => {
    startLive('u1');
    last().fail(true);
    expect(getLiveState()).toBe('down');
    vi.advanceTimersByTime(4_999);
    expect(FakeSource.all).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(FakeSource.all).toHaveLength(2);
    last().fail(true);
    vi.advanceTimersByTime(9_999);
    expect(FakeSource.all).toHaveLength(2);
    vi.advanceTimersByTime(2);
    expect(FakeSource.all).toHaveLength(3);
    last().open();
    settle();
    expect(getLiveState()).toBe('live');
    last().fail(true);
    vi.advanceTimersByTime(5_001);
    expect(FakeSource.all).toHaveLength(4);
  });

  it('does not wait longer than five minutes', () => {
    startLive('u1');
    for (let i = 0; i < 12; i++) { last().fail(true); vi.advanceTimersByTime(5 * 60_000 + 1); }
    const n = FakeSource.all.length;
    last().fail(true);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(FakeSource.all).toHaveLength(n + 1);
  });

  it('gives up a connection that has been silent too long although the browser did not notice', () => {
    live();
    vi.advanceTimersByTime(SILENT_MS - 5_000);
    expect(FakeSource.all).toHaveLength(1);
    vi.advanceTimersByTime(30_000);
    expect(FakeSource.all).toHaveLength(2);
  });

  it('keeps a connection that answers the server\'s pings', () => {
    const s = live();
    for (let t = 0; t < 10; t++) { vi.advanceTimersByTime(20_000); s.say('ping', '0'); }
    expect(FakeSource.all).toHaveLength(1);
    expect(getLiveState()).toBe('live');
  });

  it('asks everything again when the app comes back to the front', () => {
    const one = vi.fn();
    const off = onCampaign('c1', one);
    live();
    one.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    settle();
    expect(one).toHaveBeenCalledTimes(1);
    off();
  });

  it('tries at once to open a stream that is down when the app comes back or the network does', () => {
    startLive('u1');
    last().fail(true);
    expect(FakeSource.all).toHaveLength(1);
    window.dispatchEvent(new Event('online'));
    expect(FakeSource.all).toHaveLength(2);
  });
});

describe('the screens\' own timers', () => {
  const hidden = (h: boolean) => vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(h ? 'hidden' : 'visible');

  it('ask on every round while there is no stream', () => {
    const refresh = vi.fn();
    const stop = pollWhileVisible(refresh, 1_000);
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(5);
    stop();
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(5);
  });

  it('ask only on every sixth round while the stream is open', () => {
    live();
    const refresh = vi.fn();
    const stop = pollWhileVisible(refresh, 1_000);
    vi.advanceTimersByTime(SAFETY_EVERY * 1_000 * 2);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('go back to every round when the stream goes down', () => {
    const s = live();
    const refresh = vi.fn();
    const stop = pollWhileVisible(refresh, 1_000);
    vi.advanceTimersByTime(3_000);
    expect(refresh).not.toHaveBeenCalled();
    s.fail(false);
    vi.advanceTimersByTime(3_000);
    expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(3);
    stop();
  });

  it('do not ask while the app is hidden', () => {
    const spy = hidden(true);
    const refresh = vi.fn();
    const stop = pollWhileVisible(refresh, 1_000);
    vi.advanceTimersByTime(5_000);
    expect(refresh).not.toHaveBeenCalled();
    stop();
    spy.mockRestore();
  });
});

describe('the hooks of a screen', () => {
  it('ask again for the campaign they show, with the latest function, and stop when the screen goes', () => {
    const s = live();
    let n = 0;
    const seen: number[] = [];
    const { rerender, unmount } = renderHook(({ cid }: { cid: string | undefined }) => { const mine = ++n; useOnCampaign(cid, () => seen.push(mine)); }, { initialProps: { cid: 'c1' as string | undefined } });
    s.signal({ campaign: 'c1' });
    settle();
    expect(seen).toHaveLength(1);
    rerender({ cid: 'c1' });
    s.signal({ campaign: 'c1' });
    settle();
    expect(seen).toHaveLength(2);
    // the newest render's function ran, not the first one's
    expect(seen[1]).toBeGreaterThan(seen[0]!);
    rerender({ cid: undefined });
    s.signal({ campaign: 'c1' });
    settle();
    expect(seen).toHaveLength(2);
    unmount();
  });

  it('ask again when any campaign has news', () => {
    const s = live();
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useOnAnyCampaign(refresh));
    s.signal({ campaign: 'c9' });
    settle();
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    s.signal({ campaign: 'c9' });
    settle();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

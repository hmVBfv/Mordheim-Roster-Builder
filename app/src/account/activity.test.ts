/* "Last seen" of a user (Rob, 31.10.2026): somebody is at the app when the tab is in front and they touch it – change the section, work on
   the roster, scroll. A tab left open in the background is not. The app tells the server on its requests (X-Roster-Active) and keeps one
   request going every few minutes while somebody is there. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.ts';
import { isActive, startActivity, stopActivity } from './activity.ts';

const visibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};
const MIN = 60 * 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T12:00:00Z')); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); });
afterEach(() => { stopActivity(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('somebody is at the app', () => {
  it('only after they touched it, and for a few minutes', () => {
    startActivity(() => undefined);
    expect(isActive()).toBe(false);
    document.dispatchEvent(new Event('pointerdown'));
    expect(isActive()).toBe(true);
    vi.advanceTimersByTime(2 * MIN);
    expect(isActive()).toBe(true);
    vi.advanceTimersByTime(2 * MIN);
    expect(isActive()).toBe(false);
  });

  it('never from a tab in the background, whatever it does; coming to the front counts', () => {
    startActivity(() => undefined);
    visibility('hidden');
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(isActive()).toBe(false);
    visibility('visible');
    expect(isActive()).toBe(true);
    visibility('hidden');
    expect(isActive()).toBe(false);
  });

  it('is told for touches, keys, scrolling and the Back button', () => {
    startActivity(() => undefined);
    for (const e of [new Event('touchstart'), new KeyboardEvent('keydown'), new Event('scroll'), new Event('popstate')]) {
      vi.advanceTimersByTime(10 * MIN);
      expect(isActive()).toBe(false);
      (e.type === 'popstate' ? window : document).dispatchEvent(e);
      expect(isActive(), e.type).toBe(true);
    }
  });
});

describe('what the server hears', () => {
  const ok = () => new Response('{}', { headers: { 'content-type': 'application/json' } });

  it('says "active" on a request while somebody is there, and nothing in the background', async () => {
    const f = vi.fn<typeof fetch>(async () => ok());
    const headersOf = (i: number) => new Headers(f.mock.calls[i]![1]!.headers);
    vi.stubGlobal('fetch', f);
    startActivity(() => undefined);
    await api('/sync');
    expect(headersOf(0).get('x-roster-active')).toBeNull();
    document.dispatchEvent(new Event('pointerdown'));
    await api('/sync');
    expect(headersOf(1).get('x-roster-active')).toBe('1');
    visibility('hidden');
    await api('/sync');
    expect(headersOf(2).get('x-roster-active')).toBeNull();
  });

  it('keeps one request going while somebody is there: at most every four minutes, none in the background', () => {
    const ping = vi.fn();
    startActivity(ping);
    document.dispatchEvent(new Event('pointerdown'));
    expect(ping).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(3 * MIN);
    document.dispatchEvent(new Event('pointerdown'));
    expect(ping).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * MIN);
    document.dispatchEvent(new Event('pointerdown'));
    expect(ping).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10 * MIN);
    visibility('hidden');
    document.dispatchEvent(new Event('pointerdown'));
    expect(ping).toHaveBeenCalledTimes(2);
  });
});

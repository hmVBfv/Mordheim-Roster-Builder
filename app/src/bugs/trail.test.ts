/* The trail of a problem report: only structure and fixed words, never an id,
   a name, a title or anything typed (ADR 0002). */
import { beforeEach, describe, expect, it } from 'vitest';
import { TABS } from '../account/Admin.tsx';
import appSource from '../app/App.tsx?raw';
import campaignSource from '../campaign/Campaign.tsx?raw';
import { addError, callPattern, frameOf, MAX_ERRORS, MAX_STEPS, note, recentErrors, recentSteps, resetTrail, routePattern, SCREEN_WORDS, startTrail, stopTrailForTests } from './trail.ts';

beforeEach(() => { resetTrail(); stopTrailForTests(); });

const T = (n: number) => new Date(Date.UTC(2026, 9, 17, 12, 0, n));

describe('the steps', () => {
  it('lists them oldest first and counts the same step again instead of listing it twice', () => {
    note('screen', '/', T(1));
    note('edit', 'a change to the warband', T(2));
    note('edit', 'a change to the warband', T(3));
    note('edit', 'a change to the warband', T(4));
    note('screen', '/more', T(5));
    expect(recentSteps()).toEqual([
      { at: T(1).toISOString(), kind: 'screen', what: '/', n: 1 },
      { at: T(4).toISOString(), kind: 'edit', what: 'a change to the warband', n: 3 },
      { at: T(5).toISOString(), kind: 'screen', what: '/more', n: 1 },
    ]);
  });

  it('keeps the last thirty and clamps a long step', () => {
    for (let i = 0; i < MAX_STEPS + 10; i++) note('screen', `/step-${i}`, T(i));
    const steps = recentSteps();
    expect(steps).toHaveLength(MAX_STEPS);
    expect(steps[0]!.what).toBe('/step-10');
    note('api', 'x'.repeat(500), T(99));
    expect(recentSteps().at(-1)!.what).toHaveLength(160);
  });

  it('hands out copies: a report cannot change the trail', () => {
    note('screen', '/', T(1));
    recentSteps()[0]!.what = 'changed';
    expect(recentSteps()[0]!.what).toBe('/');
  });
});

describe('screens and calls as patterns', () => {
  const id = '3f2a9c1e-5b7d-4f60-9a1c-2d8e7b6a5f40';

  it('keeps the words of the app’s own routes and turns everything else into :id', () => {
    expect(routePattern('/')).toBe('/');
    expect(routePattern(`/warbands/${id}/trade`)).toBe('/warbands/:id/trade');
    expect(routePattern(`/campaign/${id}/world`)).toBe('/campaign/:id/world');
    expect(routePattern(`/campaign/${id}/warbands/${id}`)).toBe('/campaign/:id/warbands/:id');
    expect(routePattern('/admin/bugs')).toBe('/admin/bugs');
    // a title, a name or a token in an address never stays
    expect(routePattern('/warbands/Rangvalds-Reavers/export')).toBe('/warbands/:id/export');
    expect(routePattern('/invite/SECRET-TOKEN-abc123')).toBe('/invite/:id');
    expect(routePattern(`/campaign/${id}/world?secret=1#frag`)).toBe('/campaign/:id/world');
  });

  it('knows every fixed word of the routes, the campaign tabs and the admin tabs', () => {
    const words = [...appSource.matchAll(/path="([^"]+)"/g)].flatMap((m) => m[1]!.split('/')).filter((w) => w && !w.startsWith(':') && w !== '*');
    expect(words.length).toBeGreaterThan(15);
    expect(words.filter((w) => !SCREEN_WORDS.has(w))).toEqual([]);
    const tabs = [...campaignSource.matchAll(/tab === '([a-z-]+)'/g)].map((m) => m[1]!);
    expect(tabs.length).toBeGreaterThan(5);
    expect(tabs.filter((w) => !SCREEN_WORDS.has(w))).toEqual([]);
    expect(TABS.map((t) => t.key).filter((w) => !SCREEN_WORDS.has(w))).toEqual([]);
  });

  it('a call keeps its plain words and loses ids, codes, tokens and the query', () => {
    expect(callPattern(`/warbands/${id}/versions/3?x=1`)).toBe('/warbands/:id/versions/:id');
    expect(callPattern('/shares/K7M2-Q9XD')).toBe('/shares/:id');
    expect(callPattern(`/campaigns/${id}/chapter-drafts/${id}/publish`)).toBe('/campaigns/:id/chapter-drafts/:id/publish');
    expect(callPattern('/invites/q3Jv-8zX_Token1234567890abcdefghijklmnopq')).toBe('/invites/:id');
    expect(callPattern('/bugs')).toBe('/bugs');
  });
});

describe('JavaScript errors', () => {
  const target = () => new EventTarget() as unknown as Window;

  it('notes an error and an unhandled rejection with where they were thrown, and says so in the steps', () => {
    const t = target();
    startTrail(t);
    t.dispatchEvent(Object.assign(new Event('error'), { message: 'TypeError: x is undefined', filename: 'https://pi.example/assets/index-abc.js', lineno: 12, colno: 3 }));
    const reason = Object.assign(new Error('boom'), { stack: 'Error: boom\n    at f (https://pi.example/assets/chunk-9.js:40:7)' });
    t.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
    expect(recentErrors().map((e) => [e.message, e.where])).toEqual([['TypeError: x is undefined', 'index-abc.js:12:3'], ['Error: boom', 'chunk-9.js:40:7']]);
    expect(recentSteps().map((s) => [s.kind, s.what])).toEqual([['error', 'TypeError: x is undefined'], ['error', 'Error: boom']]);
  });

  it('keeps only the kind of a rejection that is no Error – it may carry anything', () => {
    const t = target();
    startTrail(t);
    t.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'SECRET words somebody typed' }));
    expect(JSON.stringify([recentErrors(), recentSteps()])).not.toMatch(/SECRET/);
    expect(recentErrors()[0]!.message).toBe('Unhandled rejection (string)');
  });

  it('listens once, notes the same error once in a row, and keeps the last five', () => {
    const t = target();
    startTrail(t);
    startTrail(t);
    const fire = (m: string) => t.dispatchEvent(Object.assign(new Event('error'), { message: m, filename: '', lineno: 0, colno: 0 }));
    fire('same');
    fire('same');
    expect(recentErrors()).toHaveLength(1);
    for (let i = 0; i < MAX_ERRORS + 3; i++) addError(`error ${i}`);
    expect(recentErrors().map((e) => e.message)).toEqual(['error 3', 'error 4', 'error 5', 'error 6', 'error 7']);
    addError('y'.repeat(900), 'z'.repeat(900));
    expect(recentErrors().at(-1)!.message).toHaveLength(300);
    expect(recentErrors().at(-1)!.where).toHaveLength(200);
  });

  it('notes the network coming and going', () => {
    const t = target();
    startTrail(t);
    t.dispatchEvent(new Event('offline'));
    t.dispatchEvent(new Event('online'));
    expect(recentSteps().map((s) => s.what)).toEqual(['went offline', 'back online']);
  });

  it('finds the first frame of a stack', () => {
    expect(frameOf('Error: x\n    at a (https://h.example/assets/app-1.js:5:9)\n    at b (https://h.example/assets/app-2.js:6:1)')).toBe('app-1.js:5:9');
    expect(frameOf('no frames here')).toBe('');
    expect(frameOf(undefined)).toBe('');
  });
});

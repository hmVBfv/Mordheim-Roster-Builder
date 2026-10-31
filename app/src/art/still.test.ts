/* The banner's lights and wings move for ever (art.module.css). Chrome has to draw the whole picture again on every frame, and it does it
   for a window nobody is looking at as well: one on a second monitor, while a video plays in another window, kept the graphics process
   busy until the video stalled (report of 31.10.2026). A window that is not in front and in focus holds its pictures still. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startStill, stopStill } from './still.ts';

const focus = (on: boolean) => { document.hasFocus = () => on; window.dispatchEvent(new Event(on ? 'focus' : 'blur')); };
const visibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};
const still = () => document.documentElement.hasAttribute('data-still');

beforeEach(() => { document.hasFocus = () => true; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); });
afterEach(() => { stopStill(); document.documentElement.removeAttribute('data-still'); });

describe('a window nobody is at', () => {
  it('moves while it is in front and in focus', () => {
    startStill();
    expect(still()).toBe(false);
  });

  it('holds still the moment it loses focus, and moves again when it has it back', () => {
    startStill();
    focus(false);
    expect(still()).toBe(true);
    focus(true);
    expect(still()).toBe(false);
  });

  it('holds still in the background, and is judged when it starts', () => {
    startStill();
    visibility('hidden');
    expect(still()).toBe(true);
    visibility('visible');
    expect(still()).toBe(false);
    stopStill();
    document.hasFocus = () => false;
    startStill();
    expect(still()).toBe(true);
  });
});

describe('the pictures', () => {
  it('every endless animation of the banner stops while the window is held still, and none is left out', () => {
    const css = readFileSync(join(process.cwd(), 'src/art/art.module.css'), 'utf8') // vitest runs in app/;
    const animated = [...css.matchAll(/\.(\w+)\s*\{\s*animation:[^;]*\binfinite\b/g)].map((m) => m[1]!);
    expect(animated.length).toBeGreaterThanOrEqual(9);
    const still = css.slice(css.indexOf('data-still'));
    expect(css, 'a rule for a held-still window').toContain(':global(html[data-still])');
    for (const name of animated) expect(still, `.${name} pauses`).toMatch(new RegExp(`\\.${name}\\b`));
    expect(still).toContain('animation-play-state: paused');
  });
});

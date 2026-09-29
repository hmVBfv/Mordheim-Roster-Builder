import { describe, expect, it } from 'vitest';
import { shownVersion } from './version.ts';

/* A full commit hash is 40 characters without a place to break: at 360 px
   it can be wider than the screen, depending on its digits. The CI found it
   (pull request #1, 29.09.2026). */
describe('the version shown on the More screen', () => {
  it('is the short form of a commit hash', () => {
    expect(shownVersion('69fbdc5e0a1b2c3d4e5f60718293a4b5c6d7e8f9')).toBe('69fbdc5');
  });
  it('stays as it is otherwise', () => {
    expect(shownVersion('dev')).toBe('dev');
    expect(shownVersion('1.2.0')).toBe('1.2.0');
  });
});

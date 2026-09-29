import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, readChoice, resolveTheme, setChoice, THEME_KEY } from './theme.ts';

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

describe('theme', () => {
  it('is Chronicle unless chosen otherwise', () => {
    expect(readChoice()).toBe('chronicle');
    expect(applyTheme()).toBe('chronicle');
    expect(document.documentElement.dataset.theme).toBe('chronicle');
  });

  it('keeps the choice on the device', () => {
    setChoice('parchment');
    expect(localStorage.getItem(THEME_KEY)).toBe('parchment');
    expect(document.documentElement.dataset.theme).toBe('parchment');
    expect(readChoice()).toBe('parchment');
  });

  it('follows the system when asked to', () => {
    expect(resolveTheme('system', true)).toBe('parchment');
    expect(resolveTheme('system', false)).toBe('chronicle');
    expect(resolveTheme('parchment', false)).toBe('parchment');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(THEME_KEY, 'neon');
    expect(readChoice()).toBe('chronicle');
  });
});

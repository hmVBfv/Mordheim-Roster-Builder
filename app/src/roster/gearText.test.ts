/* Wish #114: the lines of a unit's gear (and skills, injuries) were set in the page's full text size, larger than everything
   around them on the card. They now take the card's own size. jsdom lays nothing out, so this reads the style sheet. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/roster/Board.module.css', 'utf8');
const rule = (sel: string) => new RegExp(`(?:^|\\n)${sel.replace(/[.\s]/g, (c) => (c === '.' ? '\\.' : '\\s+'))}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('the lines of a unit\'s gear', () => {
  it('are set in the size of the card\'s other texts, not the page\'s full size', () => {
    const size = /font-size:\s*([\d.]+)rem/.exec(rule('.lines li'))?.[1];
    expect(Number(size)).toBeGreaterThan(0);
    expect(Number(size)).toBeLessThanOrEqual(0.92);
  });
});

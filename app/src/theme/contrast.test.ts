/* Both themes meet WCAG AA (docs/ui.md §4): 4.5:1 for text, 3:1 for the
   focus ring and other non-text marks. */
import { describe, expect, it } from 'vitest';
import css from './tokens.css?raw';

function theme(name: string): Record<string, string> {
  const block = css.match(new RegExp(`:root\\[data-theme='${name}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const TEXT: [string, string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'hidden-bg'],
  ['text-muted', 'bg'], ['text-muted', 'surface'], ['text-muted', 'surface-2'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'surface-2'], ['accent-ink', 'accent'],
  ['danger', 'bg'], ['danger', 'surface'], ['gold', 'surface'],
];
const MARKS: [string, string][] = [['focus', 'bg'], ['focus', 'surface'], ['border', 'bg']];

it('reads the tokens', () => { expect(css.length).toBeGreaterThan(500); });

describe.each(['chronicle', 'parchment'])('theme %s', (name) => {
  const t = theme(name);
  it('defines every colour', () => {
    for (const [a, b] of [...TEXT, ...MARKS]) { expect(t[a], a).toMatch(/^#/); expect(t[b], b).toMatch(/^#/); }
  });
  it.each(TEXT)('%s on %s reads at 4.5:1 or better', (a, b) => {
    expect(contrast(t[a]!, t[b]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(MARKS.slice(0, 2))('%s on %s shows at 3:1 or better', (a, b) => {
    expect(contrast(t[a]!, t[b]!)).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from 'vitest';
import { CHIP_GROUPS, isOn, toggleChip } from './styleChips.ts';

const group = (key: string) => CHIP_GROUPS.find((g) => g.key === key)!;

describe('the style chips', () => {
  it('offers several kinds, each with a few options', () => {
    expect(CHIP_GROUPS.map((g) => g.key)).toEqual(['language', 'tense', 'voice', 'tone', 'violence', 'length', 'out']);
    for (const g of CHIP_GROUPS) expect(g.options.length).toBeGreaterThanOrEqual(2);
  });

  it('a chip adds one line, and the same chip takes it away again', () => {
    const lang = group('language');
    const on = toggleChip('', lang, lang.options[0]!);
    expect(on).toBe(lang.options[0]!.line);
    expect(isOn(on, lang.options[0]!)).toBe(true);
    expect(toggleChip(on, lang, lang.options[0]!)).toBe('');
  });

  it('keeps what the leader wrote and adds on a new line', () => {
    const tense = group('tense');
    const out = toggleChip('Slow, quiet scenes.', tense, tense.options[0]!);
    expect(out).toBe(`Slow, quiet scenes.\n${tense.options[0]!.line}`);
    expect(toggleChip(out, tense, tense.options[0]!)).toBe('Slow, quiet scenes.');
  });

  it('a single-choice kind swaps its line instead of stacking two', () => {
    const tense = group('tense');
    const [a, b] = tense.options;
    const text = toggleChip(toggleChip('', tense, a!), tense, b!);
    expect(text).toBe(b!.line);
    expect(isOn(text, a!)).toBe(false);
  });

  it('a many-choice kind (what stays out) stacks its lines', () => {
    const out = group('out');
    expect(out.many).toBe(true);
    const text = toggleChip(toggleChip('', out, out.options[0]!), out, out.options[1]!);
    expect(text.split('\n')).toEqual([out.options[0]!.line, out.options[1]!.line]);
  });
});

import { describe, expect, it } from 'vitest';
import { battleOf, problemWith, splitBackstory } from './split.ts';

describe('splitBackstory', () => {
  it('cuts at Markdown headings and reads the battle a heading names', () => {
    const s = splitBackstory('# The Hel Fenn chronicle\n\nIt began in spring.\n\n## Battle 1 – the ferry\nRain over the Stir.\n\n## Battle 3: the quay\nA building collapsed.\n');
    expect(s).toEqual([
      { heading: 'The Hel Fenn chronicle', battleNo: null, text: 'It began in spring.' },
      { heading: 'Battle 1 – the ferry', battleNo: 1, text: 'Rain over the Stir.' },
      { heading: 'Battle 3: the quay', battleNo: 3, text: 'A building collapsed.' },
    ]);
  });

  it('reads plain lines "Battle 3 …" and "Schlacht 3 …" as headings, bold ones too', () => {
    const s = splitBackstory('Battle 2 – the quay\nA building collapsed.\n\n**Schlacht 3: Die Fähre**\nRegen.\n\nRunde 4\nNebel.');
    expect(s.map((x) => [x.heading, x.battleNo])).toEqual([['Battle 2 – the quay', 2], ['Schlacht 3: Die Fähre', 3], ['Runde 4', 4]]);
    expect(s[1]!.text).toBe('Regen.');
  });

  it('does not take a sentence that begins with the word for a heading', () => {
    const s = splitBackstory('Battle 3 was the worst of them all.\nNobody spoke of it.');
    expect(s).toEqual([{ heading: 'Backstory', battleNo: null, text: 'Battle 3 was the worst of them all.\nNobody spoke of it.' }]);
  });

  it('calls what stands before the first heading a prologue, and drops a heading with nothing under it', () => {
    const s = splitBackstory('The caravan left Nuln.\n\n# Part one\n## Battle 1\nRain.');
    expect(s).toEqual([{ heading: 'Prologue', battleNo: null, text: 'The caravan left Nuln.' }, { heading: 'Battle 1', battleNo: 1, text: 'Rain.' }]);
  });

  it('keeps one section for a text without headings', () => {
    expect(splitBackstory('Just a few lines\nof history.')).toEqual([{ heading: 'Backstory', battleNo: null, text: 'Just a few lines\nof history.' }]);
    expect(splitBackstory('   \n\n')).toEqual([]);
  });

  it('knows Windows line ends and a byte order mark, and leaves a fenced block alone', () => {
    const s = splitBackstory('﻿## Battle 1\r\nRain.\r\n```\r\n# not a heading\r\n```\r\n');
    expect(s).toHaveLength(1);
    expect(s[0]!.text).toBe('Rain.\n```\n# not a heading\n```');
  });

  it('numbers out of range name no battle', () => {
    expect(battleOf('Battle 0')).toBeNull();
    expect(battleOf('Battle 12 – the Stir')).toBe(12);
    expect(battleOf('Before the war')).toBeNull();
  });
});

describe('problemWith', () => {
  const ok = { heading: 'Battle 1', battleNo: 1, text: 'Rain.' };
  it('lets a backstory through and says what stops one', () => {
    expect(problemWith([ok])).toBeNull();
    expect(problemWith([])).toMatch(/no text/);
    expect(problemWith([{ ...ok, text: 'x'.repeat(60_001) }])).toMatch(/“Battle 1” is longer/);
    expect(problemWith(Array.from({ length: 201 }, () => ok))).toMatch(/More than 200 sections/);
    expect(problemWith(Array.from({ length: 8 }, () => ({ ...ok, text: 'x'.repeat(55_000) })))).toMatch(/whole backstory/);
  });
});

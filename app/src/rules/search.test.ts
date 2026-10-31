/* The search of the Rules tab: words match by their stem, so "hide" finds "hiding" and the other way round. */
import { describe, expect, it } from 'vitest';
import { searchBlocks, stem, words } from './search.ts';
import type { Block } from './data.ts';

const p = (text: string): Block => ({ t: 'p', text });

describe('stem', () => {
  it('brings the forms of a word together', () => {
    expect(stem('hiding')).toBe(stem('hide'));
    expect(stem('hides')).toBe(stem('hide'));
    expect(stem('enemies')).toBe(stem('enemy'));
    expect(stem('moves')).toBe(stem('moving'));
    expect(stem('attacks')).toBe(stem('attack'));
  });
  it('keeps short words and numbers as they are', () => {
    expect(stem('is')).toBe('is');
    expect(stem('d6')).toBe('d6');
    expect(stem('4')).toBe('4');
  });
});

describe('words', () => {
  it('splits on anything that is not a letter or digit, lower case', () => {
    expect(words('Hide, then Run!')).toEqual(['hide', 'then', 'run']);
    expect(words('Ward-save (4+)')).toEqual(['ward', 'save', '4']);
  });
});

describe('searchBlocks', () => {
  const blocks: Block[] = [
    { t: 'h', l: 2, id: 'hiding', text: 'hiding' },
    p('A model that is hiding cannot be seen by enemies.'),
    p('Models may run in the movement phase.'),
    { t: 'table', head: ['Roll', 'Result'], rows: [['1', 'The warrior hides in the ruins']] },
  ];
  it('finds hiding by hide, and hide by hiding', () => {
    expect(searchBlocks(blocks, 'hide').map((r) => r.index)).toEqual([0, 1, 3]);
    expect(searchBlocks([p('You may hide here.')], 'hiding').map((r) => r.index)).toEqual([0]);
  });
  it('finds a longer form by its short stem', () => {
    expect(searchBlocks([p('A hidden model.')], 'hid').map((r) => r.index)).toEqual([0]);
  });
  it('needs every word of the query in the same block', () => {
    expect(searchBlocks(blocks, 'hide enemy').map((r) => r.index)).toEqual([1]);
    expect(searchBlocks(blocks, 'hide dragon')).toEqual([]);
  });
  it('finds nothing for an empty or one-letter query', () => {
    expect(searchBlocks(blocks, '')).toEqual([]);
    expect(searchBlocks(blocks, ' a ')).toEqual([]);
  });
});

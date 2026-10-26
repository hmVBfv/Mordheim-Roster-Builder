/* A rare with a dice price (#90): the price stays on the line of the item; what it can come to (min., max., average)
   goes on a line of its own below, so the last column is not overloaded. */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import styles from '../roster/Trade.module.css';
import type { RareItem } from '../roster/equipment.ts';
import { RareLine } from './RareLine.tsx';

afterEach(() => cleanup());

const item = (over: Partial<RareItem>): RareItem => ({
  de: 'x', name: 'Test item', kind: 'misc', rarity: 7, price: '20+1D6 gc', avg: 23.5, range: [21, 26], fixed: null, text: '', usable: true, settings: [], grade: null, ...over,
});

describe('the price cell of a rare line', () => {
  it('puts the spread of a dice price on its own line', () => {
    const { container } = render(<RareLine it={item({})} />);
    const cell = container.querySelector(`.${styles.rp}`)!;
    expect(cell.firstChild?.textContent).toBe('20+1D6 gc');
    const spread = cell.querySelector('small')!;
    expect(spread.textContent).toBe('min. 21 gc, max. 26 gc, ⌀ 23.5 gc');
    expect(spread.classList.contains(styles.rs!)).toBe(true);
  });

  it('a fixed price has no second line', () => {
    const { container } = render(<RareLine it={item({ price: '35 gc', range: null, avg: null, fixed: 35 })} />);
    expect(container.querySelector(`.${styles.rp} small`)).toBeNull();
  });
});

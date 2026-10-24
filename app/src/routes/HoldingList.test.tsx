/* The phone lists of Sell and Give (reports #56, #57, #61): carried items and the stash apart, no free dagger. */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Holding } from '../roster/equipment.ts';
import { HoldingList } from './HoldingList.tsx';

afterEach(cleanup);

const hold = (from: number | 'stash', owner: string, name: string, over: Partial<Holding> = {}): Holding => ({ from, owner, goods: { key: name, rare: false }, name, pieces: 1, paid: 10, sell: 5, text: '', ...over });
const list = [
  hold(1, 'Ulrich the Grey', 'Sword'),
  hold(1, 'Ulrich the Grey', 'Dagger (free)', { free: true }),
  hold(2, 'Magda', 'Helmet'),
  hold('stash', 'Stash', 'Shield', { pieces: 2 }),
];

describe('the phone list of what is held', () => {
  it('sets the stash apart from what the warriors carry, under headings (#57, #61)', () => {
    render(<HoldingList list={list} label="Sell" action={() => 'sells'} onPick={() => undefined} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Carried by the warband', 'In the stash']);
    expect(within(screen.getByRole('list', { name: 'Carried' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Sell Sword of Ulrich the Grey', 'Sell Helmet of Magda']);
    expect(within(screen.getByRole('list', { name: 'In the stash' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Sell Shield of Stash']);
  });

  it('does not list the free dagger, which cannot be traded (#56)', () => {
    render(<HoldingList list={list} label="Give" action={() => 'give'} onPick={() => undefined} />);
    expect(screen.queryByText(/free/)).toBeNull();
  });

  it('needs no heading when only one kind is there', () => {
    render(<HoldingList list={[hold(1, 'Ulrich the Grey', 'Sword')]} label="Sell" action={() => 'sells'} onPick={() => undefined} />);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('says there is nothing when only a free dagger is there', () => {
    render(<HoldingList list={[list[1]!]} label="Give" action={() => 'give'} onPick={() => undefined} />);
    expect(screen.getByText('Nothing to give.')).toBeTruthy();
  });
});

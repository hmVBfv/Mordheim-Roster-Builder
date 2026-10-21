/* Give on a wide screen (Rob, 20.10.2026): who holds what on the left, who may take it on the right – pick, then pick. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Holding, Recipient } from '../roster/equipment.ts';
import { GiveBoard } from './GiveBoard.tsx';

afterEach(cleanup);

const hold = (from: number | 'stash', owner: string, name: string, pieces = 1): Holding => ({ from, owner, goods: { key: name, rare: false }, name, pieces, paid: 10, sell: 5, text: '' });
const held = [hold(1, 'Ulrich the Grey', 'Sword'), hold(1, 'Ulrich the Grey', 'Helmet'), hold('stash', 'Stash', 'Shield', 2), hold(2, 'Magda', 'Dagger')];
const recipients = (h: Holding): Recipient[] => [
  ...(h.from === 'stash' ? [] : [{ to: 'stash' as const, name: 'Stash', ok: true, note: 'keep it for later', cost: 0 }]),
  { to: 2, name: 'Magda', ok: h.name !== 'Helmet', note: h.name === 'Helmet' ? 'wears one already' : 'may use it', cost: 0 },
  { to: 3, name: 'Warrior', ok: false, note: 'the group needs 3, one for each man – only 1 here', cost: 0 },
];

describe('Give on a wide screen', () => {
  it('lists what is held by whom, and asks to pick one', () => {
    render(<GiveBoard held={held} recipientsFor={recipients} onGive={() => undefined} />);
    const items = screen.getByRole('region', { name: 'What to give' });
    expect(within(items).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Ulrich the Grey', 'Stash', 'Magda']);
    expect(within(items).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sword', 'Helmet', 'Shield ×2', 'Dagger']);
    expect(within(screen.getByRole('region', { name: 'Who takes it' })).getByText('Pick an item on the left.')).toBeTruthy();
  });

  it('shows who may take the picked item and why not the others; picking one gives it', async () => {
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<GiveBoard held={held} recipientsFor={recipients} onGive={onGive} />);
    await user.click(screen.getByRole('button', { name: 'Helmet' }));
    expect(screen.getByRole('button', { name: 'Helmet' }).getAttribute('aria-pressed')).toBe('true');
    const to = screen.getByRole('region', { name: 'Who takes it' });
    expect(within(to).getByText('Helmet from Ulrich the Grey')).toBeTruthy();
    const rows = within(to).getAllByRole('button');
    expect(rows.map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([
      ['Stashkeep it for later', false], ['Magdawears one already', true], ['Warriorthe group needs 3, one for each man – only 1 here', true],
    ]);
    await user.click(within(to).getByRole('button', { name: /^Stash/ }));
    expect(onGive).toHaveBeenCalledTimes(1);
    expect(onGive.mock.calls[0]![0]).toMatchObject({ name: 'Helmet', from: 1 });
    expect(onGive.mock.calls[0]![1]).toBe('stash');
    // what was given leaves the choice: the list is read again by the screen, nothing stays picked
    expect(within(screen.getByRole('region', { name: 'Who takes it' })).getByText('Pick an item on the left.')).toBeTruthy();
  });

  it('nothing held: it says so', () => {
    render(<GiveBoard held={[]} recipientsFor={recipients} onGive={() => undefined} />);
    expect(screen.getByText('Nothing to give.')).toBeTruthy();
  });
});

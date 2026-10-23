/* Give on a wide screen (Rob, 20.10.2026; report #32): a card for every warrior and the stash, with his profile – pick an item or
   drag it, then give it where the card allows. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiveCard, Holding, Recipient, ShopItem } from '../roster/equipment.ts';
import { BuyBoard, GiveBoard, SellBoard } from './GiveBoard.tsx';

afterEach(cleanup);

const hold = (from: number | 'stash', owner: string, name: string, pieces = 1): Holding => ({ from, owner, goods: { key: name, rare: false }, name, pieces, paid: 10, sell: 5, text: '' });
const stats = [{ key: 'M', value: '4', changed: false }, { key: 'WS', value: '4', changed: false }, { key: 'S', value: '4', changed: true }];
const sword = hold(1, 'Ulrich the Grey', 'Sword'), helmet = hold(1, 'Ulrich the Grey', 'Helmet'), shield = hold('stash', 'Stash', 'Shield', 2), dagger = hold(2, 'Magda', 'Dagger');
const cards: GiveCard[] = [
  { holder: 1, name: 'Ulrich the Grey', type: 'Captain', men: 1, stats, save: '5+', rules: ['Leader', 'Strong'], items: [sword, helmet] },
  { holder: 2, name: 'Magda', type: 'Champion', men: 1, stats, save: '', rules: [], items: [dagger, { ...hold(2, 'Magda', 'Dagger (free)'), free: true }] },
  { holder: 3, name: 'Warriors', type: 'Warrior', men: 3, stats: [], save: '', rules: [], items: [] },
  { holder: 'stash', name: 'Stash', type: '', men: 1, stats: [], save: '', rules: [], items: [shield] },
];
const recipients = (h: Holding): Recipient[] => [
  ...(h.from === 'stash' ? [] : [{ to: 'stash' as const, name: 'Stash', ok: true, note: 'keep it for later', cost: 0 }]),
  ...(h.from === 1 ? [] : [{ to: 1, name: 'Ulrich the Grey', ok: true, note: 'may use it', cost: 0 }]),
  { to: 2, name: 'Magda', ok: h.name !== 'Helmet', note: h.name === 'Helmet' ? 'wears one already' : 'may use it', cost: 0 },
  { to: 3, name: 'Warriors', ok: false, note: 'the group needs 3, one for each man – only 1 here', cost: 0 },
];

describe('Give on a wide screen', () => {
  it('shows every warrior and the stash as a card, with his profile, rules and what he holds', () => {
    render(<GiveBoard cards={cards} recipientsFor={recipients} onGive={() => undefined} />);
    const ulrich = screen.getByRole('article', { name: 'Ulrich the Grey' });
    expect(within(ulrich).getByText('Captain')).toBeTruthy();
    expect(within(within(ulrich).getByLabelText('Profile')).getAllByRole('term').map((t) => t.textContent)).toEqual(['M', 'WS', 'S', 'Sv']);
    expect(within(ulrich).getByText('Leader · Strong')).toBeTruthy();
    expect(within(within(ulrich).getByRole('group', { name: 'Held by Ulrich the Grey' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sword', 'Helmet']);
    expect(within(screen.getByRole('article', { name: 'Warriors' })).getByText('nothing')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Stash' })).getByRole('button', { name: 'Shield ×2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Give to/ })).toBeNull();
  });

  it('picking an item shows on every other card whether it may take it and why not; one click gives it', async () => {
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<GiveBoard cards={cards} recipientsFor={recipients} onGive={onGive} />);
    await user.click(screen.getByRole('button', { name: 'Helmet' }));
    expect(screen.getByRole('button', { name: 'Helmet' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/Helmet from Ulrich the Grey/);
    const give = screen.getAllByRole('button', { name: /^Give to/ });
    expect(give.map((b) => [b.getAttribute('aria-label'), (b as HTMLButtonElement).disabled, b.textContent])).toEqual([
      ['Give to Magda', true, 'Cannot take itwears one already'],
      ['Give to Warriors', true, 'Cannot take itthe group needs 3, one for each man – only 1 here'],
      ['Give to Stash', false, 'Give herekeep it for later'],
    ]);
    await user.click(screen.getByRole('button', { name: 'Give to Stash' }));
    expect(onGive).toHaveBeenCalledTimes(1);
    expect(onGive.mock.calls[0]![0]).toMatchObject({ name: 'Helmet', from: 1 });
    expect(onGive.mock.calls[0]![1]).toBe('stash');
    // nothing stays picked
    expect(screen.queryByRole('button', { name: /^Give to/ })).toBeNull();
  });

  it('an item dragged onto a card that may take it is given; onto one that may not, nothing happens', () => {
    const onGive = vi.fn();
    render(<GiveBoard cards={cards} recipientsFor={recipients} onGive={onGive} />);
    const data = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Helmet' }), { dataTransfer: data });
    fireEvent.drop(screen.getByRole('article', { name: 'Magda' }), { dataTransfer: data });
    expect(onGive).not.toHaveBeenCalled();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Dagger' }), { dataTransfer: data });
    fireEvent.drop(screen.getByRole('article', { name: 'Ulrich the Grey' }), { dataTransfer: data });
    expect(onGive).toHaveBeenCalledTimes(1);
    expect(onGive.mock.calls[0]![0]).toMatchObject({ name: 'Dagger', from: 2 });
    expect(onGive.mock.calls[0]![1]).toBe(1);
  });

  it('an item of the stash can be given to a warrior', async () => {
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<GiveBoard cards={cards} recipientsFor={recipients} onGive={onGive} />);
    await user.click(screen.getByRole('button', { name: 'Shield ×2' }));
    await user.click(screen.getByRole('button', { name: 'Give to Magda' }));
    expect(onGive.mock.calls[0]![0]).toMatchObject({ name: 'Shield', from: 'stash' });
    expect(onGive.mock.calls[0]![1]).toBe(2);
  });

  it('nothing held: it says so', () => {
    render(<GiveBoard cards={cards.map((c) => ({ ...c, items: [] }))} recipientsFor={recipients} onGive={() => undefined} />);
    expect(screen.getByText('Nothing to give.')).toBeTruthy();
  });

  it('shows the free dagger as a marked chip that cannot be picked or given (#52)', async () => {
    const user = userEvent.setup();
    render(<GiveBoard cards={cards} recipientsFor={recipients} onGive={() => undefined} />);
    const held = within(screen.getByRole('group', { name: 'Held by Magda' }));
    expect(held.getAllByRole('button').map((b) => b.textContent)).toEqual(['Dagger']);
    const chip = held.getByText('Dagger (free)');
    expect(chip.getAttribute('title')).toMatch(/cannot be traded/);
    await user.click(chip);
    expect(screen.queryByRole('status')?.textContent ?? '').not.toMatch(/free/);
    expect(screen.queryByRole('button', { name: /^Give to/ })).toBeNull();
  });
});

describe('Sell and Buy on a wide screen (#54)', () => {
  it('Sell shows the same cards; an item opens the price sheet, the free dagger cannot be picked', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<SellBoard cards={cards} onPick={onPick} />);
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Ulrich the Grey', 'Magda', 'Warriors', 'Stash']);
    const magda = within(screen.getByRole('group', { name: 'Held by Magda' }));
    expect(magda.getAllByRole('button').map((b) => b.textContent)).toEqual(['Dagger · 5 gc']);
    expect(magda.getByText('Dagger (free)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sell Sword of Ulrich the Grey' }));
    expect(onPick).toHaveBeenCalledWith(sword);
  });

  const lamp: ShopItem = { key: 'Lampe', name: 'Lantern', kind: 'misc', price: 20, text: '', unlisted: false };
  const buyers = (it: ShopItem): Recipient[] => [
    { to: 'stash', name: 'Stash', ok: true, note: 'keep it for later', cost: it.price },
    { to: 1, name: 'Ulrich the Grey', ok: true, note: `${it.price} gc`, cost: it.price },
    { to: 3, name: 'Warriors', ok: true, note: '3 men: 60 gc', cost: it.price * 3 },
  ];

  it('Buy lists what is on sale; a picked item says on each card what it costs, and one click buys it', async () => {
    const onBuy = vi.fn();
    const user = userEvent.setup();
    render(<BuyBoard cards={cards} shop={[lamp]} recipientsFor={buyers} gold={50} onBuy={onBuy} />);
    await user.click(within(screen.getByRole('group', { name: 'For sale' })).getByRole('button', { name: /Lantern/ }));
    expect(screen.getByRole('status').textContent).toMatch(/Lantern · 20 gc each/);
    expect((screen.getByRole('button', { name: 'Buy for Warriors' }) as HTMLButtonElement).disabled).toBe(true); // 60 gc, 50 in hand
    expect(screen.getByRole('button', { name: 'Buy for Warriors' }).textContent).toMatch(/Not enough gold/);
    expect(screen.queryByRole('button', { name: 'Buy for Magda' })?.textContent ?? 'Cannot take it').toMatch(/Cannot take it/);
    await user.click(screen.getByRole('button', { name: 'Buy for Ulrich the Grey' }));
    expect(onBuy).toHaveBeenCalledWith(lamp, 1);
  });
});

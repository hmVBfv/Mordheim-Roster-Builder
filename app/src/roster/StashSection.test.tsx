/* The Stash under the roster (wish #63): what lies in the stash with what each item does, and giving it on from there. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { StashSection } from './StashSection.tsx';
import { createWarband } from './view.ts';

afterEach(cleanup);
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland warband after its first battle: a Captain, three Warriors, a shield and a helmet in the stash. */
function band() {
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'warr');
  const [capt, warr] = s.models.map((m) => m.uid) as [number, number];
  s = core.setQty(ctx(s), warr, 3);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1 };
  s.stash = { wyrd: 0, gold: 0, items: [{ name: 'Shield', qty: 2, key: 'Schild' }, { name: 'Helmet', qty: 1, key: 'Helm' }] };
  return { s, capt, warr };
}

describe('the Stash under the roster', () => {
  it('lists every stash item with its pieces and what it does, without a click', () => {
    const { s } = band();
    render(<StashSection ctx={ctx(s)} onGive={() => undefined} />);
    const stash = screen.getByRole('region', { name: 'Stash' });
    expect(within(stash).getByText('Shield')).toBeTruthy();
    expect(within(stash).getByText('×2')).toBeTruthy();
    expect(within(stash).getByText('Helmet')).toBeTruthy();
    // the item's rule is written out, not behind a tooltip
    expect(within(stash).getAllByText(/armour save/i).length).toBeGreaterThan(0);
  });

  it('gives an item on from there: who may take it, and why not', async () => {
    const { s, capt, warr } = band();
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<StashSection ctx={ctx(s)} onGive={onGive} />);
    await user.click(screen.getByRole('button', { name: 'Give Shield' }));
    const to = screen.getByRole('group', { name: 'Give Shield to' });
    // the group of three needs three shields and the stash has two: the reason stands there
    const group = within(to).getByRole('button', { name: /Warrior/ });
    expect((group as HTMLButtonElement).disabled).toBe(true);
    expect(group.textContent).toMatch(/needs 3/);
    await user.click(within(to).getByRole('button', { name: /Captain/ }));
    expect(onGive).toHaveBeenCalledTimes(1);
    expect(onGive.mock.calls[0]![0]).toMatchObject({ from: 'stash', goods: { key: 'Schild' } });
    expect(onGive.mock.calls[0]![1]).toBe(capt);
    expect(warr).toBeGreaterThan(0);
  });

  it('is not there when the stash is empty', () => {
    const { s } = band();
    render(<StashSection ctx={ctx({ ...s, stash: { wyrd: 0, gold: 0, items: [] } })} onGive={() => undefined} />);
    expect(screen.queryByRole('region', { name: 'Stash' })).toBeNull();
  });
});

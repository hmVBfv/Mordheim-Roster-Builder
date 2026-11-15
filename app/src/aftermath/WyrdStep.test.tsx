/* Step 4 of the aftermath: the size the wyrdstone is sold at, with its adjustments, the price table with the own column, the Merchant, the sale. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { takeOverBattle } from './takeover.ts';
import { aftermathView } from './view.ts';
import { WyrdStep } from './WyrdStep.tsx';

afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function Harness({ tweak = (s: WarbandState) => s }: { tweak?: (s: WarbandState) => WarbandState }) {
  const [s, setS] = useState<WarbandState>(() => tweak(core.stashAdjust(core.ctxOf(data, takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05')), 'wyrd', 3)));
  const a = aftermathView(data, s, 'b-1')!;
  const ctx = core.ctxOf(data, s);
  return <MemoryRouter><WyrdStep a={a} data={data} acts={{ ctx, edit: (f) => setS(f(ctx)) }} /><output data-testid="gold">{core.goldCurrent(ctx)}</output><output data-testid="stash">{s.stash?.wyrd ?? 0}</output></MemoryRouter>;
}
const gold = () => Number(screen.getByTestId('gold').textContent);

describe('selling wyrdstone', () => {
  it('shows the size, the price band and the price table with the own column, and sells', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText(/Size for selling:/).textContent).toMatch(/model/);
    const own = screen.getByRole('table', { name: /warriors$/ });
    expect(own.querySelector('tr[aria-current="true"]')).not.toBeNull(); // the lot of three shards
    const before = gold();
    const button = screen.getByRole('button', { name: /^Sell for \d+ gc$/ });
    const price = Number(/(\d+)/.exec(button.textContent!)![1]);
    await user.click(button);
    expect(gold()).toBe(before + price);
    expect(screen.getByTestId('stash').textContent).toBe('0');
    expect(screen.getByText(/✓ Sold 3 shards for/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take the sale back' }));
    expect(gold()).toBe(before);
    expect(screen.getByTestId('stash').textContent).toBe('3');
  });

  it('the size can be corrected by hand and the price follows', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const price = () => Number(/(\d+)/.exec(screen.getByRole('button', { name: /^Sell for \d+ gc$/ }).textContent!)![1]);
    const first = price();
    for (let i = 0; i < 12; i++) await user.click(screen.getByRole('button', { name: 'One model more' }));
    expect(price()).toBeLessThan(first); // a larger warband earns less
    expect(screen.getByRole('list', { name: 'Size adjustments' }).textContent).toMatch(/Corrected by hand: \+12/);
  });

  it('a Cathayan Merchant’s roll comes first, and changes the price', async () => {
    const user = userEvent.setup();
    render(<Harness tweak={(s) => ({ ...s, hired: [{ key: 'cathayanmerchant', uid: 'hs1' }] }) as WarbandState} />);
    expect(screen.getByRole('button', { name: /^Sell for \d+ gc$/ })).toHaveProperty('disabled', true);
    const price = Number(/(\d+)/.exec(screen.getByRole('button', { name: /^Sell for \d+ gc$/ }).textContent!)![1]);
    await user.type(screen.getByRole('textbox', { name: 'Merchant D6' }), '4');
    await user.type(screen.getByRole('textbox', { name: 'Merchant 2D6 total' }), '9');
    expect(screen.getByRole('button', { name: `Sell for ${price + 9} gc` })).toHaveProperty('disabled', false);
    await user.click(screen.getByRole('button', { name: `Sell for ${price + 9} gc` }));
    expect(screen.getByText(/the Merchant \+9 gc/)).toBeTruthy();
  });

  it('a Halfling Cook asks for his roll: yes lowers the band', async () => {
    const user = userEvent.setup();
    render(<Harness tweak={(s) => ({ ...s, models: [...s.models, { ...s.models[0]!, uid: 99, uid_def: 'halflingco' }] }) as WarbandState} />);
    expect(screen.getByText(/Master Chef/)).toBeTruthy();
    const band = () => /band (\S+)/.exec(screen.getByText(/Size for selling:/).textContent!)![1];
    const before = band();
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(band()).not.toBe(before);
    expect(within(screen.getByRole('list', { name: 'Size adjustments' })).getByText(/Halfling Cook/)).toBeTruthy();
  });
});

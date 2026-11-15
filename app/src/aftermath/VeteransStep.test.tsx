/* Step 5 of the aftermath: the veterans roll is entered (or rolled) here, and the groups show what may join them. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { takeOverBattle } from './takeover.ts';
import { VeteransStep } from './VeteransStep.tsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function Harness() {
  const [s, setS] = useState<WarbandState>(() => takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05'));
  const ctx = core.ctxOf(data, s);
  return <MemoryRouter><VeteransStep acts={{ ctx, edit: (f) => setS(f(ctx)) }} recruitLink="/x" /></MemoryRouter>;
}

describe('the veterans step', () => {
  it('has no roll at first; the roll typed is the experience for hire', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('No roll yet this round.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter the roll' })).toHaveProperty('disabled', true);
    await user.type(screen.getByRole('textbox', { name: 'Veterans 2D6' }), '13');
    expect(screen.getByRole('button', { name: 'Enter the roll' })).toHaveProperty('disabled', true); // 2D6 is 2 to 12
    await user.clear(screen.getByRole('textbox', { name: 'Veterans 2D6' }));
    await user.type(screen.getByRole('textbox', { name: 'Veterans 2D6' }), '7');
    await user.click(screen.getByRole('button', { name: 'Enter the roll' }));
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /Experience for hire: 7 · used 0 · 7 left/.test(el.textContent ?? ''), { selector: 'p' })).toBeTruthy();
  });

  it('rolls in the app: 2D6 of a 1 and a 1 is a 2, of 6 and 6 a 12', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Roll' }));
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /Experience for hire: 12/.test(el.textContent ?? ''), { selector: 'p' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Roll' })).toHaveProperty('disabled', true); // once entered, a change is typed
  });

  it('lists each henchmen group with its price and whether he fits the roll', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const table = screen.getByRole('table', { name: 'Henchmen groups' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Group', 'Exp', 'Men', 'May join', 'One more costs', 'Fits the roll']);
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    await user.type(screen.getByRole('textbox', { name: 'Veterans 2D6' }), '12');
    await user.click(screen.getByRole('button', { name: 'Enter the roll' }));
    const fits = within(screen.getByRole('table', { name: 'Henchmen groups' })).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').at(-1)!.textContent);
    expect(fits.every((t) => /^(yes \(\d+\)|no|no roll needed)$/.test(t ?? ''))).toBe(true);
  });

  it('a link leads to the roster to add the men', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Add men on the roster' }).getAttribute('href')).toBe('/x');
  });
});

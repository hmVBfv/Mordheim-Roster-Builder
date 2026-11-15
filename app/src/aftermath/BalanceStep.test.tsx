/* Step 10 of the aftermath: the balance of the round in tables. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { BalanceStep } from './BalanceStep.tsx';
import { takeOverBattle } from './takeover.ts';

afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;
const ctxOf = (s: WarbandState) => core.ctxOf(data, s);
const row = (name: string) => within(screen.getByRole('table', { name: 'The balance of the round' })).getByText(name).closest('tr')!;

describe('the balance of the round', () => {
  it('shows before and after from the stage before the battle, and the rating for the next one', () => {
    const s = takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05');
    render(<BalanceStep ctx={ctxOf(s)} round={1} />);
    expect(screen.getByText(/Warband rating for the next battle:/).textContent).toContain(String(core.totalRating(ctxOf(s))));
    const t = screen.getByRole('table', { name: 'Before and after' });
    expect(within(t).getByText('Before the battle')).toBeTruthy();
    expect(within(t).getByText('After')).toBeTruthy();
  });

  it('reads the round’s exploration, sale and upkeep into income and spending', () => {
    let s = core.openLedger(ctxOf(core.stashAdjust(ctxOf(takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05')), 'wyrd', 2)));
    s = core.recordExploration(ctxOf(s), 1, { rolled: [6, 6, 6], by: 'app' });
    s = core.sellWyrdstone(ctxOf(s), 1, 2);
    render(<BalanceStep ctx={ctxOf(s)} round={1} />);
    expect(row('Exploration').textContent).toMatch(/3 dice = 18 → 4 shards.*rolled in the app/);
    expect(row('Wyrdstone').textContent).toMatch(/4 found, 2 sold, 4 in the stash/);
    expect(row('Income').textContent).toMatch(/wyrdstone \d+/);
    expect(screen.getByRole('table', { name: 'What the round brought, with its origin' })).toBeTruthy();
  });
});

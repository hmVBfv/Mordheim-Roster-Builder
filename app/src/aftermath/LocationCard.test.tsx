/* The place of the Exploration chart in the aftermath: its questions, what it brings, "Take it" and "Take it back". */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { ExplorationStep } from './ExplorationStep.tsx';
import { takeOverBattle } from './takeover.ts';
import { aftermathView } from './view.ts';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function Harness() {
  const [s, setS] = useState<WarbandState>(() => takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05'));
  const a = aftermathView(data, s, 'b-1')!;
  const ctx = core.ctxOf(data, s);
  return (
    <MemoryRouter>
      <ExplorationStep a={a} data={data} acts={{ ctx, edit: (f) => setS(f(ctx)) }} />
      <output data-testid="gold">{core.goldCurrent(ctx)}</output>
      <output data-testid="items">{JSON.stringify((s.stash?.items ?? []).map((i) => [i.name, i.qty]))}</output>
    </MemoryRouter>
  );
}
const gold = () => Number(screen.getByTestId('gold').textContent);
const dice = () => screen.getAllByRole('textbox', { name: /^Die \d+$/ });

/** The exploration with these four dice recorded (5, 5, 5, 3: the three 5s – Market Hall, 4 shards). */
async function explored(user: ReturnType<typeof userEvent.setup>, values: string[]) {
  for (const [i, v] of values.entries()) await user.type(dice()[i]!, v);
  await user.click(screen.getByRole('button', { name: /^Record: \d+ shards? into the stash$/ }));
}

describe('the place of the chart', () => {
  it('is not there without a double, and shows the place after the roll is recorded', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await explored(user, ['1', '2', '4', '3']);
    expect(screen.queryByText(/^An unusual place:/)).toBeNull();
    cleanup();
    render(<Harness />);
    await explored(user, ['5', '5', '5', '3']);
    expect(screen.getByText('An unusual place: Market hall')).toBeTruthy();
  });

  it('asks its question, shows what it brings, and takes it into the treasury', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = gold();
    await explored(user, ['5', '5', '5', '3']); // Market Hall: items worth 2D6 gc
    expect(screen.getByText(/Gold found \(2D6\)/)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Gold found (2D6)' }), '8');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(within(screen.getByRole('list', { name: 'What the place brings' })).getByText(/8 gc/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(gold()).toBe(before + 8);
    expect(screen.getByRole('table', { name: 'What the place brought' })).toBeTruthy();
  });

  it('rolls in the app; the places with a choice of item take the one picked', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0); // every die a 1
    render(<Harness />);
    await explored(user, ['4', '4', '4', '3']); // Fletcher? no: 4 4 4 – Fletcher: D6 table
    expect(screen.getByText('An unusual place: Fletcher')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Roll' })); // a 1: D3 short bows … then the D3
    await user.click(screen.getByRole('button', { name: 'Roll' }));
    expect(screen.getByRole('list', { name: 'What the place brings' }).textContent).toMatch(/Short bow/);
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(JSON.parse(screen.getByTestId('items').textContent!)).toEqual([['Short bow', 1]]);
  });

  it('taking it back puts everything as it was', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = gold();
    await explored(user, ['5', '5', '5', '3']);
    await user.type(screen.getByRole('textbox', { name: 'Gold found (2D6)' }), '9');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(gold()).toBe(before + 9);
    await user.click(screen.getByRole('button', { name: 'Take the place back' }));
    expect(gold()).toBe(before);
    expect(screen.getByText('An unusual place: Market hall')).toBeTruthy(); // asked again
  });

  it('a lasting advantage is listed under “Standing advantages”', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await explored(user, ['6', '6', '6', '6']); // 6 6 6 6 – Catacombs
    expect(screen.getByText('An unusual place: Catacombs')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    await user.click(screen.getByText(/Standing advantages \(1\)/));
    const list = screen.getByText(/Standing advantages/).closest('details')!;
    expect(within(list).getByText(/up to three fighters/)).toBeTruthy();
  });
});

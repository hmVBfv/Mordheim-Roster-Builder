/* The warband duties phase: the Troll's Always Hungry with its ways out and their consequences, in the sequence after the wyrdstone sale. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { DutiesStep } from './DutiesStep.tsx';
import { takeOverBattle } from './takeover.ts';
import { aftermathView } from './view.ts';

afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'blackorcs', wbName: 'Black Orcs', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function orcs(fill = 0): WarbandState {
  const c = (s: WarbandState) => core.ctxOf(data, s);
  let s = { ...core.newWarband(data, 'blackorcs'), budget: 5000 } as WarbandState;
  for (const u of data.WARBANDS.blackorcs!.units.filter((x) => x.req)) s = core.addUnit(c(s), u.id);
  s = core.addUnit(c(s), 'botroll');
  if (fill) {
    s = core.addUnit(c(s), 'boyz');
    const others = core.totalModels(c(s)) - (s.models.find((m) => m.uid_def === 'boyz')!.qty ?? 1);
    s = { ...s, models: s.models.map((m) => (m.uid_def === 'boyz' ? { ...m, qty: Math.max(1, fill - others) } : m)) };
  }
  void sampleSave;
  return takeOverBattle(data, s, battle(), ME, '2026-10-05');
}

function Harness({ fill = 0 }: { fill?: number }) {
  const [s, setS] = useState<WarbandState>(() => orcs(fill));
  const ctx = core.ctxOf(data, s);
  return <><DutiesStep a={aftermathView(data, s, 'b-1')!} acts={{ ctx, edit: (f) => setS(f(ctx)) }} /><output data-testid="gold">{core.goldCurrent(ctx)}</output><output data-testid="n">{core.totalModels(ctx)}</output></>;
}
const gold = () => Number(screen.getByTestId('gold').textContent);

describe('Always Hungry', () => {
  it('shows the three ways out with their prices; paying takes 20 gc and can be taken back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = gold();
    const list = screen.getByRole('list', { name: 'Always Hungry (Troll): the ways out' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getAllByRole('button', { name: 'Choose – 20 gc' })[0]!);
    expect(gold()).toBe(before - 20);
    expect(screen.getByText(/✓ Always Hungry \(Troll\):/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(gold()).toBe(before);
  });

  it('counting as two costs 5 gc and the warband counts one more', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const n = Number(screen.getByTestId('n').textContent);
    await user.click(screen.getByRole('button', { name: 'Choose – 5 gc' }));
    expect(Number(screen.getByTestId('n').textContent)).toBe(n + 1);
  });

  it('at the maximum it is refused with the reason, and letting someone go makes room', async () => {
    const user = userEvent.setup();
    render(<Harness fill={12} />);
    expect(screen.getByRole('button', { name: 'Choose – 5 gc' })).toHaveProperty('disabled', true);
    expect(screen.getAllByText(/at its maximum/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Let someone go…' }));
    const who = screen.getByRole('list', { name: 'Who may go' });
    await user.click(within(who).getAllByRole('button', { name: /^Let .* go$/ })[0]!);
    expect(screen.getByRole('button', { name: 'Choose – 5 gc' })).toHaveProperty('disabled', false);
  });

  it('letting the Troll leave takes him off the roster', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const n = Number(screen.getByTestId('n').textContent);
    await user.click(screen.getByRole('button', { name: 'Let him go' }));
    expect(Number(screen.getByTestId('n').textContent)).toBe(n - 1);
  });
});

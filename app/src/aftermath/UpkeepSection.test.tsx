/* The upkeep of the hirelings after the wyrdstone: who is due, pay or dismiss, the gold in hand, the warning, taking it back. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { takeOverBattle } from './takeover.ts';
import { UpkeepSection } from './UpkeepSection.tsx';
import { aftermathView } from './view.ts';

afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function Harness({ hired = ['elfranger', 'beggar'], poor = false }: { hired?: string[]; poor?: boolean }) {
  const [s, setS] = useState<WarbandState>(() => {
    const base = takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05');
    const withHires = { ...base, hired: hired.map((k, i) => ({ key: k, uid: `hs${i}` })) } as WarbandState;
    return poor ? { ...withHires, stash: { ...withHires.stash, gold: core.goldTreasury(core.ctxOf(data, withHires)) - core.goldCurrent(core.ctxOf(data, withHires)) } } as WarbandState : withHires;
  });
  const ctx = core.ctxOf(data, s);
  return <><UpkeepSection a={aftermathView(data, s, 'b-1')!} acts={{ ctx, edit: (f) => setS(f(ctx)) }} /><output data-testid="gold">{core.goldCurrent(ctx)}</output><output data-testid="n">{s.hired?.length ?? 0}</output></>;
}
const gold = () => Number(screen.getByTestId('gold').textContent);
const up = (k: string) => data.HIREDSWORDS[k]!.upkeep as number;

describe('the upkeep of the hirelings', () => {
  it('shows who is due and the gold in hand after, and pays one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = gold();
    expect(screen.getByRole('table', { name: 'Upkeep due' })).toBeTruthy();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && new RegExp(`To pay: ${up('elfranger') + up('beggar')} gc`).test(el.textContent ?? ''), { selector: 'p' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pay Elf Ranger' }));
    expect(gold()).toBe(before - up('elfranger'));
    expect(screen.getByText('✓ paid')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take the payments back' }));
    expect(gold()).toBe(before);
  });

  it('pays all at once, and warns when the gold in hand does not reach', async () => {
    const user = userEvent.setup();
    render(<Harness poor />);
    expect(screen.getByText(/Not enough gold in hand/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pay all' }));
    expect(gold()).toBe(-(up('elfranger') + up('beggar')));
  });

  it('a hireling can be sent away, and then costs nothing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = gold();
    await user.click(screen.getByRole('button', { name: 'Dismiss Beggar' }));
    expect(screen.getByTestId('n').textContent).toBe('1');
    expect(gold()).toBeGreaterThanOrEqual(before); // nothing was paid for him
  });

  it('is not there for a warband without hirelings', () => {
    render(<Harness hired={[]} />);
    expect(screen.queryByRole('table', { name: 'Upkeep due' })).toBeNull();
  });
});

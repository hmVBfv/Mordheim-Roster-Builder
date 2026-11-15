/* The rules that ask for a roll after a battle: the Marauders' Eye of the Gods and the Huckster's Slick Operator, in the duties phase. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data } from '../test/data.ts';
import { DutiesStep } from './DutiesStep.tsx';
import { takeOverBattle } from './takeover.ts';
import { aftermathView } from './view.ts';

afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (wb: string): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: wb, wbName: wb, playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;

function warband(wb: string, units: string[]): WarbandState {
  const c = (s: WarbandState) => core.ctxOf(data, s);
  let s = { ...core.newWarband(data, wb), budget: 5000, subtype: wb === 'maraudersofchaos' ? 'kurgan' : undefined } as WarbandState;
  for (const u of units) s = core.addUnit(c(s), u);
  return takeOverBattle(data, s, battle(wb), ME, '2026-10-05');
}

function Harness({ wb, units }: { wb: string; units: string[] }) {
  const [s, setS] = useState<WarbandState>(() => warband(wb, units));
  const ctx = core.ctxOf(data, s);
  return <><DutiesStep a={aftermathView(data, s, 'b-1')!} acts={{ ctx, edit: (f) => setS(f(ctx)) }} /><output data-testid="gold">{core.goldCurrent(ctx)}</output><output data-testid="mark">{s.mark ?? ''}</output><output data-testid="lead">{s.models.map((m) => m.uid_def).join(',')}</output></>;
}

describe('Eye of the Gods', () => {
  it('shows the total and what it needs, asks for the Mark on a won 12+, and sets it', async () => {
    const user = userEvent.setup();
    render(<Harness wb="maraudersofchaos" units={['chieftain']} />);
    expect(screen.getByRole('group', { name: 'Eye of the Gods' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('How the battle ended'), 'won');
    await user.type(screen.getByLabelText('Enemy models the leader took out of action'), '3');
    await user.type(screen.getByLabelText('2D6, die 1'), '5');
    await user.type(screen.getByLabelText('2D6, die 2'), '4');
    expect(screen.getByText(/needs 12\+: the leader may take a Mark/)).toBeTruthy();
    const settle = screen.getByRole('button', { name: 'Settle it' }) as HTMLButtonElement;
    expect(settle.disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText('Mark of the Dark Gods'), 'serpent');
    await user.click(settle);
    expect(screen.getByTestId('mark').textContent).toBe('serpent');
    expect(screen.getByText(/✓ Eye of the Gods:/)).toBeTruthy();
  });

  it('fills the result and the count from the battle record, and the player may still correct them', async () => {
    const user = userEvent.setup();
    const s0 = warband('maraudersofchaos', ['chieftain']);
    const lead = core.leaderUid(core.ctxOf(data, s0))!;
    const cas = (id: number) => ({ id, round: 1, battleId: 1, victim: { uid: null, name: 'x', wb: '', grade: '', value: null }, attacker: { uid: lead, name: 'Chief', wb: '', grade: '', value: null }, result: 'dead', detail: '', fallenId: null, note: '' });
    const s = { ...s0, campaign: { ...s0.campaign, casualties: [...(s0.campaign?.casualties ?? []), cas(901), cas(902)] } } as WarbandState;
    function Rec() {
      const [st, setSt] = useState(s);
      const ctx = core.ctxOf(data, st);
      return <DutiesStep a={aftermathView(data, st, 'b-1')!} acts={{ ctx, edit: (f) => setSt(f(ctx)) }} />;
    }
    render(<Rec />);
    expect(screen.getByText(/Battle record: won, the leader put 2 enemy models out of action/)).toBeTruthy();
    expect((screen.getByLabelText('How the battle ended') as HTMLSelectElement).value).toBe('won');
    const count = screen.getByLabelText('Enemy models the leader took out of action') as HTMLInputElement;
    expect(count.value).toBe('2');
    await user.clear(count);
    await user.type(count, '5');
    expect(count.value).toBe('5');
  });

  it('a lost battle on 12+ turns the leader into a Spawn', async () => {
    const user = userEvent.setup();
    render(<Harness wb="maraudersofchaos" units={['chieftain']} />);
    await user.selectOptions(screen.getByLabelText('How the battle ended'), 'lost');
    await user.type(screen.getByLabelText('Own Heroes taken out of action'), '2');
    await user.type(screen.getByLabelText('2D6, die 1'), '5');
    await user.type(screen.getByLabelText('2D6, die 2'), '5');
    expect(screen.getByText(/the leader turns into a Chaos Spawn/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Settle it' }));
    expect(screen.getByTestId('lead').textContent).toBe('spawn');
    expect(screen.queryByRole('button', { name: 'Take it back' })).toBeNull();
  });

  it('a leader who did not fight rolls nothing', async () => {
    const user = userEvent.setup();
    render(<Harness wb="maraudersofchaos" units={['chieftain']} />);
    await user.click(screen.getByRole('checkbox', { name: /The leader fought/ }));
    await user.click(screen.getByRole('button', { name: 'Settle it' }));
    expect(screen.getByText(/not in effect/)).toBeTruthy();
    expect(screen.getByTestId('lead').textContent).toBe('chieftain');
  });
});

describe('Slick Operator', () => {
  it('says so, and cannot be settled, for a Huckster with the Banditry skill', () => {
    function Ban() {
      const [st] = useState(() => { const w = warband('hochland', ['prince', 'huckster']); return { ...w, models: w.models.map((m) => (m.uid_def === 'huckster' ? { ...m, skills: ['Banditry'] } : m)) } as WarbandState; });
      const ctx = core.ctxOf(data, st);
      return <DutiesStep a={aftermathView(data, st, 'b-1')!} acts={{ ctx, edit: () => undefined }} />;
    }
    render(<Ban />);
    expect(screen.getByText(/Banditry skill, which may not be combined with Slick Operator/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Settle it' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks for the gold dice only on 2–6, then pays them in and can be taken back', async () => {
    const user = userEvent.setup();
    render(<Harness wb="hochland" units={['prince', 'huckster']} />);
    const before = Number(screen.getByTestId('gold').textContent);
    await user.type(screen.getByLabelText('D6'), '4');
    await user.type(screen.getByLabelText('Gold, die 1'), '3');
    await user.type(screen.getByLabelText('Gold, die 2'), '5');
    await user.click(screen.getByRole('button', { name: 'Settle it' }));
    expect(Number(screen.getByTestId('gold').textContent)).toBe(before + 8);
    await user.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(Number(screen.getByTestId('gold').textContent)).toBe(before);
  });

  it('rolls the dice here when asked', async () => {
    const user = userEvent.setup();
    render(<Harness wb="hochland" units={['prince', 'huckster']} />);
    await user.click(screen.getByRole('button', { name: 'Roll it here' }));
    expect((screen.getByLabelText('D6') as HTMLInputElement).value).toMatch(/^[1-6]$/);
  });
});

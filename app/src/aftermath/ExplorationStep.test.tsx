/* Step 3 of the aftermath: the dice of the exploration go in, the total gives the shards and the place, "Record" puts the shards into the
   stash – and a roll can be taken back or replaced. */
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
      <output data-testid="stash">{s.stash?.wyrd ?? 0}</output>
    </MemoryRouter>
  );
}
const stash = () => Number(screen.getByTestId('stash').textContent);
const para = (re: RegExp) => screen.getByText((_, el) => el?.tagName === 'P' && re.test(el.textContent ?? ''), { selector: 'p' });
const dice = () => screen.getAllByRole('textbox', { name: /^Die \d+$/ });

describe('the exploration step', () => {
  it('has one die for each Hero who searches and one for the win, from the roster', () => {
    render(<Harness />);
    // three Heroes search (nobody was taken out of action), one die for the win
    expect(dice()).toHaveLength(4);
  });

  it('shows the total, the shards and the place as the dice are typed, and records them into the stash', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Record the exploration' })).toHaveProperty('disabled', true);
    for (const [i, v] of ['5', '5', '5', '3'].entries()) await user.type(dice()[i]!, v);
    // the example of the rules page: 5 + 5 + 5 + 3 = 18, four shards, and the three 5s – the Market Hall
    expect(para(/= 18 → 4 shards/)).toBeTruthy();
    expect(screen.getByText(/An unusual place: Market hall/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Record: 4 shards into the stash' }));
    expect(stash()).toBe(4);
    expect(screen.getByText(/✓ Explored:/).parentElement!.textContent).toMatch(/18 → 4 shards.*Market hall/);
  });

  it('no double, no unusual place', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const [i, v] of ['1', '2', '4', '3'].entries()) await user.type(dice()[i]!, v);
    expect(screen.getByText('No double, no unusual place.')).toBeTruthy();
  });

  it('a die that is not 1 to 6 is not a die: nothing to record', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const [i, v] of ['7', '2', '4', '3'].entries()) await user.type(dice()[i]!, v);
    expect(screen.getByRole('button', { name: 'Record the exploration' })).toHaveProperty('disabled', true);
  });

  it('“Roll all” rolls in the app and says so; the roll can be taken back', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // every die a 6
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Roll all' }));
    expect(dice().map((d) => (d as HTMLInputElement).value)).toEqual(['6', '6', '6', '6']);
    await user.click(screen.getByRole('button', { name: /^Record: 4 shards into the stash$/ })); // 24
    expect(screen.getByText(/rolled in the app/)).toBeTruthy();
    expect(stash()).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(stash()).toBe(0);
    expect(screen.queryByText(/✓ Explored:/)).toBeNull();
  });

  it('typing over a rolled die makes it “entered” again; a second record replaces the first', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Roll all' }));
    await user.clear(dice()[0]!); await user.type(dice()[0]!, '1');
    await user.click(screen.getByRole('button', { name: /^Record: \d+ shards? into the stash$/ }));
    expect(screen.queryByText(/rolled in the app/)).toBeNull();
    const first = stash();
    await user.clear(dice()[1]!); await user.type(dice()[1]!, '1');
    await user.click(screen.getByRole('button', { name: /^Record: \d+ shards? into the stash$/ }));
    expect(first).toBe(4); // 1 + 6 + 6 + 6 = 19
    expect(stash()).toBe(3); // 1 + 1 + 6 + 6 = 14: the first roll's shards are replaced, not added to
  });

  it('with more than six dice the best six are kept, and the player can keep others', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: '+ A die' }));
    for (const [i, d] of dice().entries()) await user.type(d, String([1, 2, 6, 6, 5, 4, 3][i]));
    expect(dice()).toHaveLength(7);
    expect(para(/Six kept: 2 \+ 6 \+ 6 \+ 5 \+ 4 \+ 3 = 26/)).toBeTruthy();
    const keep = screen.getAllByRole('checkbox', { name: /^Keep die/ });
    expect(keep.filter((k) => (k as HTMLInputElement).checked)).toHaveLength(6);
    expect((within(document.body).getByRole('checkbox', { name: 'Keep die 1' }) as HTMLInputElement).checked).toBe(false);
  });
});

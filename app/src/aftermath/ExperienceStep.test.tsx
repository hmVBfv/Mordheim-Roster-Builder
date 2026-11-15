/* Step 2 of the aftermath: the table of the battle's points, the underdog bonus suggested from the frozen ratings, the scenario's points
   typed per warrior – and one button that grants and writes them onto the roster. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { ExperienceStep } from './ExperienceStep.tsx';
import { takeOverBattle } from './takeover.ts';
import { underdogOf } from './underdog.ts';
import { aftermathView } from './view.ts';

beforeAll(polyfillDialog);
afterEach(() => cleanup());
const ME = 'w-me', OP = 'w-op', T = '2026-10-05T20:00:00.000Z';
const totals = (rating: number) => ({ rating, spent: 0, models: 0, heroes: 0, gold: 0, fallen: 0 });
const view = (own: number | null, theirs: number | null): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [
    { warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1, beforeTotals: own == null ? undefined : totals(own) },
    { warbandId: OP, name: 'Them', wbType: 'skaven', wbName: 'Skaven', playerId: 'u2', player: 'Ben', outcome: 'defeat', revBefore: 1, beforeTotals: theirs == null ? undefined : totals(theirs) },
  ],
}) as BattleView;

function Harness({ v }: { v: BattleView }) {
  const [s, setS] = useState<WarbandState>(() => takeOverBattle(data, sampleSave(), v, ME, '2026-10-05'));
  const a = aftermathView(data, s, 'b-1')!;
  const ctx = core.ctxOf(data, s);
  return (
    <MemoryRouter>
      <ExperienceStep a={a} data={data} underdog={underdogOf(data, v, ME)} rosterLink="/x" acts={{ ctx, edit: (f) => setS(f(ctx)) }} />
      <output data-testid="exp">{JSON.stringify(s.models.map((m) => [m.uid, m.exp]))}</output>
    </MemoryRouter>
  );
}
const exps = () => JSON.parse(screen.getByTestId('exp').textContent!) as [number, number][];
const rowOf = (name: RegExp) => within(screen.getByRole('table', { name: 'Experience of the battle' })).getByRole('row', { name });

describe('the experience step', () => {
  it('suggests the underdog bonus from the frozen ratings, and the table shows it for each fighter', () => {
    render(<Harness v={view(200, 290)} />);
    expect((screen.getByRole('spinbutton', { name: 'Underdog bonus (per fighter)' }) as HTMLInputElement).value).toBe('2');
    const opponents = screen.getByRole('table', { name: 'Compared with each opponent' });
    expect(within(opponents).getByRole('row', { name: /Them/ }).getAttribute('aria-current')).toBe('true');
    expect(within(rowOf(/Mercenary Captain/)).getAllByRole('cell')[3]!.textContent).toBe('2'); // the underdog column
  });

  it('a bonus typed by hand replaces the suggestion; a missing rating is said, not guessed', async () => {
    const user = userEvent.setup();
    render(<Harness v={view(200, null)} />);
    expect(screen.getByText(/A rating is missing/)).toBeTruthy();
    const field = screen.getByRole('spinbutton', { name: 'Underdog bonus (per fighter)' });
    expect((field as HTMLInputElement).value).toBe('0');
    await user.clear(field);
    await user.type(field, '3');
    expect(within(rowOf(/Mercenary Captain/)).getAllByRole('cell')[3]!.textContent).toBe('3');
  });

  it('scenario points count only with their reason, and are written with the rest', async () => {
    const user = userEvent.setup();
    render(<Harness v={view(200, 200)} />);
    const before = exps().find(([uid]) => uid === 1)![1];
    await user.type(screen.getByLabelText('Scenario points for Mercenary Captain'), '2');
    expect(screen.getByText(/Say what the scenario points are for/)).toBeTruthy();
    expect(within(rowOf(/Mercenary Captain/)).getAllByRole('cell')[5]!.textContent).toBe('1'); // survived only: the points are not counted without a reason
    await user.type(screen.getByLabelText('What for'), 'carried the wyrdstone off');
    expect(within(rowOf(/Mercenary Captain/)).getAllByRole('cell')[5]!.textContent).toBe('3');
    await user.click(screen.getByRole('button', { name: 'Grant and write onto the roster' }));
    expect(exps().find(([uid]) => uid === 1)![1]).toBe(before + 3);
    expect(screen.getByText(/✓ Battle experience granted\./)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Experience of the battle' })).toBeNull();
  });
});

describe('the advance, rolled on this page', () => {
  /** The captain has the experience of two advances' worth: 2 for the first, 4 for the second … he needs a step. */
  function Due() {
    const [s, setS] = useState<WarbandState>(() => {
      const w = takeOverBattle(data, sampleSave(), view(200, 200), ME, '2026-10-05');
      return { ...w, models: w.models.map((m) => (core.isHeroModel(core.ctxOf(data, w), m) ? { ...m, exp: 40 } : m)) };
    });
    const a = aftermathView(data, s, 'b-1')!;
    const ctx = core.ctxOf(data, s);
    return (
      <MemoryRouter>
        <ExperienceStep a={a} data={data} underdog={null} rosterLink="/x" acts={{ ctx, edit: (f) => setS(f(ctx)) }} />
        <output data-testid="adv">{JSON.stringify(s.models.map((m) => [m.uid, (m.adv ?? {}) as object, m.skills ?? []]))}</output>
        <output data-testid="n">{a.advanceList.length}</output>
      </MemoryRouter>
    );
  }

  it('lists who has an advance due, opens the sheet from there, rolls the dice in the app and applies the result to the roster', async () => {
    const user = userEvent.setup();
    render(<Due />);
    const list = screen.getByRole('list', { name: 'Advances due' });
    expect(within(list).getAllByRole('listitem').length).toBe(Number(screen.getByTestId('n').textContent));
    const before = screen.getByTestId('adv').textContent;
    await user.click(within(list).getAllByRole('button', { name: /^Advance / })[0]!);
    const dlg = screen.getByRole('dialog', { hidden: true });
    await user.click(within(dlg).getByRole('button', { name: 'Roll 2D6 here', hidden: true }));
    const roll = within(dlg).getByRole('textbox', { name: '2D6 as rolled', hidden: true }) as HTMLInputElement;
    expect(Number(roll.value)).toBeGreaterThanOrEqual(2);
    expect(Number(roll.value)).toBeLessThanOrEqual(12);
    // whatever the dice said, a typed 7 gives the same kind of choice every time: take it from there
    await user.clear(roll);
    await user.type(roll, '7');
    await user.click(within(dlg).getByRole('button', { name: /^\+1 Weapon Skill/, hidden: true }));
    await user.click(within(dlg).getByRole('button', { name: 'Apply', hidden: true }));
    await waitFor(() => expect(screen.getByTestId('adv').textContent).not.toBe(before));
  });
});

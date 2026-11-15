/* The battles by warband: how each ended, casualties dealt and taken, who dealt the most – as bars and as tables. */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../campaign/api.ts', () => ({ readBattleStats: vi.fn() }));
vi.mock('../live/live.ts', () => ({ useOnCampaign: () => undefined }));
import { readBattleStats } from '../campaign/api.ts';
import { BattleStatistics } from './BattleStatistics.tsx';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const w = (name: string, o: Partial<{ battles: number; victory: number; defeat: number; draw: number; routed: number; inflicted: number; suffered: number; active: boolean }>) =>
  ({ warbandId: name, name, active: true, battles: 0, victory: 0, defeat: 0, draw: 0, routed: 0, inflicted: 0, suffered: 0, ...o });

describe('the battles by warband', () => {
  it('says so when no battle is closed', async () => {
    vi.mocked(readBattleStats).mockResolvedValue({ warbands: [], killers: [] });
    render(<BattleStatistics id="c1" />);
    expect(await screen.findByText(/No battle is closed yet/)).toBeTruthy();
  });

  it('a bar for each warband with its outcomes, the casualties, the numbers as a table and the top killers', async () => {
    vi.mocked(readBattleStats).mockResolvedValue({
      warbands: [w('Clan Skrittle', { battles: 3, victory: 1, defeat: 2, inflicted: 4, suffered: 7 }), w('The Silver Caravan', { battles: 3, victory: 2, draw: 1, inflicted: 7, suffered: 4 })],
      killers: [{ warbandId: 'x', warband: 'The Silver Caravan', name: 'Ulrich', count: 5 }],
    });
    render(<BattleStatistics id="c1" />);
    const bars = await screen.findByRole('list', { name: 'How the battles ended' });
    const first = within(bars).getAllByRole('img')[0]!;
    expect(first.getAttribute('aria-label')).toBe('Clan Skrittle: 1 victories, 0 draws, 2 defeats, 0 routed in 3 battles');
    expect(first.textContent).toBe('12'); // only the segments that are not empty, with their numbers
    const table = screen.getByRole('region', { name: 'Battles: the numbers' });
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([['3', '1', '0', '2', '0', '4', '7'], ['3', '2', '1', '0', '0', '7', '4']]);
    const killers = screen.getByRole('region', { name: 'Most casualties dealt' });
    expect(within(killers).getByText('Ulrich')).toBeTruthy();
    await waitFor(() => expect(readBattleStats).toHaveBeenCalledWith('c1'));
  });
});

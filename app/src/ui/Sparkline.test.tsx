/* Plan P7: the rating of a warband as a small line. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ratingSeries } from '../campaign/ratingSeries.ts';
import { Sparkline, sparkGeometry } from './Sparkline.tsx';

afterEach(cleanup);

describe('sparkGeometry', () => {
  it('spreads the points left to right and puts the highest at the top, the lowest at the bottom', () => {
    const g = sparkGeometry([10, 30, 20]);
    expect(g.map((p) => p.x)).toEqual([16, 160, 304]);
    expect(g[1]!.y).toBeLessThan(g[2]!.y);
    expect(g[2]!.y).toBeLessThan(g[0]!.y);
  });
  it('draws a line of equal values in the middle, and one point in the middle', () => {
    expect(sparkGeometry([5, 5, 5]).map((p) => p.y)).toEqual([48, 48, 48]);
    expect(sparkGeometry([7])).toEqual([{ x: 160, y: 48 }]);
    expect(sparkGeometry([])).toEqual([]);
  });
});

describe('Sparkline', () => {
  const points = [{ label: 'Start', value: 107 }, { label: 'After battle 1', value: 121 }, { label: 'After battle 2', value: 118 }];

  it('says in words what the picture shows, and has every number in a table', async () => {
    const user = userEvent.setup();
    render(<Sparkline title="Rating over the battles" unit="rating" points={points} />);
    const fig = screen.getByRole('figure', { name: /Rating over the battles/ });
    expect(fig.textContent).toContain('107 → 118 rating (+11)');
    expect(within(fig).getByRole('img').getAttribute('aria-label')).toBe('Rating over the battles: Start 107, After battle 1 121, After battle 2 118.');
    // a tooltip on each point
    expect([...fig.querySelectorAll('circle title')].map((t) => t.textContent)).toEqual(['Start: 107 rating', 'After battle 1: 121 rating', 'After battle 2: 118 rating']);
    await user.click(within(fig).getByText('The numbers'));
    expect(within(fig).getAllByRole('row').map((r) => r.textContent)).toEqual(['Whenrating', 'Start107', 'After battle 1121', 'After battle 2118']);
  });

  it('draws nothing for fewer than two points: there is no line to see', () => {
    const { container } = render(<Sparkline title="Rating" unit="rating" points={points.slice(0, 1)} />);
    expect(container.childElementCount).toBe(0);
  });
});

describe('ratingSeries', () => {
  const mark = (kind: string, round: number, rating: number, at: string) => ({ kind, round, rating, at });
  it('orders the marks by round, names them, and keeps a round it sat out', () => {
    const s = ratingSeries([mark('after_battle', 2, 130, '2026-10-03'), mark('start', 0, 107, '2026-10-01'), mark('sat_out', 1, 107, '2026-10-02')]);
    expect(s).toEqual([{ label: 'Start', value: 107 }, { label: 'Round 1, sat out', value: 107 }, { label: 'After battle 2', value: 130 }]);
  });
});

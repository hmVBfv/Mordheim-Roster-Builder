/* The statistics (plan P14): the series of a number over the marks, the axis, and the chart – legend, switching lines off, the crosshair with a
   tooltip by keyboard, and the numbers as a table. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { WarbandStatistics, WarbandWarriors } from '../campaign/api.ts';
import { Compare } from './Compare.tsx';
import { LineChart } from './LineChart.tsx';
import { warriorSeries } from './WarriorStatistics.tsx';
import { METRICS, fmt, latestOf, markLabel, metricOf, niceScale, seriesOf, toCsv, withBattles } from './metrics.ts';

afterEach(() => cleanup());
const pt = (round: number, kind: string, metrics: Record<string, number>) => ({ round, kind, at: `2026-10-0${round + 1}T10:00:00.000Z`, metrics });
const STATS: WarbandStatistics[] = [
  { warbandId: 'a', name: 'The Grey Penitents', active: true, points: [pt(0, 'start', { rating: 100, income: 0 }), pt(1, 'after_battle', { rating: 130, income: 60 }), pt(2, 'after_battle', { rating: 150, income: 140 })] },
  { warbandId: 'b', name: 'Clan Skrittle', active: true, points: [pt(0, 'start', { rating: 90 }), pt(2, 'sat_out', { rating: 90 })] },
  { warbandId: 'c', name: 'The Left Band', active: false, points: [pt(0, 'start', { rating: 70 })] },
];

describe('the numbers', () => {
  it('every metric has words, a group and a unit, and a key once', () => {
    expect(new Set(METRICS.map((m) => m.key)).size).toBe(METRICS.length);
    for (const m of METRICS) { expect(m.label.length).toBeGreaterThan(3); expect(m.about.length, m.key).toBeGreaterThan(10); }
    expect(metricOf('wealth').label).toBe('Total gold value incl. stash');
    expect(metricOf('nonsense').key).toBe(METRICS[0]!.key);
  });

  it('names a mark on the axis', () => {
    expect(markLabel('start', 0)).toBe('Start');
    expect(markLabel('after_battle', 2)).toBe('After battle 2');
    expect(markLabel('sat_out', 3)).toBe('Round 3, sat out');
  });

  it('the series of one number: in the order of the rounds, a mark without the number left out, a warband without any dropped', () => {
    const s = seriesOf(STATS, 'income');
    expect(s.map((x) => [x.name, x.points.map((p) => p.value)])).toEqual([['The Grey Penitents', [0, 60, 140]]]);
    const r = seriesOf(STATS, 'rating');
    expect(r.map((x) => x.points.map((p) => p.label))).toEqual([['Start', 'After battle 1', 'After battle 2'], ['Start', 'Round 2, sat out'], ['Start']]);
  });

  it('the axis starts at zero and ends at a clean number above the highest', () => {
    expect(niceScale([100, 150])).toMatchObject({ min: 0, max: 150 });
    expect(niceScale([0, 0])).toMatchObject({ min: 0 });
    expect(niceScale([-30, 40]).min).toBeLessThan(0);
    expect(niceScale([3, 7]).ticks.at(-1)).toBeGreaterThanOrEqual(7);
  });

  it('writes a number with its unit', () => {
    expect(fmt(60, 'gc')).toBe('60 gc');
    expect(fmt(4, '')).toBe('4');
    expect(fmt(2.5, '')).toBe('2.5');
  });
});

function Harness({ key_ = 'rating' }: { key_?: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  return <LineChart metric={metricOf(key_)} series={seriesOf(STATS, key_)} hidden={hidden} onToggle={(w) => setHidden((h) => { const n = new Set(h); if (n.has(w)) n.delete(w); else n.add(w); return n; })} />;
}

describe('the chart', () => {
  it('has a legend entry for each warband, a line for each, and a description of the whole', () => {
    render(<Harness />);
    const legend = screen.getByRole('list', { name: 'Warbands' });
    expect(within(legend).getAllByRole('button').map((b) => b.textContent)).toEqual(['The Grey Penitents', 'Clan Skrittle', 'The Left Band (left)']);
    const img = screen.getByRole('img');
    expect(img.querySelectorAll('polyline')).toHaveLength(3);
    expect(img.getAttribute('aria-label')).toMatch(/The Grey Penitents: Start 100, After battle 1 130, After battle 2 150/);
  });

  it('switching a line off removes it without repainting the others', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const colourOf = (name: string) => screen.getByRole('img').querySelectorAll('polyline')[['The Grey Penitents', 'Clan Skrittle', 'The Left Band'].indexOf(name)]?.getAttribute('stroke');
    const third = colourOf('The Left Band');
    await user.click(screen.getByRole('button', { name: 'The Grey Penitents' }));
    expect(screen.getByRole('button', { name: 'The Grey Penitents' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('img').querySelectorAll('polyline')).toHaveLength(2);
    // the legend kept its order and colours: the third warband is still the third colour
    expect(screen.getByRole('img').querySelectorAll('polyline')[1]!.getAttribute('stroke')).toBe(third);
  });

  it('all lines off says so', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const b of within(screen.getByRole('list', { name: 'Warbands' })).getAllByRole('button')) await user.click(b);
    expect(screen.getByText('All lines are switched off.')).toBeTruthy();
  });

  it('the arrow keys move a crosshair with a tooltip of every shown warband', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status').textContent).toMatch(/Start.*The Grey Penitents: 100.*Clan Skrittle: 90.*The Left Band: 70/);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const tip = screen.getByRole('status').textContent!;
    expect(tip).toMatch(/Round 2/);
    expect(tip).toMatch(/The Grey Penitents: 150/);
    expect(tip).not.toMatch(/The Left Band/); // it has no mark in round 2
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the numbers are a table with a row for each warband and a column for each round', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'The numbers' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Warband', 'Start', 'R1', 'R2']);
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([['100', '130', '150'], ['90', '–', '90'], ['70', '–', '–']]);
  });
});

describe('compare and export', () => {
  it('the latest value for each warband', () => {
    expect([...latestOf(STATS, 'rating')]).toEqual([['a', 150], ['b', 90], ['c', 70]]);
    expect([...latestOf(STATS, 'income')]).toEqual([['a', 140]]);
  });

  it('writes every number as CSV, one row for each mark, quoting names and keeping formulas out', () => {
    const csv = toCsv([{ warbandId: 'x', name: '=Evil, "Band"', active: true, points: [pt(0, 'start', { rating: 100 }), pt(1, 'after_battle', { rating: 120, income: 5 })] }]);
    const lines = csv.trim().split('\n');
    expect(lines[0]!.startsWith('warband,round,mark,rating,')).toBe(true);
    expect(lines[1]!.startsWith('"\'=Evil, ""Band""",0,Start,100,')).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[2]!.split(',').length).toBe(lines[0]!.split(',').length + 1); // the quoted comma of the name is not a column
  });

  it('compares two warbands: both values and the difference, a number only one has shown with a dash', async () => {
    render(<Compare list={STATS} />);
    const table = screen.getByRole('table');
    const row = (name: string) => within(within(table).getByRole('rowheader', { name }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(row('Warband rating')).toEqual(['150', '90', '+60']);
    expect(row('Income, total')).toEqual(['140 gc', '–', '–']);
    await userEvent.setup().selectOptions(screen.getByLabelText('Second'), 'c');
    expect(row('Warband rating')).toEqual(['150', '70', '+80']);
  });
});

describe('battles fought', () => {
  it('counts the battles from the marks: a start and a round sat out are none', () => {
    const [a, b] = withBattles(STATS);
    expect(a!.points.map((p) => p.metrics.battles)).toEqual([0, 1, 2]);
    expect(b!.points.map((p) => p.metrics.battles)).toEqual([0, 0]);
    expect(seriesOf(withBattles(STATS), 'battles').map((s) => s.points.at(-1)!.value)).toEqual([2, 0, 0]);
  });
});

describe('warriors', () => {
  const W: WarbandWarriors = {
    warbandId: 'a', name: 'The Grey Penitents', active: true,
    points: [
      { round: 0, kind: 'start', at: '2026-10-01T10:00:00.000Z', warriors: [{ uid: 1, label: 'Brother Anselm', unit: 'Captain', hero: true, exp: 20 }, { uid: 2, label: 'Zealots', unit: 'Zealots', hero: false, exp: 0 }], fallen: [] },
      { round: 1, kind: 'after_battle', at: '2026-10-05T10:00:00.000Z', warriors: [{ uid: 1, label: 'Brother Anselm', unit: 'Captain', hero: true, exp: 24 }], fallen: [{ unit: 'Zealots', count: 2 }] },
    ],
  };
  it('one line for each roster entry over the marks it was on', () => {
    const s = warriorSeries(W);
    expect(s.map((x) => [x.name, x.points.map((p) => p.value)])).toEqual([['Brother Anselm', [20, 24]], ['Zealots', [0]]]);
    expect(s[0]!.points.map((p) => p.label)).toEqual(['Start', 'After battle 1']);
  });
});

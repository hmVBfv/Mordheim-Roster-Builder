/* Warbands of one name can be told apart by when they were made and last changed (Rob, 20.10.2026). */
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoredWarband } from '../db/db.ts';
import { sampleSave } from '../test/data.ts';
import { WarbandList } from './WarbandList.tsx';

afterEach(cleanup);

const warband = (id: string, createdAt: string, updatedAt: string): StoredWarband => {
  const s = sampleSave();
  return { id, name: 'The Silver Caravan', wb: s.wb as string, wbName: 'Mercenaries', state: s, format: 1, createdAt, updatedAt };
};

describe('the list of warbands', () => {
  it('names when each was made and when it last changed, so two of one name differ', () => {
    render(<MemoryRouter><WarbandList warbands={[
      warband('a', '2026-10-03T12:00:00.000Z', '2026-10-20T12:00:00.000Z'),
      warband('b', '2026-10-05T12:00:00.000Z', '2026-10-05T12:00:00.000Z'),
    ]} /></MemoryRouter>);
    const [first, second] = screen.getAllByRole('link');
    expect(within(first!).getByText(/^Created 3 Oct, /)).toBeTruthy();
    expect(within(first!).getByText(/^Updated 20 Oct, /)).toBeTruthy();
    expect(within(second!).getByText(/^Created 5 Oct, /)).toBeTruthy();
    // the exact moment for whoever needs it
    expect(first!.querySelector('time[datetime="2026-10-03T12:00:00.000Z"]')).not.toBeNull();
    expect(first!.querySelector('time[datetime="2026-10-20T12:00:00.000Z"]')).not.toBeNull();
  });

  it('each date has a line of its own (#55)', () => {
    render(<MemoryRouter><WarbandList warbands={[warband('a', '2026-10-03T12:00:00.000Z', '2026-10-20T12:00:00.000Z')]} /></MemoryRouter>);
    const created = screen.getByText(/^Created 3 Oct, /).closest('small')!;
    const updated = screen.getByText(/^Updated 20 Oct, /).closest('small')!;
    expect(created).not.toBe(updated);
    expect(created.textContent).not.toMatch(/Updated/);
  });

  it('a warband never changed after it was made says so on the Updated line (#55)', () => {
    render(<MemoryRouter><WarbandList warbands={[warband('b', '2026-10-05T12:00:00.000Z', '2026-10-05T12:00:00.000Z')]} /></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(within(link).getByText(/^Created 5 Oct, /)).toBeTruthy();
    expect(within(link).getByText('Updated never').closest('small')).not.toBe(within(link).getByText(/^Created 5 Oct, /).closest('small'));
  });

  it('a planner says so (#77)', () => {
    const w = warband('p', '2026-10-05T12:00:00.000Z', '2026-10-05T12:00:00.000Z');
    render(<MemoryRouter><WarbandList warbands={[{ ...w, state: { ...w.state, planner: true } }, warband('q', '2026-10-05T12:00:00.000Z', '2026-10-05T12:00:00.000Z')]} /></MemoryRouter>);
    const [planner, plain] = screen.getAllByRole('link');
    expect(within(planner!).getByText(/Planner/)).toBeTruthy();
    expect(within(plain!).queryByText(/Planner/)).toBeNull();
  });
});

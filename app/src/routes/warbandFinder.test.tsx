/* Wish #116: a filter and a sort over the list of warbands to start. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warbandFacts } from '@mordheim/core';
import { afterEach, describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { useWarbandFinder, WarbandFinder } from './WarbandFinder.tsx';

afterEach(cleanup);

const facts = warbandFacts(data);

function Harness() {
  const finder = useWarbandFinder(facts);
  return (
    <>
      <WarbandFinder facts={facts} finder={finder} />
      <ul aria-label="Shown">{finder.shown.map((w) => <li key={w.key}>{w.name}</li>)}</ul>
    </>
  );
}
const shown = () => within(screen.getByRole('list', { name: 'Shown' })).getAllByRole('listitem').map((li) => li.textContent);

describe('finding a warband to start', () => {
  it('shows all of them until a filter is set, then narrows by the fields and counts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(shown()).toHaveLength(facts.length);
    await user.click(screen.getByText('Find a warband'));
    await user.selectOptions(screen.getByLabelText('Heroes at the start'), '6');
    const six = facts.filter((f) => f.heroes === 6).length;
    expect(shown()).toHaveLength(six);
    expect(screen.getByRole('status').textContent).toBe(`${six} of ${facts.length} warbands`);
    await user.selectOptions(screen.getByLabelText(/Big creature/), 'with');
    expect(shown().length).toBeLessThanOrEqual(six);
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(shown()).toHaveLength(facts.length);
  });

  it('finds by name and says when none fits', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Find a warband'));
    await user.type(screen.getByLabelText('Look for'), 'merc');
    expect(shown()).toContain('Mercenaries');
    await user.clear(screen.getByLabelText('Look for'));
    await user.type(screen.getByLabelText('Look for'), 'zzzz');
    expect(screen.getByRole('status').textContent).toBe('No warband fits.');
  });

  it('sorts by starting gold', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Find a warband'));
    await user.selectOptions(screen.getByLabelText('Sort by'), 'gold-desc');
    const gold = shown().map((n) => facts.find((f) => f.name === n)!.goldMax);
    expect(gold).toEqual([...gold].sort((a, b) => b - a));
  });
});

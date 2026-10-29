/* Wish #116: a filter and a sort over the list of warbands to start.
   Wishes #121–#125: the filter always open, its fields tidy and prefilled with the range over all warbands, the matches as a table. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warbandFacts } from '@mordheim/core';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { useWarbandFinder, WarbandFinder, WarbandTable } from './WarbandFinder.tsx';

afterEach(cleanup);

const facts = warbandFacts(data);

function Harness() {
  const finder = useWarbandFinder(facts);
  const [chosen, setChosen] = useState('');
  return (
    <>
      <WarbandFinder facts={facts} finder={finder} />
      <WarbandTable shown={finder.shown} sort={finder.sort} chosen={chosen} onChoose={setChosen} />
      <p aria-label="Chosen">{chosen}</p>
    </>
  );
}
const shown = () => within(screen.getByRole('table')).getAllByRole('radio').map((r) => r.getAttribute('aria-label'));

describe('finding a warband to start', () => {
  it('shows all of them until a filter is set, then narrows by the fields and counts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(shown()).toHaveLength(facts.length);
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
    await user.type(screen.getByLabelText('Look for'), 'merc');
    expect(shown()).toContain("Mercenaries");
    await user.clear(screen.getByLabelText('Look for'));
    await user.type(screen.getByLabelText('Look for'), 'zzzz');
    expect(screen.getByRole('status').textContent).toBe('No warband fits.');
  });

  it('sorts by starting gold', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText('Sort by'), 'gold-desc');
    const gold = shown().map((n) => facts.find((f) => f.name === n)!.goldMax);
    expect(gold).toEqual([...gold].sort((a, b) => b - a));
  });

  it('is open from the start, with no fold to open (#125)', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByLabelText('Look for')).toBeTruthy();
  });

  it('starts with the lowest and highest gold and model count of all warbands, which leaves everything in (#123, #124)', () => {
    render(<Harness />);
    const golds = facts.flatMap((f) => [f.gold, f.goldMax]);
    const sizes = facts.map((f) => f.max);
    expect((screen.getByLabelText('Gold from') as HTMLInputElement).value).toBe(String(Math.min(...golds)));
    expect((screen.getByLabelText('Gold to') as HTMLInputElement).value).toBe(String(Math.max(...golds)));
    expect((screen.getByLabelText('Max. models from') as HTMLInputElement).value).toBe(String(Math.min(...sizes)));
    expect((screen.getByLabelText('Max. models to') as HTMLInputElement).value).toBe(String(Math.max(...sizes)));
    expect(shown()).toHaveLength(facts.length);
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull();
  });

  it('narrows by a tighter value and goes back to the full range on Clear filter (#123)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const to = screen.getByLabelText('Gold to');
    await user.clear(to);
    const mid = [...facts.map((f) => f.gold)].sort((a, b) => a - b)[Math.floor(facts.length / 2)]!;
    await user.type(to, String(mid));
    expect(shown().length).toBeGreaterThan(0);
    expect(shown().length).toBeLessThan(facts.length);
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect((screen.getByLabelText('Gold to') as HTMLInputElement).value).toBe(String(Math.max(...facts.flatMap((f) => [f.gold, f.goldMax]))));
    expect(shown()).toHaveLength(facts.length);
  });

  it('names the model filter by what it limits, not "Most models" (#124)', () => {
    render(<Harness />);
    expect(screen.queryByText(/Most models/)).toBeNull();
    expect(screen.getByLabelText('Max. models from')).toBeTruthy();
  });

  it('lists the matches in a table with gold, models and Heroes per row, and a row is chosen by its radio (#121)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(expect.arrayContaining(['Warband', 'Gold', 'Max. models', 'Heroes']));
    await user.click(within(table).getByRole('radio', { name: 'Mercenaries' }));
    expect(screen.getByLabelText('Chosen').textContent).toBe('merc');
    expect((within(table).getByRole('radio', { name: 'Mercenaries' }) as HTMLInputElement).checked).toBe(true);
  });

  /* Wishes #130, #133: Race and a Yes/No big-creature column last; the filter's fields in the order of the columns; a row is chosen by tapping it. */
  it('has the columns Warband, Race, Gold, Max. models, Heroes, Big creature, in that order (#130)', () => {
    render(<Harness />);
    const head = screen.getByRole('table').querySelector('thead')!;
    expect(within(head as HTMLElement).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Warband', 'Race', 'Gold', 'Max. models', 'Heroes', 'Big creature']);
  });

  it('shows the race and a plain Yes or No for a big creature in each row (#130)', () => {
    render(<Harness />);
    const table = screen.getByRole('table');
    const big = facts.find((f) => f.large)!;
    const small = facts.find((f) => !f.large)!;
    const cells = (name: string) => within(within(table).getByRole('radio', { name }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(cells(big.name).at(-1)).toBe('Yes');
    expect(cells(small.name).at(-1)).toBe('No');
    expect(cells(big.name)[1]).toBe(big.race);
    expect(cells(big.name)[0]).not.toMatch(/big creature/i);
  });

  it('chooses a warband by tapping anywhere in its row (#130)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = within(screen.getByRole('table')).getByRole('radio', { name: 'Mercenaries' }).closest('tr')!;
    await user.click(within(row).getAllByRole('cell')[2]!);
    expect(screen.getByLabelText('Chosen').textContent).toBe('merc');
    expect(row.getAttribute('aria-selected') ?? row.dataset.picked).toBeTruthy();
  });

  it('lists the filter fields in the order of the columns (#133)', () => {
    render(<Harness />);
    const order = ['Look for', 'Race', 'Grade', 'Gold from', 'Max. models from', 'Heroes at the start', /Big creature/, 'Sort by'];
    const fields = order.map((l) => screen.getByLabelText(l));
    fields.slice(1).forEach((f, i) => {
      expect(fields[i]!.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING, `${String(order[i + 1])} after ${String(order[i])}`).toBeTruthy();
    });
  });
});

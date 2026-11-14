/* A table of the rules: caption, headings, and the marked row or column – announced, not only coloured. */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RulesTable } from './RulesTable.tsx';

afterEach(() => cleanup());
const rows = [['1', '45', '40'], ['2', '60', '55']];

describe('RulesTable', () => {
  it('has a caption, column headings and row headings', () => {
    render(<RulesTable caption="Prices" head={['Shards', '1–3', '4–6']} rows={rows} />);
    const table = screen.getByRole('table', { name: 'Prices' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Shards', '1–3', '4–6']);
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['1', '2']);
  });

  it('marks the own row and column with aria-current', () => {
    render(<RulesTable caption="Prices" head={['Shards', '1–3', '4–6']} rows={rows} row={1} col={2} />);
    const table = screen.getByRole('table');
    const current = [...table.querySelectorAll('[aria-current="true"]')].map((e) => e.textContent);
    expect(current).toContain('4–6'); // the heading of the column
    expect(current).toContain('55'); // the cell where row and column meet
    expect(table.querySelectorAll('tr[aria-current="true"]')).toHaveLength(1);
    expect(within(table.querySelector('tr[aria-current="true"]') as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe('60');
  });

  it('names its source and shows a note', () => {
    render(<RulesTable caption="Prices" head={['A']} rows={[['x']]} note="Once per sequence." link="https://example.org/rule" />);
    expect(screen.getByText(/Once per sequence/)).toBeTruthy();
    const a = screen.getByRole('link', { name: /Rules/ });
    expect(a.getAttribute('href')).toBe('https://example.org/rule');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('scrolls inside its own box, reachable by keyboard', () => {
    render(<RulesTable caption="Prices" head={['A']} rows={[['x']]} />);
    expect(screen.getByRole('region', { name: 'Prices' }).getAttribute('tabindex')).toBe('0');
  });
});

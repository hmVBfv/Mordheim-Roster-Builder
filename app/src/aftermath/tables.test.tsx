/* The tables of the post-battle sequence as the app shows them: built from the rules data, the overview page in the order of the rulebook,
   the wyrdstone prices with the warband's own column. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { data } from '../test/data.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { RULES } from '../app/paths.ts';
import { experienceTables, injuryTables, locationGroups, sequenceTable, shardsTable, wyrdPriceTable } from './tables.ts';
import { WyrdPrices } from './WyrdPrices.tsx';

beforeAll(loadScreens, SCREENS_MS);
afterEach(() => cleanup());

describe('tables.ts', () => {
  it('the hero injuries show each D66 result once, the split ones with both parts', () => {
    const rows = injuryTables(data).hero.rows;
    expect(rows.map((r) => r[0])).toEqual(['11-15', '16-21', '22', '23', '24', '25', '26', '31', '32', '33', '34', '35', '36', '41-55', '56', '61', '62-63', '64', '65', '66']);
    const arm = rows.find((r) => r[0] === '23')!;
    expect(arm[1]).toBe('Arm Wound');
    expect(arm[2]).toMatch(/1: arm amputated.*·.*2–6: misses next game/);
  });

  it('the underdog table reads like the page', () => {
    expect(experienceTables(data).underdog.rows).toEqual([['0 – 50', 'None'], ['51 – 75', '+1'], ['76 – 100', '+2'], ['101 – 150', '+3'], ['151 – 300', '+4'], ['301+', '+5']]);
  });

  it('the wyrdstone prices: eight lots by six sizes, the last lot is 8+', () => {
    const t = wyrdPriceTable();
    expect(t.head).toEqual(['Shards', '1–3 warriors', '4–6 warriors', '7–9 warriors', '10–12 warriors', '13–15 warriors', '16+ warriors']);
    expect(t.rows).toHaveLength(8);
    expect(t.rows[0]).toEqual(['1', '45', '40', '35', '30', '30', '25']);
    expect(t.rows[7]).toEqual(['8+', '155', '140', '130', '120', '110', '100']);
  });

  it('the exploration chart in five tables, six places in each', () => {
    const g = locationGroups(data);
    expect(g.map((x) => x.title)).toEqual(['Doubles', 'Triples', 'Four of a kind', 'Five of a kind', 'Six of a kind']);
    for (const x of g) expect(x.table.rows).toHaveLength(6);
    expect(g[0]!.table.rows[0]).toEqual(['1 · 1', 'Well', expect.any(String)]);
  });

  it('the shards and the sequence', () => {
    expect(shardsTable(data).rows[6]).toEqual(['36+', '7']);
    expect(sequenceTable(data).rows.map((r) => r[1])).toEqual(['Injuries', 'Experience', 'Exploration', 'Sell wyrdstone', 'Available veterans', 'Rare items', 'Dramatis Personae', 'Recruits & common items', 'Reallocate equipment', 'Warband rating']);
  });
});

describe('WyrdPrices', () => {
  it('marks the column of the warband and the row of the lot, and keeps the whole table in a fold', async () => {
    render(<WyrdPrices size={8} shards={3} />);
    const own = screen.getByRole('table', { name: /7–9 warriors/ });
    expect(within(own).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Shards', '7–9 warriors']);
    expect(within(own.querySelector('tr[aria-current="true"]') as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe('65');
    await userEvent.click(screen.getByText('All sizes'));
    expect(screen.getByRole('table', { name: 'Wyrdstone prices (gold for the whole lot)' })).toBeTruthy();
  });

  it('shows the whole table when no warband is given', () => {
    render(<WyrdPrices />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(7);
  });
});

describe('the overview of the post-battle rules', () => {
  it('shows the ten steps in the order of the rulebook, each with its link', async () => {
    render(<MemoryRouter initialEntries={[`${RULES}/post-battle`]}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'After the battle' })).toBeTruthy();
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads.slice(0, 10)).toEqual(['1. Injuries', '2. Experience', '3. Exploration', '4. Sell wyrdstone', '5. Available veterans', '6. Rare items', '7. Dramatis Personae', '8. Recruits & common items', '9. Reallocate equipment', '10. Warband rating']);
    expect(screen.getByRole('table', { name: 'Underdog bonus (per fighter)' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Wyrdstone prices (gold for the whole lot)' })).toBeTruthy();
    // every step, and the tables, point to the page of the rule
    const links = screen.getAllByRole('link', { name: /Rules ↗/ }).map((a) => a.getAttribute('href'));
    expect(links.length).toBeGreaterThanOrEqual(10);
    expect(links.every((h) => h?.startsWith('https://mordheimer.net/docs/'))).toBe(true);
  });

  it('is reachable from the Rules page', async () => {
    render(<MemoryRouter initialEntries={[RULES]}><AppRoutes /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: /After the battle/ });
    expect(link.getAttribute('href')).toBe(`${RULES}/post-battle`);
  });
});

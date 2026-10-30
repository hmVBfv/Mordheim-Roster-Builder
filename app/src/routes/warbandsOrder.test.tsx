/* Wish #157 (Rob, 30.10.2026): on the Warbands screen the warbands that take part in a campaign come right after the favourites, then
   the others (the groups, or unsorted), and the planners last. */
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); await db.warbands.clear(); await db.meta.clear(); });

async function add(id: string, name: string, extra: { campaignId?: string; planner?: boolean }) {
  const s = { ...sampleSave(), name, ...(extra.planner ? { planner: true } : {}) };
  const at = '2026-10-20T10:00:00.000Z';
  await db.warbands.add({ id, name, wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: 1, createdAt: at, updatedAt: at, ...(extra.campaignId ? { campaignId: extra.campaignId } : {}) });
}

describe('the order of the Warbands screen (#157)', () => {
  it('has the campaign warbands first, then the others, the planners last', async () => {
    await add('a', 'Free Company', {});
    await add('b', 'Planned Company', { planner: true });
    await add('c', 'Campaign Company', { campaignId: 'c-1' });
    render(<MemoryRouter initialEntries={['/warbands']}><AppRoutes /></MemoryRouter>);
    await screen.findByRole('heading', { level: 1, name: 'Warbands' });
    const main = within(screen.getByRole('main'));
    await main.findByText('Free Company');
    const names = main.getAllByRole('link').filter((a) => /^\/warbands\/[abc]$/.test(a.getAttribute('href') ?? '')).map((a) => a.getAttribute('href'));
    expect(names).toEqual(['/warbands/c', '/warbands/a', '/warbands/b']);
    const heads = main.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads.indexOf('In campaigns')).toBeLessThan(heads.indexOf('Planners'));
  });
});

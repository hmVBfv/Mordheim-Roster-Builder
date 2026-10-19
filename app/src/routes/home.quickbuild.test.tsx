/* Home in the Quick Build: no server, so no campaigns and nothing "open for
   you" – the warbands have the page to themselves. */
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db.ts';
import { data, sampleSave } from '../test/data.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

vi.mock('../flavour.ts', () => ({ FLAVOUR: 'quickbuild', APP_NAME: 'Mordheim Quick Build' }));

beforeAll(loadScreens, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); await db.warbands.clear(); await db.meta.clear(); });

describe('Home in the Quick Build', () => {
  it('shows the warbands without campaigns or an "Open for you" card', async () => {
    const { AppRoutes } = await import('../app/App.tsx');
    const s = { ...sampleSave(), name: 'The Silver Caravan' };
    await db.warbands.add({ id: 'w1', name: s.name as string, wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: 1, createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-28T10:00:00.000Z' });
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('link', { name: /The Silver Caravan/ })).toBeTruthy();
    expect(main.queryByRole('heading', { name: 'Campaigns' })).toBeNull();
    expect(main.queryByRole('heading', { name: 'Open for you' })).toBeNull();
  });
});

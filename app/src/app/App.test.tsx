/* The screens as a player reaches them. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db.ts';
import { data, sampleSave } from '../test/data.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { AppRoutes } from './App.tsx';

const NOW = '2026-09-28T10:00:00.000Z';

async function seed() {
  const s = sampleSave();
  await db.warbands.add({ id: 'w1', name: s.name ?? '', wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: 1, createdAt: NOW, updatedAt: NOW });
  return s;
}

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

beforeAll(loadScreens, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); localStorage.clear(); });
afterEach(() => cleanup());

describe('the app', () => {
  it('home: nothing open yet, and the warbands on this device', async () => {
    await seed();
    at('/');
    expect(screen.getByRole('heading', { name: 'Open for you' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: /The Silver Caravan/ })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Warbands', 'Campaign', 'Notes', 'More']);
    expect(screen.getByTitle('Saved on this device').textContent).toMatch(/Saved/);
  });

  it('a roster shows every warrior with his profile', async () => {
    const s = await seed();
    at('/warbands/w1');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeTruthy();
    const cards = await screen.findAllByRole('article');
    expect(cards.length).toBe(s.models.length + (s.hired ?? []).length + (s.dp ?? []).length);
    for (const c of cards.slice(0, s.models.length)) expect(within(c).getAllByRole('columnheader').map((h) => h.textContent).slice(0, 9)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld']);
  });

  it('an unknown warband says so', async () => {
    at('/warbands/nope');
    expect(await screen.findByRole('heading', { name: 'Not on this device' })).toBeTruthy();
  });

  it('removing a warband can be undone', async () => {
    await seed();
    at('/warbands/w1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove from this device' }));
    expect(await screen.findByText('The Silver Caravan removed.')).toBeTruthy();
    expect(await db.warbands.count()).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('link', { name: /The Silver Caravan/ })).toBeTruthy();
    expect(await db.warbands.count()).toBe(1);
  });

  it('the theme can be chosen', async () => {
    at('/more');
    await userEvent.click(screen.getByRole('radio', { name: 'Parchment (light)' }));
    expect(document.documentElement.dataset.theme).toBe('parchment');
    expect(localStorage.getItem('mordheim-theme')).toBe('parchment');
  });
});

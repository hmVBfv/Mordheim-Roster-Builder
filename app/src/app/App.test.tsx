/* The screens as a player reaches them. */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Warbands', 'Campaign', 'Account']);
    expect(screen.getByTitle('Saved on this device').textContent).toMatch(/Saved/);
  });

  it('a roster shows every warrior on a row with his whole profile; one opens under his row', async () => {
    const s = await seed();
    at('/warbands/w1');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeTruthy();
    const units = s.models.length + (s.hired ?? []).length + (s.dp ?? []).length;
    // a row each, the profile in a line; nothing is open until asked
    const strips = await screen.findAllByRole('img', { name: /^M \S+, WS \S+, BS/ });
    expect(strips).toHaveLength(units);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    const first = screen.getAllByRole('button', { expanded: false })[0]!;
    await user.click(first);
    const card = await screen.findByRole('article');
    expect(within(card).getAllByRole('columnheader').map((h) => h.textContent).slice(0, 9)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld']);
    expect(within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab').map((x) => x.textContent)).toEqual(['Overview', 'Gear', 'Skills & injuries', 'Story & more']);
    // tapping him again closes him
    await user.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
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
    at('/account');
    await userEvent.click(screen.getByRole('radio', { name: 'Parchment (light)' }));
    expect(document.documentElement.dataset.theme).toBe('parchment');
    expect(localStorage.getItem('mordheim-theme')).toBe('parchment');
  });
});

describe('the addresses (#70)', () => {
  it('Home is /home and the account is /account; the old addresses lead on to them', async () => {
    const nav = () => within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    at('/home');
    expect(await screen.findByRole('heading', { name: 'Open for you' })).toBeTruthy();
    expect(nav()).toEqual([['Home', '/home'], ['Warbands', '/warbands'], ['Campaign', '/campaign'], ['Account', '/account']]);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    cleanup();
    // the bare address and the old ones are redirects, not screens of their own
    for (const old of ['/', '/account']) {
      at(old);
      expect(await screen.findByRole('navigation', { name: 'Main' })).toBeTruthy();
      await waitFor(() => {
        const current = screen.getAllByRole('link').find((a) => a.getAttribute('aria-current') === 'page');
        expect(current?.getAttribute('href')).toBe(old === '/' ? '/home' : '/account');
      });
      cleanup();
    }
    at('/more/reports');
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('link').find((a) => a.getAttribute('aria-current') === 'page')?.getAttribute('href')).toBe('/account'));
  });
});

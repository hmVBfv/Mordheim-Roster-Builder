/* The Rules tab: the rulebook chapters word for word, with a search over all of them. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
beforeAll(loadScreens, SCREENS_MS);
beforeAll(async () => { await import('./Rules.tsx'); }, SCREENS_MS);
afterEach(() => cleanup());

describe('the rules tab', () => {
  it('opens on the first chapter and lists all eight', async () => {
    at('/library/rules');
    expect(await screen.findByRole('heading', { level: 2, name: 'Rules' })).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Characteristics' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Chapters' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Characteristics', 'The Turn', 'Movement', 'Shooting', 'Close Combat', 'Wounds and Injuries', 'Recovery', 'Leadership and Psychology',
    ]);
    // the source is named, with a link to the original page
    expect(screen.getByRole('link', { name: /mordheimer\.net/ }).getAttribute('href')).toBe('https://mordheimer.net/docs/rules/characteristics');
  });

  it('another chapter by its address', async () => {
    at('/library/rules?c=movement');
    expect(await screen.findByRole('heading', { level: 2, name: 'Movement' })).toBeTruthy();
  });

  it('a search finds hiding by hide, across the chapters', async () => {
    const user = userEvent.setup();
    at('/library/rules');
    await user.type(await screen.findByRole('searchbox', { name: 'Search the rules' }), 'hide');
    const results = await screen.findByRole('region', { name: 'Search results' });
    expect(within(results).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(results).getAllByText(/hid/i, { selector: 'mark' }).length).toBeGreaterThan(0);
  });

  /* Wish of 8.11.2026: the Rules are a tab of the Library; the old address leads there, and a reader who is not signed in can read them too. */
  it('are the Library\'s last tab, and the old address /rules leads to it', async () => {
    at('/rules?c=movement');
    expect(await screen.findByRole('heading', { level: 2, name: 'Movement' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Library' })).getByRole('link', { name: 'Rules' }).getAttribute('aria-current')).toBe('page');
  });

  it('keep the chapter links inside the Library', async () => {
    at('/library/rules');
    const nav = await screen.findByRole('navigation', { name: 'Chapters' });
    expect(within(nav).getByRole('link', { name: 'Movement' }).getAttribute('href')).toBe('/library/rules?c=movement');
  });
});

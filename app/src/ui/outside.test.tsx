/* Wish #179 (Rob, 1.11.2026): a sheet one only reads – "What's new", a report one reads – closes with a click beside it, as on a desktop
   one would expect; no need to scroll to its "Close". A sheet one writes in does not: a stray click would throw the words away. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); });

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const out = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }))));

/** The sheet's box, as a browser would say it: jsdom has no layout. */
const boxed = (d: HTMLElement) => { d.getBoundingClientRect = () => ({ left: 100, top: 50, right: 700, bottom: 450, width: 600, height: 400, x: 100, y: 50, toJSON: () => ({}) }); };
const backdrop = (d: HTMLElement) => fireEvent.click(d, { clientX: 20, clientY: 20 });

describe('a click beside a sheet', () => {
  it('closes "What\'s new", and a click in it does not', async () => {
    out();
    const user = userEvent.setup();
    at('/account');
    await user.click(within(await screen.findByRole('banner')).getByRole('button', { name: "What's new" }));
    const sheet = (await screen.findByRole('dialog', { name: "What's new", hidden: true })) as HTMLDialogElement;
    boxed(sheet);
    // on the sheet itself, inside its box (its padding), or on what it holds: it stays
    fireEvent.click(sheet, { clientX: 300, clientY: 200 });
    fireEvent.click(within(sheet).getByRole('heading', { name: "What's new" }));
    expect(sheet.open).toBe(true);
    backdrop(sheet);
    expect(sheet.open).toBe(false);
  });

  it('does not close a sheet one writes in', async () => {
    out();
    const user = userEvent.setup();
    at('/account');
    await user.click(await screen.findByRole('button', { name: 'Report a bug' }));
    const sheet = (await screen.findByRole('dialog', { name: 'Report a problem', hidden: true })) as HTMLDialogElement;
    boxed(sheet);
    backdrop(sheet);
    expect(sheet.open).toBe(true);
  });
});

/* Bug #1: after "Reload" the banner stayed on screen although the new version
   was already running. The service worker module is stubbed with a small
   stateful stand-in for useRegisterSW. */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { polyfillDialog } from '../test/dialog.ts';
import { ENTRIES } from '../changelog/entries.ts';

const updateServiceWorker = vi.fn<(reload?: boolean) => Promise<void>>(async () => {});

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: useState(true),
    offlineReady: useState(false),
    updateServiceWorker,
  }),
}));

import { UpdateBanner } from './UpdateBanner.tsx';

beforeAll(polyfillDialog);

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  updateServiceWorker.mockClear();
});

describe('UpdateBanner', () => {
  it('goes away after Reload, even when the page does not reload by itself', async () => {
    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.queryByText('New version available.')).toBeNull());
  });

  it('goes away on Later without touching the service worker', () => {
    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('New version available.')).toBeNull();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  /* Wish #154: under "Reload" a small "What's new" offers what the new version holds that this one does not. */
  const serve = (entries: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(entries))));
  const fresh = { id: '2999-01-01-next', date: '2999-01-01', changes: [{ kind: 'New', text: 'A thing from the next version.' }] };

  it('offers the changes the new version brings, and only those', async () => {
    serve([fresh, ...ENTRIES]);
    render(<UpdateBanner />);
    const open = await screen.findByRole('button', { name: "What's new" });
    // #155: the first change is in view under the notice, before anything is opened (not only inside the closed sheet)
    expect(screen.getAllByText('A thing from the next version.').some((el) => !el.closest('dialog'))).toBe(true);
    fireEvent.click(open);
    const sheet = await screen.findByRole('dialog', { name: "What's new in the update", hidden: true });
    expect(sheet.textContent).toContain('A thing from the next version.');
    expect(sheet.textContent).not.toContain(ENTRIES[0]!.changes[0]!.text);
    expect(sheet.textContent).toContain('New:');
  });

  it('offers nothing when there is nothing new, or the changelog cannot be read', async () => {
    serve(ENTRIES);
    const { unmount } = render(<UpdateBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: "What's new" })).toBeNull();
    unmount();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    render(<UpdateBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: "What's new" })).toBeNull();
  });
});

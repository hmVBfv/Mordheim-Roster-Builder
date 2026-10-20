/* Bug #1: after "Reload" the banner stayed on screen although the new version
   was already running. The service worker module is stubbed with a small
   stateful stand-in for useRegisterSW. */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const updateServiceWorker = vi.fn<(reload?: boolean) => Promise<void>>(async () => {});

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: useState(true),
    offlineReady: useState(false),
    updateServiceWorker,
  }),
}));

import { UpdateBanner } from './UpdateBanner.tsx';

afterEach(() => {
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
});

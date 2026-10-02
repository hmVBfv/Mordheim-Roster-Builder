/* Tests run in jsdom with an in-memory IndexedDB. The service worker module
   only exists in a Vite build. */
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// the first roster of a test file loads its screen module on demand (lazy),
// which Vitest transforms on the spot: a cold run needs more than a second
configure({ asyncUtilTimeout: 5000 });

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }),
}));

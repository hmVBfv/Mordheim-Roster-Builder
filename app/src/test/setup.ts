/* Tests run in jsdom with an in-memory IndexedDB. The service worker module
   only exists in a Vite build. */
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }),
}));

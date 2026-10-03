/* Tests run in jsdom with an in-memory IndexedDB. The service worker module
   only exists in a Vite build. */
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// the first roster of a test file loads its screen module on demand (lazy),
// which Vitest transforms on the spot: a cold run needs more than a second
// (files that render the routes load them first: test/screens.ts)
configure({ asyncUtilTimeout: 5000 });

// no campaign server in the tests: nobody is signed in, unless a test answers otherwise
vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }), { headers: { 'content-type': 'application/json' } })));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }),
}));

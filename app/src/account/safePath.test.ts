/* Security review CLIENT-8: an id from an address or a field goes into an API path; only plain words and ids may. */
import { describe, expect, it } from 'vitest';
import { safePath } from './api.ts';

describe('safePath', () => {
  it('lets the paths of the app through: words, ids, a UUID, a query', () => {
    for (const p of ['/campaigns', '/campaigns/3f2a8c1e-0b7d-4e1a-9c55-0a1b2c3d4e5f/battles', '/warbands/abc123/versions/2', '/campaigns/campaign-1/warbands/campaign-1-w1', '/library?since=3', '/campaigns/x/notes?as=player&since=4', '/auth/me']) {
      expect(safePath(p)).toBe(p);
    }
  });

  it('turns away a path that could lead elsewhere: .., a slash in an id, an empty segment, an encoded dot or slash, a backslash, a space, a fragment', () => {
    for (const p of ['/campaigns/../admin/users', '/campaigns/..', '/campaigns//battles', '/campaigns/%2e%2e/admin', '/campaigns/a%2Fb', '/campaigns/a\\b', '/campaigns/a b', '/campaigns/x#y', '/campaigns/x?since=1#y', 'campaigns', '/campaigns/', '/campaigns/./x']) {
      expect(() => safePath(p), p).toThrow();
    }
  });
});

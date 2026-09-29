import { describe, expect, it } from 'vitest';
import { navItems } from './nav.ts';

describe('navigation', () => {
  it('the campaign app has five places (docs/ui.md §2)', () => {
    expect(navItems('campaign').map((i) => i.label)).toEqual(['Home', 'Warbands', 'Campaign', 'Notes', 'More']);
  });
  it('the Quick Build has no campaign', () => {
    expect(navItems('quickbuild').map((i) => i.label)).toEqual(['Home', 'Warbands', 'More']);
  });
});

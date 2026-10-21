import { describe, expect, it } from 'vitest';
import { navItems } from './nav.ts';

describe('navigation', () => {
  it('the campaign app has four places, Notes only inside a campaign (docs/ui.md §2)', () => {
    expect(navItems('campaign').map((i) => i.label)).toEqual(['Home', 'Warbands', 'Campaign', 'Account']);
  });
  it('whoever is signed in has a Library before the account (ADR 0023); the Quick Build has none', () => {
    expect(navItems('campaign', false, true).map((i) => i.label)).toEqual(['Home', 'Warbands', 'Campaign', 'Library', 'Account']);
    expect(navItems('campaign', false, true).find((i) => i.label === 'Library')).toMatchObject({ to: '/library', section: 'library' });
    expect(navItems('quickbuild', false, true).map((i) => i.label)).toEqual(['Home', 'Warbands', 'Settings']);
  });
  it('the admin has a fifth place, Admin, before the account', () => {
    expect(navItems('campaign', true).map((i) => i.label)).toEqual(['Home', 'Warbands', 'Campaign', 'Admin', 'Account']);
    expect(navItems('campaign', true, true).map((i) => i.label)).toEqual(['Home', 'Warbands', 'Campaign', 'Library', 'Admin', 'Account']);
    expect(navItems('campaign', true).find((i) => i.label === 'Admin')).toMatchObject({ to: '/admin', section: 'admin' });
    expect(navItems('quickbuild', true).map((i) => i.label)).toEqual(['Home', 'Warbands', 'Settings']);
  });
  it('the Quick Build has no campaign', () => {
    expect(navItems('quickbuild').map((i) => i.label)).toEqual(['Home', 'Warbands', 'Settings']);
  });
});

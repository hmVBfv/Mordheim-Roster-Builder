/* The navigation of each flavour (docs/ui.md §2). The Quick Build has no
   campaign: only its own warbands and the settings. The last entry is the
   account in the campaign app – a person, not three dots, which read as a
   menu or settings (Rob, 19.10.2026) – and the settings in the Quick Build,
   which has no account. The address stays /more. */
import type { ReactElement } from 'react';
import { FLAVOUR, type Flavour } from '../flavour.ts';
import { BannerIcon, GearIcon, HomeIcon, MapIcon, PersonIcon, QuillIcon, ShieldIcon } from '../ui/icons.tsx';

export type Section = 'home' | 'warbands' | 'campaign' | 'notes' | 'admin' | 'account';
export interface NavItem { to: string; label: string; icon: () => ReactElement; section: Section }

/** What the last entry is called: the page's own heading says the same. */
export const accountLabel = (flavour: Flavour = FLAVOUR) => (flavour === 'campaign' ? 'Account' : 'Settings');

/** `admin`: the signed-in admin gets a place of their own before the account (Rob, 20.10.2026); nobody else. */
export function navItems(flavour: Flavour = FLAVOUR, admin = false): NavItem[] {
  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: HomeIcon, section: 'home' },
    { to: '/warbands', label: 'Warbands', icon: BannerIcon, section: 'warbands' },
  ];
  if (flavour === 'campaign') {
    items.push({ to: '/campaign', label: 'Campaign', icon: MapIcon, section: 'campaign' }, { to: '/notes', label: 'Notes', icon: QuillIcon, section: 'notes' });

    if (admin) items.push({ to: '/admin', label: 'Admin', icon: ShieldIcon, section: 'admin' });
  }
  items.push({ to: '/more', label: accountLabel(flavour), icon: flavour === 'campaign' ? PersonIcon : GearIcon, section: 'account' });
  return items;
}

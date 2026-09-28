/* The navigation of each flavour (docs/ui.md §2). The Quick Build has no
   campaign: only its own warbands and the settings. */
import type { ReactElement } from 'react';
import { FLAVOUR, type Flavour } from '../flavour.ts';
import { BannerIcon, HomeIcon, MapIcon, MoreIcon, QuillIcon } from '../ui/icons.tsx';

export interface NavItem { to: string; label: string; icon: () => ReactElement }

export function navItems(flavour: Flavour = FLAVOUR): NavItem[] {
  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/warbands', label: 'Warbands', icon: BannerIcon },
  ];
  if (flavour === 'campaign') {
    items.push({ to: '/campaign', label: 'Campaign', icon: MapIcon }, { to: '/notes', label: 'Notes', icon: QuillIcon });
  }
  items.push({ to: '/more', label: 'More', icon: MoreIcon });
  return items;
}

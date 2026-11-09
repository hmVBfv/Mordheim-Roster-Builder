/* The places under Account (the campaign app): the settings and the player's
   own reports. The tabs on top of the page on a phone, the entries under
   Account in the side navigation from 900 px (app/navChildren.ts). */
import { ACCOUNT, MY_REPORTS, WHATS_NEW } from '../app/paths.ts';

export const ACCOUNT_TABS = [
  { to: ACCOUNT, label: 'Settings', end: true },
  { to: MY_REPORTS, label: 'Your reports', end: false },
  { to: WHATS_NEW, label: "What's new", end: false },
] as const;

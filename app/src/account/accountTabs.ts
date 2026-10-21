/* The places under Account (the campaign app): the settings and the player's
   own reports. The tabs on top of the page on a phone, the entries under
   Account in the side navigation from 900 px (app/navChildren.ts). */
export const ACCOUNT_TABS = [
  { to: '/more', label: 'Settings', end: true },
  { to: '/more/reports', label: 'Your reports', end: false },
] as const;

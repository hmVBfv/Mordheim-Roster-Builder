/* The tabs of the admin's tools, in one place: the page's own tabs on a phone
   and the entries under Admin in the side navigation (app/navChildren.ts).
   Small on purpose – the navigation loads this, not the whole admin screen. */
export const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'invites', label: 'Invites' },
  { key: 'logins', label: 'Sign-ins' },
  { key: 'audit', label: 'Audit log' },
  { key: 'bugs', label: 'Reports' },
] as const;

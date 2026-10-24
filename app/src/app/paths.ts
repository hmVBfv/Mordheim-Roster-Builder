/* The addresses of the two places that had odd ones (report #70, Rob, 24.10.2026): Home is /home and the account /account (the
   Quick Build has no account, its settings are /settings). The old /, /more and /more/reports only lead on to them. */
import { FLAVOUR } from '../flavour.ts';

export const HOME = '/home';
export const ACCOUNT = FLAVOUR === 'campaign' ? '/account' : '/settings';
export const MY_REPORTS = `${ACCOUNT}/reports`;

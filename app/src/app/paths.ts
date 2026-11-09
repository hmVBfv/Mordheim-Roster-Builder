/* The addresses of the two places that had odd ones (report #70, Rob, 24.10.2026): Home is /home and the account /account (the
   Quick Build has no account, its settings are /settings). The old /, /more and /more/reports only lead on to them. */
import { FLAVOUR } from '../flavour.ts';

export const HOME = '/home';
export const ACCOUNT = FLAVOUR === 'campaign' ? '/account' : '/settings';
export const MY_REPORTS = `${ACCOUNT}/reports`;
export const WHATS_NEW = `${ACCOUNT}/whats-new`;
/** The rulebook: a tab of the Library in the campaign app (Rob, 8.11.2026), a page of its own in the Quick Build, which has no Library. */
export const RULES = FLAVOUR === 'campaign' ? '/library/rules' : '/rules';

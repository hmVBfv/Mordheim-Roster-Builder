/* The way back to the aftermath (N2): the pages a step sends you to (the roster, Hire, the Trading Post) carry `?from=<battle>`, and show
   "‹ Back to the aftermath" instead of their usual way back. The battle id is only ever used in an address of this app, and only if it
   looks like an id. */
import { useSearchParams } from 'react-router';

const ID = /^[\w-]{1,64}$/;

/** `?from=` for a link out of the aftermath of this battle. */
export const fromAftermath = (battleId: string): string => `?from=${encodeURIComponent(battleId)}`;

/** Where "Back to the aftermath" goes, or null when the page was not opened from it. */
export function useAftermathBack(warbandId: string): { to: string; label: string } | null {
  const [params] = useSearchParams();
  const from = params.get('from');
  return from && ID.test(from) ? { to: `/warbands/${warbandId}/aftermath/${from}`, label: '‹ Back to the aftermath' } : null;
}

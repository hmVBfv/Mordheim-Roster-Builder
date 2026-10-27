/* The warbands a person marked as favourites (wish #95): one Library entry of the kind `warband_favourites` (ADR 0023) holding
   their ids, so they follow the account to every device. A second device that wrote its own entry before the first arrived
   makes two; they are read together and a change keeps to the oldest. Reading works from what the device kept; writing needs the connection. */
import { newId } from '../db/ids.ts';
import { putWarbandFavourites, type LibraryWarbandFavourites } from '../library/api.ts';
import { useLibrary, warbandFavouritesOf } from '../library/useLibrary.ts';

export function useFavourites(enabled: boolean) {
  const { items, setItems, error } = useLibrary(enabled);
  const lists = warbandFavouritesOf(items);
  const ids = new Set(lists.flatMap((l) => l.body.warbands));
  const keep = (saved: LibraryWarbandFavourites) => setItems((cur) => [saved, ...(cur ?? []).filter((x) => x.id !== saved.id)]);
  const write = async (l: LibraryWarbandFavourites | null, warbands: string[]) => keep(await putWarbandFavourites(l?.id ?? newId(), 'Favourites', { warbands }, l?.seq));

  return {
    error,
    /** Nothing can be changed before the entries have arrived (a second list would be made beside the first). */
    ready: items !== null,
    has: (warbandId: string) => ids.has(warbandId),
    /** Marks the warband, or takes the mark away from it. */
    toggle: async (warbandId: string) => {
      if (ids.has(warbandId)) {
        for (const l of lists) if (l.body.warbands.includes(warbandId)) await write(l, l.body.warbands.filter((x) => x !== warbandId));
      } else {
        const first = lists[0] ?? null;
        await write(first, [...(first?.body.warbands ?? []), warbandId]);
      }
    },
  };
}

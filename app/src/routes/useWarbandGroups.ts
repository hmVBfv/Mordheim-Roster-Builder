/* The groups of one's own warbands (wish #10): Library entries of the kind `warband_group` (ADR 0023), each holding the
   ids of the warbands in it. A warband is in at most one group; moving it writes the group it leaves and the one it
   joins. Reading works from what the device kept; writing needs the connection. */
import { useCallback } from 'react';
import { newId } from '../db/ids.ts';
import { putWarbandGroup, removeItem, type LibraryWarbandGroup } from '../library/api.ts';
import { useLibrary, warbandGroupsOf } from '../library/useLibrary.ts';

export function useWarbandGroups(enabled: boolean) {
  const { items, setItems, error } = useLibrary(enabled);
  const groups = warbandGroupsOf(items);

  const keep = useCallback((saved: LibraryWarbandGroup) => setItems((cur) => [saved, ...(cur ?? []).filter((x) => x.id !== saved.id)]), [setItems]);
  const write = async (g: LibraryWarbandGroup | null, name: string, warbands: string[]) => keep(await putWarbandGroup(g?.id ?? newId(), name, { warbands }, g?.seq));

  return {
    groups, ready: items !== null, error,
    /** The group a warband is in, or '' for none. */
    groupOf: (warbandId: string) => groups.find((g) => g.body.warbands.includes(warbandId))?.id ?? '',
    create: (name: string) => write(null, name, []),
    rename: (g: LibraryWarbandGroup, name: string) => write(g, name, g.body.warbands),
    remove: async (g: LibraryWarbandGroup) => { await removeItem(g.id); setItems((cur) => (cur ?? []).filter((x) => x.id !== g.id)); },
    /** Puts a warband in the group `to` ('' for none): out of the group it was in, then into the new one. */
    assign: async (warbandId: string, to: string) => {
      for (const g of groups) {
        const has = g.body.warbands.includes(warbandId);
        if (has && g.id !== to) await write(g, g.name, g.body.warbands.filter((x) => x !== warbandId));
      }
      const target = groups.find((g) => g.id === to);
      if (target && !target.body.warbands.includes(warbandId)) await write(target, target.name, [...target.body.warbands, warbandId]);
    },
  };
}

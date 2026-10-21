/* The entries of the account's Library for a screen: what the device kept first, then the server's. Nothing is
   asked while `enabled` is false (nobody signed in). */
import { useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { cachedLibrary, getLibrary, type Faction, type LibraryGroup, type LibraryItem, type LibraryNpc } from './api.ts';

export function useLibrary(enabled = true) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void cachedLibrary().then((c) => { if (live && c) setItems((cur) => cur ?? c); });
    getLibrary().then((l) => { if (live) { setItems(l); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [enabled]);
  return { items, setItems, error };
}

/** The factions among the entries, by name. */
export const factionsOf = (items: LibraryItem[] | null): Faction[] => (items ?? []).filter((i): i is Faction => i.kind === 'faction').sort((a, b) => a.name.localeCompare(b.name));
/** The NPCs among the entries, by name. */
export const npcsOf = (items: LibraryItem[] | null): LibraryNpc[] => (items ?? []).filter((i): i is LibraryNpc => i.kind === 'npc').sort((a, b) => a.name.localeCompare(b.name));
/** The groups of opponents among the entries, by name. */
export const groupsOf = (items: LibraryItem[] | null): LibraryGroup[] => (items ?? []).filter((i): i is LibraryGroup => i.kind === 'group').sort((a, b) => a.name.localeCompare(b.name));

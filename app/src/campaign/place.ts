/* The place of a campaign (wish #66): a region or city of the lore, chosen when the campaign starts. The server keeps its key
   only; the name comes from the lore, which is fetched on first use (it is not part of the app shell). */
import { useEffect, useState } from 'react';
import { loadLore, placeOptions, type Lore } from '../library/lore.ts';

/** The lore, once it has arrived (null before, and when it cannot be had). */
export function useLore(): Lore | null {
  const [lore, setLore] = useState<Lore | null>(null);
  useEffect(() => {
    let live = true;
    void loadLore().then((l) => { if (live) setLore(l); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return lore;
}

/** The name of a place by its key, or null while the lore is not there or for a key it does not know. */
export function usePlaceName(key: string | undefined): string | null {
  const lore = useLore();
  if (!key || !lore) return null;
  return lore.entries.find((e) => e.kind === 'region' && e.id === key)?.name ?? null;
}

/** Every place for a choice, each under what contains it. */
export const placeChoices = (lore: Lore) => placeOptions(lore);

/* The warriors of a campaign's warbands, to pick from (phases 4a2, 4a3):
   who went out of action, who is named in a note. Read from the states the
   members see (the campaign's warband endpoint), kept on the device so the
   game night has them offline too, and listed by core like the Roster
   Builder's battle form. */
import type { GameData } from '@mordheim/core';
import { useCallback, useEffect, useState } from 'react';
import { readWarband } from '../campaign/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';
import { loadGameData } from '../game/gameData.ts';
import { warriorsOf, type Pick } from './sides.ts';

/** Loads a warband of the campaign as members see it; offline, as last seen here. */
export function useWarbandLoader(cid: string): (warbandId: string) => Promise<unknown> {
  return useCallback(async (wid: string) => {
    const k = ownKey('cw:', `${cid}:${wid}`);
    const who = asker();
    try {
      const r = await readWarband(cid, wid);
      const data = r.draft?.data ?? r.head.data;
      await who.keep('cw:', `${cid}:${wid}`, data);
      return data;
    } catch {
      return (await db.meta.get(k))?.value ?? null;
    }
  }, [cid]);
}

/** The warriors of these warbands, once `active` (the rules are loaded only then). */
export function usePicks(warbandIds: string[], load: (warbandId: string) => Promise<unknown>, active: boolean): { picks: Record<string, Pick[]>; error: string | null } {
  const [picks, setPicks] = useState<Record<string, Pick[]>>({});
  const [error, setError] = useState<string | null>(null);
  const ids = warbandIds.join();
  useEffect(() => {
    if (!active) return;
    let live = true;
    void (async () => {
      try {
        const [{ readSave }, data] = await Promise.all([import('../sync/engine.ts'), loadGameData()]);
        const out: Record<string, Pick[]> = {};
        for (const id of ids.split(',').filter(Boolean)) {
          const state = readSave(data as GameData, await load(id));
          out[id] = state ? warriorsOf(data, state, id) : [];
        }
        if (live) { setPicks(out); setError(null); }
      } catch {
        if (live) setError('The rosters could not be loaded: pick the warband, and type the name.');
      }
    })();
    return () => { live = false; };
  }, [ids, load, active]);
  return { picks, error };
}

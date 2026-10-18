/* A campaign's background, kept up to date (phase 4b1): as last seen on this
   device at once, then from the server every twenty seconds while the screen
   is visible, asking only whether anything is newer. */
import { useCallback, useEffect, useState } from 'react';
import { onCampaign, pollWhileVisible } from '../live/live.ts';
import { errorText } from '../account/api.ts';
import { cachedBackground, getBackground, type Entry } from './api.ts';

export const BACKGROUND_EVERY_MS = 20_000;

export function useBackground(cid: string, every = BACKGROUND_EVERY_MS) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback((): Promise<void> => getBackground(cid)
    .then((r) => { setEntries(r.entries); setError(null); })
    .catch((e: unknown) => setError(errorText(e))), [cid]);
  useEffect(() => {
    let live = true;
    void cachedBackground(cid).then((r) => { if (live && r) setEntries((cur) => cur ?? r.entries); });
    void refresh();
    const stop = pollWhileVisible(refresh, every);
    const off = onCampaign(cid, refresh);
    return () => { live = false; stop(); off(); };
  }, [cid, refresh, every]);
  return { entries, error, refresh };
}

/* A campaign's world as this device has it: last seen first, then from the server (phase 4b3b). */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, errorText } from '../account/api.ts';
import { cachedWorld, getWorld, type World } from './api.ts';

export function useWorld(cid: string) {
  const [data, setData] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    getWorld(cid).then((r) => { setData(r); setError(null); }).catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'You may not read the world of this campaign.' : errorText(e)));
  }, [cid]);
  useEffect(() => {
    let live = true;
    void cachedWorld(cid).then((c) => { if (live && c) setData((cur) => cur ?? c); });
    reload();
    return () => { live = false; };
  }, [cid, reload]);
  return { data, setData, error, reload };
}

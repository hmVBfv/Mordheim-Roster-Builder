/* A campaign's questions as this device has them: last seen first, then from the server (phase 4b3a). */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, errorText } from '../account/api.ts';
import { cachedQuestions, getQuestions, type Kept } from './api.ts';

export function useQuestions(cid: string, enabled = true) {
  const [data, setData] = useState<Kept | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!enabled) return;
    getQuestions(cid).then((r) => { setData(r); setError(null); }).catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'You may not read the questions of this campaign.' : errorText(e)));
  }, [cid, enabled]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void cachedQuestions(cid).then((c) => { if (live && c) setData((cur) => cur ?? c); });
    reload();
    return () => { live = false; };
  }, [cid, enabled, reload]);
  return { data, error, reload };
}

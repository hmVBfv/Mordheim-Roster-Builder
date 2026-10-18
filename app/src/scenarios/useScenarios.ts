/* A campaign's scenarios as this device has them: last seen first, then from the server (phase 4b3c). */
import { useCallback, useEffect, useState } from 'react';
import { useOnCampaign } from '../live/live.ts';
import { ApiError, errorText } from '../account/api.ts';
import { cachedScenarios, getScenarios, type ScenarioList } from './api.ts';

export function useScenarios(cid: string) {
  const [data, setData] = useState<ScenarioList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    getScenarios(cid).then((r) => { setData(r); setError(null); }).catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'You may not read the scenarios of this campaign.' : errorText(e)));
  }, [cid]);
  useEffect(() => {
    let live = true;
    void cachedScenarios(cid).then((c) => { if (live && c) setData((cur) => cur ?? c); });
    reload();
    return () => { live = false; };
  }, [cid, reload]);
  useOnCampaign(cid, reload);
  return { data, setData, error, reload };
}

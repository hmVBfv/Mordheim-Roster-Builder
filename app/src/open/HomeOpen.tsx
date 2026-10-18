/* "Open for you" on Home (phase 4b3a): what waits in every campaign the
   player is part of – questions, aftermaths to mark, interludes to write –
   and the copies other players sent. Last seen first (kept per account on
   the device), then from the server; without a connection the last seen
   stays, as it is. */
import { useEffect, useState } from 'react';
import { useOnAnyCampaign } from '../live/live.ts';
import { cachedCampaign, cachedCampaigns, getCampaign, listCampaigns, type CampaignView } from '../campaign/api.ts';
import { cachedQuestions, getQuestions, type Question } from '../questions/api.ts';
import { Incoming } from '../share/Incoming.tsx';
import { useWarbands } from '../sync/local.ts';
import { openItems } from './items.ts';
import { OpenList } from './OpenList.tsx';

interface Loaded { view: CampaignView; asked: Question[] }

async function load(me: string, online: boolean): Promise<Loaded[]> {
  const list = (online ? await listCampaigns(me).catch(() => null) : null) ?? (await cachedCampaigns(me)) ?? [];
  const all = await Promise.all(list.map(async (c): Promise<Loaded | null> => {
    const view = (online ? await getCampaign(c.id).catch(() => null) : null) ?? (await cachedCampaign(c.id));
    if (!view) return null;
    if (view.role === 'viewer') return { view, asked: [] };
    const asked = (online ? await getQuestions(c.id).catch(() => null) : null) ?? (await cachedQuestions(c.id));
    return { view, asked: asked?.questions ?? [] };
  }));
  return all.filter((x): x is Loaded => x !== null);
}

export function HomeOpen({ me }: { me: string }) {
  const local = useWarbands();
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  useEffect(() => {
    let live = true;
    void load(me, false).then((r) => { if (live) setLoaded(r); });
    void load(me, true).then((r) => { if (live) setLoaded(r); }, () => undefined);
    return () => { live = false; };
  }, [me]);
  // what is open for you changes when anything in any of your campaigns does
  useOnAnyCampaign(() => { void load(me, true).then(setLoaded, () => undefined); });
  const items = loaded.flatMap((l) => openItems(l.view, me, l.asked, local ?? []));
  return (
    <>
      {items.length > 0 && <OpenList items={items} withCampaign={loaded.length > 1} />}
      <Incoming nothing={items.length === 0} />
    </>
  );
}

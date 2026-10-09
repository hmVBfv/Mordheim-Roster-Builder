/* A campaign's pictures, kept up to date (phase 4a3, part 2): as last seen
   on this device at once, then from the server every ten seconds while
   the screen is visible; what this device has not sent yet laid over them,
   shown from its own bytes. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorText, type Me } from '../account/api.ts';
import { flushOutbox, usePictureOutbox, type PictureItem } from '../battle/outbox.ts';
import { db, type OutboxItem } from '../db/db.ts';
import { cachedPictures, getPictures, localAddress, type Picture, type PictureMeta, type ShownPicture } from './api.ts';

export const PICTURES_EVERY_MS = 10_000;

const localUrl = (b: PictureItem) => localAddress(b.bytes, b.meta.mime);

export function mergePictures(server: Picture[], waiting: OutboxItem[], me: Pick<Me, 'id' | 'displayName'>, urls: Map<string, string>): ShownPicture[] {
  const out = new Map<string, ShownPicture>(server.map((p) => [p.id, p]));
  for (const i of waiting) {
    if (i.op === 'attachment.delete') { if (!i.refused) out.delete(i.targetId); continue; }
    const m = (i.body as PictureItem).meta as unknown as PictureMeta;
    const cur = out.get(i.targetId);
    out.set(i.targetId, {
      ...(cur ?? { id: i.targetId, uploaderId: me.id, uploader: me.displayName, stored: false, createdAt: i.at, updatedAt: i.at }),
      ...m, pending: !i.refused, ...(i.refused ? { refused: i.refused } : {}), ...(urls.get(i.targetId) ? { localUrl: urls.get(i.targetId) } : {}),
    } as ShownPicture);
  }
  return [...out.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function usePictures(cid: string, me: Me | null, every = PICTURES_EVERY_MS) {
  const [pictures, setPictures] = useState<Picture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outbox = usePictureOutbox(cid);
  const userId = me?.id;
  const refresh = useCallback((): Promise<void> => (userId ? flushOutbox(userId) : Promise.resolve(0))
    .then(() => getPictures(cid))
    .then((p) => { setPictures(p); setError(null); })
    .catch((e: unknown) => setError(errorText(e))), [cid, userId]);
  useEffect(() => {
    let live = true;
    void cachedPictures(cid).then((p) => { if (live && p) setPictures((cur) => cur ?? p); });
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, every);
    return () => { live = false; clearInterval(t); };
  }, [cid, refresh, every]);
  // the bytes still on this device, each with an address while it waits
  const urls = useMemo(() => new Map(outbox.filter((i) => i.op === 'attachment.put').flatMap((i) => { const u = localUrl(i.body as PictureItem); return u ? [[i.targetId, u] as const] : []; })), [outbox]);
  useEffect(() => () => { for (const u of urls.values()) URL.revokeObjectURL(u); }, [urls]);
  const shown = useMemo(() => (pictures && me ? mergePictures(pictures, outbox, me, urls) : null), [pictures, outbox, me, urls]);
  return { pictures: shown, error, refresh };
}

/** Sending a picture and taking one out: the same for the Notes tab and the game night. */
export function usePictureActions(cid: string, user: Me, notify: (t: string) => void, refresh: () => Promise<void>) {
  const send = async (id: string, meta: PictureMeta, bytes: ArrayBuffer) => {
    const body: PictureItem = { meta: meta as unknown as PictureItem['meta'], bytes };
    await db.outbox.put({ key: id, op: 'attachment.put', userId: user.id, campaignId: cid, battleId: meta.battleId ?? '', targetId: id, body, at: new Date().toISOString() });
    notify('Picture saved.');
    void refresh();
  };
  const remove = async (p: ShownPicture) => {
    await db.outbox.delete(p.id);
    if (p.stored || !p.pending) await db.outbox.put({ key: `${p.id}:delete`, op: 'attachment.delete', userId: user.id, campaignId: cid, battleId: p.battleId ?? '', targetId: p.id, body: null, at: new Date().toISOString() });
    notify('Taken out.');
    void refresh();
  };
  return { send, remove };
}

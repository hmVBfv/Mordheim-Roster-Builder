/* A campaign's pictures on the server (phase 4a3, part 2; server/src/
   routes-attachments.ts). The list is kept on the device, so it shows
   offline what it showed last; a picture's bytes come straight from the
   server into an <img>, and the browser keeps them (they never change). */
import { api, apiUrl } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export type PictureVisibility = 'public' | 'leader';
export interface Picture {
  id: string; battleId: string | null; turn: number | null; uploaderId: string; uploader: string;
  mime: string; bytes: number; width: number; height: number; caption: string; visibility: PictureVisibility;
  stored: boolean; createdAt: string; updatedAt: string;
}
/** What a picture is, as the device announces it. */
export interface PictureMeta { battleId: string | null; turn: number | null; mime: string; bytes: number; width: number; height: number; caption: string; visibility: PictureVisibility }
/** A picture as shown: from the server, or still on this device (with its bytes as a local address). */
export type ShownPicture = Picture & { pending?: boolean; refused?: string; localUrl?: string };

const key = (cid: string) => ownKey('pictures:', cid);

export async function cachedPictures(cid: string): Promise<Picture[] | null> {
  return ((await db.meta.get(key(cid)))?.value as Picture[] | undefined) ?? null;
}

export async function getPictures(cid: string): Promise<Picture[]> {
  const who = asker();
  const r = await api<{ attachments: Picture[] }>(`/campaigns/${cid}/attachments`);
  await who.keep('pictures:', cid, r.attachments);
  return r.attachments;
}

export const pictureUrl = (cid: string, aid: string) => apiUrl(`/campaigns/${cid}/attachments/${aid}/file`);

/** A local address for bytes still on this device – none where the browser cannot make one. */
export function localAddress(bytes: ArrayBuffer, type: string): string | undefined {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(new Blob([bytes], { type })) : undefined;
  } catch {
    return undefined;
  }
}

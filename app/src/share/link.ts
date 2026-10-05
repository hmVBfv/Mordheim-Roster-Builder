/* "Send to campaign server" (concept.md 4.11): the Quick Build opens
   https://<server>/import#<the save, compressed> – the data stays in the
   fragment, which the browser never sends to a server, so no server and no
   CORS rule is involved; the campaign app reads it on its own page. The
   save is JSON, deflated and written in base64url. */

const toB64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
  const out = new Response(source.pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

/** The fragment for a save: "v1." and the deflated JSON. */
export async function encodeSave(save: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(save));
  return `v1.${toB64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

/** The save in a fragment, or null if it is not one. */
export async function decodeSave(fragment: string): Promise<unknown> {
  const f = fragment.replace(/^#/, '');
  if (!f.startsWith('v1.')) return null;
  try {
    const json = await pipe(fromB64url(f.slice(3)), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(json)) as unknown;
  } catch {
    return null;
  }
}

/* ---- the server's address, a setting of the Quick Build ---- */

const KEY = 'mordheim-server';

/** https://host[:port] or http for a home network address; '' for anything else. */
export function cleanServer(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) && !/^https?:\/\//i.test(t)) return '';
  try {
    const u = new URL(/^https?:\/\//.test(t) ? t : `https://${t}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.origin;
  } catch {
    return '';
  }
}

export function getServer(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function setServer(origin: string): void {
  try { if (origin) localStorage.setItem(KEY, origin); else localStorage.removeItem(KEY); } catch { /* a setting of this device only */ }
}

export const importLink = (server: string, fragment: string) => `${server}/import#${fragment}`;

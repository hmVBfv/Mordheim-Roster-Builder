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

/** A link this long, or a save inflating to more, is no warband (security review CLIENT-4: a small link can inflate to
    gigabytes and freeze the tab). Warbands are a few dozen KB. */
export const MAX_FRAGMENT = 256 * 1024;
export const MAX_INFLATED = 4 * 1024 * 1024;

/** Inflates, stopping as soon as more than `max` bytes come out. */
async function inflate(bytes: Uint8Array, max: number): Promise<Uint8Array | null> {
  const source = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** The save in a fragment, or null if it is not one. */
export async function decodeSave(fragment: string): Promise<unknown> {
  const f = fragment.replace(/^#/, '');
  if (!f.startsWith('v1.') || f.length > MAX_FRAGMENT) return null;
  try {
    const json = await inflate(fromB64url(f.slice(3)), MAX_INFLATED);
    return json ? JSON.parse(new TextDecoder().decode(json)) as unknown : null;
  } catch {
    return null;
  }
}

/* ---- the server's address, a setting of the Quick Build ---- */

const KEY = 'mordheim-server';

/** A host of the home network: a private IPv4 address (the whole host, not a name that starts like one), localhost, or a name
    under .local, .lan or .home.arpa. */
function homeHost(h: string): boolean {
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  return h === 'localhost' || /\.(local|lan|home\.arpa)$/.test(h);
}

/** https://host[:port] – or http for a home network address; '' for anything else (security review CLIENT-5: a page
    fetched over plain http from the internet can be swapped on the way, and that page reads the warband from the link). */
export function cleanServer(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) && !/^https?:\/\//i.test(t)) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol === 'http:' && !homeHost(u.hostname)) return '';
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.origin;
  } catch {
    return '';
  }
}

export function getServer(): string {
  // an address kept before the check above is checked again
  try { return cleanServer(localStorage.getItem(KEY) ?? ''); } catch { return ''; }
}

export function setServer(origin: string): void {
  try { if (origin) localStorage.setItem(KEY, origin); else localStorage.removeItem(KEY); } catch { /* a setting of this device only */ }
}

export const importLink = (server: string, fragment: string) => `${server}/import#${fragment}`;

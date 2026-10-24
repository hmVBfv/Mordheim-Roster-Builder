/* A rough place for an address, from a database on the Pi itself (wish #69, Rob, 24.10.2026: "not online, not on GitHub").
   The file is a MaxMind-format city database (for example DB-IP's free "City Lite") that Rob puts on the volume; nothing of it is
   in the repository and no address ever leaves the machine. Without the file there is no place, and everything else works. */
import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import type { CityResponse } from 'maxmind';
import type { Logger } from 'pino';

/** The place of an address: "Berlin, Berlin, Germany", or '' when it is unknown. */
export type Geo = (ip: string) => string;

/** Addresses of the machine's own network: no database could say more. */
export function isLocal(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a === 0;
  }
  if (v === 6) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd') || (l.startsWith('::ffff:') && isLocal(l.slice(7)));
  }
  return false;
}

/** The place of an address through a lookup; local addresses are named as such. */
export const placeOf = (ip: string, lookup: Geo | null): string => (isLocal(ip) ? 'local network' : lookup ? lookup(ip) : '');

/** Opens the database file; null when there is none or it cannot be read (the server logs why and goes on without places). */
export async function openGeo(file: string, log: Pick<Logger, 'info' | 'warn'>): Promise<Geo | null> {
  if (!existsSync(file)) {
    log.info({ event: 'geoip_missing' }, 'no database of places: sign-ins are listed without them');
    return null;
  }
  try {
    const { open } = await import('maxmind');
    const reader = await open<CityResponse>(file);
    log.info({ event: 'geoip_open' }, 'database of places opened');
    return (ip) => {
      try {
        const r = reader.get(ip);
        const name = (n?: { names?: { en?: string } }) => n?.names?.en ?? '';
        const parts = [name(r?.city), name(r?.subdivisions?.[0]), name(r?.country)].filter(Boolean);
        return [...new Set(parts)].join(', ');
      } catch {
        return '';
      }
    };
  } catch (err) {
    log.warn({ event: 'geoip_unreadable', err }, 'the database of places could not be read: sign-ins are listed without them');
    return null;
  }
}

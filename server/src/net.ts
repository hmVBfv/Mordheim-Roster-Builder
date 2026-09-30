/* Whose X-Forwarded-For the server believes (docs/security.md, Netz).
   Caddy runs in the host network and proxies to 127.0.0.1:3000; Docker
   forwards that port into the container, so the connection arrives from the
   Docker network's gateway, not from 127.0.0.1. Trusting only loopback would
   make every request look like it came from the gateway – and Fail2Ban would
   ban the gateway. So the default is loopback plus the container's own
   default gateway, read from the kernel's routing table. Nothing else can
   reach the published port: it is bound to 127.0.0.1 on the Pi. */
import { readFileSync } from 'node:fs';

/** The default gateway from /proc/net/route, e.g. "172.18.0.1"; null if there is none. */
export function defaultGateway(routeTable: string): string | null {
  for (const line of routeTable.split('\n').slice(1)) {
    const [, dest, gw, flags] = line.trim().split(/\s+/);
    // RTF_UP | RTF_GATEWAY
    if (dest === '00000000' && gw && /^[0-9A-F]{8}$/i.test(gw) && (parseInt(flags ?? '0', 16) & 0x3) === 0x3) {
      const n = parseInt(gw, 16);
      return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255].join('.');
    }
  }
  return null;
}

export function trustedProxies(configured: string[] | null, readRoutes: () => string = () => readFileSync('/proc/net/route', 'utf8')): string[] {
  if (configured) return configured;
  const trusted = ['127.0.0.1', '::1'];
  try {
    const gw = defaultGateway(readRoutes());
    if (gw) trusted.push(gw);
  } catch {
    // not Linux, or no /proc: loopback only
  }
  return trusted;
}

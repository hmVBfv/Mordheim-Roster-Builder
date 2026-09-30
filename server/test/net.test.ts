import { describe, expect, it } from 'vitest';
import { defaultGateway, trustedProxies } from '../src/net.ts';

// /proc/net/route of a container on a Docker bridge network 172.18.0.0/16
const ROUTES = `Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT
eth0\t00000000\t010012AC\t0003\t0\t0\t0\t00000000\t0\t0\t0
eth0\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0
`;

describe('trusted proxies', () => {
  it('the default gateway from the routing table', () => {
    expect(defaultGateway(ROUTES)).toBe('172.18.0.1');
    expect(defaultGateway('Iface\tDestination\tGateway\n')).toBeNull();
  });

  it('loopback and the gateway, unless configured', () => {
    expect(trustedProxies(null, () => ROUTES)).toEqual(['127.0.0.1', '::1', '172.18.0.1']);
    expect(trustedProxies(null, () => { throw new Error('no /proc'); })).toEqual(['127.0.0.1', '::1']);
    expect(trustedProxies(['10.0.0.1'], () => ROUTES)).toEqual(['10.0.0.1']);
  });
});

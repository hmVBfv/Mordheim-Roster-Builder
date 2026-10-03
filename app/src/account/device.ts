/* A name for this device in the list of signed-in devices: browser and
   system, from the user agent ("Firefox on Android"). Only a label; the
   server falls back to the raw user agent. */
export function deviceLabel(ua: string = navigator.userAgent): string {
  const browser = /Firefox\//.test(ua) ? 'Firefox'
    : /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
        : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
          : /Chrome\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari'
              : 'Browser';
  const system = /Android/.test(ua) ? 'Android'
    : /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) ? 'iPad'
        : /Windows/.test(ua) ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
            : /CrOS/.test(ua) ? 'ChromeOS'
              : /Linux/.test(ua) ? 'Linux'
                : '';
  return system ? `${browser} on ${system}` : browser;
}

/** Where to go after signing in: a path of this app, never another site. */
export function safeNext(next: string | null, fallback = '/more'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}

/* The version the build carries (vite.config.ts: APP_VERSION, in the CI the
   commit hash). Shown short: a full hash is 40 characters with no place to
   break and can be wider than a phone's screen. */
export function shownVersion(v: string): string {
  return /^[0-9a-f]{40}$/.test(v) ? v.slice(0, 7) : v;
}

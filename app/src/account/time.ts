/* Times in the account and the admin's logs: how long ago for the recent
   past, a date beyond a week; the logs show date and time. */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = now.getTime() - t;
  if (d < 2 * MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)} minutes ago`;
  if (d < 2 * HOUR) return 'an hour ago';
  if (d < DAY) return `${Math.floor(d / HOUR)} hours ago`;
  if (d < 2 * DAY) return 'yesterday';
  if (d < 8 * DAY) return `${Math.floor(d / DAY)} days ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** "3 Oct, 14:05" in the device's time zone. */
export function stamp(iso: string): string {
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return '';
  return `${t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

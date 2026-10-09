/* Logs: one JSON line per event on stdout (pino); Docker hands them to
   journald (`journalctl CONTAINER_NAME=roster-app`). Secrets never reach the
   log: request headers are not logged at all, and the known secret fields are
   redacted should one ever be passed along.

   Security events have a fixed shape, because Fail2Ban reads them
   (ops/fail2ban/filter.d/roster-auth.conf): `"event"` first, then `"ip"`,
   before any field a user controls. */
import pino, { type LoggerOptions } from 'pino';

export function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: ['password', 'token', 'totp', '*.password', '*.token', '*.totp', 'headers.cookie', 'headers.authorization'], censor: '[redacted]' },
  };
}

type Log = Pick<pino.BaseLogger, 'warn'>;

/** A failed login (phase 3 calls it); Fail2Ban bans an IP after 10 in an hour. */
export function loginFailed(log: Log, ip: string, account: string): void {
  log.warn({ event: 'login_failed', ip, account }, 'login failed');
}

/** A try the brake refused – not a failure Fail2Ban counts: the owner of a locked-out account must not get the own address banned. */
export function loginBraked(log: Log, ip: string, account: string): void {
  log.warn({ event: 'login_braked', ip, account }, 'login braked');
}

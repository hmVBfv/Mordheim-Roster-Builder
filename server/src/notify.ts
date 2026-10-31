/* A message on Rob's phone (ntfy.sh; Rob, 31.10.2026): a report came in. It says that there is one and of what kind, never what it says –
   a report is text from a player and may carry a warband. It never stands in the way of what caused it: the call is not waited for, a
   failure is only logged, and the address – its topic is the secret – is never written anywhere. */

export interface Notice { title: string; message: string }
export type Notify = (n: Notice) => void;

interface Warn { warn: (o: object, msg: string) => void }

const TIMEOUT_MS = 5000;

/** Sends each notice to `url` (https://ntfy.sh/<topic>) as a plain POST. `send` is fetch; tests give theirs. */
export function ntfyNotifier(url: string, log: Warn, send: typeof fetch = fetch): Notify {
  return (n) => {
    void (async () => {
      try {
        const res = await send(url, { method: 'POST', headers: { Title: n.title }, body: n.message, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) log.warn({ event: 'notify_refused', status: res.status }, 'the notice was refused');
      } catch (err) {
        // the error text may hold the address: only its kind is kept
        log.warn({ event: 'notify_failed', error: err instanceof Error ? err.name : 'error' }, 'the notice could not be sent');
      }
    })();
  };
}

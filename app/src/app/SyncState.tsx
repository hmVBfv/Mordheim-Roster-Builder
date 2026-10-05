/* Where the data stands, always visible (docs/ui.md §1.4). Without an
   account (and in the Quick Build) everything lives on this device; with one
   the sync (phase 3h) says whether the server has it all. */
import { useSyncExternalStore } from 'react';
import { useSyncStatus, type SyncStatus } from '../sync/runner.ts';
import styles from './Shell.module.css';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Symbol, short word, the longer rest (shown where there is room) and the title. */
export function syncWords(s: SyncStatus, online: boolean): { mark: string; word: string; more: string; title: string; bad: boolean } {
  switch (s.state) {
    case 'off':
      return { mark: '✓', word: 'Saved', more: ' on this device', title: 'Saved on this device', bad: !online };
    case 'syncing':
      return { mark: '↻', word: 'Syncing', more: '', title: 'Talking to the campaign server', bad: false };
    case 'idle':
      if (s.conflicts) return { mark: '!', word: 'Check', more: ` ${s.conflicts} warband${s.conflicts === 1 ? '' : 's'}`, title: 'Changed on another device as well – open the warband to decide', bad: true };
      if (s.waiting) return { mark: '•', word: `${s.waiting} waiting`, more: '', title: 'Saved on this device; not all of it is on the server yet', bad: false };
      return { mark: '✓', word: 'Saved', more: ' and synced', title: 'Saved on this device and on the campaign server', bad: false };
    case 'offline':
      return { mark: '•', word: s.waiting ? `${s.waiting} waiting` : 'Saved', more: s.waiting ? '' : ' on this device', title: 'The campaign server does not answer; changes wait on this device', bad: true };
    case 'error':
      return { mark: '!', word: 'Not synced', more: '', title: `The sync failed: ${s.message}`, bad: true };
  }
}

export function SyncState() {
  const online = useOnline();
  const w = syncWords(useSyncStatus(), online);
  const offlineTag = !online && <span className={styles.offline}> · Offline</span>;
  return (
    <p className={styles.sync} aria-live="polite" title={w.title}>
      <span aria-hidden="true">{w.mark}</span> <span className={w.bad && online ? styles.offline : undefined}>{w.word}</span>
      {w.more && <span className={styles.syncMore}>{w.more}</span>}
      {offlineTag}
    </p>
  );
}

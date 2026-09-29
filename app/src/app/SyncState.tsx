/* Where the data stands, always visible (docs/ui.md §1.4). Until the server
   exists everything lives on this device, so the only states are "saved here"
   and being offline. */
import { useSyncExternalStore } from 'react';
import styles from './Shell.module.css';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function SyncState() {
  const online = useOnline();
  return (
    <p className={styles.sync} aria-live="polite" title="Saved on this device">
      <span aria-hidden="true">✓</span> Saved<span className={styles.syncMore}> on this device</span>
      {!online && <span className={styles.offline}> · Offline</span>}
    </p>
  );
}

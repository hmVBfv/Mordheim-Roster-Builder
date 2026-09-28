/* A new version is only ever loaded when the player says so (docs/ui.md §1.8):
   never by itself, and never in the middle of a game night. */
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './Shell.module.css';

export function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  if (needRefresh) {
    return (
      <div className={styles.banner} role="status">
        <span>New version available.</span>
        <button type="button" className={styles.bannerAction} onClick={() => { void updateServiceWorker(true); }}>Reload</button>
        <button type="button" className={styles.bannerQuiet} onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className={styles.banner} role="status">
        <span>Ready to work offline.</span>
        <button type="button" className={styles.bannerQuiet} onClick={() => setOfflineReady(false)}>OK</button>
      </div>
    );
  }
  return null;
}

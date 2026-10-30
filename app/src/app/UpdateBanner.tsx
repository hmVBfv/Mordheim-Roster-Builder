/* A new version is only ever loaded when the player says so (docs/ui.md §1.8):
   never by itself, and never in the middle of a game night. */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useState } from 'react';
import { ChangelogSheet } from '../changelog/ChangelogSheet.tsx';
import { ENTRIES } from '../changelog/entries.ts';
import { notIn, readJson, type Entry } from '../changelog/parse.ts';
import { useSheet } from '../ui/useSheet.ts';
import styles from './Shell.module.css';

export function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  const { ref, open, close } = useSheet('changelog');
  // what the new version holds that this one does not (wish #154): its changelog.json is read from the network, never from the cache
  const [news, setNews] = useState<Entry[]>([]);
  useEffect(() => {
    if (!needRefresh) return;
    let live = true;
    fetch(`${import.meta.env.BASE_URL}changelog.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((raw: unknown) => { if (live) setNews(notIn(readJson(raw), ENTRIES)); })
      .catch(() => {}); // offline, or an older server: no "What's new", the notice is as it was
    return () => { live = false; };
  }, [needRefresh]);
  if (needRefresh) {
    return (
      <div className={styles.banner} role="status">
        <span>New version available.</span>
        <ChangelogSheet dialogRef={ref} close={close} title="What's new in the update" entries={news} />
        <button type="button" className={styles.bannerAction} onClick={() => { setNeedRefresh(false); void updateServiceWorker(true); }}>Reload</button>
        <button type="button" className={styles.bannerQuiet} onClick={() => setNeedRefresh(false)}>Later</button>
        {news.length > 0 && (
          <p className={styles.bannerNews}>
            <span>{news[0]!.changes[0]!.text}{news.reduce((n, e) => n + e.changes.length, 0) > 1 ? ' …' : ''}</span>
            <button type="button" className={styles.bannerAction} onClick={open}>What's new</button>
          </p>
        )}
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

/* The frame around every screen: title and sync state on top, navigation at
   the bottom on a phone and on the left from tablet width on. */
import { useEffect, type ReactNode } from 'react';
import { NavLink, useMatch } from 'react-router';
import { startSession, subscribeSession, getSession } from '../account/session.ts';
import { startSync, stopSync } from '../sync/runner.ts';
import { APP_NAME, FLAVOUR } from '../flavour.ts';
import { navItems } from './nav.ts';
import styles from './Shell.module.css';
import { SyncState } from './SyncState.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';

export function Shell({ children }: { children: ReactNode }) {
  const items = navItems();
  // the game night is full screen on a phone: its own buttons for one hand instead of the navigation
  const bare = !!useMatch('/campaign/:id/battles/:bid');
  // who is signed in: asked once, never waited for (the builder works without)
  useEffect(() => { if (FLAVOUR === 'campaign') startSession(); }, []);
  // the sync runs while someone is signed in (also offline: changes wait on the device)
  useEffect(() => {
    if (FLAVOUR !== 'campaign') return;
    const follow = () => {
      const s = getSession();
      const id = s.status === 'in' ? s.user.id : s.status === 'unreachable' ? s.user?.id : undefined;
      if (id) startSync(id);
      else if (s.status !== 'loading') stopSync();
    };
    follow();
    return subscribeSession(follow);
  }, []);
  return (
    <div className={`${styles.shell} ${bare ? styles.bare : ''}`}>
      <header className={styles.header}>
        <span className={styles.title}>{APP_NAME}</span>
        <SyncState />
      </header>
      <nav className={styles.nav} aria-label="Main">
        <ul style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.active}` : styles.navLink)}>
                <it.icon />
                <span>{it.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className={styles.main}>
        <UpdateBanner />
        {children}
      </main>
    </div>
  );
}

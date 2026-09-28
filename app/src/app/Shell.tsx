/* The frame around every screen: title and sync state on top, navigation at
   the bottom on a phone and on the left from tablet width on. */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { APP_NAME } from '../flavour.ts';
import { navItems } from './nav.ts';
import styles from './Shell.module.css';
import { SyncState } from './SyncState.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';

export function Shell({ children }: { children: ReactNode }) {
  const items = navItems();
  return (
    <div className={styles.shell}>
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

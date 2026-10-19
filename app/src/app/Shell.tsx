/* The frame around every screen: title and sync state on top, navigation at
   the bottom on a phone and on the left from tablet width on. */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useMatch } from 'react-router';
import { startSession, subscribeSession, getSession } from '../account/session.ts';
import { ReportProblem } from '../bugs/ReportProblem.tsx';
import { note, routePattern } from '../bugs/trail.ts';
import { startSync, stopSync } from '../sync/runner.ts';
import { APP_NAME, FLAVOUR } from '../flavour.ts';
import { navItems, type Section } from './nav.ts';
import { useNavChildren, useSideNav, type NavChild } from './navChildren.ts';
import { ChevronIcon } from '../ui/icons.tsx';
import styles from './Shell.module.css';
import { SyncState } from './SyncState.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';

/* Which groups of the side navigation the player opened or closed, on this device. */
const OPEN_KEY = 'mordheim-nav-open';
function readOpen(): Partial<Record<Section, boolean>> {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as Partial<Record<Section, boolean>>; } catch { return {}; }
}
function writeOpen(v: Partial<Record<Section, boolean>>) {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(v)); } catch { /* a private window: only for now */ }
}

/** The entries under a group, and under the campaign one is in its sections. */
function SubList({ items, id }: { items: NavChild[]; id: string }) {
  return (
    <ul className={styles.sub} id={id}>
      {items.map((c) => (
        <li key={c.to}>
          <NavLink to={c.to} end={c.end ?? !c.children} className={({ isActive }) => (isActive ? `${styles.subLink} ${styles.active}` : styles.subLink)}>{c.label}</NavLink>
          {c.children && (
            <ul className={styles.subSub} aria-label={`${c.label}: sections`}>
              {c.children.map((t) => (
                <li key={t.to}>
                  <NavLink to={t.to} end={t.end} className={({ isActive }) => (isActive ? `${styles.subLink} ${styles.active}` : styles.subLink)}>{t.label}</NavLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const items = navItems();
  const side = useSideNav();
  const groups = useNavChildren(side);
  const [opened, setOpened] = useState(readOpen);
  // the game night is full screen on a phone: its own buttons for one hand instead of the navigation
  const bare = !!useMatch('/campaign/:id/battles/:bid');
  // the roster uses the whole width: list and warrior side by side (docs/ui.md §3)
  const own = useMatch('/warbands/:id');
  const other = useMatch('/campaign/:id/warbands/:wid');
  const wide = !!own || !!other;
  // the screens the reporter passed, for a problem report (as patterns, never with the ids)
  const { pathname } = useLocation();
  useEffect(() => { note('screen', routePattern(pathname)); }, [pathname]);
  // a group is open where one is, unless the player closed it; the player's choice stays on the device
  const inSection = (sec: Section) => (sec === 'warbands' ? pathname.startsWith('/warbands') : sec === 'campaign' ? pathname.startsWith('/campaign') : false);
  const isOpen = (sec: Section) => opened[sec] ?? inSection(sec);
  const toggle = (sec: Section) => setOpened((cur) => { const next = { ...cur, [sec]: !isOpen(sec) }; writeOpen(next); return next; });
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
        <ReportProblem />
      </header>
      <nav className={styles.nav} aria-label="Main">
        <ul style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((it) => {
            const sub = it.section === 'warbands' ? groups.warbands : it.section === 'campaign' ? groups.campaign : [];
            const open = sub.length > 0 && isOpen(it.section);
            return (
              <li key={it.to} className={sub.length ? styles.group : undefined}>
                <div className={styles.groupHead}>
                  <NavLink to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.active}` : styles.navLink)}>
                    <it.icon />
                    <span>{it.label}</span>
                  </NavLink>
                  {sub.length > 0 && (
                    <button type="button" className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`} aria-expanded={open} aria-controls={`nav-${it.section}`}
                      aria-label={`${open ? 'Close' : 'Open'} ${it.label}`} onClick={() => toggle(it.section)}>
                      <ChevronIcon />
                    </button>
                  )}
                </div>
                {open && <SubList items={sub} id={`nav-${it.section}`} />}
              </li>
            );
          })}
        </ul>
      </nav>
      <main className={`${styles.main} ${wide ? styles.wide : ''}`}>
        <UpdateBanner />
        {children}
      </main>
    </div>
  );
}

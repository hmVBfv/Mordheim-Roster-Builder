/* The tabs under the heading of the Account screens, on a phone; from tablet width on the side navigation carries them. */
import { NavLink } from 'react-router';
import styles from './Account.module.css';
import { ACCOUNT_TABS } from './accountTabs.ts';

export function AccountTabs() {
  return (
    <nav className={`${styles.tabs} ${styles.sideTabs}`} aria-label="Account">
      {ACCOUNT_TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end}>{t.label}</NavLink>)}
    </nav>
  );
}

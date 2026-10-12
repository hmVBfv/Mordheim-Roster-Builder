/* The lines of "Open for you", each a link to where it is done. */
import { Link } from 'react-router';
import styles from './Open.module.css';
import type { OpenItem } from './items.ts';

export function OpenList({ items, withCampaign = false }: { items: OpenItem[]; withCampaign?: boolean }) {
  return (
    <ul className={styles.list} aria-label="Open for you">
      {items.map((o) => (
        <li key={o.key}>
          <Link to={o.to} className={styles.entry}>
            <span>{o.title}<small>{withCampaign ? `${o.campaign} · ${o.detail}` : o.detail}</small></span>
            <span className={styles.chip}>{o.chip}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

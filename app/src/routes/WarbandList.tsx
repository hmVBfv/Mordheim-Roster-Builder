import { Link } from 'react-router';
import type { StoredWarband } from '../db/db.ts';
import ui from '../ui/ui.module.css';

export function WarbandList({ warbands }: { warbands: StoredWarband[] }) {
  return (
    <ul className={ui.list}>
      {warbands.map((w) => (
        <li key={w.id}>
          <Link to={`/warbands/${w.id}`} className={ui.listLink}>
            <span>{w.name}</span>
            <small>{w.wbName}</small>
          </Link>
        </li>
      ))}
    </ul>
  );
}

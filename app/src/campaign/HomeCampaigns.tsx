/* "Campaigns" on Home (docs/ui.md §2): the campaigns the player is part of,
   one line each, a tap from the start – on a desktop beside the warbands, on
   a phone under them (the Campaign tab at the bottom does the same job there). */
import { Link } from 'react-router';
import { useSession } from '../account/session.ts';
import ui from '../ui/ui.module.css';
import { ROLE_NAMES, roundName } from './api.ts';
import { useCampaigns } from './useCampaigns.ts';

export function HomeCampaigns() {
  const session = useSession();
  const user = session.status === 'in' || session.status === 'unreachable' ? session.user : null;
  const list = useCampaigns(user?.id);
  if (session.status === 'loading') return null;
  const active = list?.filter((c) => !c.archived);
  return (
    <section className={ui.page} aria-labelledby="home-campaigns">
      <div>
        <h2 id="home-campaigns">Campaigns</h2>
        {!user && <p className={ui.muted}>Campaigns live on the campaign server: sign in to see yours.</p>}
        {user && active?.length === 0 && <p className={ui.muted}>None in play yet. A leader adds you to a campaign, or you start one.</p>}
        {active && active.length > 0 && (
          <ul className={`${ui.list} ${ui.listGrid}`} aria-label="Your campaigns">
            {active.map((c) => (
              <li key={c.id}>
                <Link to={`/campaign/${c.id}`} className={ui.listLink}>
                  <span>{c.name}</span>
                  <small>{ROLE_NAMES[c.role]} · {roundName(c.round)} · {c.warbands} warband{c.warbands === 1 ? '' : 's'}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={ui.row}>
        {user ? <Link to="/campaign" state={{ all: true }} className={ui.buttonQuiet}>All campaigns</Link> : <Link to="/sign-in" className={ui.buttonQuiet}>Sign in</Link>}
      </div>
    </section>
  );
}

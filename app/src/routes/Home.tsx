/* The start: what waits for the player, their warbands and – in the campaign app – their campaigns (docs/ui.md §1.5, §2). */
import { Link, useNavigate } from 'react-router';
import { FLAVOUR } from '../flavour.ts';
import { useWarbands } from '../sync/local.ts';
import { useSession } from '../account/session.ts';
import { useSideNav } from '../app/navChildren.ts';
import { HomeCampaigns } from '../campaign/HomeCampaigns.tsx';
import { HomeOpen } from '../open/HomeOpen.tsx';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { ImportSheet } from './ImportSheet.tsx';
import styles from './Home.module.css';
import { WarbandList } from './WarbandList.tsx';

/** How many warbands Home shows: a phone three, a desktop has room for more. */
const ON_PHONE = 3;
const ON_DESKTOP = 6;

export function Home() {
  const wide = useSideNav();
  const recent = useWarbands(wide ? ON_DESKTOP : ON_PHONE);
  const session = useSession();
  const navigate = useNavigate();
  const campaigns = FLAVOUR === 'campaign';
  return (
    <section className={`${ui.page} ${styles.home} ${campaigns ? '' : styles.solo}`}>
      <div className={ui.page}>
        {campaigns && (
          <div className={ui.card}>
            <h2>Open for you</h2>
            {session.status === 'in' ? <HomeOpen me={session.user.id} /> : <p className={ui.muted}>Nothing waiting. Questions, sealed notes and battles to write up will appear here once you are part of a campaign.</p>}
          </div>
        )}
        <div>
          <h2>Your warbands</h2>
          {recent && recent.length > 0 ? <WarbandList warbands={recent} grid /> : recent && <Empty scene="camp" title="No warband yet.">Start one below, or bring one in from the Roster Builder.</Empty>}
        </div>
        <div className={ui.row}>
          <Link to="/warbands/new" className={ui.button}>New warband</Link>
          <ImportSheet quiet onImported={(id) => { void navigate(`/warbands/${id}`); }} />
          {recent && recent.length > 0 && <Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link>}
        </div>
      </div>
      {campaigns && <HomeCampaigns />}
    </section>
  );
}

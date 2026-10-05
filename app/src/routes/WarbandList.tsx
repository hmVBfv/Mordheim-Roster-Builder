import { Link } from 'react-router';
import { useCampaignName } from '../campaign/name.ts';
import type { StoredWarband } from '../db/db.ts';
import ui from '../ui/ui.module.css';

/** Which campaign a warband is entered in – the copy, beside the free one it came from. */
function CampaignMark({ id }: { id: string }) {
  const name = useCampaignName(id);
  return <> · in {name ?? 'a campaign'}</>;
}

/** With `marks` (someone signed in): which are only on this device, and which wait for a decision. */
export function WarbandList({ warbands, marks = false }: { warbands: StoredWarband[]; marks?: boolean }) {
  return (
    <ul className={ui.list}>
      {warbands.map((w) => (
        <li key={w.id}>
          <Link to={`/warbands/${w.id}`} className={ui.listLink}>
            <span>{w.name}</span>
            <small>
              {w.wbName}
              {marks && !w.ownerId && ' · only on this device'}
              {w.campaignId && <CampaignMark id={w.campaignId} />}
              {w.conflict && <strong className={ui.error}> · changed elsewhere too – check</strong>}
            </small>
          </Link>
        </li>
      ))}
    </ul>
  );
}

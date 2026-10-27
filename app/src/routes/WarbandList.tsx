import { Link } from 'react-router';
import { stamp } from '../account/time.ts';
import { useCampaignName } from '../campaign/name.ts';
import type { StoredWarband } from '../db/db.ts';
import { CometIcon } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';

/** Which campaign a warband is entered in – the copy, beside the free one it came from. */
function CampaignMark({ id }: { id: string }) {
  const name = useCampaignName(id);
  return <> · in {name ?? 'a campaign'}</>;
}

/** With `marks` (someone signed in): which are only on this device, and which wait for a decision. With `grid`, a desktop lays them side by side. */
export interface GroupChoice { options: { id: string; name: string }[]; of: (warbandId: string) => string; assign: (warbandId: string, groupId: string) => void; disabled: boolean }

/** With `favourites` (someone signed in): which warbands are favourites, marked by a ribbon, and with `toggle` a button to change that. */
export interface FavouriteChoice { has: (warbandId: string) => boolean; toggle?: (warbandId: string) => void; disabled?: boolean }

/** With `groups` (someone signed in): a choice under each warband to put it in one of their groups. */
export function WarbandList({ warbands, marks = false, grid = false, groups, favourites }: { warbands: StoredWarband[]; marks?: boolean; grid?: boolean; groups?: GroupChoice; favourites?: FavouriteChoice }) {
  return (
    <ul className={`${ui.list} ${grid ? ui.listGrid : ''}`}>
      {warbands.map((w) => {
        const fav = !!favourites?.has(w.id);
        return (
        <li key={w.id}>
          <Link to={`/warbands/${w.id}`} className={ui.listLink}>
            {fav && <span className={`${ui.ribbon} ${ui.ribbonFavourite}`} aria-hidden="true"><CometIcon /></span>}
            {w.state.planner && <span className={`${ui.ribbon} ${fav ? ui.ribbonFurther : ''}`} aria-hidden="true">P</span>}
            <span>{w.name}</span>
            <small>
              {w.wbName}{w.state.planner && ' · Planner'}{fav && ' · Favourite'}
              {marks && !w.ownerId && ' · only on this device'}
              {w.campaignId && <CampaignMark id={w.campaignId} />}
              {w.conflict && <strong className={ui.error}> · changed elsewhere too – check</strong>}
            </small>
            {/* when it was made and last changed: two warbands of one name differ by it */}
            <small><time dateTime={w.createdAt}>Created {stamp(w.createdAt)}</time></small>
            <small>{w.updatedAt !== w.createdAt ? <time dateTime={w.updatedAt}>Updated {stamp(w.updatedAt)}</time> : <>Updated never</>}</small>
          </Link>
          {favourites?.toggle && (
            <button type="button" className={ui.buttonQuiet} aria-pressed={fav} disabled={favourites.disabled}
              aria-label={fav ? `Take ${w.name} out of the favourites` : `Favourite ${w.name}`} onClick={() => favourites.toggle?.(w.id)}>
              {fav ? 'Favourite ✓' : 'Favourite'}
            </button>
          )}
          {groups && (
            <select className={ui.select} aria-label={`Group of ${w.name}`} value={groups.of(w.id)} disabled={groups.disabled} onChange={(e) => groups.assign(w.id, e.target.value)}>
              <option value="">No group</option>
              {groups.options.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </li>
        );
      })}
    </ul>
  );
}

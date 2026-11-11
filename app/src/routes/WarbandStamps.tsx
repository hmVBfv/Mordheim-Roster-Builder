/* When a warband was made and last changed, and whether it is a copy: what tells two warbands of one name apart – in the list of warbands and in the sheet
   that enters one in a campaign (report of 11.11.2026). */
import { stamp } from '../account/time.ts';

export function WarbandStamps({ w, copy = false }: { w: { createdAt: string; updatedAt: string; origin?: string }; copy?: boolean }) {
  return (
    <>
      {copy && w.origin === 'copy' && <small>A copy</small>}
      <small><time dateTime={w.createdAt}>Created {stamp(w.createdAt)}</time></small>
      <small>{w.updatedAt !== w.createdAt ? <time dateTime={w.updatedAt}>Updated {stamp(w.updatedAt)}</time> : <>Updated never</>}</small>
    </>
  );
}

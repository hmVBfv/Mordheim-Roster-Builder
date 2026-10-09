/* On the roster of a warband entered in a campaign (phase 4a1): where it is
   entered, and leaving – the warband is then free again; what the campaign
   marked of it stays in the campaign's history. Its own house rules where
   they differ from the campaign's (4a4), to take them over. */
import { useState } from 'react';
import { Link } from 'react-router';
import { errorText } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { requestSync } from '../sync/runner.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { getCampaign, withdrawEnrolment, type CampaignView } from './api.ts';
import { useCampaignName } from './name.ts';
import { differingRules } from '../roster/house.ts';
import { useCampaignRules } from './rules.ts';

export function InCampaign({ rec, onNotice }: { rec: StoredWarband; onNotice: (t: string) => void }) {
  const id = rec.campaignId!;
  const name = useCampaignName(id);
  const camp = useCampaignRules(id);
  const differs = camp ? differingRules(camp.rules, rec.state.house) : [];
  const { ref, open, close } = useSheet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      const view = (await db.meta.get(`campaign:${id}`))?.value as CampaignView | undefined;
      const e = (view?.enrolments.find((x) => x.warbandId === rec.id) ? view : await getCampaign(id)).enrolments.find((x) => x.warbandId === rec.id);
      if (e) await withdrawEnrolment(id, e.id);
      // the sheet closes first: free again, the roster shows no sheet of this kind
      close(() => {
        void db.warbands.update(rec.id, { campaignId: null }).then(() => { requestSync(); onNotice('The warband has left the campaign.'); });
      });
    } catch (x) { setError(errorText(x)); } finally { setBusy(false); }
  };
  return (
    <>
      <Link to={`/campaign/${id}`} className={ui.buttonQuiet}>In {name ?? 'a campaign'}</Link>
      {differs.length > 0 && <Link to={`/warbands/${rec.id}/house`} className={ui.buttonQuiet}>⚠ House rules differ from the campaign’s</Link>}
      <button type="button" className={ui.buttonQuiet} onClick={() => { setError(null); open(); }}>Leave the campaign…</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="leave-title">
        <div className={ui.page}>
          <h2 id="leave-title">Leave {name ?? 'the campaign'}?</h2>
          <p className={ui.muted}>{rec.name} takes no further part. It stays yours, free again; what the campaign marked of it stays in its history. To take part again it is entered anew.</p>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy} onClick={() => void leave()}>Leave the campaign</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Stay</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/* The opening scene of a campaign (wish #169), at the top of the World: where and how the story starts. What the leaders wrote, or – while
   nothing is written – the Lore's description of the campaign's place, marked as the Lore's. Everybody reads it; leaders write their own,
   starting from the Lore's text, or go back to it. */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import { setOpening, type CampaignView } from '../campaign/api.ts';
import { useLore } from '../campaign/place.ts';
import { Actions, FormSheet, useSaving } from '../ui/FormSheet.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import styles from './World.module.css';

const LIMIT = 4000;

function Form({ id, start, close, titleId, onSaved }: { id: string; start: string; close: () => void; titleId: string; onSaved: (v: CampaignView) => void }) {
  const [text, setText] = useState(start);
  const { busy, error, submit } = useSaving(() => setOpening(id, text).then(onSaved), close, errorText);
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>Opening scene</h2>
      <p className={ui.muted}>Where and how the story starts. Everybody in the campaign reads it. Leave it empty to show the Lore’s description of the place.</p>
      <div className={ui.field}>
        <label htmlFor={`${titleId}-t`}>The opening scene</label>
        <textarea id={`${titleId}-t`} className={`${ui.textarea} ${ui.writing}`} rows={10} value={text} maxLength={LIMIT} onChange={(e) => setText(e.target.value)} />
      </div>
      <Actions busy={busy} ok label="Save" close={close} error={error} />
    </form>
  );
}

export function OpeningScene({ id, view, lead, onView }: { id: string; view: CampaignView; lead: boolean; onView: (v: CampaignView) => void }) {
  const lore = useLore();
  const sheet = useSheet();
  const [key, setKey] = useState(0);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const place = view.campaign.place ? lore?.entries.find((e) => e.kind === 'region' && e.id === view.campaign.place) : undefined;
  const own = (view.campaign.opening ?? '').trim();
  const shown = own || place?.text || '';
  const back = () => { setError(null); setOpening(id, '').then(onView).catch((e: unknown) => setError(errorText(e))); };
  return (
    <section className={styles.section} aria-labelledby="w-opening">
      <h2 id="w-opening">Opening scene</h2>
      {shown
        ? (
          <>
            <p className={styles.opening}>{shown}</p>
            <p className={ui.muted}>{own ? 'Written by the leaders' : `From the Lore · ${place?.name ?? ''}`}</p>
          </>
        )
        : <p className={ui.muted}>No opening scene yet.</p>}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {lead && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => { setKey((k) => k + 1); setWriting(true); sheet.open(); }}>Write your own</button>
          {own && place && <button type="button" className={ui.buttonQuiet} onClick={back}>Use the Lore text</button>}
        </div>
      )}
      <FormSheet dialogRef={sheet.ref} wide>
        {(titleId) => writing && <Form key={key} id={id} start={shown} close={() => sheet.close(() => setWriting(false))} titleId={titleId} onSaved={onView} />}
      </FormSheet>
    </section>
  );
}

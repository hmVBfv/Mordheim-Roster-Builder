/* The canon export (phase 4b4b, ADR 0018): a leaders' section of Manage. The
   names the campaign uses in German and English – warbands, warriors, titles,
   factions, people – as a text file for the chronicle's linter, which the
   leader hands on by hand. The app writes nothing into the chronicle's
   repository. Names only: no background, no notes, no profile text.

   It needs every warband and the world read; a list with a warband missing
   would be wrong without saying so, so nothing is saved unless all of it
   could be read. */
import { canonText, type CanonInput, type CanonWarband } from '@mordheim/core';
import { useId, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { readWarband, type CampaignView } from '../campaign/api.ts';
import campaign from '../campaign/Campaign.module.css';
import { fileSlug, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { getWorld } from '../world/api.ts';

/** The warbands of the campaign and its world, read now. A warband that cannot be read stops it: its names would be missing without a word. */
/** A warband that could not be read, with the reason in the app's words. */
export class Unreadable extends Error {
  constructor(readonly warband: string, readonly reason: string) { super(`${warband}: ${reason}`); }
}

export async function gatherCanon(cid: string, view: CampaignView): Promise<CanonInput> {
  const active = view.enrolments.filter((e) => e.status === 'active');
  const [world, reads] = await Promise.all([
    getWorld(cid),
    Promise.all(active.map((e) => readWarband(cid, e.warbandId).catch((err: unknown) => { throw new Unreadable(e.name || e.wbName, errorText(err)); }))),
  ]);
  const warbands = reads.map((r, i): CanonWarband => ({ ...(r.head.data as Omit<CanonWarband, 'name'>), name: active[i]!.name || active[i]!.wbName }));
  return {
    campaign: view.campaign.name,
    warbands,
    factions: world.factions.map((f) => ({ nameDe: f.nameDe, nameEn: f.nameEn })),
    people: world.npcs.map((n) => ({ nameDe: n.nameDe, nameEn: n.nameEn, faction: world.factions.find((f) => f.id === n.factionId)?.nameEn || world.factions.find((f) => f.id === n.factionId)?.nameDe || '' })),
  };
}

export function CanonSection({ id, view }: { id: string; view: CampaignView }) {
  const ids = useId();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { text, stats } = canonText(await gatherCanon(id, view), new Date().toISOString().slice(0, 10));
      saveFile(`${fileSlug(view.campaign.name)}-canon.txt`, text, 'text/plain');
      setMessage({
        text: `Saved ${stats.names} name${stats.names === 1 ? '' : 's'}: ${stats.onlyDe} differ between German and English, ${stats.same} are the same in both.${stats.incomplete ? ` ${stats.incomplete} not finished yet – they are listed in the file.` : ''}`,
        error: false,
      });
    } catch (e) {
      setMessage({ text: `Nothing was saved. ${e instanceof Unreadable ? `${e.warband} could not be read: ${e.reason}` : errorText(e)}`, error: true });
    } finally { setBusy(false); }
  };

  return (
    <section className={campaign.section} aria-labelledby={`${ids}-h`}>
      <h2 id={`${ids}-h`}>Canon for the linter</h2>
      <p className={ui.muted}>
        The names the campaign uses in German and English – warbands, warriors, titles, factions, people – as a text file for the chronicle’s linter,
        so it knows which name may stand in only one language. Names only: no background, no notes. You hand it on yourself; nothing is sent anywhere.
      </p>
      {message && <p className={`${ui.message} ${message.error ? ui.error : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      {!online && <p className={ui.message} role="status">Reading every warband needs the connection.</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void download()}>Download the canon (.txt)</button>
      </div>
    </section>
  );
}

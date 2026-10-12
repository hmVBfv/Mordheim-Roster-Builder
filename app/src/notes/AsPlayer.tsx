/* "View as player" (phase 4b1; docs/mockups/visibility.html): a leader sees
   the campaign's notes and pictures as a player would get them – nothing
   leaders-only, no words of a sealed note, not even the leader's own. The
   server narrows the answer (`?as=player`); this device neither keeps it
   nor mixes it with what it holds for the leader. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../account/api.ts';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { PictureCard } from '../pictures/PictureParts.tsx';
import type { Picture } from '../pictures/api.ts';
import ui from '../ui/ui.module.css';
import { type Note } from './api.ts';
import { NoteCard } from './NoteParts.tsx';
import styles from './Notes.module.css';

export function AsPlayerTab({ id, view }: { id: string; view: CampaignView }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [pictures, setPictures] = useState<Picture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([api<{ notes: Note[] }>(`/campaigns/${id}/notes?as=player`), api<{ attachments: Picture[] }>(`/campaigns/${id}/attachments?as=player`)])
      .then(([n, p]) => { if (live) { setNotes(n.notes); setPictures(p.attachments); } })
      .catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);
  const battleName = (bid: string | null) => {
    const b = (view.battles ?? []).find((x) => x.id === bid);
    return b ? `battle ${b.round}` : 'the battle';
  };
  const items = [
    ...(notes ?? []).map((n) => ({ at: n.createdAt, battleId: n.battleId, note: n, picture: null as Picture | null })),
    ...(pictures ?? []).map((p) => ({ at: p.createdAt, battleId: p.battleId, note: null as Note | null, picture: p })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const groups = [...(view.battles ?? [])].reverse().map((b) => ({ key: b.id, title: battleTitle(b), items: items.filter((x) => x.battleId === b.id) }));
  groups.push({ key: 'campaign', title: 'The campaign in general', items: items.filter((x) => !x.battleId || !(view.battles ?? []).some((b) => b.id === x.battleId)) });
  return (
    <div className={ui.page}>
      <p className={`${ui.card} ${styles.leader}`} role="status">👁 This is what a player gets from the server – nothing leaders-only, no words of a sealed note, not even your own. Read only.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!notes && !error && <p className={ui.muted}>Loading…</p>}
      {notes && items.length === 0 && <p className={ui.muted}>A player would see no notes and no pictures yet.</p>}
      {groups.filter((g) => g.items.length > 0).map((g) => (
        <section key={g.key} className={styles.section} aria-label={g.title}>
          <h2>{g.title}</h2>
          <ul className={styles.list}>
            {g.items.map(({ note: n, picture: p }) => p
              ? <PictureCard key={p.id} p={p} cid={id} canRemove={false} onRemove={() => undefined} />
              : <NoteCard key={n!.id} n={n!} battleName={battleName} canEdit={false} canRemove={false} onEdit={() => undefined} onRemove={() => undefined} />)}
          </ul>
        </section>
      ))}
      <div className={ui.row}><Link to={`/campaign/${id}/notes`} className={ui.buttonQuiet}>Back to the notes</Link></div>
    </div>
  );
}

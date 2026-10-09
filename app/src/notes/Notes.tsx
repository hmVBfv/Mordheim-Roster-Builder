/* The campaign's Notes tab (phase 4a3; docs/mockups/visibility.html):
   everyone writes at the same time, each note with one author (ADR 0010);
   who may read it is chosen when writing – everyone, sealed until a battle
   is closed, or leaders only – and kept on the server (ADR 0011). Grouped
   by battle, newest first; written offline, a note waits on the device.
   Pictures (4a3, part 2) stand among the notes: a screenshot from TTS or a
   photo of the table, for everyone or leaders only. */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import type { Me } from '../account/api.ts';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { battleTitle } from '../battle/api.ts';
import { enqueue } from '../battle/outbox.ts';
import { usePicks, useWarbandLoader } from '../battle/picks.ts';
import { cachedCampaigns, listCampaigns, type CampaignSummary, type CampaignView } from '../campaign/api.ts';
import { db } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { isSealed, type FullNote, type Note, type NoteBody } from './api.ts';
import { NoteCard, NoteSheet, type BattleChoice } from './NoteParts.tsx';
import styles from './Notes.module.css';
import { useNotes } from './useNotes.ts';
import { PictureCard, PictureSheet } from '../pictures/PictureParts.tsx';
import { usePictureActions, usePictures } from '../pictures/usePictures.ts';
import type { ShownPicture } from '../pictures/api.ts';

/** Writing, editing, taking out: the same for the Notes tab and the game night. */
export function useNoteActions(cid: string, user: Me, notify: (t: string) => void, refresh: () => Promise<void>) {
  const save = async (id: string, body: NoteBody, text: string) => {
    await enqueue({ key: id, op: 'note.put', userId: user.id, campaignId: cid, battleId: body.battleId ?? '', targetId: id, body });
    notify(text);
    void refresh();
  };
  const remove = async (n: Note) => {
    await db.outbox.delete(n.id);
    await enqueue({ key: `${n.id}:delete`, op: 'note.delete', userId: user.id, campaignId: cid, battleId: n.battleId ?? '', targetId: n.id, body: null });
    notify('Taken out.');
    void refresh();
  };
  return { save, remove };
}

/** May this user change the note (its author), or correct its words (a leader)? */
export function noteRights(n: Note, user: Me, lead: boolean, writer: boolean): { edit: boolean; words: boolean; remove: boolean } {
  if (isSealed(n) || !writer) return { edit: false, words: false, remove: false };
  const own = n.authorId === user.id;
  return { edit: own || lead, words: !own && lead, remove: own || lead };
}

export function NotesTab({ id, view, user, lead }: { id: string; view: CampaignView; user: Me; lead: boolean }) {
  const { notes, error, refresh } = useNotes(id, user);
  const [notice, notify] = useNotice();
  const sheet = useSheet();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<FullNote | null>(null);
  const [wantPicks, setWantPicks] = useState(false);
  const writer = view.role !== 'viewer';
  const warbands = useMemo(() => view.enrolments.filter((e) => e.status === 'active').map((e) => ({ warbandId: e.warbandId, name: e.name || e.wbName })), [view.enrolments]);
  const ids = useMemo(() => warbands.map((w) => w.warbandId), [warbands]);
  const loader = useWarbandLoader(id);
  const { picks } = usePicks(ids, loader, wantPicks);
  const battles: BattleChoice[] = useMemo(() => [...(view.battles ?? [])].reverse().map((b) => ({ id: b.id, label: battleTitle(b), open: b.status === 'open' })), [view.battles]);
  const battleName = (bid: string | null) => {
    const b = (view.battles ?? []).find((x) => x.id === bid);
    return b ? `battle ${b.round}` : 'the battle';
  };
  const { save, remove } = useNoteActions(id, user, notify, refresh);
  const open = (n: FullNote | null) => { setEditing(n); setFormKey((k) => k + 1); setWantPicks(true); sheet.open(); };
  const pics = usePictures(id, user);
  const pictures = usePictureActions(id, user, notify, pics.refresh);
  const pictureSheet = useSheet();

  // grouped by battle, newest battle first; then the campaign in general – notes and pictures together, newest first
  const groups = useMemo(() => {
    type Item = { at: string; note: NonNullable<typeof notes>[number] | null; picture: ShownPicture | null };
    const items: (Item & { battleId: string | null })[] = [
      ...(notes ?? []).map((n) => ({ at: n.createdAt, battleId: n.battleId, note: n, picture: null })),
      ...(pics.pictures ?? []).map((p) => ({ at: p.createdAt, battleId: p.battleId, note: null, picture: p })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const out: { key: string; title: string; items: Item[] }[] = battles.map((b) => ({ key: b.id, title: b.label, items: items.filter((x) => x.battleId === b.id) }));
    out.push({ key: 'campaign', title: 'The campaign in general', items: items.filter((x) => !x.battleId || !battles.some((b) => b.id === x.battleId)) });
    return out.filter((g) => g.items.length > 0);
  }, [notes, pics.pictures, battles]);

  return (
    <div className={ui.page}>
      {writer && (
        <div className={ui.row}>
          <button type="button" className={ui.button} onClick={() => open(null)}>New note</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => { setFormKey((k) => k + 1); pictureSheet.open(); }}>New picture</button>
        </div>
      )}
      {error && <p className={ui.message} role="status">{error}{notes ? ' Shown as last seen.' : ''}</p>}
      {notes && notes.length === 0 && (pics.pictures ?? []).length === 0 && <p className={ui.muted}>No notes yet. Scenes, quotes, dice moments, open threads, pictures of the table – whatever the story should keep.</p>}
      {groups.map((g) => (
        <section key={g.key} className={styles.section} aria-label={g.title}>
          <h2>{g.title}</h2>
          <ul className={styles.list}>
            {g.items.map(({ note: n, picture: p }) => {
              if (p) return <PictureCard key={p.id} p={p} cid={id} canRemove={writer && (p.uploaderId === user.id || lead)} onRemove={() => void pictures.remove(p)} />;
              const r = noteRights(n!, user, lead, writer);
              return (
                <NoteCard key={n!.id} n={n!} battleName={battleName} pending={'pending' in n! ? n.pending : false} refused={'refused' in n! ? n.refused : undefined}
                  canEdit={r.edit} canRemove={r.remove} onEdit={() => open(n as FullNote)} onRemove={() => void remove(n!)} />
              );
            })}
          </ul>
        </section>
      ))}
      <p className={ui.muted}>What is hidden is filtered on the server: a player’s phone never receives a leaders’ note or the words of a sealed one. Mechanics – rosters, rolls, gold – are never hidden.</p>
      <NoteSheet dialogRef={sheet.ref} close={sheet.close} formKey={formKey} battles={battles} kind={editing?.kind ?? 'general'} canLead={lead}
        warbands={warbands} picks={picks} note={editing} wordsOnly={!!editing && editing.authorId !== user.id}
        onSave={(body) => {
          const nid = editing?.id ?? newId();
          void save(nid, editing && editing.authorId !== user.id ? { ...body, kind: editing.kind, visibility: editing.visibility, mentions: editing.mentions, battleId: editing.battleId, turn: editing.turn } : body, editing ? 'Saved.' : 'Note saved.')
            .catch((e: unknown) => notify(errorText(e)));
        }} />
      <PictureSheet dialogRef={pictureSheet.ref} close={pictureSheet.close} formKey={formKey} battles={battles} canLead={lead}
        onSave={(meta, bytes) => { void pictures.send(newId(), meta, bytes).catch((e: unknown) => notify(errorText(e))); }} />
      {notice}
    </div>
  );
}

/** The Notes button below: the campaign's notes – with several campaigns, which one first. */
export function NotesHome() {
  const session = useSession();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void cachedCampaigns(userId).then((c) => { if (live && c) setList((l) => l ?? c); });
    listCampaigns(userId).then((c) => { if (live) setList(c); }).catch(() => undefined);
    return () => { live = false; };
  }, [userId]);
  if (session.status === 'loading') return null;
  if (!user) {
    return (
      <section className={ui.page}>
        <h1>Notes</h1>
        <p className={ui.muted}>Notes belong to a campaign on the campaign server: sign in to write yours.</p>
        <p><Link to="/sign-in" className={ui.button}>Sign in</Link></p>
      </section>
    );
  }
  if (list && list.length === 1) return <Navigate to={`/campaign/${list[0]!.id}/notes`} replace />;
  return (
    <section className={ui.page}>
      <h1>Notes</h1>
      {list && list.length === 0 && <p className={ui.muted}>Notes belong to a campaign. Once you are part of one, they are here.</p>}
      {list && list.length > 1 && (
        <ul className={styles.list} aria-label="Campaigns">
          {list.map((c) => <li key={c.id}><Link to={`/campaign/${c.id}/notes`} className={ui.buttonQuiet}>{c.name}</Link></li>)}
        </ul>
      )}
    </section>
  );
}

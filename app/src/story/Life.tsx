/* A warrior's life (phase 4b2; concept.md 4.6): his profile, then what
   happened to him and what was written about it, in order – derived by
   core from the changes the marks froze, the protocol, and the notes that
   mention him. The marks and the notes live on the campaign server; a
   warband outside a campaign, or a device that cannot reach it, still gets
   the life the save itself tells. */
import * as core from '@mordheim/core';
import type { GameData, LifeEntry, LifeMark, LifeNote, WarbandState } from '@mordheim/core';
import { useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { cachedCampaign, readWarband } from '../campaign/api.ts';
import type { StoredWarband } from '../db/db.ts';
import { cachedNotes, getNotes, isSealed, type Note } from '../notes/api.ts';
import ui from '../ui/ui.module.css';
import type { Person } from './people.ts';
import { PROFILE_FIELDS } from './people.ts';
import styles from './Story.module.css';

interface Sources { marks: LifeMark[]; notes: LifeNote[]; partial: string | null; loading: boolean }

/** What the server knows of this warband: its marks (with the changes they froze) and the notes that mention a warrior. */
export function useLifeSources(rec: StoredWarband, uid: number | string | null): Sources {
  const cid = rec.campaignId ?? null;
  const [got, setGot] = useState<{ uid: number | string; marks: LifeMark[]; notes: LifeNote[]; partial: string | null } | null>(null);
  useEffect(() => {
    if (uid == null || !cid) return;
    let live = true;
    void (async () => {
      const rounds = new Map<string, number>(((await cachedCampaign(cid))?.battles ?? []).map((b) => [b.id, b.round]));
      const mine = (notes: Note[]): LifeNote[] => notes.flatMap((n) => {
        if (isSealed(n) || !n.mentions.some((m) => m.warbandId === rec.id && String(m.uid) === String(uid))) return [];
        return [{ id: n.id, round: n.battleId ? rounds.get(n.battleId) ?? null : null, text: n.text, kind: n.kind, author: n.author, at: n.createdAt }];
      });
      const cached = await cachedNotes(cid);
      if (live && cached) setGot((g) => ({ uid, marks: g?.uid === uid ? g.marks : [], notes: mine(cached.notes), partial: g?.partial ?? null }));
      let partial: string | null = null;
      let marks: LifeMark[] = [];
      let notes = cached ? mine(cached.notes) : [];
      try {
        const w = await readWarband(cid, rec.id);
        // the newest mark of each battle: a correction replaces the mark before it
        const byRound = new Map<number, (typeof w.tags)[number]>();
        for (const t of w.tags) if (t.kind === 'after_battle' && (!byRound.get(t.round) || byRound.get(t.round)!.createdAt <= t.createdAt)) byRound.set(t.round, t);
        marks = [...byRound.values()].sort((a, b) => a.round - b.round).map((t) => ({ round: t.round, changes: (t.changes ?? []) as LifeMark['changes'] }));
      } catch (e) { partial = `The marked changes are missing: ${errorText(e)}`; }
      try { notes = mine((await getNotes(cid)).notes); } catch (e) { partial ??= `Notes that mention him are as last seen: ${errorText(e)}`; }
      if (live) setGot({ uid, marks, notes, partial });
    })();
    return () => { live = false; };
  }, [cid, rec.id, uid]);
  if (uid == null || !cid) return { marks: [], notes: [], partial: null, loading: false };
  if (!got || got.uid !== uid) return { marks: [], notes: [], partial: null, loading: true };
  return { marks: got.marks, notes: got.notes, partial: got.partial, loading: false };
}

function Entry({ e }: { e: LifeEntry }) {
  return (
    <li>
      <small>{core.lifeLabel(e.round)}{e.kind === 'note' && e.by ? ` · note by ${e.by}` : ''}</small>
      <span>{e.kind === 'note' ? `“${e.text}”` : e.text}</span>
      {e.why && <p className={styles.why}>{e.why}</p>}
      {e.unexplained && <small className={styles.flag}>⚠ no cause found, and not explained yet</small>}
    </li>
  );
}

/** The inside of the sheet. */
export function Life({ data, rec, state, who, onProfile, close }: {
  data: GameData; rec: StoredWarband; state: WarbandState; who: Person; onProfile: (() => void) | null; close: () => void;
}) {
  const src = useLifeSources(rec, who.uid);
  const life = useMemo(() => core.lifeOf(data, state, { uid: who.uid, marks: src.marks, notes: src.notes }), [data, state, who.uid, src.marks, src.notes]);
  const filled = PROFILE_FIELDS.filter((f) => who.profile[f.key as keyof typeof who.profile]);
  return (
    <div className={ui.page}>
      <h2 id="life-title">{who.name}</h2>
      <p className={ui.muted}>{who.sub}</p>
      {filled.length > 0 && (
        <dl className={styles.profile} aria-label="Profile">
          {filled.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{who.profile[f.key as keyof typeof who.profile]}</dd></div>)}
        </dl>
      )}
      {src.loading && <p className={ui.muted}>Looking up what the campaign knows…</p>}
      {src.partial && <p className={ui.message} role="status">{src.partial}</p>}
      {life.length === 0 && !src.loading && <p className={ui.muted}>Nothing recorded yet. Battles, wounds, advances and the notes that mention him gather here.</p>}
      {life.length > 0 && <ul className={styles.life} aria-label="Life">{life.map((e) => <Entry key={e.key} e={e} />)}</ul>}
      <div className={ui.row}>
        {onProfile && <button type="button" className={ui.buttonQuiet} onClick={onProfile}>Edit the profile</button>}
        <button type="button" className={ui.buttonQuiet} onClick={close}>Close</button>
      </div>
    </div>
  );
}

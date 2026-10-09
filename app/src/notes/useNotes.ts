/* A campaign's notes, kept up to date (phase 4a3): as last seen on this
   device at once, then from the server – every ten seconds while the
   screen is visible, asking only whether anything is newer – with what
   this device has not sent yet laid over them. What is being sent stays
   laid over until the server's list has it, so nothing flickers away. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { flushOutbox, useNoteOutbox } from '../battle/outbox.ts';
import { db, type OutboxItem } from '../db/db.ts';
import { cachedNotes, getNotes, mergeNotes, type Note } from './api.ts';

export const NOTES_EVERY_MS = 10_000;

export function useNotes(cid: string, me: { id: string; displayName: string } | null, every = NOTES_EVERY_MS) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [sending, setSending] = useState<OutboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const outbox = useNoteOutbox(cid);
  const userId = me?.id;
  const refresh = useCallback((): Promise<void> => db.outbox.filter((i) => i.campaignId === cid && i.op.startsWith('note.')).toArray()
    .then((items) => { setSending(items); return userId ? flushOutbox(userId) : 0; })
    .then(() => getNotes(cid))
    .then((r) => { setNotes(r.notes); setSending([]); setError(null); })
    .catch((e: unknown) => setError(errorText(e))), [cid, userId]);
  useEffect(() => {
    let live = true;
    void cachedNotes(cid).then((r) => { if (live && r) setNotes((n) => n ?? r.notes); });
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, every);
    return () => { live = false; clearInterval(t); };
  }, [cid, refresh, every]);
  const shown = useMemo(() => {
    if (!notes || !me) return null;
    const waiting = [...sending.filter((s) => !outbox.some((o) => o.key === s.key)), ...outbox];
    return mergeNotes(notes, waiting, me);
  }, [notes, sending, outbox, me]);
  return { notes: shown, error, refresh };
}

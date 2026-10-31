/* The campaign's style guide (phase 4b4a; concept.md 4.10): the writing
   instructions the AI pack hands to whoever writes the chapter – language,
   tense, voice, what stays out of the prose. A leaders' own text under
   Manage: read and written by leaders. Writing needs
   the connection; the last text is kept on the device. */
import { useEffect, useId, useRef, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import campaign from '../campaign/Campaign.module.css';
import ui from '../ui/ui.module.css';
import { cachedStyle, getStyle, MAX_STYLE, putStyle, staleStyle, type Style } from './api.ts';

const EMPTY: Style = { text: '', updatedBy: null, updatedAt: null, seq: 0 };

export function StyleSection({ id }: { id: string }) {
  const ids = useId();
  const online = useOnline();
  const [saved, setSaved] = useState<Style | null>(null);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // what the leader has typed is never overwritten by what arrives
  const typed = useRef(false);
  const newest = useRef(-1);
  useEffect(() => {
    let live = true;
    const arrive = (s: Style) => {
      if (s.seq < newest.current) return; // the device's copy came after the server's
      newest.current = s.seq;
      setSaved(s);
      if (!typed.current) setText(s.text);
      setLoaded(true);
    };
    // what was seen last first, then the server's
    void cachedStyle(id).then((c) => { if (live && c) arrive(c); });
    getStyle(id).then((s) => { if (live) arrive(s); })
      .catch((e: unknown) => { if (live) setMessage({ text: errorText(e), error: false }); });
    return () => { live = false; };
  }, [id]);

  const base = saved ?? EMPTY;
  const changed = text !== base.text;
  const save = () => {
    setBusy(true);
    setMessage(null);
    putStyle(id, text, base.seq)
      .then((s) => { newest.current = s.seq; setSaved(s); setText(s.text); typed.current = false; setMessage({ text: 'Style guide saved.', error: false }); })
      .catch((e: unknown) => {
        const cur = staleStyle(e);
        if (cur) { newest.current = cur.seq; setSaved(cur); setText(cur.text); typed.current = false; setMessage({ text: `${cur.updatedBy ?? 'Another leader'} changed the style guide while you were editing it. Theirs is shown now; redo your change.`, error: true }); } else setMessage({ text: errorText(e), error: true });
      })
      .finally(() => setBusy(false));
  };

  return (
    <section className={campaign.section} aria-labelledby="m-style">
      <h2 id="m-style">Style guide ⚑</h2>
      <p className={ui.muted}>
        Only leaders read this. The AI pack on the Timeline hands it to whoever writes the chapter: the language, the tense, the voice, what stays out of the prose.
        {base.updatedBy ? ` Last saved by ${base.updatedBy}.` : ''}
      </p>
      <div className={ui.field}>
        <label htmlFor={`${ids}-t`}>Instructions for the writer</label>
        <textarea id={`${ids}-t`} className={`${ui.textarea} ${ui.writing}`} rows={6} value={text} maxLength={MAX_STYLE} disabled={!loaded && !message}
          placeholder="German, past tense, close third person. No dice, no game terms." onChange={(e) => { typed.current = true; setText(e.target.value); setMessage(null); }} />
      </div>
      {message && <p className={`${ui.message} ${message.error ? ui.error : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!online || busy || !changed} onClick={save}>Save the style</button>
      </div>
    </section>
  );
}

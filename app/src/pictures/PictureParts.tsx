/* A picture on screen and the sheet to send one (phase 4a3, part 2;
   concept.md 4.5–4.6): a screenshot from Tabletop Simulator or a photo of
   the table, at a battle (and its turn) or about the campaign in general.
   Who may see it is chosen like a note's: everyone, or leaders only. The
   picture is made smaller on this phone first; what leaves it is only the
   pixels. */
import { useEffect, useId, useState, type RefObject } from 'react';
import ui from '../ui/ui.module.css';
import type { BattleChoice } from '../notes/NoteParts.tsx';
import { localAddress, pictureUrl, type PictureMeta, type PictureVisibility, type ShownPicture } from './api.ts';
import styles from './Pictures.module.css';
import { shrink, type Shrunk } from './shrink.ts';

export function PictureCard({ p, cid, where, canRemove, onRemove }: {
  p: ShownPicture; cid: string; where?: string; canRemove: boolean; onRemove: () => void;
}) {
  const src = p.localUrl ?? (p.stored ? pictureUrl(cid, p.id) : undefined);
  const alt = p.caption || `A picture by ${p.uploader}`;
  return (
    <li className={`${styles.picture} ${p.visibility === 'leader' ? styles.leader : ''}`}>
      <figure>
        {src
          ? <a href={src} target="_blank" rel="noopener noreferrer" className={styles.frame}><img src={src} alt={alt} width={p.width} height={p.height} loading="lazy" /></a>
          : <div className={styles.frame} role="img" aria-label={alt}><span className={ui.muted}>The picture is on its way.</span></div>}
        <figcaption>
          {p.caption && <span>{p.caption}</span>}
          <small>
            {p.uploader}{p.turn ? ` · turn ${p.turn}` : ''}{where ? ` · ${where}` : ''}
            {p.visibility === 'leader' && <span className={styles.visible}> · ⚑ Leaders only</span>}
            {p.pending && <span className={styles.pending}> · ⏳ on this phone</span>}
            {p.refused && <span className={styles.refused}> · not taken: {p.refused}</span>}
          </small>
        </figcaption>
      </figure>
      {canRemove && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={onRemove}>Take out</button></div>}
    </li>
  );
}

interface FormProps {
  battles: BattleChoice[];
  /** The game night: the picture belongs to this battle, at this turn. */
  fixed?: { battleId: string; turn: number };
  canLead: boolean;
  onSave: (meta: PictureMeta, bytes: ArrayBuffer) => void;
}

export function PictureSheet({ dialogRef, close, formKey, ...rest }: { dialogRef: RefObject<HTMLDialogElement | null>; close: (then?: () => void) => void; formKey: number } & FormProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="picture-title">
      <PictureForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

function PictureForm({ close, battles, fixed, canLead, onSave }: FormProps & { close: (then?: () => void) => void }) {
  const ids = { file: useId(), caption: useId(), battle: useId() };
  const [shrunk, setShrunk] = useState<(Shrunk & { url?: string }) | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PictureVisibility>('public');
  const [battleId, setBattleId] = useState(fixed?.battleId ?? battles.find((b) => b.open)?.id ?? '');
  // the preview's address goes with the preview
  useEffect(() => () => { if (shrunk?.url) URL.revokeObjectURL(shrunk.url); }, [shrunk]);
  const pick = (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    setError(null);
    shrink(f)
      .then((s) => { const url = localAddress(s.bytes, s.mime); setShrunk({ ...s, ...(url ? { url } : {}) }); })
      .catch((e: unknown) => { setShrunk(null); setError(e instanceof Error && e.message ? e.message : 'This picture cannot be read here.'); })
      .finally(() => setReading(false));
  };
  return (
    <form className={ui.page} onSubmit={(e) => {
      e.preventDefault();
      if (!shrunk) return;
      const meta: PictureMeta = {
        battleId: battleId || null, turn: fixed && battleId === fixed.battleId ? fixed.turn : null,
        mime: shrunk.mime, bytes: shrunk.bytes.byteLength, width: shrunk.width, height: shrunk.height, caption: caption.trim(), visibility,
      };
      close(() => onSave(meta, shrunk.bytes));
    }}>
      <h2 id="picture-title">A picture{fixed ? ` · turn ${fixed.turn}` : ''}</h2>
      <label className={ui.field} htmlFor={ids.file}>
        <span>Screenshot or photo</span>
        <input id={ids.file} type="file" accept="image/png,image/jpeg,image/webp" className={ui.input} onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {reading && <p className={ui.muted} role="status">Making it smaller…</p>}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {shrunk && (
        <figure className={styles.preview}>
          {shrunk.url && <img src={shrunk.url} alt="The picture to send" width={shrunk.width} height={shrunk.height} />}
          <figcaption className={ui.muted}>{shrunk.width} × {shrunk.height} · {Math.max(1, Math.round(shrunk.bytes.byteLength / 1024))} KB · only the pixels leave this phone</figcaption>
        </figure>
      )}
      {!fixed && (
        <label className={ui.field} htmlFor={ids.battle}>
          <span>About</span>
          <select id={ids.battle} className={ui.select} value={battleId} onChange={(e) => setBattleId(e.target.value)}>
            <option value="">The campaign in general</option>
            {battles.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}
      <label className={ui.field} htmlFor={ids.caption}>
        <span>Caption (optional)</span>
        <textarea id={ids.caption} className={`${ui.textarea} ${ui.writing}`} rows={2} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </label>
      {canLead && (
        <fieldset className={styles.who}>
          <legend>Who can see it?</legend>
          <label className={styles.choice}><input type="radio" name="picture-visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} /> 👁 Everyone in the campaign</label>
          <label className={styles.choice}><input type="radio" name="picture-visibility" checked={visibility === 'leader'} onChange={() => setVisibility('leader')} /> ⚑ Leaders only</label>
        </fieldset>
      )}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!shrunk || reading}>Save the picture</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/* A note on screen and the sheet to write one (phase 4a3; docs/mockups/
   visibility.html, game-night.html): who may read it shown in symbol,
   word and its own surface; a sealed note of someone else's as what it is
   – sealed, without its words. Used on the Notes tab and at the game night. */
import { useId, useState, type RefObject } from 'react';
import type { Pick } from '../battle/sides.ts';
import ui from '../ui/ui.module.css';
import { isSealed, KIND_NAMES, type FullNote, type Kind, type Mention, type Note, type NoteBody, type Visibility } from './api.ts';
import styles from './Notes.module.css';

export const VISIBILITY_WORDS: Record<Visibility, { mark: string; word: string }> = {
  public: { mark: '👁', word: 'Everyone' },
  sealed: { mark: '🔒', word: 'Sealed' },
  leader: { mark: '⚑', word: 'Leaders only' },
};

export function NoteCard({ n, battleName, pending, refused, canEdit, canRemove, onEdit, onRemove }: {
  n: Note; battleName: (id: string | null) => string; pending?: boolean; refused?: string;
  canEdit: boolean; canRemove: boolean; onEdit: () => void; onRemove: () => void;
}) {
  if (isSealed(n)) {
    return (
      <li className={`${styles.note} ${styles.sealed}`}>
        <small>{n.author} · <span className={styles.sealedWord}>🔒 Sealed until {battleName(n.sealedUntil)} is closed</span></small>
        <p className={styles.placeholder}>This note is sealed. It opens for everyone when {battleName(n.sealedUntil)} is closed.</p>
      </li>
    );
  }
  const v = VISIBILITY_WORDS[n.visibility];
  const speaker = n.kind === 'quote' ? n.mentions[0] : undefined;
  const named = n.kind === 'quote' ? n.mentions.slice(1) : n.mentions;
  return (
    <li className={`${styles.note} ${n.visibility === 'leader' ? styles.leader : ''} ${n.visibility === 'sealed' ? styles.opened : ''}`}>
      <small className={styles.line}>
        <span>
          {n.author}{n.turn ? ` · turn ${n.turn}` : ''}
          {pending && <span className={styles.pending}> · ⏳ on this phone</span>}
          {refused && <span className={styles.refused}> · not taken: {refused}</span>}
        </span>
        <span className={n.visibility === 'public' ? undefined : styles.visible}>
          {v.mark} {n.visibility === 'sealed' ? (n.opened ? 'Opened after the battle' : `Sealed until ${battleName(n.sealedUntil)} is closed`) : v.word}
        </span>
      </small>
      {n.kind === 'quote'
        ? (
          <blockquote className={styles.quote}>
            <p>“{n.text}”</p>
            {speaker && <footer>— {speaker.name}</footer>}
          </blockquote>
        )
        : <p>{n.kind !== 'general' && <span className={styles.kind}>{KIND_NAMES[n.kind]} </span>}{n.text}</p>}
      {named.length > 0 && <small>With {named.map((m) => m.name).join(', ')}</small>}
      {n.edited && <small>edited</small>}
      {(canEdit || canRemove) && (
        <div className={styles.acts}>
          {canEdit && <button type="button" className={ui.buttonQuiet} onClick={onEdit}>Edit</button>}
          {canRemove && <button type="button" className={ui.buttonQuiet} onClick={onRemove}>Take out</button>}
        </div>
      )}
    </li>
  );
}

export interface BattleChoice { id: string; label: string; open: boolean }

interface FormProps {
  battles: BattleChoice[];
  /** The game night: the note belongs to this battle, at this turn. */
  fixed?: { battleId: string; turn: number };
  kind: Kind;
  canLead: boolean;
  warbands: { warbandId: string; name: string }[];
  picks: Record<string, Pick[]>;
  note: FullNote | null;
  /** A leader correcting another's words: only the words. */
  wordsOnly?: boolean;
  onSave: (body: NoteBody) => void;
}

export function NoteSheet({ dialogRef, close, formKey, ...rest }: { dialogRef: RefObject<HTMLDialogElement | null>; close: (then?: () => void) => void; formKey: number } & FormProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="note-title">
      <NoteForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

const pickKey = (m: Mention) => `${m.warbandId}|${m.uid}`;

function NoteForm({ close, battles, fixed, kind: kind0, canLead, warbands, picks, note, wordsOnly, onSave }: FormProps & { close: (then?: () => void) => void }) {
  const ids = { battle: useId(), kind: useId(), text: useId(), who: useId(), add: useId() };
  const [battleId, setBattleId] = useState<string>(note?.battleId ?? fixed?.battleId ?? battles.find((b) => b.open)?.id ?? '');
  const [kind, setKind] = useState<Kind>(note?.kind ?? kind0);
  const [text, setText] = useState(note?.text ?? '');
  const [visibility, setVisibility] = useState<Visibility>(note?.visibility ?? 'public');
  const [mentions, setMentions] = useState<Mention[]>(note?.mentions ?? []);
  const all: (Mention & { label: string })[] = warbands.flatMap((w) => (picks[w.warbandId] ?? [])
    .filter((p) => p.side.fallenIdx == null && p.side.uid != null)
    .map((p) => ({ warbandId: w.warbandId, uid: p.side.uid!, name: p.side.name, label: `${p.side.name} (${w.name})` })));
  const battle = battles.find((b) => b.id === battleId);
  const canSeal = !!battle && (battle.open || note?.visibility === 'sealed');
  const speaker = kind === 'quote' ? mentions[0] : undefined;
  const others = kind === 'quote' ? mentions.slice(1) : mentions;
  const setSpeaker = (key: string) => {
    const m = all.find((x) => pickKey(x) === key);
    setMentions([...(m ? [{ warbandId: m.warbandId, uid: m.uid, name: m.name }] : []), ...others.filter((x) => !m || pickKey(x) !== key)]);
  };
  const add = (key: string) => {
    const m = all.find((x) => pickKey(x) === key);
    if (m && !mentions.some((x) => pickKey(x) === key)) setMentions([...mentions, { warbandId: m.warbandId, uid: m.uid, name: m.name }]);
  };
  const effective: Visibility = visibility === 'sealed' && !canSeal ? 'public' : visibility;
  return (
    <form className={ui.page} onSubmit={(e) => {
      e.preventDefault();
      // a quote without a speaker keeps the others named after an empty first place out
      close(() => onSave({ battleId: battleId || null, turn: fixed && battleId === fixed.battleId ? (note?.turn ?? fixed.turn) : (note?.turn ?? null), kind, text: text.trim(), visibility: effective, mentions }));
    }}>
      <h2 id="note-title">{note ? (wordsOnly ? 'Correct the note' : 'Edit the note') : kind === 'quote' ? 'A quote' : 'A note'}{fixed ? ` · turn ${note?.turn ?? fixed.turn}` : ''}</h2>
      {!fixed && !wordsOnly && (
        <label className={ui.field} htmlFor={ids.battle}>
          <span>About</span>
          <select id={ids.battle} className={ui.select} value={battleId} onChange={(e) => setBattleId(e.target.value)}>
            <option value="">The campaign in general</option>
            {battles.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}
      {!wordsOnly && (
        <label className={ui.field} htmlFor={ids.kind}>
          <span>Kind</span>
          <select id={ids.kind} className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(Object.keys(KIND_NAMES) as Kind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
          </select>
        </label>
      )}
      {kind === 'quote' && !wordsOnly && (
        <label className={ui.field} htmlFor={ids.who}>
          <span>Who says it?</span>
          <select id={ids.who} className={ui.select} value={speaker ? pickKey(speaker) : ''} onChange={(e) => setSpeaker(e.target.value)}>
            <option value="">Someone not on a roster</option>
            {all.map((m) => <option key={pickKey(m)} value={pickKey(m)}>{m.label}</option>)}
          </select>
        </label>
      )}
      <label className={ui.field} htmlFor={ids.text}>
        <span>{kind === 'quote' ? 'What was said' : 'What happened'}</span>
        <textarea id={ids.text} className={`${ui.textarea} ${ui.writing}`} value={text} rows={4} maxLength={20000} required onChange={(e) => setText(e.target.value)} />
      </label>
      {!wordsOnly && all.length > 0 && (
        <div className={ui.field}>
          <label htmlFor={ids.add}>Who is in it? (optional)</label>
          {others.length > 0 && (
            <ul className={styles.chips} aria-label="Named">
              {others.map((m) => (
                <li key={pickKey(m)}>
                  <button type="button" className={ui.buttonQuiet} aria-label={`Take ${m.name} out of the note`}
                    onClick={() => setMentions(mentions.filter((x) => pickKey(x) !== pickKey(m) || x === speaker))}>{m.name} ✕</button>
                </li>
              ))}
            </ul>
          )}
          <select id={ids.add} className={ui.select} value="" onChange={(e) => add(e.target.value)}>
            <option value="">Name a warrior…</option>
            {all.filter((m) => !mentions.some((x) => pickKey(x) === pickKey(m))).map((m) => <option key={pickKey(m)} value={pickKey(m)}>{m.label}</option>)}
          </select>
        </div>
      )}
      {!wordsOnly && (
        <fieldset className={styles.who}>
          <legend>Who can read this?</legend>
          <label className={`${styles.choice} ${effective === 'public' ? styles.chosen : ''}`}>
            <input type="radio" name="note-visibility" checked={effective === 'public'} onChange={() => setVisibility('public')} />
            <span>👁 Everyone in the campaign<small>Players, leaders and viewers, from now on.</small></span>
          </label>
          {canSeal && (
            <label className={`${styles.choice} ${effective === 'sealed' ? styles.chosen : ''}`}>
              <input type="radio" name="note-visibility" checked={effective === 'sealed'} onChange={() => setVisibility('sealed')} />
              <span>🔒 Sealed until {battle!.label} is closed<small>Nobody can read it before – not the leader, not the admin. Then it opens for everyone.</small></span>
            </label>
          )}
          {canLead && (
            <label className={`${styles.choice} ${effective === 'leader' ? styles.chosen : ''}`}>
              <input type="radio" name="note-visibility" checked={effective === 'leader'} onChange={() => setVisibility('leader')} />
              <span>⚑ Leaders only<small>Players and viewers never receive it.</small></span>
            </label>
          )}
        </fieldset>
      )}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!text.trim()}>{note ? 'Save' : 'Save the note'}</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/* The sheets of the game night (phase 4a2): a casualty and an event for the
   protocol (leaders), a correction (players). What they make goes to the
   outbox first – a table without a connection loses nothing. */
import type { GameData } from '@mordheim/core';
import { useEffect, useId, useState, type RefObject } from 'react';
import { loadGameData } from '../game/gameData.ts';
import ui from '../ui/ui.module.css';
import type { CasualtyPayload, Entry, Participant, Side } from './api.ts';
import { keyOf, warriorsOf, type Pick } from './sides.ts';
import styles from './Battle.module.css';

type Sheet = { dialogRef: RefObject<HTMLDialogElement | null>; close: (then?: () => void) => void };

/** The warriors of every warband that fought, from their states as members read them. */
export function usePicks(participants: Participant[], load: (warbandId: string) => Promise<unknown>, active: boolean): { picks: Record<string, Pick[]>; error: string | null } {
  const [picks, setPicks] = useState<Record<string, Pick[]>>({});
  const [error, setError] = useState<string | null>(null);
  const ids = participants.map((p) => p.warbandId).join();
  useEffect(() => {
    if (!active) return;
    let live = true;
    void (async () => {
      try {
        const [{ readSave }, data] = await Promise.all([import('../sync/engine.ts'), loadGameData()]);
        const out: Record<string, Pick[]> = {};
        for (const id of ids.split(',').filter(Boolean)) {
          const state = readSave(data as GameData, await load(id));
          out[id] = state ? warriorsOf(data, state, id) : [];
        }
        if (live) { setPicks(out); setError(null); }
      } catch {
        if (live) setError('The rosters could not be loaded: pick the warband, and type the name.');
      }
    })();
    return () => { live = false; };
  }, [ids, load, active]);
  return { picks, error };
}

const ENV = 'env';
const OTHER = 'other';

function SidePicker({ label, participants, picks, value, onChange, attacker }: {
  label: string; participants: Participant[]; picks: Record<string, Pick[]>; attacker?: boolean;
  value: { warband: string; pick: string; name: string }; onChange: (v: { warband: string; pick: string; name: string }) => void;
}) {
  const ids = { wb: useId(), who: useId(), name: useId() };
  const list = picks[value.warband] ?? [];
  const free = value.warband === OTHER || (value.warband && value.warband !== ENV && list.length === 0);
  return (
    <fieldset className={styles.side}>
      <legend>{label}</legend>
      <label className={ui.field} htmlFor={ids.wb}>
        <span>Warband</span>
        <select id={ids.wb} className={ui.select} value={value.warband} required={!attacker}
          onChange={(e) => onChange({ warband: e.target.value, pick: '', name: '' })}>
          <option value="">{attacker ? 'Nobody in particular' : 'Choose…'}</option>
          {participants.map((p) => <option key={p.warbandId} value={p.warbandId}>{p.name}</option>)}
          {attacker && <option value={ENV}>The surroundings</option>}
          {attacker && <option value={OTHER}>Someone else</option>}
        </select>
      </label>
      {value.warband && value.warband !== ENV && value.warband !== OTHER && list.length > 0 && (
        <label className={ui.field} htmlFor={ids.who}>
          <span>Who</span>
          <select id={ids.who} className={ui.select} value={value.pick} required={!attacker} onChange={(e) => onChange({ ...value, pick: e.target.value })}>
            <option value="">{attacker ? 'Someone of theirs' : 'Choose…'}</option>
            {list.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {free && (
        <label className={ui.field} htmlFor={ids.name}>
          <span>Name</span>
          <input id={ids.name} className={ui.input} value={value.name} maxLength={120} required onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
      )}
    </fieldset>
  );
}

const sideFrom = (v: { warband: string; pick: string; name: string }, picks: Record<string, Pick[]>, participants: Participant[]): Side | null => {
  if (v.warband === ENV) return { name: 'The surroundings', env: true };
  if (v.warband === OTHER) return v.name.trim() ? { name: v.name.trim() } : null;
  const p = participants.find((x) => x.warbandId === v.warband);
  if (!p) return null;
  const hit = (picks[v.warband] ?? []).find((x) => x.key === v.pick);
  if (hit) return hit.side;
  if (v.name.trim()) return { warbandId: p.warbandId, name: v.name.trim(), wb: p.wbType };
  return null;
};
const valueFrom = (s: Side | null | undefined) => (!s ? { warband: '', pick: '', name: '' }
  : s.env ? { warband: ENV, pick: '', name: '' }
    : !s.warbandId ? { warband: OTHER, pick: '', name: s.name }
      : { warband: s.warbandId, pick: keyOf(s), name: s.uid == null ? s.name : '' });

/** A casualty: new, or an entry to correct (same id). `formKey` starts the form anew each time the sheet opens. */
export function CasualtySheet({ dialogRef, close, formKey, ...rest }: Sheet & { formKey: number } & CasualtyFormProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="cas-title">
      <CasualtyForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

interface CasualtyFormProps {
  participants: Participant[]; picks: Record<string, Pick[]>; picksError: string | null; turn: number;
  entry: (Entry & { kind: 'casualty' }) | null; onSave: (payload: CasualtyPayload, turn: number) => void;
}

function CasualtyForm({ close, participants, picks, picksError, turn, entry, onSave }: CasualtyFormProps & { close: Sheet['close'] }) {
  const [victim, setVictim] = useState(valueFrom(entry?.payload.victim));
  const [attacker, setAttacker] = useState(valueFrom(entry?.payload.attacker));
  const [note, setNote] = useState(entry?.payload.note ?? '');
  const v = sideFrom(victim, picks, participants);
  /** Nobody picked of a warband: someone of theirs. */
  const by = (): Side | null => {
    if (!attacker.warband) return null;
    const s = sideFrom(attacker, picks, participants);
    if (s) return s;
    const p = participants.find((x) => x.warbandId === attacker.warband);
    return p ? { warbandId: p.warbandId, name: p.name, wb: p.wbType } : null;
  };
  const ready = !!v && (attacker.warband !== OTHER || !!attacker.name.trim());
  return (
    <form className={ui.page} onSubmit={(e) => {
      e.preventDefault();
      if (!v) return;
      const a = by();
      close(() => onSave({ victim: v, attacker: a, note: note.trim() }, entry?.turn ?? turn));
    }}>
      <h2 id="cas-title">{entry ? 'Correct the casualty' : `Out of action · turn ${turn}`}</h2>
      {picksError && <p className={ui.message}>{picksError}</p>}
      <SidePicker label="Out of action" participants={participants} picks={picks} value={victim} onChange={setVictim} />
      <SidePicker label="Taken out by" participants={participants} picks={picks} value={attacker} onChange={setAttacker} attacker />
      <label className={ui.field}>
        <span>What happened (optional)</span>
        <input className={ui.input} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!ready}>{entry ? 'Save the correction' : 'Add to the protocol'}</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/** Something else that happened: the ferry drifts, a building collapses. */
export function EventSheet({ dialogRef, close, formKey, ...rest }: Sheet & { formKey: number } & EventFormProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="ev-title">
      <EventForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

interface EventFormProps { turn: number; entry: (Entry & { kind: 'event' }) | null; onSave: (text: string, turn: number) => void }

function EventForm({ close, turn, entry, onSave }: EventFormProps & { close: Sheet['close'] }) {
  const [text, setText] = useState(entry?.payload.text ?? '');
  return (
      <form className={ui.page} onSubmit={(e) => { e.preventDefault(); close(() => onSave(text.trim(), entry?.turn ?? turn)); }}>
        <h2 id="ev-title">{entry ? 'Correct the event' : `Event · turn ${turn}`}</h2>
        <label className={ui.field}>
          <span>What happened</span>
          <textarea className={ui.textarea} value={text} maxLength={1000} rows={3} required onChange={(e) => setText(e.target.value)} />
        </label>
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={!text.trim()}>{entry ? 'Save the correction' : 'Add to the protocol'}</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        </div>
      </form>
  );
}

/** A correction for the leader: of one entry, or of the battle. */
export function ProposalSheet({ dialogRef, close, formKey, ...rest }: Sheet & { formKey: number } & ProposalFormProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="prop-title">
      <ProposalForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

interface ProposalFormProps { about: string | null; onSave: (text: string) => void }

function ProposalForm({ close, about, onSave }: ProposalFormProps & { close: Sheet['close'] }) {
  const [text, setText] = useState('');
  return (
      <form className={ui.page} onSubmit={(e) => { e.preventDefault(); close(() => onSave(text.trim())); }}>
        <h2 id="prop-title">Suggest a correction</h2>
        <p className={ui.muted}>{about ? `About: ${about}` : 'About the battle.'} Only a leader writes the protocol; they take it over or not.</p>
        <label className={ui.field}>
          <span>What should it say?</span>
          <textarea className={ui.textarea} value={text} maxLength={1000} rows={3} required onChange={(e) => setText(e.target.value)} />
        </label>
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={!text.trim()}>Send to the leader</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        </div>
      </form>
  );
}

/* Questions to players (phase 4b3a; concept.md 4.6 "Fragen des Leiters"): a
   leader asks one player a pointed question – "How did Robba spend the night
   after the battle?" – and the player answers with a note of their own, with
   the visibility they choose. The question itself is seen by the leaders and
   the one it is asked of, nobody else, and never goes into the note.
   For a leader the tab lists every question; for anyone else, the ones asked
   of them. Asking and answering need the connection. */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { errorText } from '../account/api.ts';
import { ago } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import notes from '../notes/Notes.module.css';
import { useNotice } from '../ui/Notice.tsx';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { answerQuestion, MAX_QUESTION, putQuestion, STATUS_NAMES, type Question } from './api.ts';
import styles from './Questions.module.css';
import { useQuestions } from './useQuestions.ts';

interface Battle { id: string; label: string; open: boolean }

/** The sheet's form: a question, or the answer to one. A change that fails stays open with its words. */
function AskForm({ battles, people, edit, close, onSave, titleId }: {
  battles: Battle[]; people: { id: string; name: string }[]; edit: Question | null; close: () => void; titleId: string; onSave: (b: { to: string; text: string; battleId: string | null }) => Promise<void>;
}) {
  const ids = { to: useId(), battle: useId(), text: useId() };
  const [to, setTo] = useState(edit?.to ?? '');
  const [battleId, setBattleId] = useState(edit?.battleId ?? '');
  const [text, setText] = useState(edit?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className={ui.page} onSubmit={(e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      onSave({ to, text: text.trim(), battleId: battleId || null }).then(() => close(), (err: unknown) => setError(errorText(err))).finally(() => setBusy(false));
    }}>
      <h2 id={titleId}>{edit ? 'Change the question' : 'Ask a question'}</h2>
      <p className={ui.muted}>Only you and the other leaders see a question – and the player it is asked of. Their answer becomes a note of theirs; the question is not shown with it.</p>
      <label className={ui.field} htmlFor={ids.to}>
        <span>To</span>
        <select id={ids.to} className={ui.select} value={to} disabled={!!edit} required onChange={(e) => setTo(e.target.value)}>
          {!edit && <option value="">Choose…</option>}
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className={ui.field} htmlFor={ids.battle}>
        <span>About</span>
        <select id={ids.battle} className={ui.select} value={battleId} onChange={(e) => setBattleId(e.target.value)}>
          <option value="">The campaign in general</option>
          {battles.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      <div className={ui.field}>
        <label htmlFor={ids.text}>Question</label>
        <textarea id={ids.text} className={`${ui.textarea} ${ui.writing}`} rows={4} value={text} maxLength={MAX_QUESTION} required onChange={(e) => setText(e.target.value)} />
        {text.length > MAX_QUESTION * 0.8 && <small className={styles.count}>{text.length} / {MAX_QUESTION}</small>}
      </div>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="submit" className={ui.button} disabled={busy || !text.trim() || !to}>{edit ? 'Save' : 'Ask'}</button>
      </div>
    </form>
  );
}

type Visibility = 'public' | 'sealed' | 'leader';

function AnswerForm({ q, battle, lead, close, onSave, titleId }: {
  q: Question; battle: Battle | undefined; lead: boolean; close: () => void; titleId: string; onSave: (b: { text: string; visibility: Visibility }) => Promise<void>;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSeal = !!battle?.open;
  const effective: Visibility = visibility === 'sealed' && !canSeal ? 'public' : visibility;
  return (
    <form className={ui.page} onSubmit={(e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      onSave({ text: text.trim(), visibility: effective }).then(() => close(), (err: unknown) => setError(errorText(err))).finally(() => setBusy(false));
    }}>
      <h2 id={titleId}>Answer</h2>
      <blockquote className={styles.quote}>{q.text}</blockquote>
      <p className={ui.muted}>Your answer becomes a note of yours{battle ? ` on ${battle.label}` : ''}. The question is not shown with it.</p>
      <div className={ui.field}>
        <label htmlFor={id}>Your answer</label>
        <textarea id={id} className={`${ui.textarea} ${ui.writing}`} rows={5} value={text} maxLength={20000} required onChange={(e) => setText(e.target.value)} />
      </div>
      <fieldset className={notes.who}>
        <legend>Who can read this?</legend>
        <label className={`${notes.choice} ${effective === 'public' ? notes.chosen : ''}`}>
          <input type="radio" name="answer-visibility" checked={effective === 'public'} onChange={() => setVisibility('public')} />
          <span>👁 Everyone in the campaign<small>Players, leaders and viewers, from now on.</small></span>
        </label>
        {canSeal && (
          <label className={`${notes.choice} ${effective === 'sealed' ? notes.chosen : ''}`}>
            <input type="radio" name="answer-visibility" checked={effective === 'sealed'} onChange={() => setVisibility('sealed')} />
            <span>🔒 Sealed until {battle!.label} is closed<small>Nobody can read it before – not the leader, not the admin. Then it opens for everyone.</small></span>
          </label>
        )}
        {lead && (
          <label className={`${notes.choice} ${effective === 'leader' ? notes.chosen : ''}`}>
            <input type="radio" name="answer-visibility" checked={effective === 'leader'} onChange={() => setVisibility('leader')} />
            <span>⚑ Leaders only<small>Players and viewers never receive it.</small></span>
          </label>
        )}
      </fieldset>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="submit" className={ui.button} disabled={busy || !text.trim()}>Answer</button>
      </div>
    </form>
  );
}

type Sheet = ReturnType<typeof useSheet>;
type Person = { id: string; name: string };

function AskSheet({ dialogRef, close, asking, battles, people, onSave }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; asking: { key: number; edit: Question | null } | null; battles: Battle[]; people: Person[];
  onSave: (edit: Question | null, b: { to: string; text: string; battleId: string | null }) => Promise<void>;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {asking && <AskForm key={asking.key} titleId={id} battles={battles} people={people} edit={asking.edit} close={() => close()} onSave={(b) => onSave(asking.edit, b)} />}
    </dialog>
  );
}

function AnswerSheet({ dialogRef, close, answering, battles, lead, onSave }: {
  dialogRef: Sheet['ref']; close: Sheet['close']; answering: { key: number; q: Question } | null; battles: Battle[]; lead: boolean;
  onSave: (q: Question, b: { text: string; visibility: Visibility }) => Promise<void>;
}) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {answering && <AnswerForm key={answering.key} titleId={id} q={answering.q} battle={battles.find((b) => b.id === answering.q.battleId)} lead={lead} close={() => close()} onSave={(b) => onSave(answering.q, b)} />}
    </dialog>
  );
}

export function QuestionsTab({ id, view, user, lead }: { id: string; view: CampaignView; user: { id: string }; lead: boolean }) {
  const { data, error, reload } = useQuestions(id);
  const online = useOnline();
  const [notice, notify] = useNotice();
  const ask = useSheet();
  const answer = useSheet();
  const [asking, setAsking] = useState<{ key: number; edit: Question | null } | null>(null);
  const [answering, setAnswering] = useState<{ key: number; q: Question } | null>(null);
  const battles: Battle[] = (view.battles ?? []).filter((b) => !b.takenOver).map((b) => ({ id: b.id, label: battleTitle(b), open: b.status === 'open' }));
  const battleOf = (bid: string | null) => battles.find((b) => b.id === bid);
  const people = view.members.filter((m) => m.role !== 'viewer' && m.userId !== user.id).map((m) => ({ id: m.userId, name: m.displayName }));
  const questions = data?.questions ?? [];

  const openAsk = (edit: Question | null) => { setAsking((p) => ({ key: (p?.key ?? 0) + 1, edit })); ask.open(); };
  const openAnswer = (q: Question) => { setAnswering((p) => ({ key: (p?.key ?? 0) + 1, q })); answer.open(); };
  const withdraw = (q: Question, status: 'open' | 'withdrawn') =>
    putQuestion(id, q.id, { to: q.to, text: q.text, battleId: q.battleId, status }).then(() => { reload(); notify(status === 'withdrawn' ? 'Question withdrawn.' : 'Question asked again.'); }, (e: unknown) => notify(errorText(e)));

  const item = (q: Question) => {
    const b = battleOf(q.battleId);
    const own = q.to === user.id;
    return (
      <li key={q.id} className={`${styles.item} ${q.status === 'open' ? styles.open : ''}`}>
        <div className={styles.line}>
          <strong>{lead ? (own ? 'To you' : `To ${q.toName}`) : `From ${q.askedByName}`}</strong>
          <span className={`${styles.status} ${q.status === 'open' ? styles.statusOpen : ''}`}>{STATUS_NAMES[q.status]}</span>
        </div>
        <small>{b ? `About ${b.label} · ` : ''}{lead ? `asked by ${q.askedBy === user.id ? 'you' : q.askedByName} · ` : ''}{ago(q.createdAt)}</small>
        <p>{q.text}</p>
        {q.status === 'answered' && <small>{own ? 'You answered with a note.' : `${q.toName} answered with a note.`}</small>}
        <div className={ui.row}>
          {q.status === 'answered' && <Link to={`/campaign/${id}/notes`} className={ui.buttonQuiet}>Read the notes</Link>}
          {own && q.status === 'open' && <button type="button" className={ui.button} disabled={!online} onClick={() => openAnswer(q)}>Answer</button>}
          {lead && q.status === 'open' && <button type="button" className={ui.buttonQuiet} disabled={!online} onClick={() => openAsk(q)}>Change</button>}
          {lead && q.status === 'open' && <button type="button" className={ui.buttonQuiet} disabled={!online} onClick={() => void withdraw(q, 'withdrawn')}>Withdraw</button>}
          {lead && q.status === 'withdrawn' && <button type="button" className={ui.buttonQuiet} disabled={!online} onClick={() => void withdraw(q, 'open')}>Ask again</button>}
        </div>
      </li>
    );
  };

  return (
    <div className={ui.page}>
      <section className={styles.section} aria-labelledby="q-title">
        <h2 id="q-title">{lead ? 'Questions to players' : 'Questions for you'}</h2>
        <p className={ui.muted}>
          {lead
            ? '⚑ Only leaders and the player asked see a question. The answer becomes a note of that player’s, with the visibility they choose.'
            : 'A leader may ask you something about the story. Your answer becomes a note of yours – you choose who can read it.'}
        </p>
        {error && <p className={ui.message} role="status">{error}{data ? ' Shown as last seen.' : ''}</p>}
        {lead && <div className={ui.row}><button type="button" className={ui.button} disabled={!online || people.length === 0} onClick={() => openAsk(null)}>Ask a question</button></div>}
        {data && questions.length === 0 && <Empty scene="scribe" title={lead ? 'No questions yet.' : 'Nothing asked of you.'} />}
        {questions.length > 0 && <ul className={styles.list} aria-label="Questions">{questions.map(item)}</ul>}
      </section>
      <AskSheet dialogRef={ask.ref} close={ask.close} asking={asking} battles={battles}
        people={asking?.edit ? view.members.filter((m) => m.userId === asking.edit!.to).map((m) => ({ id: m.userId, name: m.displayName })) : people}
        onSave={async (edit, b) => {
          await putQuestion(id, edit?.id ?? newId(), { ...b, status: 'open' });
          reload();
          notify(edit ? 'Question changed.' : 'Question asked.');
        }} />
      <AnswerSheet dialogRef={answer.ref} close={answer.close} answering={answering} battles={battles} lead={lead}
        onSave={async (q, b) => {
          await answerQuestion(id, q.id, { noteId: newId(), ...b });
          reload();
          notify('Answered. Your note is in Notes.');
        }} />
      {notice}
    </div>
  );
}

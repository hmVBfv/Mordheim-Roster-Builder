/* The scenarios of a campaign (phase 4b3c; concept.md 4.9): a leaders' own
   playable package – the rules and the values of the NPCs in it, in the text
   form of the Tabletop Simulator export. A draft is read by the leaders
   (with the authenticator) alone; assigning it to a battle releases it, and
   from then on everybody in the campaign reads it – that is not undone.
   A released scenario may still be corrected, but not taken out. Plans and
   ideas around a scenario stay in the Background. Writing needs the
   connection. */
import { useId, useState } from 'react';
import { ApiError, errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import { Actions, FormSheet, RemoveForm, useSaving, type Removing } from '../ui/FormSheet.tsx';
import { copyText } from '../ui/files.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { LIMITS, putScenario, releaseScenario, removeScenario, staleScenario, ttsText, type Scenario, type ScenarioList } from './api.ts';
import styles from './Scenarios.module.css';
import { useScenarios } from './useScenarios.ts';

/** Why a write was refused, in words for a leader: the stale case is not the server's wording. */
const explain = (e: unknown): string => {
  if (staleScenario(e)) return 'Another leader changed this scenario while you were editing it. Close this, look at it again and redo your change.';
  if (e instanceof ApiError && e.code === 'released') return 'This scenario has been released to a battle: it is part of the story now and stays.';
  if (e instanceof ApiError && e.code === 'full') return 'The campaign holds as many scenarios as it can.';
  return '';
};

function ScenarioForm({ edit, close, onSave, titleId, onStale }: {
  edit: Scenario | null; close: () => void; titleId: string; onStale: () => void;
  onSave: (b: { title: string; body: string; npcStatlines: string }) => Promise<void>;
}) {
  const ids = useId();
  const [title, setTitle] = useState(edit?.title ?? '');
  const [body, setBody] = useState(edit?.body ?? '');
  const [statlines, setStatlines] = useState(edit?.npcStatlines ?? '');
  const { busy, error, submit } = useSaving(
    () => onSave({ title: title.trim(), body: body.trim(), npcStatlines: statlines.trim() }), close,
    (e) => { if (staleScenario(e)) onStale(); return explain(e) || errorText(e); },
  );
  const released = edit?.visibility === 'public';
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>{edit ? 'Change the scenario' : 'Write a scenario'}</h2>
      <p className={ui.muted}>
        {released
          ? 'Everyone in the campaign already reads this scenario, viewers too. A correction shows to everybody; the earlier wording is kept.'
          : '⚑ Only leaders read a draft. It stays hidden until you release it to a battle; then everybody in the campaign reads it.'}
      </p>
      <label className={ui.field} htmlFor={`${ids}-t`}><span>Title</span>
        <input id={`${ids}-t`} className={ui.input} value={title} maxLength={LIMITS.title} autoComplete="off" onChange={(e) => setTitle(e.target.value)} /></label>
      <div className={ui.field}>
        <label htmlFor={`${ids}-b`}>Rules</label>
        <textarea id={`${ids}-b`} className={`${ui.textarea} ${ui.writing}`} rows={8} value={body} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className={ui.field}>
        <label htmlFor={`${ids}-s`}>NPC statlines (optional)</label>
        <textarea id={`${ids}-s`} className={`${ui.textarea} ${ui.writing}`} rows={5} value={statlines} maxLength={LIMITS.statlines} onChange={(e) => setStatlines(e.target.value)} />
        <small className={ui.muted}>Profiles and rules the way the Tabletop Simulator export writes them – the players copy them to the table.</small>
      </div>
      <Actions busy={busy} ok={!!title.trim()} label="Save" close={close} error={error} />
    </form>
  );
}

function ReleaseForm({ s, battles, close, onRelease, titleId }: {
  s: Scenario; battles: { id: string; label: string }[]; close: () => void; titleId: string; onRelease: (battleId: string) => Promise<void>;
}) {
  const ids = useId();
  const [battle, setBattle] = useState('');
  const { busy, error, submit } = useSaving(() => onRelease(battle), close, (e) => explain(e) || errorText(e));
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>Release {s.title}</h2>
      <p className={ui.muted}>
        Assigning the scenario to a battle makes it public: everybody in the campaign reads its rules and its NPC statlines, viewers too.
        This cannot be undone. A released scenario can still be corrected, but not taken out.
      </p>
      <label className={ui.field} htmlFor={`${ids}-b`}><span>Played in</span>
        <select id={`${ids}-b`} className={ui.select} value={battle} required onChange={(e) => setBattle(e.target.value)}>
          <option value="">Choose a battle…</option>
          {battles.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select></label>
      {battles.length === 0 && <p className={ui.muted}>The campaign has no battle yet. Open one first; a scenario is released to the battle it is played in.</p>}
      <Actions busy={busy} ok={!!battle} label="Release" close={close} error={error} />
    </form>
  );
}

function Card({ s, lead, online, battleLabel, onEdit, onRelease, onRemove, onCopy }: {
  s: Scenario; lead: boolean; online: boolean; battleLabel: string;
  onEdit: () => void; onRelease: () => void; onRemove: () => void; onCopy: () => void;
}) {
  const draft = s.visibility === 'leader';
  return (
    <li>
      <article className={`${ui.card} ${styles.card} ${draft ? styles.draft : ''}`} aria-label={draft ? `Draft: ${s.title}` : s.title}>
        <h3>{s.title}</h3>
        {draft
          ? <p className={styles.secret}>⚑ Draft – only leaders read it</p>
          : <p className={styles.meta}>Played in {battleLabel}{s.releasedBy ? ` · released by ${s.releasedBy}` : ''}{s.edited ? ' · corrected since' : ''}</p>}
        {s.body && (
          <details className={styles.more}>
            <summary>Rules</summary>
            <p className={styles.text}>{s.body}</p>
          </details>
        )}
        {s.npcStatlines && (
          <details className={styles.more}>
            <summary>NPC statlines</summary>
            <pre className={styles.statline}>{s.npcStatlines}</pre>
          </details>
        )}
        <div className={ui.row}>
          {s.npcStatlines && <button type="button" className={ui.buttonQuiet} aria-label={`Copy the statlines of ${s.title}`} onClick={onCopy}>Copy statlines</button>}
          {lead && <button type="button" className={ui.buttonQuiet} aria-label={`Change ${s.title}`} disabled={!online} onClick={onEdit}>Change</button>}
          {lead && draft && <button type="button" className={ui.button} aria-label={`Release ${s.title} to a battle`} disabled={!online} onClick={onRelease}>Release</button>}
          {lead && draft && <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${s.title}`} disabled={!online} onClick={onRemove}>Remove</button>}
        </div>
      </article>
    </li>
  );
}

export function Scenarios({ id, view, lead }: { id: string; view: CampaignView; lead: boolean }) {
  const { data, setData, error, reload } = useScenarios(id);
  const online = useOnline();
  const [notice, notify] = useNotice();
  const editSheet = useSheet();
  const releaseSheet = useSheet();
  const removeSheet = useSheet();
  const [editing, setEditing] = useState<{ key: number; edit: Scenario | null } | null>(null);
  const [releasing, setReleasing] = useState<{ key: number; s: Scenario } | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);

  const list: ScenarioList = data ?? { scenarios: [], seq: 0 };
  // a draft belongs to the leaders: a cached list from before a demotion shows none
  const drafts = lead ? list.scenarios.filter((s) => s.visibility === 'leader') : [];
  const played = list.scenarios.filter((s) => s.visibility === 'public');
  const battles = [...(view.battles ?? [])].sort((a, b) => b.round - a.round).map((b) => ({ id: b.id, label: battleTitle(b) }));
  const battleLabel = (bid: string | null) => battles.find((b) => b.id === bid)?.label ?? 'a battle';

  /** A write that worked: the list it answers with is the list now. */
  const done = (message: string) => (l: ScenarioList) => { setData(l); notify(message); };
  const openEdit = (edit: Scenario | null) => { setEditing((p) => ({ key: (p?.key ?? 0) + 1, edit })); editSheet.open(); };
  const openRelease = (s: Scenario) => { setReleasing((p) => ({ key: (p?.key ?? 0) + 1, s })); releaseSheet.open(); };
  const askRemove = (s: Scenario) => {
    setRemoving((p) => ({ key: (p?.key ?? 0) + 1, title: `Remove ${s.title}?`, text: 'Only you could read this draft. It is taken out for good.', run: () => removeScenario(id, s.id).then(done('Draft removed.')) }));
    removeSheet.open();
  };
  const copy = (s: Scenario) => { void copyText(ttsText(s)).then((ok) => notify(ok ? 'Statlines copied.' : 'Copying is not possible here. Open the statlines and select the text.')); };

  return (
    <section className={styles.section} aria-labelledby="sc-title">
      <h2 id="sc-title">Scenarios</h2>
      <p className={ui.muted}>
        {lead
          ? '⚑ A draft is read by the leaders alone. Assign it to a battle to release it: from then on everybody in the campaign reads it, and that cannot be undone. Plans and ideas stay in the Background.'
          : 'The scenarios the campaign has played: their rules and the values of the NPCs in them.'}
      </p>
      {error && <p className={ui.message} role="status">{error}{data ? ' Shown as last seen.' : ''}</p>}
      {lead && (
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={!online} onClick={() => openEdit(null)}>Write a scenario</button>
        </div>
      )}
      {data && drafts.length === 0 && played.length === 0 && <p className={ui.muted}>{lead ? 'No scenario yet.' : 'No scenario has been played yet.'}</p>}
      {drafts.length > 0 && (
        <>
          <p className={styles.group}>Drafts</p>
          <ul className={styles.cards} aria-label="Drafts">
            {drafts.map((s) => <Card key={s.id} s={s} lead={lead} online={online} battleLabel="" onEdit={() => openEdit(s)} onRelease={() => openRelease(s)} onRemove={() => askRemove(s)} onCopy={() => copy(s)} />)}
          </ul>
        </>
      )}
      {played.length > 0 && (
        <>
          {drafts.length > 0 && <p className={styles.group}>Played</p>}
          <ul className={styles.cards} aria-label="Played scenarios">
            {played.map((s) => <Card key={s.id} s={s} lead={lead} online={online} battleLabel={battleLabel(s.playedInBattle)} onEdit={() => openEdit(s)} onRelease={() => undefined} onRemove={() => undefined} onCopy={() => copy(s)} />)}
          </ul>
        </>
      )}

      <FormSheet dialogRef={editSheet.ref}>
        {(titleId) => editing && (
          <ScenarioForm key={editing.key} titleId={titleId} edit={editing.edit} close={() => editSheet.close()} onStale={reload}
            onSave={(b) => putScenario(id, editing.edit?.id ?? newId(), b, editing.edit?.seq ?? 0).then(done(editing.edit ? 'Saved.' : 'Draft saved. Only leaders see it.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={releaseSheet.ref}>
        {(titleId) => releasing && (
          <ReleaseForm key={releasing.key} titleId={titleId} s={releasing.s} battles={battles} close={() => releaseSheet.close()}
            onRelease={(battleId) => releaseScenario(id, releasing.s.id, battleId).then(done('Released. Everybody in the campaign reads it now.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={removeSheet.ref}>
        {(titleId) => removing && <RemoveForm key={removing.key} titleId={titleId} r={removing} close={() => removeSheet.close()} />}
      </FormSheet>
      {notice}
    </section>
  );
}

/* The scenarios of a campaign (phase 4b3c; concept.md 4.9): a leaders' own
   playable package – the rules and the values of the NPCs in it, in the text
   form of the Tabletop Simulator export. A draft is read by the leaders
   (with the authenticator) alone; assigning it to a battle releases it, and
   from then on everybody in the campaign reads it – that is not undone.
   A released scenario may still be corrected, but not taken out. Plans and
   ideas around a scenario stay in the Background. The NPCs of a scenario come
   after it exists (a leader's form of their own); what a leader hides of one
   reads "?" for the players (ADR 0022). Writing needs the connection. */
import { lazy, Suspense, useId, useState } from 'react';
import type { OpponentTemplate, ScenarioNpc } from '@mordheim/core';
import { ApiError, errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import type { WarbandRef } from '../opponents/ProfileTools.tsx';
import { Actions, FormSheet, RemoveForm, useSaving, type Removing } from '../ui/FormSheet.tsx';
import { copyText } from '../ui/files.ts';
import { useNotice } from '../ui/Notice.tsx';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { frozenProblem, LIMITS, putScenario, releaseScenario, removeScenario, staleScenario, ttsText, type Scenario, type ScenarioList } from './api.ts';
import { NpcView } from './NpcView.tsx';
import styles from './Scenarios.module.css';
import { useScenarios } from './useScenarios.ts';

const ScenarioNpcsForm = lazy(() => import('./ScenarioNpcs.tsx').then((m) => ({ default: m.ScenarioNpcsForm })));

/** Why a write was refused, in words for a leader: the stale case is not the server's wording. */
const explain = (e: unknown): string => {
  if (staleScenario(e)) return 'Another leader changed this scenario while you were editing it. Close this, look at it again and redo your change.';
  if (e instanceof ApiError && e.code === 'released') return 'This scenario has been released to a battle: it is part of the story now and stays.';
  if (e instanceof ApiError && e.code === 'full') return 'The campaign holds as many scenarios as it can.';
  const frozen = frozenProblem(e);
  if (frozen) return `The players have already read this scenario: ${frozen}.`;
  return '';
};

function ScenarioForm({ edit, close, onSave, titleId, onStale }: {
  edit: Scenario | null; close: () => void; titleId: string; onStale: () => void;
  onSave: (b: { title: string; body: string; npcStatlines: string; npcs: ScenarioNpc[] }) => Promise<void>;
}) {
  const ids = useId();
  const [title, setTitle] = useState(edit?.title ?? '');
  const [body, setBody] = useState(edit?.body ?? '');
  const [statlines, setStatlines] = useState(edit?.npcStatlines ?? '');
  const { busy, error, submit } = useSaving(
    () => onSave({ title: title.trim(), body: body.trim(), npcStatlines: statlines.trim(), npcs: edit?.npcs ?? [] }), close,
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
        <small className={ui.muted}>Anything the NPC form cannot hold, the way the Tabletop Simulator export writes it. Players read it whole – hide nothing here. NPCs with values and “?” for hidden parts: save the scenario, then use “Add NPCs”.</small>
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

function Card({ s, lead, online, battleLabel, onEdit, onNpcs, onRelease, onRemove, onCopy, onCopied }: {
  s: Scenario; lead: boolean; online: boolean; battleLabel: string;
  onEdit: () => void; onNpcs: () => void; onRelease: () => void; onRemove: () => void; onCopy: () => void; onCopied: (what: string) => void;
}) {
  const draft = s.visibility === 'leader';
  const copyable = !!s.npcStatlines.trim() || s.npcs.length > 0;
  return (
    <li>
      <article className={`${ui.card} ${styles.card} ${draft ? styles.draft : ''}`} aria-label={draft ? `Draft: ${s.title}` : s.title}>
        <h3>{s.title}</h3>
        {draft
          ? <p className={styles.secret}>⚑ Draft – only leaders read it</p>
          : <p className={styles.meta}>Played in {battleLabel}{s.releasedBy ? ` · released by ${s.releasedBy}` : ''}{s.edited ? ' · corrected since' : ''}</p>}
        {s.body && (
          <details className={styles.more}>
            <summary className={ui.fold}>Rules</summary>
            <p className={styles.text}>{s.body}</p>
          </details>
        )}
        {s.npcs.length > 0 && (
          <>
            <p className={styles.group}>NPCs</p>
            <ul className={styles.npcs} aria-label={`NPCs of ${s.title}`}>
              {s.npcs.map((n) => <NpcView key={n.id} n={n} lead={lead} onCopied={onCopied} />)}
            </ul>
          </>
        )}
        {s.npcStatlines && (
          <details className={styles.more}>
            <summary className={ui.fold}>NPC statlines</summary>
            <pre className={styles.statline}>{s.npcStatlines}</pre>
          </details>
        )}
        <div className={ui.row}>
          {copyable && <button type="button" className={ui.buttonQuiet} aria-label={`Copy the statlines of ${s.title}`} onClick={onCopy}>Copy statlines</button>}
          {lead && <button type="button" className={ui.buttonQuiet} aria-label={`Change ${s.title}`} disabled={!online} onClick={onEdit}>Change</button>}
          {lead && <button type="button" className={ui.buttonQuiet} aria-label={`${s.npcs.length > 0 ? 'Change' : 'Add'} the NPCs of ${s.title}`} disabled={!online} onClick={onNpcs}>{s.npcs.length > 0 ? 'Change NPCs' : 'Add NPCs'}</button>}
          {lead && draft && <button type="button" className={ui.button} aria-label={`Release ${s.title} to a battle`} disabled={!online} onClick={onRelease}>Release</button>}
          {lead && draft && <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${s.title}`} disabled={!online} onClick={onRemove}>Remove</button>}
        </div>
      </article>
    </li>
  );
}

export function Scenarios({ id, view, lead, warbands = [], templates = [] }: {
  id: string; view: CampaignView; lead: boolean; /** the warbands whose warriors an NPC can be copied from, and the NPCs of the world as models */ warbands?: WarbandRef[]; templates?: OpponentTemplate[];
}) {
  const { data, setData, error, reload } = useScenarios(id);
  const online = useOnline();
  const [notice, notify] = useNotice();
  const editSheet = useSheet();
  const releaseSheet = useSheet();
  const removeSheet = useSheet();
  const npcSheet = useSheet();
  const [npcsOf, setNpcsOf] = useState<{ key: number; s: Scenario } | null>(null);
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
  const openNpcs = (s: Scenario) => { setNpcsOf((p) => ({ key: (p?.key ?? 0) + 1, s })); npcSheet.open(); };
  const openRelease = (s: Scenario) => { setReleasing((p) => ({ key: (p?.key ?? 0) + 1, s })); releaseSheet.open(); };
  const askRemove = (s: Scenario) => {
    setRemoving((p) => ({ key: (p?.key ?? 0) + 1, title: `Remove ${s.title}?`, text: 'Only you could read this draft. It is taken out for good.', run: () => removeScenario(id, s.id).then(done('Draft removed.')) }));
    removeSheet.open();
  };
  const copy = (s: Scenario) => { void copyText(ttsText(s)).then((ok) => notify(ok ? 'Statlines copied.' : 'Copying is not possible here. Open the statlines and select the text.')); };
  const copied = (what: string) => notify(what ? `${what} copied.` : 'Copying is not possible here: the text is selected, copy it yourself.');

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
      {data && drafts.length === 0 && played.length === 0 && <Empty scene="battle" title={lead ? 'No scenario yet.' : 'No scenario has been played yet.'} />}
      {drafts.length > 0 && (
        <>
          <p className={styles.group}>Drafts</p>
          <ul className={styles.cards} aria-label="Drafts">
            {drafts.map((s) => <Card key={s.id} s={s} lead={lead} online={online} battleLabel="" onEdit={() => openEdit(s)} onNpcs={() => openNpcs(s)} onRelease={() => openRelease(s)} onRemove={() => askRemove(s)} onCopy={() => copy(s)} onCopied={copied} />)}
          </ul>
        </>
      )}
      {played.length > 0 && (
        <>
          {drafts.length > 0 && <p className={styles.group}>Played</p>}
          <ul className={styles.cards} aria-label="Played scenarios">
            {played.map((s) => <Card key={s.id} s={s} lead={lead} online={online} battleLabel={battleLabel(s.playedInBattle)} onEdit={() => openEdit(s)} onNpcs={() => openNpcs(s)} onRelease={() => undefined} onRemove={() => undefined} onCopy={() => copy(s)} onCopied={copied} />)}
          </ul>
        </>
      )}

      <FormSheet dialogRef={editSheet.ref}>
        {(titleId) => editing && (
          <ScenarioForm key={editing.key} titleId={titleId} edit={editing.edit} close={() => editSheet.close()} onStale={reload}
            onSave={(b) => putScenario(id, editing.edit?.id ?? newId(), b, editing.edit?.seq ?? 0).then(done(editing.edit ? 'Saved.' : 'Draft saved. Only leaders see it.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={npcSheet.ref} wide>
        {(titleId) => npcsOf && (
          <Suspense fallback={<p className={ui.muted}>Loading the NPC form…</p>}>
            <ScenarioNpcsForm key={npcsOf.key} titleId={titleId} cid={id} s={npcsOf.s} others={list.scenarios.filter((x) => x.id !== npcsOf.s.id && x.npcs.length > 0)}
              templates={templates} warbands={warbands} close={() => npcSheet.close()} onStale={reload}
              onSave={(npcs) => putScenario(id, npcsOf.s.id, { title: npcsOf.s.title, body: npcsOf.s.body, npcStatlines: npcsOf.s.npcStatlines, npcs }, npcsOf.s.seq).then(done('NPCs saved.'))} />
          </Suspense>
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

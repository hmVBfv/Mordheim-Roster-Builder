/* Opponents (Background tab, leaders only): the men and beasts a leader sets
   against the warbands, in groups. A profile is copied from any model of the
   game – every warband, the Hired Swords, the Dramatis Personae, the
   bestiary, the warriors of the campaign as they stand – or written from
   nothing, and then changed at will: name, characteristics, save, skills
   (from the game's lists, the campaign's own skills with their tooltip, or
   typed in), equipment, special rules. Each profile is a Tabletop Simulator
   card. Rob, 19.10.2026: always leaders only. Writing needs the connection;
   reading works from what the device kept. */
import * as core from '@mordheim/core';
import type { OpponentProfile } from '@mordheim/core';
import { Suspense, useEffect, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { cachedCampaign } from '../campaign/api.ts';
import { putGroup as keepGroup, withoutRefs } from '../library/api.ts';
import { newId } from '../db/ids.ts';
import { Card } from '../roster/TtsCard.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedOpponents, getOpponents, MAX_PROFILES, putGroup, putSkill, removeGroup, removeSkill, staleOf, type Group, type Opponents, type OwnSkill } from './api.ts';
import styles from './Opponents.module.css';
import { GroupsFromLibrary } from './GroupsFromLibrary.tsx';
import { ProfileEditor, TemplatePicker, statline, type WarbandRef } from './ProfileTools.tsx';

export type { WarbandRef };



/** `compact`: the game night's own panel – the groups only; the campaign's own skills stay with the Background tab. */
export function OpponentsSection({ id, warbands, notify, compact = false }: { id: string; warbands: WarbandRef[]; notify: (text: string) => void; compact?: boolean }) {
  const online = useOnline();
  const [data, setData] = useState<Opponents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ref: groupRef, open: openGroup, close: closeGroup } = useSheet();
  const { ref: ttsRef, open: openTts, close: closeTts } = useSheet();
  const { ref: skillRef, open: openSkill, close: closeSkill } = useSheet();
  const { ref: libRef, open: openLib, close: closeLib } = useSheet();
  const [libKey, setLibKey] = useState(0);
  const [editing, setEditing] = useState<{ group: Group | null; key: number } | null>(null);
  const [tts, setTts] = useState<Group | null>(null);
  const [skill, setSkill] = useState<{ skill: OwnSkill | null; key: number } | null>(null);

  useEffect(() => {
    let live = true;
    void cachedOpponents(id).then((c) => { if (live && c) setData((cur) => cur ?? c); });
    getOpponents(id).then((o) => { if (live) { setData(o); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);
  const refresh = () => { void cachedOpponents(id).then((c) => { if (c) setData(c); }); };

  const groups = data?.groups ?? [];
  const skills = data?.skills ?? [];
  return (
    <section className={ui.page} aria-labelledby="opp-title">
      <h2 id="opp-title" className={styles.title}>Opponents{compact ? ' ⚑' : ''}</h2>
      <p className={ui.muted}>{compact
        ? '⚑ Only leaders see this. Set an opponent against the warbands while the battle runs: copy a profile from any model of the game or write your own; every profile is a Tabletop Simulator card.'
        : 'The men and beasts you set against the warbands, in groups. Copy a profile from any model of the game or write your own; every profile is a Tabletop Simulator card. Only leaders see them.'}</p>
      {error && <p className={ui.message} role="status">{error}{data ? ' Shown as last seen.' : ''}</p>}
      {!data && !error && <p className={ui.muted}>Loading the opponents…</p>}
      {data && groups.length === 0 && <p className={ui.muted}>No group yet.</p>}
      <ul className={styles.groups} aria-label="Opponent groups">
        {groups.map((g) => (
          <li key={g.id} className={styles.group}>
            <h3>{g.name}</h3>
            {g.note && <p className={styles.note}>{g.note}</p>}
            <ul className={styles.profiles} aria-label={`Profiles of ${g.name}`}>
              {g.profiles.map((p) => (
                <li key={p.id}>
                  <strong>{p.name || 'Unnamed'}{p.count > 1 ? ` ×${p.count}` : ''}</strong> <small className={styles.meta}>{p.type}</small>
                  <code className={styles.line}>{statline(p)}</code>
                  {p.skills.length > 0 && <small className={styles.meta}>{p.skills.map((s) => s.name).join(', ')}</small>}
                </li>
              ))}
              {g.profiles.length === 0 && <li className={ui.muted}>No profile yet.</li>}
            </ul>
            <div className={ui.row}>
              <button type="button" className={ui.buttonQuiet} aria-label={`Edit ${g.name}`} onClick={() => { setEditing((e) => ({ group: g, key: (e?.key ?? 0) + 1 })); openGroup(); }}>Edit</button>
              <button type="button" className={ui.buttonQuiet} aria-label={`Save ${g.name} to your Library`} disabled={!online}
                onClick={() => { keepGroup(newId(), g.name, { note: g.note, profiles: withoutRefs(g.profiles) }).then(() => notify('Saved to your Library.')).catch((e: unknown) => notify(errorText(e))); }}>Save to Library</button>
              <button type="button" className={ui.buttonQuiet} aria-label={`Tabletop Simulator cards of ${g.name}`} disabled={g.profiles.length === 0} onClick={() => { setTts(g); openTts(); }}>Tabletop Simulator</button>
            </div>
          </li>
        ))}
      </ul>
      <div className={ui.row}>
        <button type="button" className={ui.button} onClick={() => { setEditing((e) => ({ group: null, key: (e?.key ?? 0) + 1 })); openGroup(); }}>New group</button>
        <button type="button" className={ui.buttonQuiet} disabled={!online} onClick={() => { setLibKey((k) => k + 1); openLib(); }}>Groups from the Library…</button>
      </div>

      {!compact && (
        <>
        <h3 className={styles.sub}>Our own skills</h3>
        <p className={ui.muted}>Skills the game does not have, with the text a card shows for them. They can be added to any profile.</p>
        {data && skills.length === 0 && <p className={ui.muted}>No skill of our own yet.</p>}
        <ul className={styles.skills} aria-label="Our own skills">
          {skills.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              {s.text && <span className={styles.meta}>{s.text}</span>}
              <button type="button" className={ui.buttonQuiet} aria-label={`Edit the skill ${s.name}`} onClick={() => { setSkill((k) => ({ skill: s, key: (k?.key ?? 0) + 1 })); openSkill(); }}>Edit</button>
            </li>
          ))}
        </ul>
        <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => { setSkill((k) => ({ skill: null, key: (k?.key ?? 0) + 1 })); openSkill(); }}>New skill</button></div>

        </>
      )}

      <dialog ref={groupRef} className={ui.sheet} aria-labelledby="opp-group-title">
        {editing && (
          <GroupForm key={editing.key} cid={id} warbands={warbands} group={editing.group} skills={skills} online={online} close={closeGroup}
            onSkill={refresh}
            onSaved={(g, gone) => { refresh(); notify(gone ? `“${g.name}” taken out.` : `“${g.name}” saved. Only leaders see it.`); }} />
        )}
      </dialog>
      <dialog ref={libRef} className={ui.sheet} aria-labelledby="opp-library-title">
        {libKey > 0 && (
          <GroupsFromLibrary key={libKey} close={closeLib} here={groups.map((g) => g.name)}
            onAdd={async (g) => {
              await putGroup(id, newId(), { name: g.name, note: g.body.note, profiles: withoutRefs(g.body.profiles).map((p) => ({ ...p, id: newId() })) }, 0);
              refresh();
              notify(`“${g.name}” added from your Library. Only leaders see it.`);
            }} />
        )}
      </dialog>
      <dialog ref={ttsRef} className={ui.sheet} aria-labelledby="opp-tts-title">
        {tts && <TtsCards group={tts} close={closeTts} />}
      </dialog>
      <dialog ref={skillRef} className={ui.sheet} aria-labelledby="opp-skill-title">
        {skill && (
          <SkillForm key={skill.key} cid={id} skill={skill.skill} online={online} close={closeSkill}
            onSaved={(text) => { refresh(); notify(text); }} />
        )}
      </dialog>
    </section>
  );
}

function TtsCards({ group, close }: { group: Group; close: () => void }) {
  const [note, setNote] = useState('');
  const [opened, setOpened] = useState<Set<string>>(() => new Set(group.profiles.length === 1 ? [group.profiles[0]!.id] : []));
  const setOpen = (pid: string, on: boolean) => setOpened((cur) => { const n = new Set(cur); if (on) n.add(pid); else n.delete(pid); return n; });
  return (
    <div className={ui.page}>
      <h2 id="opp-tts-title">{group.name} · Tabletop Simulator</h2>
      <p className={ui.muted}>Two fields for each profile, each copied on its own into the model’s Name and Description.</p>
      <div className={styles.cards}>
        {group.profiles.map((p) => (
          <Card key={p.id} open={opened.has(p.id)} onOpen={(on) => setOpen(p.id, on)} onCopied={(w) => setNote(w ? `${w} copied.` : 'Copying is not possible here: the text is selected, copy it yourself.')}
            c={{ id: `tts-opp-${p.id}`, label: `${p.name || 'Unnamed'}${p.count > 1 ? ` ×${p.count}` : ''}`, group: null, name: core.ttsOpponentName(p), text: core.ttsOpponentText(p) }} />
        ))}
      </div>
      <p className={ui.muted} role="status" aria-live="polite">{note}</p>
      <div className={ui.actions}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
    </div>
  );
}

function SkillForm({ cid, skill, online, close, onSaved }: { cid: string; skill: OwnSkill | null; online: boolean; close: (then?: () => void) => void; onSaved: (text: string) => void }) {
  const ids = useId();
  const [name, setName] = useState(skill?.name ?? '');
  const [text, setText] = useState(skill?.text ?? '');
  const [base, setBase] = useState(skill?.seq ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sid = useMemo(() => skill?.id ?? newId(), [skill]);
  const save = async () => {
    setBusy(true); setError(null);
    try { const s = await putSkill(cid, sid, { name: name.trim(), text }, base); close(() => onSaved(`Skill “${s.name}” saved.`)); } catch (e) {
      const cur = staleOf<OwnSkill>(e);
      if (cur) { setBase(cur.seq); setError(`${cur.updatedBy} changed this skill meanwhile (“${cur.name}”). Save again to replace it with yours.`); } else setError(errorText(e));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!skill) return;
    setBusy(true); setError(null);
    try { await removeSkill(cid, skill.id); close(() => onSaved(`Skill “${skill.name}” taken out. Profiles that have it keep their copy.`)); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2 id="opp-skill-title">{skill ? `The skill ${skill.name}` : 'A skill of our own'}</h2>
      <div className={ui.field}><label htmlFor={`${ids}-n`}>Name</label><input id={`${ids}-n`} className={ui.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-t`}>What it does (the tooltip)</label><textarea id={`${ids}-t`} className={ui.textarea} rows={4} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></div>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving needs the connection.</p>}
      <div className={ui.actions}>
        {skill && <button type="button" className={ui.buttonQuiet} disabled={busy || !online} onClick={() => void remove()}>Take it out</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="submit" className={ui.button} disabled={busy || !online || !name.trim()}>Save the skill</button>
      </div>
    </form>
  );
}

function GroupForm({ cid, warbands, group, skills, online, close, onSaved, onSkill }: {
  cid: string; warbands: WarbandRef[]; group: Group | null; skills: OwnSkill[]; online: boolean; close: (then?: () => void) => void;
  onSaved: (g: { name: string }, gone?: boolean) => void; onSkill: () => void;
}) {
  const ids = useId();
  const gid = useMemo(() => group?.id ?? newId(), [group]);
  const [name, setName] = useState(group?.name ?? '');
  const [note, setNote] = useState(group?.note ?? '');
  const [profiles, setProfiles] = useState<OpponentProfile[]>(group?.profiles ?? []);
  const [fresh, setFresh] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [own, setOwn] = useState(skills);
  const [base, setBase] = useState(group?.seq ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = profiles.length >= MAX_PROFILES;
  const add = (p: OpponentProfile) => { setProfiles((cur) => [...cur, p]); setFresh(p.id); };
  const ownChanged = () => { onSkill(); void cachedOpponents(cid).then((c) => { if (c) setOwn(c.skills); }); };

  const save = async () => {
    if (!name.trim()) { setError('Give the group a name.'); return; }
    setBusy(true); setError(null);
    try { const g = await putGroup(cid, gid, { name: name.trim(), note, profiles }, base); close(() => onSaved(g)); } catch (e) {
      const cur = staleOf<Group>(e);
      if (cur) { setBase(cur.seq); setError(`${cur.updatedBy} changed this group meanwhile. Save again to replace their version with yours, or cancel to see theirs.`); } else setError(errorText(e));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!group) return;
    setBusy(true); setError(null);
    try { await removeGroup(cid, group.id); close(() => onSaved(group, true)); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2 id="opp-group-title">{group ? `Edit ${group.name}` : 'New group of opponents'}</h2>
      <p className={ui.muted}>⚑ Only leaders see this.</p>
      <div className={ui.field}><label htmlFor={`${ids}-n`}>Group name</label><input id={`${ids}-n`} className={ui.input} value={name} maxLength={120} placeholder="The ferrymen of the Stir" onChange={(e) => setName(e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-no`}>Note</label><textarea id={`${ids}-no`} className={ui.textarea} rows={2} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} /></div>
      <h3 className={styles.sub}>Profiles</h3>
      {profiles.length === 0 && <p className={ui.muted}>No profile yet: copy one from the game, or write your own.</p>}
      <div className={styles.editors}>
        {profiles.map((p, i) => (
          <ProfileEditor key={p.id} cid={cid} p={p} own={own} open={fresh === p.id} onOwn={ownChanged}
            onChange={(x) => setProfiles((cur) => cur.map((y, j) => (j === i ? x : y)))}
            onRemove={() => setProfiles((cur) => cur.filter((_, j) => j !== i))} />
        ))}
      </div>
      {full && <p className={ui.muted}>A group holds at most {MAX_PROFILES} profiles.</p>}
      {picking && !full && <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}><TemplatePicker cid={cid} warbands={warbands} onClose={() => setPicking(false)} onPick={(t) => add(core.profileFrom(newId(), t))} /></Suspense>}
      {!picking && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => setPicking(true)}>Copy a model from the game…</button>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => add(core.profileFrom(newId(), null))}>Write your own</button>
        </div>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving needs the connection.</p>}
      <div className={ui.actions}>
        {group && <button type="button" className={ui.buttonQuiet} disabled={busy || !online} onClick={() => void remove()}>Take the group out</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="submit" className={ui.button} disabled={busy || !online}>Save the group</button>
      </div>
    </form>
  );
}

/** The panel on the game night's page: every warband of the campaign can be copied from, as far as the device knows them; else the fighters. */
export function BattleOpponents({ cid, fighters, notify }: { cid: string; fighters: WarbandRef[]; notify: (text: string) => void }) {
  const [all, setAll] = useState<WarbandRef[] | null>(null);
  useEffect(() => {
    let live = true;
    void cachedCampaign(cid).then((v) => {
      if (live && v) setAll(v.enrolments.filter((e) => e.status === 'active').map((e) => ({ id: e.warbandId, name: e.name || e.wbName })));
    });
    return () => { live = false; };
  }, [cid]);
  return <OpponentsSection id={cid} warbands={all ?? fighters} notify={notify} compact />;
}

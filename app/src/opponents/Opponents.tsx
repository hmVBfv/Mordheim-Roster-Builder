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
import type { OpponentProfile, OpponentSkill, OpponentTemplate, StatKey, TemplateKind } from '@mordheim/core';
import { Suspense, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { readWarband, type CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import { useGameData } from '../game/useGameData.ts';
import { Card } from '../roster/TtsCard.tsx';
import { readSave } from '../sync/engine.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedOpponents, getOpponents, MAX_PROFILES, putGroup, putSkill, removeGroup, removeSkill, staleOf, type Group, type Opponents, type OwnSkill } from './api.ts';
import styles from './Opponents.module.css';

const STATS = core.OPPONENT_STATS;
const KINDS: TemplateKind[] = ['unit', 'hired', 'dramatis', 'beast', 'warrior'];
const KIND_LABEL: Record<TemplateKind, string> = { unit: 'Warbands', hired: 'Hired Swords', dramatis: 'Dramatis Personae', beast: 'Bestiary', warrior: 'Our warriors' };
const TYPES = ['Hero', 'Henchman', 'Hired Sword', 'Dramatis Persona', 'Animal', 'Monster'];
const SHOWN = 40;

const statline = (p: Pick<OpponentProfile, 'profile' | 'sv'>) => `${STATS.map((k) => `${k} ${(p.profile[k] ?? '').trim() || '-'}`).join(' ')} Sv ${p.sv.trim() || '-'}`;

export function OpponentsSection({ id, view, notify }: { id: string; view: CampaignView; notify: (text: string) => void }) {
  const online = useOnline();
  const [data, setData] = useState<Opponents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ref: groupRef, open: openGroup, close: closeGroup } = useSheet();
  const { ref: ttsRef, open: openTts, close: closeTts } = useSheet();
  const { ref: skillRef, open: openSkill, close: closeSkill } = useSheet();
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
      <h2 id="opp-title" className={styles.title}>Opponents</h2>
      <p className={ui.muted}>The men and beasts you set against the warbands, in groups. Copy a profile from any model of the game or write your own; every profile is a Tabletop Simulator card. Only leaders see them.</p>
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
              <button type="button" className={ui.buttonQuiet} aria-label={`Tabletop Simulator cards of ${g.name}`} disabled={g.profiles.length === 0} onClick={() => { setTts(g); openTts(); }}>Tabletop Simulator</button>
            </div>
          </li>
        ))}
      </ul>
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => { setEditing((e) => ({ group: null, key: (e?.key ?? 0) + 1 })); openGroup(); }}>New group</button></div>

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

      <dialog ref={groupRef} className={ui.sheet} aria-labelledby="opp-group-title">
        {editing && (
          <GroupForm key={editing.key} cid={id} view={view} group={editing.group} skills={skills} online={online} close={closeGroup}
            onSkill={refresh}
            onSaved={(g, gone) => { refresh(); notify(gone ? `“${g.name}” taken out.` : `“${g.name}” saved. Only leaders see it.`); }} />
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
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
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
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || !online || !name.trim()}>Save the skill</button>
        {skill && <button type="button" className={ui.buttonQuiet} disabled={busy || !online} onClick={() => void remove()}>Take it out</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/** The warriors of the campaign's warbands as templates, read when first asked for. */
function useWarriors(cid: string, view: CampaignView, want: boolean) {
  const data = useGameData();
  const [list, setList] = useState<OpponentTemplate[] | null>(null);
  const [missing, setMissing] = useState(0);
  useEffect(() => {
    if (!want || list) return;
    let live = true;
    const active = view.enrolments.filter((e) => e.status === 'active');
    void Promise.all(active.map(async (e) => {
      const w = await readWarband(cid, e.warbandId).catch(() => null);
      const s = w ? readSave(data, w.head.data) : null;
      return s ? core.warriorTemplates(core.ctxOf(data, s), e.warbandId, e.name || e.wbName) : null;
    })).then((r) => { if (live) { setList(r.flatMap((x) => x ?? [])); setMissing(r.filter((x) => !x).length); } });
    return () => { live = false; };
  }, [cid, view, want, list, data]);
  return { list, missing };
}

function TemplatePicker({ cid, view, onPick, onClose }: { cid: string; view: CampaignView; onPick: (t: OpponentTemplate) => void; onClose: () => void }) {
  const ids = useId();
  const data = useGameData();
  const all = useMemo(() => core.opponentTemplates(data), [data]);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<TemplateKind[]>([]);
  const warriors = useWarriors(cid, view, kinds.length === 0 || kinds.includes('warrior'));
  const q = useDeferredValue(query);
  const found = useMemo(() => core.searchTemplates([...(warriors.list ?? []), ...all], q, kinds), [all, warriors.list, q, kinds]);
  const toggle = (k: TemplateKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  return (
    <div className={styles.picker} role="group" aria-label="Copy a model">
      <div className={ui.field}>
        <label htmlFor={`${ids}-q`}>Search every model</label>
        <input id={`${ids}-q`} className={ui.input} type="search" value={query} placeholder="ogre, captain, wolf, Skaven …" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className={styles.kinds} role="group" aria-label="Only">
        {KINDS.map((k) => <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      {(kinds.length === 0 || kinds.includes('warrior')) && !warriors.list && <p className={ui.muted}>Reading the campaign’s warbands…</p>}
      {warriors.missing > 0 && <p className={ui.muted}>{warriors.missing} warband{warriors.missing === 1 ? '' : 's'} could not be read.</p>}
      <p className={ui.muted} role="status">{found.length.toLocaleString('en')} found{found.length > SHOWN ? `, the first ${SHOWN} shown – search to narrow it` : ''}.</p>
      <ul className={styles.found} aria-label="Models found">
        {found.slice(0, SHOWN).map((t) => (
          <li key={`${t.kind}:${t.key}`}>
            <span><strong>{t.name}</strong>{t.count > 1 ? ` ×${t.count}` : ''} <small className={styles.meta}>{t.type} · {t.source}{t.grade && t.kind !== 'warrior' ? ` · ${t.grade}` : ''}</small></span>
            <code className={styles.line}>{statline(t)}</code>
            <button type="button" className={ui.buttonQuiet} aria-label={`Add ${t.name} (${t.source})`} onClick={() => onPick(t)}>Add</button>
          </li>
        ))}
      </ul>
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={onClose}>Done adding</button></div>
    </div>
  );
}

function SkillAdder({ cid, own, onAdd, onOwn, onClose }: { cid: string; own: OwnSkill[]; onAdd: (s: OpponentSkill) => void; onOwn: () => void; onClose: () => void }) {
  const ids = useId();
  const data = useGameData();
  const online = useOnline();
  const catalog = useMemo(() => [...own.map((s) => ({ list: 'Our own skills', name: s.name, text: s.text, ref: s.id })), ...core.skillCatalog(data)], [own, data]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useDeferredValue(query);
  const found = useMemo(() => (q.trim() ? core.searchSkills(catalog, q).slice(0, 20) : catalog.filter((s) => s.list === 'Our own skills')), [catalog, q]);
  const write = async () => {
    const skill: OpponentSkill = { name: name.trim(), text: text.trim() };
    if (!skill.name) return;
    setError(null);
    if (keep) {
      try { const s = await putSkill(cid, newId(), skill, 0); skill.ref = s.id; onOwn(); } catch (e) { setError(errorText(e)); return; }
    }
    onAdd(skill);
    setName(''); setText(''); setKeep(false);
  };
  return (
    <div className={styles.picker} role="group" aria-label="Add a skill">
      <div className={ui.field}>
        <label htmlFor={`${ids}-q`}>Find a skill</label>
        <input id={`${ids}-q`} className={ui.input} type="search" value={query} placeholder="Step Aside, Mighty Blow, our own …" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className={styles.found} aria-label="Skills found">
        {found.map((s) => (
          <li key={`${s.list}:${s.name}`}>
            <span><strong>{s.name}</strong> <small className={styles.meta}>{s.list}</small></span>
            {s.text && <small className={styles.meta}>{s.text.length > 160 ? `${s.text.slice(0, 160)}…` : s.text}</small>}
            <button type="button" className={ui.buttonQuiet} aria-label={`Add the skill ${s.name}`} onClick={() => onAdd({ name: s.name, text: s.text, ...('ref' in s && s.ref ? { ref: s.ref as string } : {}) })}>Add</button>
          </li>
        ))}
      </ul>
      <fieldset className={styles.write}>
        <legend>Or write one in</legend>
        <div className={ui.field}><label htmlFor={`${ids}-n`}>Skill name</label><input id={`${ids}-n`} className={ui.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
        <div className={ui.field}><label htmlFor={`${ids}-t`}>Tooltip (optional)</label><textarea id={`${ids}-t`} className={ui.textarea} rows={2} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></div>
        <label className={styles.check}><input type="checkbox" checked={keep} disabled={!online} onChange={(e) => setKeep(e.target.checked)} /><span>Keep it among our own skills</span></label>
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} disabled={!name.trim()} onClick={() => void write()}>Add this skill</button>
          <button type="button" className={ui.buttonQuiet} onClick={onClose}>Done</button>
        </div>
      </fieldset>
    </div>
  );
}

function ProfileEditor({ cid, p, own, open, onChange, onRemove, onOwn }: {
  cid: string; p: OpponentProfile; own: OwnSkill[]; open: boolean; onChange: (p: OpponentProfile) => void; onRemove: () => void; onOwn: () => void;
}) {
  const ids = useId();
  const [adding, setAdding] = useState(false);
  const set = <K extends keyof OpponentProfile>(k: K, v: OpponentProfile[K]) => onChange({ ...p, [k]: v });
  const setStat = (k: StatKey, v: string) => onChange({ ...p, profile: { ...p.profile, [k]: v } });
  return (
    <details className={styles.editor} open={open}>
      <summary><strong>{p.name || 'New profile'}</strong>{p.count > 1 ? ` ×${p.count}` : ''} <small className={styles.meta}>{p.type}</small></summary>
      {p.from && <p className={styles.meta}>Copied from {p.from.label}</p>}
      <div className={styles.head}>
        <div className={ui.field}><label htmlFor={`${ids}-n`}>Name</label><input id={`${ids}-n`} className={ui.input} value={p.name} maxLength={120} onChange={(e) => set('name', e.target.value)} /></div>
        <div className={ui.field}><label htmlFor={`${ids}-ty`}>Type</label><input id={`${ids}-ty`} className={ui.input} list={`${ids}-types`} value={p.type} maxLength={60} onChange={(e) => set('type', e.target.value)} />
          <datalist id={`${ids}-types`}>{TYPES.map((t) => <option key={t} value={t} />)}</datalist></div>
        <div className={ui.field}><label htmlFor={`${ids}-c`}>How many</label><input id={`${ids}-c`} className={ui.input} type="number" inputMode="numeric" min={1} max={50} value={p.count} onChange={(e) => set('count', Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))} /></div>
      </div>
      <fieldset className={styles.stats}>
        <legend>Characteristics</legend>
        {STATS.map((k) => (
          <label key={k} className={styles.stat}><span>{k}</span><input className={ui.input} value={p.profile[k] ?? ''} maxLength={12} aria-label={`${k} of ${p.name || 'the profile'}`} onChange={(e) => setStat(k, e.target.value)} /></label>
        ))}
        <label className={styles.stat}><span>Sv</span><input className={ui.input} value={p.sv} maxLength={12} placeholder="-" aria-label={`Save of ${p.name || 'the profile'}`} onChange={(e) => set('sv', e.target.value)} /></label>
      </fieldset>
      <div className={ui.field}>
        <span>Skills</span>
        <ul className={styles.chips} aria-label={`Skills of ${p.name || 'the profile'}`}>
          {p.skills.map((s, i) => (
            <li key={`${i}:${s.name}`} title={s.text || undefined}>
              <span>{s.name}</span>
              <button type="button" aria-label={`Take ${s.name} away`} onClick={() => set('skills', p.skills.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
          {p.skills.length === 0 && <li className={ui.muted}>None.</li>}
        </ul>
        {!adding && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => setAdding(true)}>Add a skill</button></div>}
        {adding && <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}><SkillAdder cid={cid} own={own} onOwn={onOwn} onClose={() => setAdding(false)} onAdd={(s) => { if (!p.skills.some((x) => x.name === s.name)) set('skills', [...p.skills, s]); }} /></Suspense>}
      </div>
      <div className={ui.field}><label htmlFor={`${ids}-e`}>Equipment</label><textarea id={`${ids}-e`} className={ui.textarea} rows={2} value={p.equipment} maxLength={2000} onChange={(e) => set('equipment', e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-r`}>Special rules (one per line)</label><textarea id={`${ids}-r`} className={ui.textarea} rows={4} value={p.rules} maxLength={6000} onChange={(e) => set('rules', e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-no`}>Note (not on the card)</label><textarea id={`${ids}-no`} className={ui.textarea} rows={2} value={p.note} maxLength={4000} onChange={(e) => set('note', e.target.value)} /></div>
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={onRemove}>Take this profile out of the group</button></div>
    </details>
  );
}

function GroupForm({ cid, view, group, skills, online, close, onSaved, onSkill }: {
  cid: string; view: CampaignView; group: Group | null; skills: OwnSkill[]; online: boolean; close: (then?: () => void) => void;
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
      {picking && !full && <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}><TemplatePicker cid={cid} view={view} onClose={() => setPicking(false)} onPick={(t) => add(core.profileFrom(newId(), t))} /></Suspense>}
      {!picking && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => setPicking(true)}>Copy a model from the game…</button>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => add(core.profileFrom(newId(), null))}>Write your own</button>
        </div>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving needs the connection.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || !online}>Save the group</button>
        {group && <button type="button" className={ui.buttonQuiet} disabled={busy || !online} onClick={() => void remove()}>Take the group out</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

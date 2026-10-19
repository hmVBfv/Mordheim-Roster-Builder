/* The tools a profile is made with (Opponents, and the NPCs of the world and
   of scenarios): copying a model from the game, the campaign's warriors or
   other NPCs; adding a skill from the game's lists, the campaign's own or
   typed in; and the editor of one profile's values. */
import * as core from '@mordheim/core';
import type { OpponentProfile, OpponentSkill, OpponentTemplate, StatKey, TemplateKind } from '@mordheim/core';
import { Suspense, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { readWarband } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import { useGameData } from '../game/useGameData.ts';
import { readSave } from '../sync/engine.ts';
import ui from '../ui/ui.module.css';
import { putSkill, type OwnSkill } from './api.ts';
import styles from './Opponents.module.css';

const STATS = core.OPPONENT_STATS;
const KINDS: TemplateKind[] = ['unit', 'hired', 'dramatis', 'beast', 'warrior', 'npc'];
const KIND_LABEL: Record<TemplateKind, string> = { unit: 'Warbands', hired: 'Hired Swords', dramatis: 'Dramatis Personae', beast: 'Bestiary', warrior: 'Our warriors', npc: 'NPCs' };
const TYPES = ['Hero', 'Henchman', 'Hired Sword', 'Dramatis Persona', 'Animal', 'Monster'];
const SHOWN = 40;

/** A warband of the campaign whose warriors can be copied: its id and the name it plays under. */
export interface WarbandRef { id: string; name: string }

export const statline = (p: Pick<OpponentProfile, 'profile' | 'sv'>) => `${STATS.map((k) => `${k} ${(p.profile[k] ?? '').trim() || '-'}`).join(' ')} Sv ${p.sv.trim() || '-'}`;

/** The warriors of the campaign's warbands as templates, read when first asked for. */
function useWarriors(cid: string, warbands: WarbandRef[], want: boolean) {
  const data = useGameData();
  const [list, setList] = useState<OpponentTemplate[] | null>(null);
  const [missing, setMissing] = useState(0);
  useEffect(() => {
    if (!want || list) return;
    let live = true;
    void Promise.all(warbands.map(async (e) => {
      const w = await readWarband(cid, e.id).catch(() => null);
      const s = w ? readSave(data, w.head.data) : null;
      return s ? core.warriorTemplates(core.ctxOf(data, s), e.id, e.name) : null;
    })).then((r) => { if (live) { setList(r.flatMap((x) => x ?? [])); setMissing(r.filter((x) => !x).length); } });
    return () => { live = false; };
  }, [cid, warbands, want, list, data]);
  return { list, missing };
}

/** `extra`: more to copy from than the game and the campaign's warriors – the NPCs of the world and of scenarios. */
export function TemplatePicker({ cid, warbands, extra = [], verb = 'Add', done = 'Done adding', onPick, onClose }: {
  cid: string; warbands: WarbandRef[]; extra?: OpponentTemplate[]; /** the button of every hit and the one that closes the picker */ verb?: string; done?: string; onPick: (t: OpponentTemplate) => void; onClose: () => void;
}) {
  const ids = useId();
  const data = useGameData();
  const all = useMemo(() => core.opponentTemplates(data), [data]);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<TemplateKind[]>([]);
  const warriors = useWarriors(cid, warbands, kinds.length === 0 || kinds.includes('warrior'));
  const q = useDeferredValue(query);
  const found = useMemo(() => core.searchTemplates([...extra, ...(warriors.list ?? []), ...all], q, kinds), [all, extra, warriors.list, q, kinds]);
  const toggle = (k: TemplateKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  return (
    <div className={styles.picker} role="group" aria-label="Copy a model">
      <div className={ui.field}>
        <label htmlFor={`${ids}-q`}>Search every model</label>
        <input id={`${ids}-q`} className={ui.input} type="search" value={query} placeholder="ogre, captain, wolf, Skaven …" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className={styles.kinds} role="group" aria-label="Only">
        {KINDS.filter((k) => k !== 'npc' || extra.length > 0).map((k) => <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      {(kinds.length === 0 || kinds.includes('warrior')) && !warriors.list && <p className={ui.muted}>Reading the campaign’s warbands…</p>}
      {warriors.missing > 0 && <p className={ui.muted}>{warriors.missing} warband{warriors.missing === 1 ? '' : 's'} could not be read.</p>}
      <p className={ui.muted} role="status">{found.length.toLocaleString('en')} found{found.length > SHOWN ? `, the first ${SHOWN} shown – search to narrow it` : ''}.</p>
      <ul className={styles.found} aria-label="Models found">
        {found.slice(0, SHOWN).map((t) => (
          <li key={`${t.kind}:${t.key}`}>
            <span><strong>{t.name}</strong>{t.count > 1 ? ` ×${t.count}` : ''} <small className={styles.meta}>{t.type} · {t.source}{t.grade && t.kind !== 'warrior' ? ` · ${t.grade}` : ''}</small></span>
            <code className={styles.line}>{statline(t)}</code>
            <button type="button" className={ui.buttonQuiet} aria-label={`${verb} ${t.name} (${t.source})`} onClick={() => onPick(t)}>{verb}</button>
          </li>
        ))}
      </ul>
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={onClose}>{done}</button></div>
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

/** `bare`: the values of one person, not a profile of a group – no name, number or note, no folding, nothing to take out; the name is the form's.
    `locked`: parts that cannot be changed – a characteristic by its key (`WS`), the save (`sv`), `skills`, `equipment`, `rules`, and `name` for the type
    (a scenario's NPC once its hidden values were released: ADR 0022). */
export function ProfileEditor({ cid, p, own, open, bare = false, locked = [], onChange, onRemove, onOwn }: {
  cid: string; p: OpponentProfile; own: OwnSkill[]; open?: boolean; bare?: boolean; locked?: readonly string[]; onChange: (p: OpponentProfile) => void; onRemove?: () => void; onOwn: () => void;
}) {
  const ids = useId();
  const [adding, setAdding] = useState(false);
  const fixed = (k: string) => locked.includes(k);
  const set = <K extends keyof OpponentProfile>(k: K, v: OpponentProfile[K]) => onChange({ ...p, [k]: v });
  const setStat = (k: StatKey, v: string) => onChange({ ...p, profile: { ...p.profile, [k]: v } });
  const Wrap = bare ? 'div' : 'details';
  return (
    <Wrap className={bare ? styles.bare : styles.editor} {...(bare ? {} : { open })}>
      {!bare && <summary><strong>{p.name || 'New profile'}</strong>{p.count > 1 ? ` ×${p.count}` : ''} <small className={styles.meta}>{p.type}</small></summary>}
      {p.from && <p className={styles.meta}>Copied from {p.from.label}</p>}
      <div className={styles.head}>
        {!bare && <div className={ui.field}><label htmlFor={`${ids}-n`}>Name</label><input id={`${ids}-n`} className={ui.input} value={p.name} maxLength={120} onChange={(e) => set('name', e.target.value)} /></div>}
        <div className={ui.field}><label htmlFor={`${ids}-ty`}>Type</label><input id={`${ids}-ty`} className={ui.input} list={`${ids}-types`} value={p.type} maxLength={60} disabled={fixed('name')} onChange={(e) => set('type', e.target.value)} />
          <datalist id={`${ids}-types`}>{TYPES.map((t) => <option key={t} value={t} />)}</datalist></div>
        {!bare && <div className={ui.field}><label htmlFor={`${ids}-c`}>How many</label><input id={`${ids}-c`} className={ui.input} type="number" inputMode="numeric" min={1} max={50} value={p.count} onChange={(e) => set('count', Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))} /></div>}
      </div>
      <fieldset className={styles.stats}>
        <legend>Characteristics</legend>
        {STATS.map((k) => (
          <label key={k} className={styles.stat}><span>{k}</span><input className={ui.input} value={p.profile[k] ?? ''} maxLength={12} disabled={fixed(k)} aria-label={`${k} of ${p.name || 'the profile'}`} onChange={(e) => setStat(k, e.target.value)} /></label>
        ))}
        <label className={styles.stat}><span>Sv</span><input className={ui.input} value={p.sv} maxLength={12} placeholder="-" disabled={fixed('sv')} aria-label={`Save of ${p.name || 'the profile'}`} onChange={(e) => set('sv', e.target.value)} /></label>
      </fieldset>
      <div className={ui.field}>
        <span>Skills</span>
        <ul className={styles.chips} aria-label={`Skills of ${p.name || 'the profile'}`}>
          {p.skills.map((s, i) => (
            <li key={`${i}:${s.name}`} title={s.text || undefined}>
              <span>{s.name}</span>
              <button type="button" aria-label={`Take ${s.name} away`} disabled={fixed('skills')} onClick={() => set('skills', p.skills.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
          {p.skills.length === 0 && <li className={`${ui.muted} ${styles.none}`}>None.</li>}
        </ul>
        {!adding && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={fixed('skills')} onClick={() => setAdding(true)}>Add a skill</button></div>}
        {adding && <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}><SkillAdder cid={cid} own={own} onOwn={onOwn} onClose={() => setAdding(false)} onAdd={(s) => { if (!p.skills.some((x) => x.name === s.name)) set('skills', [...p.skills, s]); }} /></Suspense>}
      </div>
      <div className={ui.field}><label htmlFor={`${ids}-e`}>Equipment</label><textarea id={`${ids}-e`} className={ui.textarea} rows={2} value={p.equipment} maxLength={2000} disabled={fixed('equipment')} onChange={(e) => set('equipment', e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-r`}>Special rules (one per line)</label><textarea id={`${ids}-r`} className={ui.textarea} rows={4} value={p.rules} maxLength={6000} disabled={fixed('rules')} onChange={(e) => set('rules', e.target.value)} /></div>
      {!bare && <div className={ui.field}><label htmlFor={`${ids}-no`}>Note (not on the card)</label><textarea id={`${ids}-no`} className={ui.textarea} rows={2} value={p.note} maxLength={4000} onChange={(e) => set('note', e.target.value)} /></div>}
      {!bare && onRemove && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={onRemove}>Take this profile out of the group</button></div>}
    </Wrap>
  );
}


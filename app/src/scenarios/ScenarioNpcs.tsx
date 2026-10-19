/* The NPCs of a scenario (ADR 0022), a leader's form, opened from the scenario
   once it exists: a new NPC with the grid of characteristics, a copy from any
   model of the game or an NPC of the world, or one brought along from another
   scenario – an NPC that turns up again. Each NPC has the parts the leader
   keeps from the players: the name, single characteristics or all of them,
   the save, skills, equipment, rules. The players read a "?" there, in the
   scenario and in the Tabletop Simulator copy. A released scenario still takes
   NPCs and corrections, but what the players have seen may only be revealed,
   never changed or hidden after the fact. Loaded when the form opens. */
import { useEffect, useId, useRef, useState } from 'react';
import {
  emptyScenarioNpc, normalizeHidden, npcAsOpponent, redactNpc, releasedChangeProblem, revealedBy, scenarioNpcFrom, STAT_PARTS,
  type Hidable, type OpponentProfile, type OpponentTemplate, type ScenarioNpc,
} from '@mordheim/core';
import { newId } from '../db/ids.ts';
import { cachedOpponents, getOpponents, type OwnSkill } from '../opponents/api.ts';
import { ProfileEditor, TemplatePicker, type WarbandRef } from '../opponents/ProfileTools.tsx';
import { Actions, useSaving } from '../ui/FormSheet.tsx';
import ui from '../ui/ui.module.css';
import { errorText } from '../account/api.ts';
import { frozenProblem, MAX_NPCS, staleScenario, type Scenario } from './api.ts';
import { hiddenWords, NpcStats } from './NpcView.tsx';
import styles from './Scenarios.module.css';

/** The campaign's own skills, as far as the device knows them, then as the server has them. */
function useOwnSkills(cid: string) {
  const [own, setOwn] = useState<OwnSkill[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void cachedOpponents(cid).then((c) => { if (live && c) setOwn(c.skills); });
    if (tick === 0) getOpponents(cid).then((o) => { if (live) setOwn(o.skills); }).catch(() => undefined);
    return () => { live = false; };
  }, [cid, tick]);
  return { own, changed: () => setTick((t) => t + 1) };
}

const ONLY_STATS: readonly Hidable[] = STAT_PARTS;
const OTHER_PARTS: { key: Hidable; label: string }[] = [
  { key: 'skills', label: 'Skills' }, { key: 'equipment', label: 'Equipment' }, { key: 'rules', label: 'Special rules' },
];

/** The checkboxes of what the players do not read: the name, every characteristic by itself or all of them, skills, equipment, rules.
    `fixed`: the NPC was already read by the players – only what was hidden then may be switched, back and forth until it is saved. */
function HideParts({ n, fixed, onChange }: { n: ScenarioNpc; fixed: readonly Hidable[] | null; onChange: (hidden: Hidable[]) => void }) {
  const all = useRef<HTMLInputElement>(null);
  const who = n.name.trim() || 'this NPC';
  const has = (k: Hidable) => n.hidden.includes(k);
  const free = (k: Hidable) => fixed === null || fixed.includes(k);
  const set = (keys: readonly Hidable[], on: boolean) => onChange(normalizeHidden(on ? [...new Set([...n.hidden, ...keys])] : n.hidden.filter((k) => !keys.includes(k))));
  const count = ONLY_STATS.filter(has).length;
  const everyStat = count === ONLY_STATS.length;
  const statsFree = ONLY_STATS.every(free);
  useEffect(() => { if (all.current) all.current.indeterminate = count > 0 && !everyStat; }, [count, everyStat]);
  const chip = (k: Hidable, label: string, aria: string) => (
    <label key={k} className={`${styles.chip} ${has(k) ? styles.chipOn : ''} ${free(k) ? '' : styles.chipOff}`}>
      <input type="checkbox" checked={has(k)} disabled={!free(k)} aria-label={aria} onChange={(e) => set([k], e.target.checked)} />
      <span>{label}</span>
    </label>
  );
  return (
    <fieldset className={styles.hide}>
      <legend>Hide from the players</legend>
      <p className={ui.muted}>A hidden part reads “?” in the scenario and in the Tabletop Simulator copy. You always read all of it.</p>
      <div className={styles.chips}>{chip('name', 'Name', `Hide the name of ${who}`)}</div>
      <div className={styles.chips} role="group" aria-label={`Characteristics of ${who}`}>
        <label className={`${styles.chip} ${styles.chipAll} ${everyStat ? styles.chipOn : ''} ${statsFree ? '' : styles.chipOff}`}>
          <input ref={all} type="checkbox" checked={everyStat} disabled={!statsFree} aria-label={`Hide all stats of ${who}`} onChange={(e) => set(ONLY_STATS, e.target.checked)} />
          <span>All stats</span>
        </label>
        {ONLY_STATS.map((k) => chip(k, k === 'sv' ? 'Sv' : k, `Hide ${k === 'sv' ? 'the save' : k} of ${who}`))}
      </div>
      <div className={styles.chips}>{OTHER_PARTS.map((o) => chip(o.key, o.label, `Hide the ${o.label.toLowerCase()} of ${who}`))}</div>
    </fieldset>
  );
}

/** One NPC: its name, what is hidden, its values. */
function NpcBlock({ cid, n, before, released, open, own, onOwn, onChange, onRemove }: {
  cid: string; n: ScenarioNpc; /** the NPC as it is saved, or null for one that is new */ before: ScenarioNpc | null; released: boolean; open: boolean;
  own: OwnSkill[]; onOwn: () => void; onChange: (n: ScenarioNpc) => void; onRemove: () => void;
}) {
  const ids = useId();
  // once the players have read the NPC, what was hidden then is fixed (only revealed), and nothing else is hidden after the fact
  const fixed = released && before ? before.hidden : null;
  const revealed = before ? (revealedBy([before], [n])[0]?.parts ?? []) : [];
  const stays = released && before !== null && before.hidden.length > 0;
  const asOpponent = npcAsOpponent(n.name, n);
  const set = (p: OpponentProfile) => onChange({ ...n, type: p.type, profile: p.profile, sv: p.sv, skills: p.skills, equipment: p.equipment, rules: p.rules, from: p.from });
  const preview = redactNpc(n);
  return (
    <details className={styles.block} open={open}>
      <summary><strong>{n.name.trim() || 'New NPC'}</strong>{n.hidden.length > 0 && <small className={styles.secret}> ⚑ {n.hidden.length} hidden</small>}</summary>
      <div className={styles.blockBody}>
        <div className={styles.blockSide}>
          <div className={ui.field}>
            <label htmlFor={`${ids}-n`}>Name of the NPC</label>
            <input id={`${ids}-n`} className={ui.input} value={n.name} maxLength={120} autoComplete="off" disabled={fixed?.includes('name') ?? false} onChange={(e) => onChange({ ...n, name: e.target.value })} />
          </div>
          <HideParts n={n} fixed={fixed} onChange={(hidden) => onChange({ ...n, hidden })} />
          <div className={styles.preview}>
            <p className={styles.group}>As the players read it</p>
            <p className={styles.previewName}><strong>{preview.name || '…'}</strong>{preview.type ? <small> {preview.type}</small> : null}</p>
            <NpcStats n={preview} marked={false} />
          </div>
          {fixed && fixed.length > 0 && <p className={ui.muted}>The players have read this NPC with {hiddenWords(fixed)} hidden. Those values can be shown, not changed.</p>}
          {revealed.length > 0 && <p className={styles.reveal} role="status">⚑ Saving shows {hiddenWords(revealed)} to everybody in the campaign.</p>}
          <div className={ui.row}>
            <button type="button" className={ui.buttonQuiet} aria-label={`Take ${n.name.trim() || 'this NPC'} out`} disabled={stays} onClick={onRemove}>Take out</button>
            {stays && <small className={ui.muted}>It has hidden parts and stays in a released scenario – show them first, then it can go.</small>}
          </div>
        </div>
        <div className={styles.blockMain}>
          <ProfileEditor bare cid={cid} p={asOpponent} own={own} locked={fixed ?? []} onChange={set} onOwn={onOwn} />
        </div>
      </div>
    </details>
  );
}

export function ScenarioNpcsForm({ cid, s, others, templates, warbands, close, titleId, onSave, onStale }: {
  cid: string; s: Scenario; /** the other scenarios, whose NPCs can be brought along */ others: Scenario[];
  /** the NPCs of the world as models to copy */ templates: OpponentTemplate[]; warbands: WarbandRef[];
  close: () => void; titleId: string; onSave: (npcs: ScenarioNpc[]) => Promise<void>; onStale: () => void;
}) {
  const ids = useId();
  const { own, changed } = useOwnSkills(cid);
  const [npcs, setNpcs] = useState<ScenarioNpc[]>(s.npcs);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [bring, setBring] = useState('');
  const released = s.visibility === 'public';
  const problem = released ? releasedChangeProblem(s.npcs, npcs) : null;
  const named = npcs.every((n) => n.name.trim());
  const full = npcs.length >= MAX_NPCS;
  const { busy, error, submit } = useSaving(
    () => onSave(npcs.map((n) => ({ ...n, name: n.name.trim(), hidden: normalizeHidden(n.hidden) }))), close,
    (e) => { if (staleScenario(e)) onStale(); const f = frozenProblem(e); return f ? `The players have already read this scenario: ${f}.` : errorText(e); },
  );

  const add = (n: ScenarioNpc) => { setNpcs((cur) => [...cur, n]); setFresh(n.id); };
  const fromModel = (t: OpponentTemplate) => { add(scenarioNpcFrom(newId(), t)); setCopying(false); };
  const broughtAlong = others.flatMap((o) => o.npcs.map((n) => ({ key: `${o.id}/${n.id}`, label: `${n.name} · ${o.title}`, n })));
  const bringIn = () => {
    const found = broughtAlong.find((b) => b.key === bring);
    if (!found) return;
    add({ ...structuredClone(found.n), id: newId(), hidden: normalizeHidden(found.n.hidden) });
    setBring('');
  };

  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>NPCs of {s.title}</h2>
      <p className={ui.muted}>
        {released
          ? 'The players already read this scenario. You can add NPCs and correct what they may read; what you hid from them can be shown, not changed.'
          : '⚑ A draft: only leaders read it. Tick what the players must not read yet – they see “?” in its place, also in the Tabletop Simulator copy. Hidden parts can be shown after the battle.'}
      </p>
      <div className={styles.addRow}>
        <button type="button" className={ui.button} disabled={full} onClick={() => add(emptyScenarioNpc(newId()))}>New NPC</button>
        <button type="button" className={ui.buttonQuiet} disabled={full} aria-expanded={copying} onClick={() => setCopying((c) => !c)}>Copy from a model…</button>
        {broughtAlong.length > 0 && (
          <span className={styles.bring}>
            <label htmlFor={`${ids}-b`} className={ui.muted}>Bring along from another scenario</label>
            <select id={`${ids}-b`} className={ui.select} value={bring} disabled={full} onChange={(e) => setBring(e.target.value)}>
              <option value="">Choose an NPC…</option>
              {broughtAlong.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
            <button type="button" className={ui.buttonQuiet} disabled={!bring || full} onClick={bringIn}>Bring along</button>
          </span>
        )}
      </div>
      {full && <p className={ui.muted} role="status">A scenario holds at most {MAX_NPCS} NPCs.</p>}
      {copying && <TemplatePicker cid={cid} warbands={warbands} extra={templates} verb="Copy" done="Close" onPick={fromModel} onClose={() => setCopying(false)} />}
      {npcs.length === 0 && <p className={ui.message}>No NPC yet. Start a new one, or copy a model of the game, an NPC of the world or one from another scenario.</p>}
      <div className={styles.blocks}>
        {npcs.map((n) => (
          <NpcBlock key={n.id} cid={cid} n={n} before={s.npcs.find((x) => x.id === n.id) ?? null} released={released} open={n.id === fresh || npcs.length <= 3}
            own={own} onOwn={changed} onChange={(x) => setNpcs((cur) => cur.map((y) => (y.id === x.id ? x : y)))} onRemove={() => setNpcs((cur) => cur.filter((y) => y.id !== n.id))} />
        ))}
      </div>
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}.</p>}
      <Actions busy={busy} ok={named && !problem} label="Save NPCs" close={close} error={error} />
    </form>
  );
}

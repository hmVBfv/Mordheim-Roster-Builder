/* The world of a campaign (phase 4b3b; concept.md 4.9): the factions, the
   people around them and what each warband has earned with each faction.
   Mechanics are open, so everybody in the campaign reads all of it, viewers
   too; a leader (with the authenticator) writes. What only a leader may know
   about an NPC stays in the Background – a leader puts an NPC here when the
   players may know it exists. Writing needs the connection. */
import { lazy, Suspense, useId, useState } from 'react';
import { npcAsOpponent, OPPONENT_STATS, ttsOpponentName, ttsOpponentText, type NpcProfile, type OpponentTemplate } from '@mordheim/core';
import { useOnline } from '../app/SyncState.tsx';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import notes from '../notes/Notes.module.css';
import { Scenarios } from '../scenarios/Scenarios.tsx';
import { useNotice } from '../ui/Notice.tsx';
import { Actions, FormSheet, RemoveForm, useSaving, type Removing } from '../ui/FormSheet.tsx';
import { Empty } from '../art/Pixels.tsx';
import { CopyField } from '../roster/TtsCard.tsx';
import type { WarbandRef } from '../opponents/ProfileTools.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { addReputation, LIMITS, nameOf, otherName, putFaction, putNpc, removeFaction, removeNpc, removeReputation, signed, standings, type Faction, type Npc, type ReputationEvent, type World } from './api.ts';
import { bodyOf, draftOf, npcTemplates, type NpcDraft } from './npcDraft.ts';
import { useWorld } from './useWorld.ts';
import styles from './World.module.css';

const NpcFields = lazy(() => import('./NpcFields.tsx').then((m) => ({ default: m.NpcFields })));

type Option = { id: string; label: string };

const PUBLIC = 'Everyone in the campaign reads this, viewers too. What only the leaders may know belongs in the Background.';

function FactionForm({ edit, close, onSave, titleId }: { edit: Faction | null; close: () => void; onSave: (b: { nameDe: string; nameEn: string; publicStatus: string }) => Promise<void>; titleId: string }) {
  const ids = useId();
  const [nameEn, setNameEn] = useState(edit?.nameEn ?? '');
  const [nameDe, setNameDe] = useState(edit?.nameDe ?? '');
  const [status, setStatus] = useState(edit?.publicStatus ?? '');
  const { busy, error, submit } = useSaving(() => onSave({ nameEn: nameEn.trim(), nameDe: nameDe.trim(), publicStatus: status.trim() }), close);
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>{edit ? 'Change the faction' : 'Add a faction'}</h2>
      <p className={ui.muted}>{PUBLIC}</p>
      <label className={ui.field} htmlFor={`${ids}-en`}><span>Name (English)</span>
        <input id={`${ids}-en`} className={ui.input} value={nameEn} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setNameEn(e.target.value)} /></label>
      <label className={ui.field} htmlFor={`${ids}-de`}><span>Name (German)</span>
        <input id={`${ids}-de`} className={ui.input} value={nameDe} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setNameDe(e.target.value)} /></label>
      <label className={ui.field} htmlFor={`${ids}-st`}><span>Status everyone may read</span>
        <input id={`${ids}-st`} className={ui.input} value={status} maxLength={LIMITS.status} placeholder="holds the Stir crossing" autoComplete="off" onChange={(e) => setStatus(e.target.value)} /></label>
      <Actions busy={busy} ok={!!(nameEn.trim() || nameDe.trim())} label="Save" close={close} error={error} />
    </form>
  );
}

export interface NpcSave { factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string; named: boolean; profile: NpcProfile | null }

function NpcForm({ cid, edit, factions, templates, warbands, close, onSave, titleId }: {
  cid: string; edit: Npc | null; factions: Faction[]; templates: OpponentTemplate[]; warbands: WarbandRef[]; close: () => void; titleId: string;
  onSave: (b: NpcSave) => Promise<void>;
}) {
  const ids = useId();
  const [faction, setFaction] = useState(edit?.factionId ?? '');
  const [nameEn, setNameEn] = useState(edit?.nameEn ?? '');
  const [nameDe, setNameDe] = useState(edit?.nameDe ?? '');
  const [status, setStatus] = useState(edit?.publicStatus ?? '');
  const [named, setNamed] = useState(edit?.named ?? false);
  const [draft, setDraft] = useState<NpcDraft>(() => draftOf(edit));
  const { busy, error, submit } = useSaving(() => onSave({ factionId: faction || null, nameEn: nameEn.trim(), nameDe: nameDe.trim(), publicStatus: status.trim(), named, ...bodyOf(draft) }), close);
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>{edit ? 'Change the NPC' : 'Add an NPC'}</h2>
      <p className={ui.muted}>{PUBLIC} Add a person only when the players may know they exist.</p>
      <label className={ui.field} htmlFor={`${ids}-f`}><span>Faction</span>
        <select id={`${ids}-f`} className={ui.select} value={faction} onChange={(e) => setFaction(e.target.value)}>
          <option value="">No faction</option>
          {factions.map((f) => <option key={f.id} value={f.id}>{nameOf(f)}</option>)}
        </select></label>
      <label className={ui.field} htmlFor={`${ids}-en`}><span>Name (English)</span>
        <input id={`${ids}-en`} className={ui.input} value={nameEn} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setNameEn(e.target.value)} /></label>
      <label className={ui.field} htmlFor={`${ids}-de`}><span>Name (German)</span>
        <input id={`${ids}-de`} className={ui.input} value={nameDe} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setNameDe(e.target.value)} /></label>
      <label className={ui.field} htmlFor={`${ids}-st`}><span>Status everyone may read</span>
        <input id={`${ids}-st`} className={ui.input} value={status} maxLength={LIMITS.status} placeholder="alive · dead · now leads the Watch" autoComplete="off" onChange={(e) => setStatus(e.target.value)} /></label>
      <label className={styles.check}>
        <input type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} />
        <span><strong>Named</strong> – a person of its own, not one of a crowd. A thread of the Background can refer to it.</span>
      </label>
      <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
        <NpcFields cid={cid} warbands={warbands} extra={templates} name={nameEn.trim() || nameDe.trim()} draft={draft} onDraft={setDraft}
          onCopied={(from) => { if (!nameEn.trim() && !nameDe.trim()) setNameEn(from); }} />
      </Suspense>
      <Actions busy={busy} ok={!!(nameEn.trim() || nameDe.trim())} label="Save" close={close} error={error} />
    </form>
  );
}

function ReputationForm({ warbands, factions, battles, close, onSave, titleId }: {
  warbands: Option[]; factions: Faction[]; battles: Option[]; close: () => void; titleId: string;
  onSave: (b: { warbandId: string; factionId: string; delta: number; reason: string; battleId: string | null }) => Promise<void>;
}) {
  const ids = useId();
  const [warband, setWarband] = useState('');
  const [faction, setFaction] = useState(factions.length === 1 ? factions[0]!.id : '');
  const [gain, setGain] = useState(true);
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const [battle, setBattle] = useState('');
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n <= LIMITS.step;
  const { busy, error, submit } = useSaving(() => onSave({ warbandId: warband, factionId: faction, delta: gain ? n : -n, reason: reason.trim(), battleId: battle || null }), close);
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>Record reputation</h2>
      <p className={ui.muted}>{PUBLIC} An entry is never edited; a mistake is taken out.</p>
      <label className={ui.field} htmlFor={`${ids}-w`}><span>Warband</span>
        <select id={`${ids}-w`} className={ui.select} value={warband} required onChange={(e) => setWarband(e.target.value)}>
          <option value="">Choose…</option>
          {warbands.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select></label>
      <label className={ui.field} htmlFor={`${ids}-f`}><span>Faction</span>
        <select id={`${ids}-f`} className={ui.select} value={faction} required onChange={(e) => setFaction(e.target.value)}>
          <option value="">Choose…</option>
          {factions.map((f) => <option key={f.id} value={f.id}>{nameOf(f)}</option>)}
        </select></label>
      <fieldset className={notes.who}>
        <legend>What happened to its standing?</legend>
        <label className={`${notes.choice} ${gain ? notes.chosen : ''}`}>
          <input type="radio" name="rep-direction" checked={gain} onChange={() => setGain(true)} /><span>Gains reputation</span>
        </label>
        <label className={`${notes.choice} ${!gain ? notes.chosen : ''}`}>
          <input type="radio" name="rep-direction" checked={!gain} onChange={() => setGain(false)} /><span>Loses reputation</span>
        </label>
      </fieldset>
      <label className={ui.field} htmlFor={`${ids}-n`}><span>By how much (1–{LIMITS.step})</span>
        <input id={`${ids}-n`} className={ui.input} type="number" inputMode="numeric" min={1} max={LIMITS.step} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <div className={ui.field}>
        <label htmlFor={`${ids}-r`}>Why</label>
        <textarea id={`${ids}-r`} className={`${ui.textarea} ${ui.writing}`} rows={3} value={reason} maxLength={LIMITS.reason} required onChange={(e) => setReason(e.target.value)} />
      </div>
      <label className={ui.field} htmlFor={`${ids}-b`}><span>In battle (optional)</span>
        <select id={`${ids}-b`} className={ui.select} value={battle} onChange={(e) => setBattle(e.target.value)}>
          <option value="">No particular battle</option>
          {battles.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select></label>
      <Actions busy={busy} ok={!!warband && !!faction && valid && !!reason.trim()} label="Record" close={close} error={error} />
    </form>
  );
}

/** The characteristics of an NPC in a row, the way the rule book prints them. */
function StatTable({ p, name }: { p: NpcProfile; name: string }) {
  return (
    <div className={styles.statsWrap}>
      <table className={styles.stats} aria-label={`Characteristics of ${name}`}>
        <thead><tr>{OPPONENT_STATS.map((k) => <th key={k} scope="col">{k}</th>)}<th scope="col">Sv</th></tr></thead>
        <tbody><tr>{OPPONENT_STATS.map((k) => <td key={k}>{p.profile[k]?.trim() || '-'}</td>)}<td>{p.sv.trim() || '-'}</td></tr></tbody>
      </table>
    </div>
  );
}

function Person({ n, lead, online, onEdit, onRemove, onCopied }: { n: Npc; lead: boolean; online: boolean; onEdit: () => void; onRemove: () => void; onCopied: (what: string) => void }) {
  const other = otherName(n);
  const p = n.profile;
  const rules = p ? p.rules.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [];
  const card = p ? npcAsOpponent(nameOf(n), p) : null;
  return (
    <li className={`${styles.person} ${n.named ? styles.named : ''}`}>
      <div className={styles.line}>
        <strong>{nameOf(n)}{other && <span className={styles.other}> · {other}</span>}{n.named && <span className={styles.badge}>Named</span>}</strong>
        {n.publicStatus && <small>{n.publicStatus}</small>}
      </div>
      {p && <small>{p.type}</small>}
      {p && <StatTable p={p} name={nameOf(n)} />}
      {p && (p.skills.length > 0 || p.equipment.trim() || rules.length > 0) && (
        <details className={styles.more}>
          <summary>Skills, equipment and rules</summary>
          <div className={styles.rules}>
            {p.skills.length > 0 && <p><strong>Skills:</strong> {p.skills.map((s) => s.name).join(', ')}</p>}
            {p.equipment.trim() && <p><strong>Equipment:</strong> {p.equipment.trim()}</p>}
            {rules.length > 0 && <ul>{rules.map((r, i) => <li key={`${i}:${r}`}>{r}</li>)}</ul>}
          </div>
        </details>
      )}
      {card && (
        <details className={styles.more}>
          <summary>Tabletop Simulator</summary>
          <CopyField label="Name" value={ttsOpponentName(card)} rows={1} onCopied={onCopied} />
          <CopyField label="Description" value={ttsOpponentText(card)} rows={7} onCopied={onCopied} />
        </details>
      )}
      {!p && n.statlineTts && (
        <details className={styles.more}>
          <summary>Statline</summary>
          <pre className={styles.statline}>{n.statlineTts}</pre>
        </details>
      )}
      {lead && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} aria-label={`Change ${nameOf(n)}`} disabled={!online} onClick={onEdit}>Change</button>
          <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${nameOf(n)}`} disabled={!online} onClick={onRemove}>Remove</button>
        </div>
      )}
    </li>
  );
}

const LOG_SHOWN = 30;

export function WorldTab({ id, view, lead }: { id: string; view: CampaignView; lead: boolean }) {
  const { data, setData, error } = useWorld(id);
  const online = useOnline();
  const [notice, notify] = useNotice();
  const factionSheet = useSheet();
  const npcSheet = useSheet();
  const repSheet = useSheet();
  const removeSheet = useSheet();
  const [factionEdit, setFactionEdit] = useState<{ key: number; edit: Faction | null } | null>(null);
  const [npcEdit, setNpcEdit] = useState<{ key: number; edit: Npc | null } | null>(null);
  const [repKey, setRepKey] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [all, setAll] = useState(false);

  const world: World = data ?? { factions: [], npcs: [], reputation: [], seq: 0 };
  const warbands = view.enrolments.filter((e) => e.status === 'active').map((e) => ({ id: e.warbandId, label: `${e.name || e.wbName} · ${e.player}` }));
  const battles = (view.battles ?? []).filter((b) => !b.takenOver).map((b) => ({ id: b.id, label: battleTitle(b) }));
  const loose = world.npcs.filter((n) => !n.factionId);
  const fighters: WarbandRef[] = view.enrolments.filter((e) => e.status === 'active').map((e) => ({ id: e.warbandId, name: e.name || e.wbName }));
  const copied = (what: string) => notify(what ? `${what} copied.` : 'Copying is not possible here: the text is selected, copy it yourself.');

  /** A write that worked: the world it answers with is the world now. */
  const done = (message: string) => (w: World) => { setData(w); notify(message); };
  const askRemove = (title: string, text: string, run: () => Promise<World>, message: string) => {
    setRemoving((p) => ({ key: (p?.key ?? 0) + 1, title, text, run: () => run().then(done(message)) }));
    removeSheet.open();
  };
  const openFaction = (edit: Faction | null) => { setFactionEdit((p) => ({ key: (p?.key ?? 0) + 1, edit })); factionSheet.open(); };
  const openNpc = (edit: Npc | null) => { setNpcEdit((p) => ({ key: (p?.key ?? 0) + 1, edit })); npcSheet.open(); };
  const openRep = () => { setRepKey((k) => (k ?? 0) + 1); repSheet.open(); };

  const removeNpcAsk = (n: Npc) => askRemove(`Remove ${nameOf(n)}?`, 'Everyone in the campaign stops seeing this person.', () => removeNpc(id, n.id), 'NPC removed.');
  const peopleOf = (fid: string | null) => (fid ? world.npcs.filter((n) => n.factionId === fid) : loose);
  const factionName = (fid: string) => { const f = world.factions.find((x) => x.id === fid); return f ? nameOf(f) : ''; };
  const log = all ? world.reputation : world.reputation.slice(0, LOG_SHOWN);
  const battleLabel = (bid: string | null) => battles.find((b) => b.id === bid)?.label ?? '';

  return (
    <div className={ui.page}>
      <section className={styles.section} aria-labelledby="w-title">
        <h2 id="w-title">The world</h2>
        <p className={ui.muted}>
          {lead
            ? '⚑ Everyone in the campaign reads this, viewers too. What only you may know about a person belongs in the Background.'
            : 'The factions of the campaign, the people around them and what each warband has earned with each faction.'}
        </p>
        {error && <p className={ui.message} role="status">{error}{data ? ' Shown as last seen.' : ''}</p>}
        {lead && (
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={!online} onClick={() => openFaction(null)}>Add a faction</button>
            <button type="button" className={ui.buttonQuiet} disabled={!online} onClick={() => openNpc(null)}>Add an NPC</button>
            <button type="button" className={ui.buttonQuiet} disabled={!online || world.factions.length === 0 || warbands.length === 0} onClick={openRep}>Record reputation</button>
          </div>
        )}
        {data && world.factions.length === 0 && loose.length === 0 && <Empty scene="gate" title={lead ? 'Nothing here yet.' : 'The leaders have not made anything of the world public yet.'} />}
      </section>

      {world.factions.length > 0 && (
        <section className={styles.section} aria-labelledby="w-factions">
          <h2 id="w-factions">Factions</h2>
          <div className={styles.cards}>
            {world.factions.map((f) => {
              const stand = standings(world, f.id);
              const people = peopleOf(f.id);
              const other = otherName(f);
              return (
                <article key={f.id} className={`${ui.card} ${styles.card}`} aria-label={nameOf(f)}>
                  <h3>{nameOf(f)}{other && <span className={styles.other}> · {other}</span>}</h3>
                  {f.publicStatus && <p className={styles.status}>{f.publicStatus}</p>}
                  {people.length > 0 && <ul className={styles.list} aria-label={`People of ${nameOf(f)}`}>{people.map((n) => <Person key={n.id} n={n} lead={lead} online={online} onEdit={() => openNpc(n)} onRemove={() => removeNpcAsk(n)} onCopied={copied} />)}</ul>}
                  {stand.length > 0 && (
                    <ul className={styles.list} aria-label={`Standing with ${nameOf(f)}`}>
                      {stand.map((x) => (
                        <li key={x.warbandId} className={styles.standing}>
                          <div className={styles.line}>
                            <span>{x.warband}</span>
                            <span className={`${styles.value} ${x.value > 0 ? styles.up : x.value < 0 ? styles.down : ''}`}>{signed(x.value)}</span>
                          </div>
                          <small>{x.events} {x.events === 1 ? 'entry' : 'entries'}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lead && (
                    <div className={ui.row}>
                      <button type="button" className={ui.buttonQuiet} aria-label={`Change ${nameOf(f)}`} disabled={!online} onClick={() => openFaction(f)}>Change</button>
                      <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${nameOf(f)}`} disabled={!online}
                        onClick={() => askRemove(`Remove ${nameOf(f)}?`, 'Its people stay, without a faction. Its reputation entries leave the view with it.', () => removeFaction(id, f.id), 'Faction removed.')}>Remove</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {loose.length > 0 && (
        <section className={styles.section} aria-labelledby="w-loose">
          <h2 id="w-loose">People without a faction</h2>
          <ul className={`${styles.list} ${styles.columns}`} aria-label="People without a faction">
            {loose.map((n) => <Person key={n.id} n={n} lead={lead} online={online} onEdit={() => openNpc(n)} onRemove={() => removeNpcAsk(n)} onCopied={copied} />)}
          </ul>
        </section>
      )}

      <Scenarios id={id} view={view} lead={lead} warbands={fighters} templates={npcTemplates(world.npcs, world.factions)} />

      {world.reputation.length > 0 && (
        <section className={styles.section} aria-labelledby="w-log">
          <h2 id="w-log">Reputation log</h2>
          <ul className={`${styles.list} ${styles.columns}`} aria-label="Reputation log">
            {log.map((e: ReputationEvent) => (
              <li key={e.id} className={styles.event}>
                <div className={styles.line}>
                  <strong>{e.warband} · {factionName(e.factionId)}</strong>
                  <span className={`${styles.value} ${e.delta > 0 ? styles.up : styles.down}`}>{signed(e.delta)}</span>
                </div>
                <span>{e.reason}</span>
                <small>{battleLabel(e.battleId) ? `${battleLabel(e.battleId)} · ` : ''}recorded by {e.actor}</small>
                {lead && (
                  <div className={ui.row}>
                    <button type="button" className={ui.buttonQuiet} aria-label={`Take out the entry of ${e.warband}, ${signed(e.delta)}`} disabled={!online}
                      onClick={() => askRemove('Take this entry out?', `${e.warband}, ${signed(e.delta)} with ${factionName(e.factionId)}. The standing is worked out again without it.`, () => removeReputation(id, e.id), 'Entry taken out.')}>Take out</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!all && world.reputation.length > LOG_SHOWN && (
            <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => setAll(true)}>Show all {world.reputation.length}</button></div>
          )}
        </section>
      )}

      <FormSheet dialogRef={factionSheet.ref}>
        {(titleId) => factionEdit && (
          <FactionForm key={factionEdit.key} titleId={titleId} edit={factionEdit.edit} close={() => factionSheet.close()}
            onSave={(b) => putFaction(id, factionEdit.edit?.id ?? newId(), b).then(done(factionEdit.edit ? 'Faction changed.' : 'Faction added.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={npcSheet.ref} wide>
        {(titleId) => npcEdit && (
          <NpcForm key={npcEdit.key} titleId={titleId} cid={id} edit={npcEdit.edit} factions={world.factions} warbands={fighters} templates={npcTemplates(world.npcs, world.factions, npcEdit.edit?.id)} close={() => npcSheet.close()}
            onSave={(b) => putNpc(id, npcEdit.edit?.id ?? newId(), b).then(done(npcEdit.edit ? 'NPC changed.' : 'NPC added.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={repSheet.ref}>
        {(titleId) => repKey !== null && (
          <ReputationForm key={repKey} titleId={titleId} warbands={warbands} factions={world.factions} battles={battles} close={() => repSheet.close()}
            onSave={(b) => addReputation(id, newId(), b).then(done('Reputation recorded.'))} />
        )}
      </FormSheet>
      <FormSheet dialogRef={removeSheet.ref}>
        {(titleId) => removing && <RemoveForm key={removing.key} titleId={titleId} r={removing} close={() => removeSheet.close()} />}
      </FormSheet>
      {notice}
    </div>
  );
}

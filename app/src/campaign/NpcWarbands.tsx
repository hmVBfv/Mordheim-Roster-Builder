/* Hidden NPC warbands (wish #79, Rob, 26.10.2026): the game master's own warbands in the campaign – reference and Tabletop
   Simulator data – that no other member ever sees. They are planners (no gold limit; what they own, the experience their
   advances would need and their rating are tracked, nothing makes the experience even). A leader adds one from his own
   warbands, reads its cards and figures, takes a copy of it to work on, replaces it, or takes it out. Only leaders with the
   authenticator get an answer from the server; for everyone else this section is not drawn. */
import * as core from '@mordheim/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useGameData } from '../game/useGameData.ts';
import { newId } from '../db/ids.ts';
import { exportCtx, ttsCards } from '../roster/exports.ts';
import { Card } from '../roster/TtsCard.tsx';
import { readSave } from '../sync/engine.ts';
import { useWarbands } from '../sync/local.ts';
import { makeCopy } from '../sync/versions.ts';
import { useNavigate } from 'react-router';
import ui from '../ui/ui.module.css';
import styles from './Campaign.module.css';
import { getNpcWarband, listNpcWarbands, putNpcWarband, removeNpcWarband, staleOf, summaryOf, type NpcListed, type NpcWarband } from './npcWarbands.ts';

/** The warband as an NPC warband is kept: a planner with its Trading Post open. */
function asNpc(data: core.GameData, s: core.WarbandState): core.WarbandState {
  const planner = core.isPlanner(s) ? s : core.asPlanner(core.ctxOf(data, s));
  return core.setPlannerTrade(core.ctxOf(data, planner), true);
}

function Entry({ cid, w, data, onChanged, onReplace }: { cid: string; w: NpcListed; data: core.GameData; onChanged: () => void; onReplace: (w: NpcListed) => void }) {
  const navigate = useNavigate();
  const [full, setFull] = useState<NpcWarband | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState('');
  const state = useMemo(() => (full ? readSave(data, full.save) : null), [data, full]);
  const cards = useMemo(() => (state ? ttsCards(exportCtx(data, state)) : []), [data, state]);
  const load = () => { if (!full) getNpcWarband(cid, w.id).then(setFull, (e: unknown) => setError(errorText(e))); };
  const take = async () => {
    if (!state || !full) return;
    const id = await makeCopy({ id: w.id, name: w.name, wb: String(state.wb ?? ''), wbName: data.WARBANDS[state.wb as string]?.name ?? '', state } as never, state, undefined, new Date(), 'NPC');
    void navigate(`/warbands/${id}`);
  };
  return (
    <li>
      <details className={ui.card} onToggle={(e) => { if (e.currentTarget.open) load(); }}>
        <summary><strong>{w.name}</strong> <small className={ui.muted}>{w.summary.kind} · Value {w.summary.value} gc · Exp {w.summary.exp} · Rating {w.summary.rating} · {w.summary.models} {w.summary.models === 1 ? 'model' : 'models'}</small></summary>
        <div className={ui.page}>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.buttonQuiet} disabled={!state} onClick={() => void take()}>Take a copy to work on</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => onReplace(w)}>Replace from one of my warbands</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => { removeNpcWarband(cid, w.id).then(onChanged, (e: unknown) => setError(errorText(e))); }}>Remove</button>
          </div>
          {full && cards.length === 0 && <p className={ui.muted}>No warrior yet.</p>}
          {cards.length > 0 && (
            <div aria-label={`Tabletop Simulator cards of ${w.name}`} role="group">
              {cards.map((c) => <Card key={c.id} c={c} open={opened.has(c.id)} onOpen={(o) => setOpened((cur) => { const n = new Set(cur); if (o) n.add(c.id); else n.delete(c.id); return n; })} onCopied={(what) => setNote(what ? `${what} copied.` : 'Select the text and copy it.')} />)}
            </div>
          )}
          {note && <p className={ui.muted} role="status">{note}</p>}
        </div>
      </details>
    </li>
  );
}

export function NpcWarbands({ id }: { id: string }) {
  const data = useGameData();
  const own = useWarbands();
  const [list, setList] = useState<NpcListed[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [replacing, setReplacing] = useState<NpcListed | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => { listNpcWarbands(id).then((l) => { setList(l); setProblem(null); }, (e: unknown) => setProblem(errorText(e))); }, [id]);
  useEffect(refresh, [refresh]);
  const chosen = (own ?? []).find((w) => w.id === pick) ?? null;

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    const state = asNpc(data, chosen.state);
    const kind = data.WARBANDS[state.wb as string]?.name ?? chosen.wbName;
    const body = { name: (replacing?.name ?? name.trim()) || chosen.name, save: core.writeSave(core.ctxOf(data, state), __APP_VERSION__), summary: summaryOf(core.ctxOf(data, state), kind) };
    try {
      await putNpcWarband(id, replacing?.id ?? newId(), body, replacing?.seq ?? 0);
      setPick(''); setName(''); setReplacing(null); setProblem(null);
      refresh();
    } catch (e) {
      const cur = staleOf(e);
      setProblem(cur ? 'Another leader changed it first. Open it again and replace it from there.' : errorText(e));
    } finally { setBusy(false); }
  };

  if (list === null && problem === null) return null;
  // not a leader with the authenticator: the server has nothing to say, and nor has this page
  if (list === null) return null;
  return (
    <section className={styles.section} aria-labelledby="w-npc">
      <h2 id="w-npc">NPC warbands <small className={ui.muted}>· only leaders see these</small></h2>
      <p className={ui.muted}>Warbands of the game master: reference and Tabletop Simulator data. No gold limit; what they own, the experience their advances need and their rating are shown. No other member sees them, and they take no part in the campaign.</p>
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      {list.length === 0 && <p className={ui.muted}>None yet.</p>}
      {list.length > 0 && <ul className={styles.cards} aria-label="NPC warbands">{list.map((w) => <Entry key={w.id} cid={id} w={w} data={data} onChanged={refresh} onReplace={(x) => { setReplacing(x); setName(x.name); }} />)}</ul>}
      <form className={ui.card} onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={replacing ? `Replace ${replacing.name}` : 'Add an NPC warband'}>
        <h3>{replacing ? `Replace “${replacing.name}”` : 'Add an NPC warband'}</h3>
        <label className={ui.field}><span>From one of my warbands</span>
          <select className={ui.select} value={pick} onChange={(e) => { setPick(e.target.value); if (!replacing) setName((own ?? []).find((w) => w.id === e.target.value)?.name ?? ''); }}>
            <option value="">Choose a warband</option>
            {(own ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}{w.state.planner ? ' (planner)' : ''}</option>)}
          </select>
        </label>
        {!replacing && (
          <label className={ui.field}><span>Name</span>
            <input className={ui.input} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <div className={ui.actions}>
          {replacing && <button type="button" className={ui.buttonQuiet} onClick={() => { setReplacing(null); setName(''); }}>Cancel</button>}
          <button type="submit" className={ui.button} disabled={busy || !chosen || (!replacing && !name.trim())}>{replacing ? 'Replace' : 'Add as an NPC warband'}</button>
        </div>
        <p className={ui.muted}>A copy of the warband is kept as a planner with its Trading Post open; your own warband stays as it is.</p>
      </form>
    </section>
  );
}

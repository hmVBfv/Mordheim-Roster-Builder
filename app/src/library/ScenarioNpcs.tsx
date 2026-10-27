/* The NPCs of a scenario in the Library (wish #97, Rob, 26.10.2026): no free field for statlines – an NPC is added from the
   Library's NPCs or made on the spot, and then also stands under NPCs. The scenario holds a copy (with the parts a leader can
   hide from the players, ADR 0022) under the same id as the NPC it comes from, and the two are linked, so each shows the other. A copy
   is changed in a campaign, where its form lives; here an NPC is added or taken out. */
import { emptyNpcProfile, type ScenarioNpc } from '@mordheim/core';
import { lazy, Suspense, useId, useState } from 'react';
import { errorText } from '../account/api.ts';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { MAX_NPCS } from '../scenarios/api.ts';
import { bodyOf, draftOf, valuesOf, type NpcDraft } from '../world/npcDraft.ts';
import { MAX_NAME, putNpc, type LibraryItem, type LibraryNpc } from './api.ts';
import styles from './Library.module.css';
import { npcsOf } from './useLibrary.ts';

const NpcFields = lazy(() => import('../world/NpcFields.tsx').then((m) => ({ default: m.NpcFields })));

export function ScenarioNpcsField({ items, npcs, onNpcs, links, onLinks, online, onMade }: {
  items: LibraryItem[] | null; npcs: ScenarioNpc[]; onNpcs: (n: ScenarioNpc[]) => void; links: string[]; onLinks: (l: string[]) => void; online: boolean;
  /** An NPC made here is now in the Library. */ onMade: (n: LibraryNpc) => void;
}) {
  const ids = useId();
  const [pick, setPick] = useState('');
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<NpcDraft>(() => draftOf(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inside = new Set(npcs.map((n) => n.id));
  const offered = npcsOf(items).filter((n) => !inside.has(n.id));
  const full = npcs.length >= MAX_NPCS;

  const add = (n: LibraryNpc) => {
    onNpcs([...npcs, { id: n.id, name: n.name, hidden: [], ...(valuesOf(n.body) ?? emptyNpcProfile()) }]);
    if (!links.includes(n.id)) onLinks([...links, n.id]);
  };
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await putNpc(newId(), name.trim(), { de: '', status: '', faction: '', named: false, ...bodyOf(draft), links: [], folder: '' });
      onMade(saved);
      add(saved);
      setMaking(false);
      setName('');
      setDraft(draftOf(null));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.field}>
      <span>NPCs of this scenario</span>
      {npcs.length === 0 ? <p className={ui.muted}>No NPC yet. Add one from the Library, or make a new one.</p> : (
        <ul className={styles.links} aria-label="NPCs of this scenario">
          {npcs.map((n) => (
            <li key={n.id}>
              <span className={styles.chip}>{n.type || 'NPC'}</span> {n.name}{n.hidden.length > 0 && <small className={ui.muted}> · {n.hidden.length} hidden from the players</small>}{' '}
              <button type="button" className={ui.buttonQuiet} aria-label={`Take ${n.name} out of the scenario`}
                onClick={() => { onNpcs(npcs.filter((x) => x.id !== n.id)); onLinks(links.filter((l) => l !== n.id)); }}>Take out</button>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}>
        <label className={ui.field} htmlFor={`${ids}-p`}>
          <span className={ui.muted}>Add an NPC from the Library</span>
        </label>
        <select id={`${ids}-p`} className={ui.select} value={pick} disabled={full || offered.length === 0} onChange={(e) => setPick(e.target.value)}>
          <option value="">{offered.length > 0 ? 'Choose an NPC…' : 'No NPC left to add'}</option>
          {offered.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <button type="button" className={ui.buttonQuiet} disabled={!pick || full}
          onClick={() => { const n = offered.find((x) => x.id === pick); if (n) { add(n); setPick(''); } }}>Add this NPC</button>
      </div>
      {full && <p className={ui.muted} role="status">A scenario holds at most {MAX_NPCS} NPCs.</p>}
      <div className={ui.row}>
        <button type="button" className={ui.buttonQuiet} aria-expanded={making} disabled={full} onClick={() => setMaking((m) => !m)}>Create a new NPC</button>
      </div>
      {making && (
        <div className={ui.page}>
          <label className={ui.field}>
            <span>Name of the new NPC</span>
            <input className={ui.input} value={name} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </label>
          <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
            <NpcFields cid={null} warbands={[]} extra={[]} name={name.trim()} draft={draft} onDraft={setDraft} onCopied={(from) => { if (!name.trim()) setName(from); }} />
          </Suspense>
          <p className={ui.muted}>It is kept under NPCs as well, and a copy goes into this scenario.</p>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.actions}>
            <button type="button" className={ui.button} disabled={busy || !online || !name.trim()} onClick={() => void create()}>Create and add</button>
          </div>
        </div>
      )}
      <small className={ui.muted}>The scenario keeps a copy; the NPC stays in the Library, linked. A leader changes the copy and hides parts of it from the players in a campaign.</small>
    </div>
  );
}

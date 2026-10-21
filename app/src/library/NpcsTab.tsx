/* The NPCs tab of the Library (ADR 0023): people of one's own world, written outside any campaign and kept with the
   account. A leader brings one into a campaign's World as a copy (world/FromLibrary.tsx). The values are the world's
   NPC form (world/NpcFields.tsx), without a campaign: no own skills, no warriors to copy from. */
import { lazy, Suspense, useState } from 'react';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { bodyOf, draftOf, type NpcDraft } from '../world/npcDraft.ts';
import worldStyles from '../world/World.module.css';
import { MAX_NAME, MAX_STATUS, putNpc, removeItem, staleItem, type LibraryNpc, type NpcBody } from './api.ts';
import styles from './Library.module.css';
import { npcsOf, useLibrary } from './useLibrary.ts';

const NpcFields = lazy(() => import('../world/NpcFields.tsx').then((m) => ({ default: m.NpcFields })));

function NpcForm({ npc, online, close, onSaved, onRemoved }: {
  npc: LibraryNpc | null; online: boolean; close: (then?: () => void) => void; onSaved: (n: LibraryNpc) => void; onRemoved: (n: LibraryNpc) => void;
}) {
  const [nameEn, setNameEn] = useState(npc?.name ?? '');
  const [nameDe, setNameDe] = useState(npc?.body.de ?? '');
  const [faction, setFaction] = useState(npc?.body.faction ?? '');
  const [status, setStatus] = useState(npc?.body.status ?? '');
  const [named, setNamed] = useState(npc?.body.named ?? false);
  const [draft, setDraft] = useState<NpcDraft>(() => draftOf(npc?.body ?? null));
  const [base, setBase] = useState<number | undefined>(npc?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => npc?.id ?? newId());
  const name = nameEn.trim() || nameDe.trim();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: NpcBody = { de: nameDe.trim() === name ? '' : nameDe.trim(), status: status.trim(), faction: faction.trim(), named, ...bodyOf(draft) };
      const saved = await putNpc(id, name, body, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem<NpcBody>(e);
      if (cur) {
        setBase(cur.seq);
        setError(`This NPC was changed on another device while you were writing. Theirs: “${cur.name}${cur.body.status ? ` – ${cur.body.status}` : ''}” – save again to replace it with yours.`);
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeItem(id);
      close(() => onRemoved(npc!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="npc-form-title">{npc ? 'Edit NPC' : 'A new NPC'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <label className={ui.field}>
        <span>Name (English)</span>
        <input className={ui.input} value={nameEn} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setNameEn(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Name (German)</span>
        <input className={ui.input} value={nameDe} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setNameDe(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Faction</span>
        <input className={ui.input} value={faction} maxLength={MAX_NAME} autoComplete="off" placeholder="its name; found by name when the NPC goes into a world" onChange={(e) => setFaction(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Status everyone may read</span>
        <input className={ui.input} value={status} maxLength={MAX_STATUS} autoComplete="off" placeholder="alive · dead · now leads the Watch" onChange={(e) => setStatus(e.target.value)} />
      </label>
      <label className={worldStyles.check}>
        <input type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} />
        <span><strong>Named</strong> – a person of its own, not one of a crowd.</span>
      </label>
      <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
        <NpcFields cid={null} warbands={[]} extra={[]} name={name} draft={draft} onDraft={setDraft}
          onCopied={(from) => { if (!name) setNameEn(from); }} />
      </Suspense>
      <p className={ui.muted}>Only you see the Library. In a campaign’s World a leader adds the NPC from here as a copy: everyone in that campaign then reads its names, status and values.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device. Campaigns that already have a copy keep it.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !name}>Save</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          {npc && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this NPC</button>}
        </div>
      )}
    </form>
  );
}

export function NpcsTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('npc-form');
  const [editing, setEditing] = useState<{ npc: LibraryNpc | null; key: number } | null>(null);
  const npcs = npcsOf(items);
  const edit = (npc: LibraryNpc | null) => { setEditing((e) => ({ npc, key: (e?.key ?? 0) + 1 })); open(); };
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="npcs-title">
      <h2 id="npcs-title" className={styles.title}>NPCs</h2>
      <p className={ui.muted}>People of your own world, written once and used in any campaign: a leader adds one to a campaign’s World from here. Only you see this.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the NPCs…</p>}
      {items && npcs.length === 0 && <p className={ui.muted}>No NPCs yet. Write the first one down.</p>}
      {npcs.length > 0 && (
        <ul className={styles.list} aria-label="NPCs">
          {npcs.map((n) => (
            <li key={n.id} className={styles.idea}>
              <div className={styles.head}>
                <strong>{n.name}</strong>
                {n.body.de && n.body.de !== n.name && <span className={styles.chip}>{n.body.de}</span>}
                {n.body.named && <span className={styles.chip}>Named</span>}
              </div>
              {n.body.faction && <p className={styles.excerpt}>{n.body.faction}</p>}
              {n.body.status && <p className={styles.excerpt}>{n.body.status}</p>}
              {n.body.statlineTts && <p className={styles.excerpt}>{n.body.statlineTts.split('\n')[0]!.slice(0, 120)}</p>}
              <small className={styles.meta}>Changed <time dateTime={n.updatedAt}>{stamp(n.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${n.name}`} onClick={() => edit(n)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New NPC</button></div>
      <dialog ref={ref} className={`${ui.sheet} ${ui.sheetWide}`} aria-labelledby="npc-form-title">
        {editing && (
          <NpcForm key={editing.key} npc={editing.npc} online={reachable} close={close}
            onSaved={(n) => { setItems((cur) => [n, ...(cur ?? []).filter((x) => x.id !== n.id)]); notify('NPC saved. Only you see it.'); }}
            onRemoved={(n) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== n.id)); notify('NPC removed.'); }} />
        )}
      </dialog>
    </section>
  );
}

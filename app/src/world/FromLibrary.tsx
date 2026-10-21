/* "From the Library…" in the World (ADR 0023): a leader picks one of their own factions and the campaign gets a
   copy – the names and what players may read; the lore stays in the Library. A faction that is in the world
   already is not offered again. */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import { factionsOf, useLibrary } from '../library/useLibrary.ts';
import type { Faction as LibraryFaction } from '../library/api.ts';
import ui from '../ui/ui.module.css';
import { nameOf, type Faction } from './api.ts';

export function FromLibrary({ titleId, world, close, onAdd }: {
  titleId: string; world: Faction[]; close: () => void; onAdd: (f: LibraryFaction) => Promise<void>;
}) {
  const { items, error } = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const factions = factionsOf(items);
  const there = new Set(world.map((f) => nameOf(f).trim().toLowerCase()));
  const add = async (f: LibraryFaction) => {
    setBusy(f.id);
    setProblem(null);
    try {
      await onAdd(f);
      close();
    } catch (e) {
      setProblem(errorText(e));
      setBusy(null);
    }
  };
  return (
    <div className={ui.page}>
      <h2 id={titleId}>Add from your Library</h2>
      <p className={ui.muted}>A copy of the faction comes into this world: its names and what the players may read. The lore stays in your Library, and a change there does not change the campaign.</p>
      {error && <p className={ui.message} role="status">{error}</p>}
      {!items && !error && <p className={ui.muted}>Loading your Library…</p>}
      {items && factions.length === 0 && <p className={ui.muted}>No factions in your Library yet. Write them under Library → Factions.</p>}
      {factions.length > 0 && (
        <ul className={ui.list} aria-label="Your factions">
          {factions.map((f) => {
            const have = there.has(f.name.trim().toLowerCase());
            return (
              <li key={f.id}>
                <span><strong>{f.name}</strong>{f.body.status && <small className={ui.muted}> · {f.body.status}</small>}</span>
                <button type="button" className={ui.buttonQuiet} aria-label={`Add ${f.name}`} disabled={have || busy !== null} onClick={() => void add(f)}>{have ? 'Already in this world' : 'Add'}</button>
              </li>
            );
          })}
        </ul>
      )}
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
    </div>
  );
}

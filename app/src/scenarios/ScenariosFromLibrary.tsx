/* "Scenarios from the Library…" (ADR 0023): a leader brings one of their own scenarios into the campaign as a draft –
   the rules, the statlines and the NPCs with the parts hidden from the players. Only leaders read a draft until it is
   released to a battle. A scenario of the same title is not offered again. */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import type { LibraryScenario } from '../library/api.ts';
import { scenariosOf, useLibrary } from '../library/useLibrary.ts';
import ui from '../ui/ui.module.css';

export function ScenariosFromLibrary({ titleId, here, close, onAdd }: { titleId: string; here: string[]; close: () => void; onAdd: (s: LibraryScenario) => Promise<void> }) {
  const { items, error } = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const scenarios = scenariosOf(items);
  const there = new Set(here.map((t) => t.trim().toLowerCase()));
  const add = async (s: LibraryScenario) => {
    setBusy(s.id);
    setProblem(null);
    try {
      await onAdd(s);
      close();
    } catch (e) {
      setProblem(errorText(e));
      setBusy(null);
    }
  };
  return (
    <div className={ui.page}>
      <h2 id={titleId}>Add scenarios from your Library</h2>
      <p className={ui.muted}>⚑ A copy comes in as a draft that only leaders read. A change in your Library does not change the campaign.</p>
      {error && <p className={ui.message} role="status">{error}</p>}
      {!items && !error && <p className={ui.muted}>Loading your Library…</p>}
      {items && scenarios.length === 0 && <p className={ui.muted}>No scenarios in your Library yet. Write them under Library → Scenarios.</p>}
      {scenarios.length > 0 && (
        <ul className={ui.list} aria-label="Your scenarios">
          {scenarios.map((s) => {
            const have = there.has(s.name.trim().toLowerCase());
            return (
              <li key={s.id}>
                <span><strong>{s.name}</strong>{s.body.npcs.length > 0 && <small className={ui.muted}> · {s.body.npcs.length} {s.body.npcs.length === 1 ? 'NPC' : 'NPCs'}</small>}</span>
                <button type="button" className={ui.buttonQuiet} aria-label={`Add ${s.name}`} disabled={have || busy !== null} onClick={() => void add(s)}>{have ? 'Already here' : 'Add'}</button>
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

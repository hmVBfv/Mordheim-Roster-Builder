/* The groups of warbands: make one, rename one, remove one (the warbands in it stay, ungrouped). */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { LibraryWarbandGroup } from '../library/api.ts';
import ui from '../ui/ui.module.css';
import type { useWarbandGroups } from './useWarbandGroups.ts';

const MAX_NAME = 120;

function Row({ g, online, busy, run, api }: { g: LibraryWarbandGroup; online: boolean; busy: boolean; run: (f: () => Promise<void>) => void; api: ReturnType<typeof useWarbandGroups> }) {
  const [name, setName] = useState(g.name);
  return (
    <li>
      <input className={ui.input} aria-label={`Name of ${g.name}`} value={name} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      <button type="button" className={ui.buttonQuiet} aria-label={`Rename ${g.name}`} disabled={!online || busy || !name.trim() || name.trim() === g.name} onClick={() => run(() => api.rename(g, name.trim()))}>Rename</button>
      <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${g.name}`} disabled={!online || busy} onClick={() => run(() => api.remove(g))}>Remove</button>
    </li>
  );
}

export function GroupsSheet({ api, close, titleId }: { api: ReturnType<typeof useWarbandGroups>; close: () => void; titleId: string }) {
  const online = useOnline();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = (f: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    f().catch((e: unknown) => setProblem(errorText(e))).finally(() => setBusy(false));
  };
  return (
    <div className={ui.page}>
      <h2 id={titleId}>Groups of warbands</h2>
      <p className={ui.muted}>Sort your warbands into groups of your own. Only you see them, on every device you sign in on. Taking a group out leaves its warbands where they are, without a group.</p>
      {!online && <p className={`${ui.message} ${ui.error}`}>Changing groups needs the connection.</p>}
      {api.groups.length > 0 && (
        <ul className={ui.list} aria-label="Your groups">
          {api.groups.map((g) => <Row key={`${g.id}:${g.seq}`} g={g} online={online} busy={busy} run={run} api={api} />)}
        </ul>
      )}
      <form className={ui.row} onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(async () => { await api.create(name.trim()); setName(''); }); }}>
        <input className={ui.input} aria-label="Name of the new group" value={name} maxLength={MAX_NAME} autoComplete="off" placeholder="Reikland bands" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className={ui.button} aria-label="Add the group" disabled={!online || busy || !name.trim()}>Add</button>
      </form>
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      <div className={ui.actions}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
    </div>
  );
}

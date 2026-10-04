/* On the roster when the warband changed on another device as well (phase
   3h): which one to keep. Until then it is not sent (engine.ts). */
import type { GameData } from '@mordheim/core';
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import type { StoredWarband } from '../db/db.ts';
import ui from '../ui/ui.module.css';
import { conflictText, keepMine, takeTheirs } from './conflict.ts';

export function ConflictBanner({ data, rec }: { data: GameData; rec: StoredWarband }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!rec.conflict) return null;
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : errorText(e)); } finally { setBusy(false); }
  };
  const removed = rec.conflict.kind === 'removed';
  return (
    <div className={`${ui.message} ${ui.card}`} role="alert">
      <p>{conflictText(rec)}</p>
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={busy} onClick={() => void run(() => keepMine(rec))}>{removed ? 'Keep it' : 'Keep this one'}</button>
        <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void run(() => takeTheirs(data, rec))}>{removed ? 'Remove it here too' : 'Take the other one'}</button>
      </div>
      <p className={ui.muted}>{removed ? 'Kept, it comes back on every device.'
        : rec.conflict.kind === 'behind' ? 'The newer version stays in the history either way; keeping this one makes it the draft on top.'
          : 'The draft you do not keep is gone afterwards.'}</p>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}

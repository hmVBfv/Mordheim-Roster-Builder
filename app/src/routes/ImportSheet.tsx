/* Bringing a warband onto the device: a save file or the exported text of
   the Roster Builder. */
import { useState } from 'react';
import type { GameData } from '@mordheim/core';
import type * as Reader from '../db/warbands.ts';
import type { ImportOutcome } from '../db/warbands.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';

export function ImportSheet({ onImported, quiet = false }: { onImported: (id: string) => void; quiet?: boolean }) {
  const { ref: sheetRef, open: openSheet, close: closeSheet } = useSheet();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (r: ImportOutcome) => {
    if (!r.ok) { setError(r.msg); return; }
    setText(''); setError(null);
    closeSheet(() => onImported(r.id));
  };
  // the rules and the reader are loaded on first use, not with the app
  const run = async (f: (data: GameData, w: typeof Reader) => Promise<ImportOutcome> | ImportOutcome) => {
    setBusy(true);
    try {
      const [{ loadGameData }, w] = await Promise.all([import('../game/gameData.ts'), import('../db/warbands.ts')]);
      finish(await f(await loadGameData(), w));
    } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className={quiet ? ui.buttonQuiet : ui.button} onClick={() => { setError(null); openSheet(); }}>Import a warband</button>
      <dialog ref={sheetRef} className={ui.sheet} aria-labelledby="import-title">
        <form method="dialog" className={ui.page} onSubmit={(e) => { e.preventDefault(); void run((d, w) => w.importText(d, text)); }}>
          <h2 id="import-title">Import a warband</h2>
          <label className={ui.field}>
            <span>A save file of the Roster Builder</span>
            <input type="file" accept=".json,.txt,application/json,text/plain" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void run((d, w) => w.importFile(d, f)); e.target.value = ''; }} />
          </label>
          <label className={ui.field}>
            <span>…or paste the file, or the exported text</span>
            <textarea className={ui.textarea} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </label>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || !text.trim()}>Import</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => closeSheet()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

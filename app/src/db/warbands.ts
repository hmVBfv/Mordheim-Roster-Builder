/* Bringing warbands onto the device: a save file of the Roster Builder, or
   the text it exports (which carries the save at its end). Reading goes
   through core, exactly as the old app loads a file. */
import { FORMAT, loadSave, readSaveText } from '@mordheim/core';
import type { GameData, LoadResult } from '@mordheim/core';
import { newOwnership } from '../sync/local.ts';
import { requestSync } from '../sync/runner.ts';
import { db, type StoredWarband } from './db.ts';

export type ImportOutcome = { ok: true; id: string; notes: string[] } | { ok: false; msg: string };

const CAMPAIGN_FILE = 'This is a campaign file. So far this app takes single warbands; open campaign files in the Roster Builder.';

/** A campaign file of the Roster Builder, as JSON or pasted text. */
function isCampaignFile(text: string): boolean {
  try { return (JSON.parse(text.trim()) as { type?: unknown } | null)?.type === 'mordheim-campaign-file'; } catch { return false; }
}

function store(data: GameData, r: LoadResult, now: string, newId: () => string): Promise<ImportOutcome> | ImportOutcome {
  if (!r.ok) return r;
  const s = r.state;
  const wb = data.WARBANDS[s.wb as string];
  const rec: StoredWarband = {
    id: newId(), name: s.name || wb?.name || 'Warband', wb: s.wb as string, wbName: wb?.name ?? String(s.wb),
    state: s, format: FORMAT, createdAt: now, updatedAt: now, ...newOwnership('import'),
  };
  return db.warbands.add(rec).then(() => { requestSync(); return { ok: true as const, id: rec.id, notes: r.notes }; });
}

/** Pasted text: the JSON of a save, or the readable export with its data line. */
export function importText(data: GameData, text: string, now = new Date().toISOString(), newId: () => string = () => crypto.randomUUID()): Promise<ImportOutcome> | ImportOutcome {
  if (isCampaignFile(text)) return { ok: false, msg: CAMPAIGN_FILE };
  return store(data, readSaveText(data, text), now, newId);
}

/** A file: tried as JSON first, then as exported text. */
export async function importFile(data: GameData, file: Blob, now = new Date().toISOString(), newId: () => string = () => crypto.randomUUID()): Promise<ImportOutcome> {
  const text = await file.text();
  if (isCampaignFile(text)) return { ok: false, msg: CAMPAIGN_FILE };
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON: try it as exported text */ }
  const r = parsed ? loadSave(data, parsed) : readSaveText(data, text);
  return store(data, r, now, newId);
}


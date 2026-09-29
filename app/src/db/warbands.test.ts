import { beforeEach, describe, expect, it } from 'vitest';
import { data, sampleSave } from '../test/data.ts';
import { db } from './db.ts';
import { importFile, importText } from './warbands.ts';

beforeEach(async () => { await db.warbands.clear(); });

const NOW = '2026-09-28T10:00:00.000Z';
let n = 0;
const id = () => `id-${++n}`;

describe('importing warbands', () => {
  it('stores a save file as the Roster Builder writes it', async () => {
    const save = sampleSave();
    const r = await importFile(data, new Blob([JSON.stringify({ ...save, goldNow: 17 })]), NOW, id);
    expect(r.ok).toBe(true);
    const rec = await db.warbands.get((r as { id: string }).id);
    expect(rec?.name).toBe('The Silver Caravan');
    expect(rec?.wbName).toBe(data.WARBANDS[save.wb as string]!.name);
    expect(rec?.state.models.length).toBe(save.models.length);
    expect(rec?.createdAt).toBe(NOW);
  });

  it('reads the exported text with its data line, and pasted JSON', async () => {
    const save = sampleSave();
    const text = `Some warband\n# ++ Warband ++\nMORDHEIM-DATA: ${JSON.stringify(save)}`;
    expect((await importText(data, text, NOW, id)).ok).toBe(true);
    expect((await importFile(data, new Blob([text]), NOW, id)).ok).toBe(true);
    expect((await importText(data, JSON.stringify(save), NOW, id)).ok).toBe(true);
    expect(await db.warbands.count()).toBe(3);
  });

  it('refuses what it cannot read, and says why', async () => {
    const bad = await importText(data, 'hello', NOW, id);
    expect(bad).toEqual({ ok: false, msg: expect.stringMatching(/Could not read/) });
    const unknown = await importText(data, JSON.stringify({ wb: 'nope', models: [] }), NOW, id);
    expect(unknown.ok).toBe(false);
    expect(await db.warbands.count()).toBe(0);
  });

  it('says so when it is handed a campaign file (button audit, 29.09.2026)', async () => {
    const cf = JSON.stringify({ type: 'mordheim-campaign-file', version: 1, name: 'Spring', warbands: [], battles: [] });
    for (const r of [await importText(data, cf, NOW, id), await importFile(data, new Blob([cf]), NOW, id)]) {
      expect(r).toEqual({ ok: false, msg: expect.stringMatching(/campaign file/) });
    }
  });
});

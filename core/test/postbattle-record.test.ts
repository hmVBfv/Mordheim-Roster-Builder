/* ADR 0032: the post-battle sequence keeps a record (rolls, finds with their origin). The new keys are optional: a save without them loads
   as before, one with them is read without notes and keeps them through a save, and a departure from the shape is a note, never a refusal. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function base(): Record<string, unknown> {
  let s = core.newWarband(data, 'mastersofhorror');
  for (const u of data.WARBANDS.mastersofhorror!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  return core.writeSave(ctx(s));
}
const withRound = (round: Record<string, unknown>): Record<string, unknown> => {
  const save = base();
  const camp = (save.campaign ?? { on: true, round: 1, districts: {} }) as Record<string, unknown>;
  return { ...save, campaign: { ...camp, on: true, postbattle: { 1: round } } };
};
const RECORD = {
  done: { injuries: true, experience: true },
  wyrd: null,
  explore: { rolled: { value: [5, 5, 3, 1], by: 'entered' }, kept: [5, 5, 3, 1], total: 14, shards: 3, location: '5 5' },
  xp: { underdog: 2, scenario: [{ uid: 1, amount: 1, reason: 'carried the wyrdstone' }] },
  upkeep: { paid: [{ uid: 'cathayanmerchant', gc: 20 }], dismissed: [] },
  finds: [{ id: 1, kind: 'wyrd', source: 'explore', amount: 3, text: 'Found 3 shards.' }, { id: 2, kind: 'item', source: 'location:3 3', item: 'Dolch', qty: 1, worth: 3, text: 'A dagger.' }],
};
const notesOf = (save: Record<string, unknown>) => { const r = core.loadSave(data, save); expect(r.ok).toBe(true); return r.ok ? r.notes : []; };

describe('the post-battle record', () => {
  it('reads a round of the old shape (done and wyrd only) without notes', () => {
    expect(notesOf(withRound({ done: { injuries: true }, wyrd: { done: true, shards: 2, gc: 60, size: 5 } }))).toEqual([]);
  });

  it('reads a round with the whole record without notes and keeps it', () => {
    const save = withRound(RECORD);
    expect(notesOf(save)).toEqual([]);
    const r = core.loadSave(data, save);
    expect(r.ok && (r.state.campaign as { postbattle?: Record<string, unknown> }).postbattle?.['1']).toEqual(RECORD);
    const again = core.writeSave(ctx((r as { state: WarbandState }).state)) as { campaign: { postbattle: Record<string, unknown> } };
    expect(again.campaign.postbattle['1']).toEqual(RECORD);
  });

  it('reports a roll that is neither entered nor from the app, and still loads', () => {
    const bad = { ...RECORD, explore: { ...RECORD.explore, rolled: { value: [5], by: 'guess' } } };
    expect(notesOf(withRound(bad)).length).toBeGreaterThan(0);
  });

  it('knows where a ledger booking and a stash item came from', () => {
    const save = base();
    const s = { ...save, ledger: [{ id: 1, kind: 'adjust', amount: 40, text: 'Sold wyrdstone', source: 'wyrdstone' }], stash: { wyrd: 0, gold: null, items: [{ name: 'Dagger', qty: 1, paid: 0, source: 'explore' }] } };
    expect(notesOf(s)).toEqual([]);
    expect(notesOf({ ...s, ledger: [{ id: 1, kind: 'adjust', amount: 40, text: 'x', source: 7 }] }).length).toBeGreaterThan(0);
  });
});

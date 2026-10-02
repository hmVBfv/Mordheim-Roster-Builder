/* Fixed ids for the Fallen (V2, docs/behaviour-changes.md). The Roster
   Builder linked a casualty record to its Fallen entry by position
   (`fallenId`): deleting one entry left every later record pointing at the
   wrong warrior. Core gives each Fallen entry an id from the chronicle's
   sequence and links by it (`fallenRef`); `fallenId` is kept in step so the
   old app still reads a save correctly. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Casualty, FallenRecord, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const cas = (s: WarbandState) => s.campaign!.casualties as Casualty[];
const fallen = (s: WarbandState) => s.fallen as FallenRecord[];
const nameOf = (s: WarbandState, r: Casualty) => (r.fallenId == null ? null : fallen(s)[r.fallenId]?.m.name ?? null);

/** Three Heroes, each put out of action and rolled Dead in turn. */
function threeDead() {
  let s = core.newWarband(data, 'merc');
  for (const id of ['capt', 'champ', 'young']) s = core.addUnit(ctx(s), id);
  const uids = s.models.map((m) => m.uid);
  ['Ulrich', 'Magda', 'Pieter'].forEach((n, i) => { s = core.setModelName(ctx(s), uids[i]!, n); });
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1, districts: {} };
  for (const uid of uids) {
    s = core.addCasualty(ctx(s), { victim: { uid, name: '' }, attacker: { name: 'Gorbag' } });
    s = core.resolveCasualtyRoll(ctx(s), cas(s).at(-1)!.id, '11-15');
  }
  return s;
}

describe('a casualty points at its Fallen entry', () => {
  it('still at the right warrior after an earlier entry was deleted', () => {
    const s = threeDead();
    expect(cas(s).map((r) => nameOf(s, r))).toEqual(['Ulrich', 'Magda', 'Pieter']);
    const n = core.removeFallenAt(ctx(s), 0);
    expect(cas(n).map((r) => nameOf(n, r))).toEqual([null, 'Magda', 'Pieter']);
    expect(cas(n)[1]!.fallenRef).toBe(fallen(n)[0]!.id);
    // and once more, from the middle
    const m = core.removeFallenAt(ctx(n), 0);
    expect(cas(m).map((r) => nameOf(m, r))).toEqual([null, null, 'Pieter']);
  });

  it('the same for deaths through injure (V1)', () => {
    let s = core.newWarband(data, 'merc');
    for (const id of ['capt', 'champ', 'young']) s = core.addUnit(ctx(s), id);
    const uids = s.models.map((m) => m.uid);
    ['Ulrich', 'Magda', 'Pieter'].forEach((n, i) => { s = core.setModelName(ctx(s), uids[i]!, n); });
    s = structuredClone(s);
    s.campaign = { ...s.campaign, on: true, round: 1, districts: {} };
    for (const uid of uids) s = core.injure(ctx(s), uid, { hero: { code: '11-15' } });
    expect(cas(s).map((r) => nameOf(s, r))).toEqual(['Ulrich', 'Magda', 'Pieter']);
    s = core.removeFallenAt(ctx(s), 1);
    expect(cas(s).map((r) => nameOf(s, r))).toEqual(['Ulrich', null, 'Pieter']);
  });

  it('every Fallen entry has its own id from the chronicle sequence', () => {
    const s = threeDead();
    const ids = fallen(s).map((f) => f.id);
    expect(ids.every((x) => typeof x === 'number')).toBe(true);
    const used = [...(s.campaign!.log ?? []).map((e) => e.id), ...cas(s).map((r) => r.id)];
    for (const id of ids) expect(used).not.toContain(id);
    expect(new Set(ids).size).toBe(3);
    // the sequence goes on after them, even in a save without its counter
    const noSeq = structuredClone(s);
    delete noSeq.campaign!.logSeq;
    const next = core.addCasualty(ctx(noSeq), { victim: { name: 'x' } });
    expect(cas(next).at(-1)!.id).toBeGreaterThan(Math.max(...ids.map(Number)));
  });

  it('taking back a death unlinks its record', () => {
    const s = core.undoFallen(ctx(threeDead()));
    expect(cas(s)[2]).toMatchObject({ result: 'pending' });
    expect(cas(s)[2]!.fallenRef).toBeUndefined();
    expect(cas(s)[2]!.fallenId).toBeUndefined();
  });
});

describe('older saves', () => {
  /** A save as the Roster Builder wrote it: no ids, links by position. */
  function legacySave() {
    const s = structuredClone(threeDead()) as WarbandState & Record<string, unknown>;
    for (const f of fallen(s)) delete f.id;
    for (const r of cas(s)) delete r.fallenRef;
    delete s.campaign!.logSeq;
    return s;
  }

  it('get ids in the order of their Fallen, and links from the positions', () => {
    const loaded = core.loadSave(data, legacySave());
    expect(loaded.ok).toBe(true);
    const s = (loaded as { state: WarbandState }).state;
    expect(fallen(s).every((f) => typeof f.id === 'number')).toBe(true);
    expect(cas(s).map((r) => r.fallenRef)).toEqual(fallen(s).map((f) => f.id));
    const n = core.removeFallenAt(ctx(s), 0);
    expect(cas(n).map((r) => nameOf(n, r))).toEqual([null, 'Magda', 'Pieter']);
  });

  it('the old app\'s own edits are mended on the next load: its positions follow the ids', () => {
    // the old app deletes an entry and leaves the positions as they were
    const s = structuredClone(threeDead());
    (s.fallen as FallenRecord[]).splice(0, 1);
    const back = core.loadSave(data, s);
    const t = (back as { state: WarbandState }).state;
    expect(cas(t).map((r) => nameOf(t, r))).toEqual([null, 'Magda', 'Pieter']);
  });

  it('normalising twice changes nothing more', () => {
    const once = core.normalizeState(ctx(legacySave()));
    expect(core.normalizeState(ctx(once))).toEqual(once);
  });

  it('are written as format 2', () => {
    expect(core.FORMAT).toBe(2);
    expect(core.writeSave(ctx(threeDead())).format).toBe(2);
  });
});

/* Warrior uids: never reused, and the counter in the state is honoured. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

const ctx = (s: WarbandState) => core.ctxOf(data, s);
const add = (s: WarbandState) => core.addUnit(ctx(s), 'warr');
const lastUid = (s: WarbandState) => s.models[s.models.length - 1]!.uid;

describe('uid counter', () => {
  it('without a counter, continues after the highest uid in use (legacy resyncUid)', () => {
    expect(lastUid(add(core.newWarband(data, 'merc')))).toBe(2);
    const s = { ...core.newWarband(data, 'merc'), models: [{ uid: 7, uid_def: 'capt', qty: 1 }] } as WarbandState;
    expect(lastUid(add(s))).toBe(8);
  });

  it('keeps a counter that collides with nothing, as a fresh legacy session starting at 1', () => {
    expect(lastUid(add({ ...core.newWarband(data, 'merc'), uidSeq: 1 }))).toBe(1);
    expect(lastUid(add({ ...core.newWarband(data, 'merc'), uidSeq: 12 }))).toBe(12);
  });

  it('skips a counter that would hand out a uid in use, the Fallen included', () => {
    const s = { ...core.newWarband(data, 'merc'), uidSeq: 3, models: [{ uid: 5, uid_def: 'capt', qty: 1 }] } as WarbandState;
    expect(lastUid(add(s))).toBe(6);
    const f = { ...core.newWarband(data, 'merc'), uidSeq: 2, fallen: [{ kind: 'hero', m: { uid: 4, uid_def: 'capt' } }] } as unknown as WarbandState;
    expect(lastUid(add(f))).toBe(5);
  });
});

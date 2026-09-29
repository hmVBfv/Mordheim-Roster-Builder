/* Rules questions Rob has decided. Each test holds one ruling so that a later
   change cannot quietly undo it (docs/behaviour-changes.md, "Geplant"). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

describe('V3: Augur and "Blinded in one eye" (RAW; mordheimer.net states no exception)', () => {
  it('costs the Augur 1 BS like any other warrior', () => {
    const hired = core.addUnit(ctx(core.newWarband(data, 'sos')), 'augur');
    const augur = hired.models.find((m) => m.uid_def === 'augur')!;
    expect(core.effProfile(ctx(hired), augur)?.BS).toBe(2);

    const blinded = core.addInjury(ctx(hired), augur.uid, '31');
    const after = blinded.models.find((m) => m.uid === augur.uid)!;
    expect(after.inj?.map((j) => j.code)).toEqual(['31']);
    expect(core.effProfile(ctx(blinded), after)?.BS).toBe(1);
  });
});

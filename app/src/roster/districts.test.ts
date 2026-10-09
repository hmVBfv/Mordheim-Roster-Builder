/* The districts a warband holds (phase 4a4): every district by area, what
   it gives, the others' footholds in a campaign; set by hand with core. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, sampleSave } from '../test/data.ts';
import { districtsView } from './districts.ts';

describe('districts', () => {
  it('every district by area; a foothold held, its effects in force, control effects only with control', () => {
    let s = sampleSave();
    const v0 = districtsView(data, s);
    expect(v0.areas.flatMap((a) => a.rows)).toHaveLength(data.DISTRICTS.length);
    expect(v0.held).toBe(0);
    s = core.setDistrict(core.ctxOf(data, s), 'artisanquarter', 'foothold');
    const v = districtsView(data, s, [{ name: 'Clan Skrittle', districts: [{ id: 'artisanquarter' }] }, { name: 'The Grey Penitents', districts: [] }]);
    const row = v.areas.flatMap((a) => a.rows).find((r) => r.id === 'artisanquarter')!;
    expect(row).toMatchObject({ hold: 'foothold', others: ['Clan Skrittle'] });
    expect(v.held).toBe(1);
    expect(v.active.map((a) => a.district)).toEqual(['Artisan Quarter']);
    const hard = data.DISTRICTS.find((d) => d.effects.some((e) => e.tier === 'control'))!;
    s = core.setDistrict(core.ctxOf(data, s), hard.id, 'foothold');
    const before = districtsView(data, s).active.length;
    s = core.setDistrict(core.ctxOf(data, s), hard.id, 'control');
    expect(districtsView(data, s).active.length).toBeGreaterThan(before);
  });
});

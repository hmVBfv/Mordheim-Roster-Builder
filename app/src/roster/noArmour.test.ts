/* The Augur never wears armour: her list shows no armour group (reports of 7.11.2026), while another Sister's list still does. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { equipmentView } from './equipment.ts';
import { createWarband } from './view.ts';

describe('the list of a unit that never wears armour', () => {
  it('has no armour group, and every other group stays', () => {
    let s = createWarband(data, 'sos', null, 'The Sisters');
    s = core.addUnit(core.ctxOf(data, s), 'augur');
    s = core.addUnit(core.ctxOf(data, s), 'matri');
    const [augur, matri] = s.models.map((m) => m.uid) as [number, number];
    const labels = (uid: number) => equipmentView(core.ctxOf(data, s), uid)!.groups.map((g) => g.label);
    expect(labels(matri)).toContain('Armour');
    expect(labels(augur)).not.toContain('Armour');
    expect(labels(augur)).toContain('Close combat');
  });
});

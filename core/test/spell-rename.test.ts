/* Bug 256 (Rob, 12.11.2026): Dark Elf Magic follows mordheimer.net – three difficulties and one name changed. A learned spell is stored as its name
   with the difficulty in brackets, so a save from before must come out under the new name, with the spell's reductions kept; other warbands are left
   alone. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

function savedSorceress(wb: string, spells: { name: string; red?: number }[]) {
  let s = core.newWarband(data, wb);
  if (wb === 'darkelves') s = core.addUnit(core.ctxOf(data, s), 'highborn');
  s = core.addUnit(core.ctxOf(data, s), wb === 'darkelves' ? 'sorceress' : 'magician');
  const raw = JSON.parse(JSON.stringify(core.writeSave(core.ctxOf(data, s)))) as { models: { spells: unknown[] }[] };
  raw.models[raw.models.length - 1]!.spells = spells;
  return raw;
}
const spellsOf = (raw: unknown) => {
  const r = core.loadSave(data, raw);
  if (!r.ok) throw new Error(r.msg);
  return r.state.models[r.state.models.length - 1]!.spells;
};

describe('a save from before the Dark Elf Magic of the page', () => {
  it('reads the spells under their new names and difficulties, with the reductions kept', () => {
    const got = spellsOf(savedSorceress('darkelves', [{ name: 'Doombolt (8)', red: 1 }, { name: 'Black Blade of Khaine (8)' }, { name: 'Word of Pain (9)' }, { name: 'Deathspasm (9)', red: 2 }, { name: 'Witch Flight (7)' }]));
    expect(got).toEqual([{ name: 'Doombolt (9)', red: 1 }, { name: 'Flamesword (8)' }, { name: 'Word of Pain (8)' }, { name: 'Deathspasm (10)', red: 2 }, { name: 'Witch Flight (7)' }]);
  });

  it('does not touch a spell that is already under the new name, or another warband\'s', () => {
    expect(spellsOf(savedSorceress('darkelves', [{ name: 'Doombolt (9)' }]))).toEqual([{ name: 'Doombolt (9)' }]);
    expect(spellsOf(savedSorceress('caravans', [{ name: 'Doombolt (8)' }]))).toEqual([{ name: 'Doombolt (8)' }]);
  });
});

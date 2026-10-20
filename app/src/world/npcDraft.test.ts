/* The NPC form's draft: what opens, what is stored, what can be copied. */
import { emptyNpcProfile, type NpcProfile } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { LIMITS, type Faction, type Npc } from './api.ts';
import { bodyOf, draftOf, isBlank, npcTemplates, valuesOf } from './npcDraft.ts';

const filled = (): NpcProfile => ({ type: 'Hero', profile: { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' }, sv: '', skills: [], equipment: '', equipmentTips: [], rules: '', from: null });
const npc = (o: Partial<Npc>): Npc => ({ id: 'n', factionId: null, nameDe: '', nameEn: 'Marek', publicStatus: '', statlineTts: '', named: false, profile: null, updatedAt: '', seq: 1, ...o });
const faction = (id: string, nameEn: string): Faction => ({ id, nameEn, nameDe: '', publicStatus: '', updatedAt: '', seq: 1 });

describe('the draft of an NPC form', () => {
  it('a new NPC opens as an empty grid; one with values as values; one written as text as text', () => {
    expect(draftOf(null)).toEqual({ mode: 'values', profile: emptyNpcProfile(), text: '' });
    expect(draftOf(npc({}))).toEqual({ mode: 'values', profile: emptyNpcProfile(), text: '' });
    expect(draftOf(npc({ profile: filled(), statlineTts: 'M4' }))).toEqual({ mode: 'values', profile: filled(), text: 'M4' });
    expect(draftOf(npc({ statlineTts: 'M4 WS3' }))).toEqual({ mode: 'text', profile: emptyNpcProfile(), text: 'M4 WS3' });
  });

  it('knows an empty set of values: nothing in the grid, no skill, no equipment, no rule', () => {
    expect(isBlank(emptyNpcProfile())).toBe(true);
    expect(isBlank({ ...emptyNpcProfile(), type: 'Monster' })).toBe(true); // a type alone is nothing
    for (const o of [{ sv: '5+' }, { equipment: 'Axe' }, { rules: 'Fear' }, { skills: [{ name: 'Step Aside', text: '' }] }, { profile: { M: '4' } }]) expect(isBlank({ ...emptyNpcProfile(), ...o })).toBe(false);
  });

  it('stores values with the text written from them; text mode stores the text alone; an empty grid stores nothing', () => {
    expect(bodyOf({ mode: 'values', profile: filled(), text: 'ignored' })).toEqual({ profile: filled(), statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv -' });
    expect(bodyOf({ mode: 'text', profile: filled(), text: '  Just a man.  ' })).toEqual({ profile: null, statlineTts: 'Just a man.' });
    expect(bodyOf({ mode: 'values', profile: emptyNpcProfile(), text: 'left over' })).toEqual({ profile: null, statlineTts: '' });
  });

  it('never stores more text than the server takes', () => {
    const long = 'x'.repeat(LIMITS.statline + 500);
    expect(bodyOf({ mode: 'text', profile: emptyNpcProfile(), text: long }).statlineTts).toHaveLength(LIMITS.statline);
    expect(bodyOf({ mode: 'values', profile: { ...filled(), rules: Array.from({ length: 2_000 }, (_, i) => `rule number ${i}`).join('\n') }, text: '' }).statlineTts.length).toBeLessThanOrEqual(LIMITS.statline);
  });

  it('reads the values of an NPC, or what can be read from its text', () => {
    expect(valuesOf(npc({ profile: filled() }))).toEqual(filled());
    expect(valuesOf(npc({ statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' }))?.profile).toEqual(filled().profile);
    expect(valuesOf(npc({ statlineTts: 'Just a man.' }))).toBeNull();
  });
});

describe('the NPCs as templates', () => {
  it('lists the NPCs that have values (or a readable text), with their faction as the source, and leaves out the one being changed', () => {
    const list = [
      npc({ id: 'a', nameEn: 'Marek', factionId: 'f1', profile: filled() }),
      npc({ id: 'b', nameEn: 'Written', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' }),
      npc({ id: 'c', nameEn: 'Nothing', statlineTts: 'Just a man.' }),
    ];
    const t = npcTemplates(list, [faction('f1', 'The Ferrymen')]);
    expect(t.map((x) => [x.kind, x.key, x.name, x.source])).toEqual([['npc', 'npc/a', 'Marek', 'NPC · The Ferrymen'], ['npc', 'npc/b', 'Written', 'NPC · no faction']]);
    expect(npcTemplates(list, [], 'a').map((x) => x.name)).toEqual(['Written']);
  });
});

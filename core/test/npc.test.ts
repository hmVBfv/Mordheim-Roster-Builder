/* The values of an NPC: written to plain text and read back, copied from a template, and read from what a leader typed by hand. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const marek: core.NpcProfile = {
  type: 'Hero', profile: { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' }, sv: '6+',
  skills: [{ name: 'Step Aside', text: 'Dodges the first hit.' }, { name: 'Wits', text: '' }], equipment: 'Dagger, boat hook', rules: 'Knows every shoal of the Stir\nNever leaves the ferry', from: null,
};

describe('npcStatline', () => {
  it('writes the statline, the equipment and a line to every rule and skill', () => {
    expect(core.npcStatline(marek)).toBe([
      'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv 6+', 'Equipment: Dagger, boat hook', '• Knows every shoal of the Stir', '• Never leaves the ferry', '• Step Aside: Dodges the first hit.', '• Wits',
    ].join('\n'));
  });

  it('writes a dash for what is not filled in, and no statline at all when nothing is', () => {
    expect(core.npcStatline({ ...core.emptyNpcProfile(), profile: { M: '6', WS: '4' } })).toBe('M6 WS4 BS- S- T- W- I- A- Ld- Sv -');
    expect(core.npcStatline({ ...core.emptyNpcProfile(), rules: 'Only a legend' })).toBe('• Only a legend');
    expect(core.npcStatline(core.emptyNpcProfile())).toBe('');
  });
});

describe('parseStatline', () => {
  it('reads what npcStatline wrote back into the same values (the skills come back as rules)', () => {
    const back = core.parseStatline(core.npcStatline(marek))!;
    expect(back.profile).toEqual(marek.profile);
    expect(back.sv).toBe('6+');
    expect(back.equipment).toBe('Dagger, boat hook');
    expect(back.rules.split('\n')).toEqual(['Knows every shoal of the Stir', 'Never leaves the ferry', 'Step Aside: Dodges the first hit.', 'Wits']);
    expect(core.npcStatline(back)).toBe(core.npcStatline(marek));
  });

  it('reads a line a leader typed by hand, with the rules under it', () => {
    const p = core.parseStatline('Captain Brandt  M4 WS4 BS3 S3 T3 W2 I4 A2 Ld8 Sv 5+\n• Cannot be ambushed\nHates the Countess')!;
    expect(p.profile).toEqual({ M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '2', I: '4', A: '2', Ld: '8' });
    expect(p.sv).toBe('5+');
    expect(p.rules).toBe('Cannot be ambushed\nHates the Countess');
  });

  it('reads values such as 3(4), D6 and a dash, and the profile of the Tabletop Simulator export', () => {
    const p = core.parseStatline('M6   WS3   BS0   S3(4)   T3   W D6   I3   A1   Ld5   Sv -')!;
    expect(p.profile).toMatchObject({ M: '6', S: '3(4)', W: 'D6', BS: '0' });
    expect(p.sv).toBe('-');
  });

  it('does not take prose for a profile', () => {
    expect(core.parseStatline('A tall man with a limp. Ld matters to him, and so does M4.')).toBeNull();
    expect(core.parseStatline('')).toBeNull();
  });
});

describe('npcProfileFrom, npcTemplate and npcAsOpponent', () => {
  it('copies a model of the game, its profile, rules and equipment, and says where it came from', () => {
    const wardog = core.opponentTemplates(data).find((t) => t.key === 'beast/wardog')!;
    const p = core.npcProfileFrom(wardog);
    expect(p).toMatchObject({ type: 'Animal', profile: { M: '6', WS: '4' }, from: { kind: 'beast', key: 'beast/wardog' } });
    p.profile.M = '9';
    expect(wardog.profile.M).toBe('6');
    expect(core.npcProfileFrom(null)).toEqual(core.emptyNpcProfile());
  });

  it('makes another NPC a template, so it can be copied like any model, and back', () => {
    const t = core.npcTemplate('abc', 'World', 'Old Marek', marek);
    expect(t).toMatchObject({ key: 'npc/abc', kind: 'npc', source: 'World', name: 'Old Marek', type: 'Hero', sv: '6+' });
    expect(core.searchTemplates([t], 'marek', ['npc'])).toHaveLength(1);
    const copy = core.npcProfileFrom(t);
    expect(copy.skills).toEqual(marek.skills);
    expect(copy.from).toMatchObject({ kind: 'npc', key: 'npc/abc' });
  });

  it('is a Tabletop Simulator card like an opponent’s', () => {
    const o = core.npcAsOpponent('Old Marek', marek);
    expect(core.ttsOpponentName(o)).toContain('Old Marek');
    expect(core.ttsOpponentText(o)).toContain('M 4   WS 3');
  });
});

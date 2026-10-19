/* An NPC of a scenario: what the players read of it, its Tabletop Simulator card, and what may change once the scenario is released. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';

const base = (over: Partial<core.ScenarioNpc> = {}): core.ScenarioNpc => ({
  id: 'n1', name: 'Gerhard Voss', hidden: [], type: 'Hero',
  profile: { M: '4', WS: '5', BS: '3', S: '4', T: '4', W: '3', I: '4', A: '2', Ld: '8' }, sv: '5+',
  skills: [{ name: 'Strongman', text: 'Hits harder.' }], equipment: 'Boat hook, light armour', rules: 'Kills witnesses', from: { kind: 'hired', key: 'hired/ogre', label: 'Ogre Bodyguard (Rulebook)' },
  ...over,
});

describe('redactNpc', () => {
  it('changes nothing that is not hidden – except where it was copied from, which is the leader’s own note', () => {
    const r = core.redactNpc(base());
    expect(r).toEqual({ ...base(), from: null });
  });

  it('makes a "?" of the name (and the type, which would give it away), of single characteristics, of the save', () => {
    const r = core.redactNpc(base({ hidden: ['name', 'WS', 'Ld', 'sv'] }));
    expect(r.name).toBe('?');
    expect(r.type).toBe('?');
    expect(r.profile).toEqual({ M: '4', WS: '?', BS: '3', S: '4', T: '4', W: '3', I: '4', A: '2', Ld: '?' });
    expect(r.sv).toBe('?');
    expect(r.equipment).toBe('Boat hook, light armour');
  });

  it('makes a "?" of skills, equipment and rules, and says it once when both skills and rules are hidden', () => {
    const r = core.redactNpc(base({ hidden: ['skills', 'equipment', 'rules'] }));
    expect(r.skills).toEqual([]);
    expect(r.rules).toBe('?');
    expect(r.equipment).toBe('?');
    expect(core.redactNpc(base({ hidden: ['skills'] })).skills).toEqual([{ name: '?', text: '' }]);
  });

  it('hides a characteristic that was never filled in as well – the "?" does not say whether there was a value', () => {
    expect(core.redactNpc(base({ profile: { M: '4' }, hidden: ['BS'] })).profile.BS).toBe('?');
  });

  it('leaves no hidden word in what it returns, and never changes what it was given', () => {
    const n = base({ hidden: [...core.HIDABLE] });
    const before = JSON.stringify(n);
    const out = JSON.stringify(core.redactNpc(n));
    expect(JSON.stringify(n)).toBe(before);
    for (const secret of ['Gerhard', 'Voss', 'Strongman', 'Hits harder', 'Boat hook', 'Kills witnesses', 'Ogre', 'Hero', '5+', '"5"', '"8"']) expect(out, secret).not.toContain(secret);
  });

  it('puts the parts in the order of the form, once each', () => {
    expect(core.redactNpc(base({ hidden: ['rules', 'WS', 'name', 'WS'] })).hidden).toEqual(['name', 'WS', 'rules']);
    expect(core.normalizeHidden(['sv', 'bogus', 'M'])).toEqual(['M', 'sv']);
  });
});

describe('scenarioNpcCard', () => {
  it('writes the Tabletop Simulator card the way the table gets it: "?" where hidden', () => {
    const c = core.scenarioNpcCard(base({ hidden: ['name', 'WS', 'rules'] }));
    expect(c.name).toBe('[B8860B]?[-]');
    expect(c.text).toContain('M 4   WS ?   BS 3   S 4   T 4   W 3   I 4   A 2   Ld 8   Sv 5+');
    expect(c.text).toContain('• Strongman: Hits harder.');
    expect(c.text).toContain('• ?');
    expect(c.text).not.toContain('Kills witnesses');
    expect(c.text).toContain('Boat hook, light armour');
  });

  it('the leader may have the whole card for his own use', () => {
    const c = core.scenarioNpcCard(base({ hidden: ['name', 'WS'] }), true);
    expect(c.name).toBe('[B8860B]Gerhard Voss[-]');
    expect(c.text).toContain('WS 5');
  });
});

describe('copying', () => {
  it('a template becomes an NPC with its own id, its name and nothing hidden', () => {
    const t: core.OpponentTemplate = { key: 'hired/ogre', kind: 'hired', source: 'Rulebook', name: 'Ogre Bodyguard', type: 'Hired Sword', count: 1, profile: { M: '6' }, sv: '6+', skills: [], equipment: 'Hand weapons', rules: 'Fear', grade: '1a' };
    expect(core.scenarioNpcFrom('x1', t)).toMatchObject({ id: 'x1', name: 'Ogre Bodyguard', type: 'Hired Sword', hidden: [], sv: '6+', from: { kind: 'hired', key: 'hired/ogre' } });
    expect(core.emptyScenarioNpc('x2')).toMatchObject({ id: 'x2', name: '', hidden: [], profile: {} });
  });
});

describe('releasedChangeProblem', () => {
  const hidden = base({ hidden: ['name', 'WS', 'rules'] });

  it('allows what leaves everything hidden as it was – whatever else is corrected', () => {
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, equipment: 'Axe', profile: { ...hidden.profile, BS: '4' } }])).toBeNull();
    expect(core.releasedChangeProblem([hidden], [hidden, base({ id: 'n2', name: 'A newcomer', hidden: ['WS'] })])).toBeNull(); // a new NPC is new
  });

  it('allows a reveal, with the value it always had', () => {
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, hidden: ['name'] }])).toBeNull();
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, hidden: [] }])).toBeNull();
  });

  it('refuses to change a hidden value – also while revealing it', () => {
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, profile: { ...hidden.profile, WS: '3' } }])).toMatch(/cannot be changed.*WS/);
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, hidden: ['name'], rules: 'Harmless' }])).toMatch(/cannot be changed.*rules/);
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, name: 'Someone else' }])).toMatch(/cannot be changed.*name/);
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, type: 'Animal' }])).toMatch(/cannot be changed.*name/); // the type goes with the name
  });

  it('refuses to hide what the players have read, and to take out an NPC that has hidden parts', () => {
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, hidden: ['name', 'WS', 'rules', 'Ld'] }])).toMatch(/cannot be hidden.*Ld/);
    expect(core.releasedChangeProblem([base()], [base({ hidden: ['name'] })])).toMatch(/cannot be hidden/);
    expect(core.releasedChangeProblem([hidden], [])).toMatch(/stays in a released scenario/);
    expect(core.releasedChangeProblem([base()], [])).toBeNull(); // one with nothing hidden is a correction
  });
});

describe('revealedBy', () => {
  it('lists, per NPC that is still there, the parts that are not hidden any more', () => {
    const a = base({ id: 'a', hidden: ['name', 'WS'] });
    const b = base({ id: 'b', hidden: ['rules'] });
    expect(core.revealedBy([a, b], [{ ...a, hidden: ['WS'] }, b])).toEqual([{ npc: 'a', parts: ['name'] }]);
    expect(core.revealedBy([a, b], [a, b])).toEqual([]);
    expect(core.revealedBy([a], [])).toEqual([]);
  });
});

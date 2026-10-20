/* An NPC of a scenario: what the players read of it, its Tabletop Simulator card, and what may change once the scenario is released. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';

const base = (over: Partial<core.ScenarioNpc> = {}): core.ScenarioNpc => ({
  id: 'n1', name: 'Gerhard Voss', hidden: [], type: 'Hero',
  profile: { M: '4', WS: '5', BS: '3', S: '4', T: '4', W: '3', I: '4', A: '2', Ld: '8' }, sv: '5+',
  skills: [{ name: 'Strongman', text: 'Hits harder.' }], equipment: 'Boat hook, light armour', equipmentTips: [{ name: 'Boat hook', text: 'Reach: strikes first.' }], rules: 'Kills witnesses', from: { kind: 'hired', key: 'hired/ogre', label: 'Ogre Bodyguard (Rulebook)' },
  ...over,
});

describe('redactNpc', () => {
  it('changes nothing that is not hidden – except where it was copied from, which is the leader’s own note', () => {
    const r = core.redactNpc(base());
    expect(r).toEqual({ ...base(), from: null, type: '' });
  });

  it('never shows the type – not as a "?" either: it is too much of the game for our table (Rob, 20.10.2026)', () => {
    for (const hidden of [[], ['name'], [...core.HIDABLE]] as core.Hidable[][]) {
      const out = core.redactNpc(base({ type: 'Henchman (Gnoblar)', hidden }));
      expect(out.type, hidden.join()).toBe('');
      expect(JSON.stringify(out), hidden.join()).not.toContain('Gnoblar');
    }
  });

  it('makes a "?" of the name, of single characteristics, of the save', () => {
    const r = core.redactNpc(base({ hidden: ['name', 'WS', 'Ld', 'sv'] }));
    expect(r.name).toBe('?');
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

  it('hides the tooltips of the equipment on their own: the players see what he carries, not what it does', () => {
    const r = core.redactNpc(base({ hidden: ['equipmentTips'] }));
    expect(r.equipment).toBe('Boat hook, light armour');
    expect(r.equipmentTips).toEqual([{ name: '?', text: '' }]);
    expect(JSON.stringify(r)).not.toContain('Reach');
    // an item without a tooltip hides the same: a "?" does not say whether there was one
    expect(core.redactNpc(base({ equipmentTips: [], hidden: ['equipmentTips'] })).equipmentTips).toEqual([{ name: '?', text: '' }]);
    // shown, they are as written
    expect(core.redactNpc(base()).equipmentTips).toEqual([{ name: 'Boat hook', text: 'Reach: strikes first.' }]);
  });

  it('hidden equipment takes its tooltips with it – their names would give it away', () => {
    const r = core.redactNpc(base({ hidden: ['equipment'] }));
    expect(r.equipment).toBe('?');
    expect(r.equipmentTips).toEqual([]);
    expect(core.redactNpc(base({ hidden: ['equipment', 'equipmentTips'] })).equipmentTips).toEqual([]);
  });

  it('copes with an NPC saved before tooltips existed', () => {
    const old = { ...base() } as Partial<core.ScenarioNpc>;
    delete old.equipmentTips;
    expect(core.redactNpc(old as core.ScenarioNpc).equipmentTips).toEqual([]);
    expect(core.redactNpc({ ...old, hidden: ['equipmentTips'] } as core.ScenarioNpc).equipmentTips).toEqual([{ name: '?', text: '' }]);
  });

  it('hides a characteristic that was never filled in as well – the "?" does not say whether there was a value', () => {
    expect(core.redactNpc(base({ profile: { M: '4' }, hidden: ['BS'] })).profile.BS).toBe('?');
  });

  it('leaves no hidden word in what it returns, and never changes what it was given', () => {
    const n = base({ hidden: [...core.HIDABLE] });
    const before = JSON.stringify(n);
    const out = JSON.stringify(core.redactNpc(n));
    expect(JSON.stringify(n)).toBe(before);
    for (const secret of ['Gerhard', 'Voss', 'Strongman', 'Hits harder', 'Boat hook', 'Reach', 'Kills witnesses', 'Ogre', 'Hero', '5+', '"5"', '"8"']) expect(out, secret).not.toContain(secret);
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

  it('carries the tooltips of the equipment under it, or a "?" for them', () => {
    expect(core.scenarioNpcCard(base()).text).toContain('[5ACFFF]Equipment:[-] Boat hook, light armour\n[5ACFFF]Equipment tooltips:[-]\n• Boat hook: Reach: strikes first.');
    const hid = core.scenarioNpcCard(base({ hidden: ['equipmentTips'] })).text;
    expect(hid).toContain('Boat hook, light armour\n[5ACFFF]Equipment tooltips:[-]\n• ?');
    expect(hid).not.toContain('Reach');
    expect(core.scenarioNpcCard(base({ hidden: ['equipmentTips'] }), true).text).toContain('Reach: strikes first.');
    expect(core.scenarioNpcCard(base({ equipmentTips: [] })).text).not.toContain('Equipment tooltips');
  });

  it('does not depend on the type: the name has the same colour for a hero and for a henchman', () => {
    for (const all of [false, true]) {
      expect(core.scenarioNpcCard(base({ type: 'Henchman' }), all)).toEqual(core.scenarioNpcCard(base({ type: 'Hero' }), all));
      expect(core.scenarioNpcCard(base({ type: 'Animal' }), all).name).toBe(core.scenarioNpcCard(base({ type: '' }), all).name);
    }
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
  });

  it('the tooltips of the equipment are a hidden part like the others: kept once hidden, revealed or not', () => {
    const tips = base({ hidden: ['equipmentTips'] });
    expect(core.releasedChangeProblem([tips], [{ ...tips, equipment: 'Axe' }])).toBeNull();
    expect(core.releasedChangeProblem([tips], [{ ...tips, hidden: [] }])).toBeNull(); // revealed, as it always was
    expect(core.releasedChangeProblem([tips], [{ ...tips, equipmentTips: [{ name: 'Boat hook', text: 'Harmless.' }] }])).toMatch(/cannot be changed.*equipmentTips/);
    expect(core.releasedChangeProblem([base()], [base({ hidden: ['equipmentTips'] })])).toMatch(/cannot be hidden.*equipmentTips/);
  });

  it('the type is nobody’s to read, so changing it concerns nobody', () => {
    const hidden = base({ hidden: ['name', 'WS', 'rules'] });
    expect(core.releasedChangeProblem([hidden], [{ ...hidden, type: 'Animal' }])).toBeNull();
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

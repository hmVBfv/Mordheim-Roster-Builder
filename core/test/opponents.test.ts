/* Opponents: templates from every corner of the rules data and from the
   campaign's own warriors, searched and copied into a profile that is the
   leader's to change; skills from the game's lists; a TTS card like a
   warband model's. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const templates = core.opponentTemplates(data);
const byKey = (k: string) => templates.find((t) => t.key === k)!;

describe('opponentTemplates', () => {
  it('holds a model of every warband with a profile, the Hired Swords, the Dramatis Personae and the bestiary', () => {
    const kinds = new Set(templates.map((t) => t.kind));
    expect([...kinds].sort()).toEqual(['beast', 'dramatis', 'hired', 'unit']);
    for (const [k, w] of Object.entries(data.WARBANDS)) {
      const fighters = w.units.filter((u) => u.profile && !u.vehicle);
      expect(templates.filter((t) => t.kind === 'unit' && t.key.startsWith(`${k}/`)).length).toBe(fighters.length);
    }
    expect(templates.filter((t) => t.kind === 'beast')).toHaveLength(data.BESTIARY.length);
    expect(new Set(templates.map((t) => t.key)).size).toBe(templates.length);
  });

  it('copies a warband model’s profile, type and rules', () => {
    const capt = byKey('merc/capt');
    expect(capt).toMatchObject({ name: 'Mercenary Captain', source: 'Mercenaries', type: 'Hero', count: 1 });
    expect(capt.profile).toEqual({ M: '4', WS: '4', BS: '4', S: '3', T: '3', W: '1', I: '4', A: '1', Ld: '8' });
    expect(byKey('merc/warr').type).toBe('Henchman');
  });

  it('copies a Hired Sword with its equipment, rules and the save its armour gives', () => {
    const ogre = byKey('hired/ogre');
    expect(ogre).toMatchObject({ name: 'Ogre Bodyguard', type: 'Hired Sword', sv: '6+' });
    expect(ogre.equipment).toMatch(/Light Armour/);
    expect(ogre.rules).toMatch(/^Fear: /m);
  });

  it('gives a Dramatis Persona with personas one template per persona, its fixed skills with their text', () => {
    const luthor = templates.filter((t) => t.key.startsWith('dramatis/luthorwolfenbaum/'));
    expect(luthor.length).toBe(data.DRAMATIS.luthorwolfenbaum!.personas!.length);
    expect(luthor[0]!.name).toMatch(/^Luthor Wolfenbaum – /);
    expect(luthor[0]!.skills.map((s) => s.name)).toContain('Step Aside');
    expect(luthor[0]!.skills.find((s) => s.name === 'Step Aside')!.text).not.toBe('');
  });

  it('copies a beast with its rules and its own save', () => {
    expect(byKey('beast/templedog')).toMatchObject({ name: 'Temple Dog', type: 'Animal', sv: '5+', source: 'Bestiary · Border Town Burning' });
    expect(byKey('beast/giantspider').profile.S).toBe('3(4)');
    expect(byKey('beast/coldone').rules.split('\n')).toEqual(['Fear: Causes fear.', expect.stringMatching(/^Stupid: /), expect.stringMatching(/^Scaly: /)]);
  });
});

describe('warriorTemplates', () => {
  const save = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as unknown;
  const r = core.loadSave(data, save);
  if (!r.ok) throw new Error(r.msg);
  const ctx = core.ctxOf(data, r.state);
  const list = core.warriorTemplates(ctx, 'w-1', 'The Silver Caravan');

  it('takes each warrior as he stands: profile with his advances, skills with their text, equipment', () => {
    const fighters = ctx.s.models.filter((m) => core.effProfile(ctx, m));
    expect(list).toHaveLength(fighters.length);
    const m = fighters[0]!;
    const t = list[0]!;
    expect(t).toMatchObject({ kind: 'warrior', key: `w-1/${m.uid}`, source: 'The Silver Caravan' });
    expect(t.profile.WS).toBe(String(core.effProfile(ctx, m)!.WS));
    expect(t.skills.map((s) => s.name)).toEqual(m.skills ?? []);
    expect(t.equipment).toBe([...core.eqDisplayParts(ctx, m), ...core.rareDisplayParts(ctx, m)].join(', '));
  });

  it('counts the men of a henchman group', () => {
    const group = ctx.s.models.find((m) => !core.isHeroModel(ctx, m) && core.memberCount(m) > 1);
    if (group) expect(list.find((t) => t.key === `w-1/${group.uid}`)!.count).toBe(core.memberCount(group));
    expect(list.some((t) => t.type === 'Henchman')).toBe(true);
  });
});

describe('searching', () => {
  it('finds by every word, names that start with the query first, and keeps to the kinds asked for', () => {
    const ogres = core.searchTemplates(templates, 'ogre');
    expect(ogres[0]!.name.toLowerCase().startsWith('ogre')).toBe(true);
    expect(core.searchTemplates(templates, 'captain mercenaries').map((t) => t.key)).toContain('merc/capt');
    expect(core.searchTemplates(templates, 'dog', ['beast']).map((t) => t.key)).toEqual(['beast/wardog', 'beast/templedog']);
    expect(core.searchTemplates(templates, '', ['beast'])).toHaveLength(data.BESTIARY.length);
    expect(core.searchTemplates(templates, 'zzzz')).toEqual([]);
  });

  it('the skill catalogue knows the standard lists and the warbands’ own sets, with their text', () => {
    const skills = core.skillCatalog(data);
    const step = skills.find((s) => s.name === 'Step Aside')!;
    expect(step.list).toBe(data.SKILLLISTS.combat!.name);
    expect(step.text.length).toBeGreaterThan(10);
    expect(skills.some((s) => Object.values(data.SKILLSETS).some((l) => l.name === s.list))).toBe(true);
    expect(core.searchSkills(skills, 'step')[0]!.name).toBe('Step Aside');
  });
});

describe('profiles and TTS', () => {
  it('a copy is the leader’s: changing it leaves the template alone', () => {
    const t = byKey('merc/capt');
    const p = core.profileFrom('p1', t);
    p.profile.WS = '5';
    p.skills.push({ name: 'Mighty Blow', text: '+1 to injury rolls.' });
    expect(t.profile.WS).toBe('4');
    expect(t.skills).toEqual([]);
    expect(p.from).toEqual({ kind: 'unit', key: 'merc/capt', label: 'Mercenary Captain (Mercenaries)' });
    expect(core.profileFrom('p2', null)).toMatchObject({ id: 'p2', name: '', type: 'Henchman', count: 1, profile: {}, from: null });
  });

  it('a card reads like a warband model’s: statline with the save, rules and skills, equipment', () => {
    const p: core.OpponentProfile = {
      ...core.profileFrom('p1', null), name: 'Old Marek', type: 'Hero', profile: { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '2', I: '4', A: '2', Ld: '8' }, sv: '5+',
      skills: [{ name: 'Step Aside', text: 'A 5+ save in close combat.' }, { name: 'Ferryman’s Luck', text: '' }], equipment: 'Boat hook, dagger', rules: '• Fear: causes fear\nKnows the Stir',
    };
    expect(core.ttsOpponentName(p)).toBe('[B8860B]Old Marek[-]');
    expect(core.ttsOpponentName({ name: 'Ferryman', type: 'Henchman' })).toBe('[E8C26B]Ferryman[-]');
    expect(core.ttsOpponentText(p)).toBe(
      '[7AD1A4]M 4   WS 4   BS 3   S 3   T 3   W 2   I 4   A 2   Ld 8   Sv 5+[-]\n'
      + '[5ACFFF]Special Rules:[-]\n• Fear: causes fear\n• Knows the Stir\n• Step Aside: A 5+ save in close combat.\n• Ferryman’s Luck\n'
      + '[5ACFFF]Equipment:[-] Boat hook, dagger');
    expect(core.ttsOpponentText(core.profileFrom('p2', null))).toBe('[5ACFFF]Special Rules:[-]\nNone\n[5ACFFF]Equipment:[-] None');
  });
});

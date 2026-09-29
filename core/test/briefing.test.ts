/* core/narrative: the briefing for one battle, told with core's own actions:
   two warbands fight, one Hero falls, another is wounded, a champion puts an
   enemy down and advances, and the players have explained some of it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(wb: string, name: string, units: string[]): WarbandState {
  let s: WarbandState = { ...core.newWarband(data, wb), name, campaign: { on: true, districts: {} } };
  for (const u of units) s = core.addUnit(ctx(s), u);
  return s;
}

describe('buildBriefing', () => {
  const beforeA = band('merc', 'Silver Caravan', ['capt', 'champ', 'warr']);
  const [capt, champ] = beforeA.models;
  const beforeB = band('skaven', 'Clan Eshin Raiders', ['adept', 'vermin']);
  const [adept] = beforeB.models;

  // our side: the champion takes down the Assassin Adept, the captain falls
  let a = core.addCasualty(ctx(beforeA), { victim: { name: 'Assassin Adept', wb: 'skaven' }, attacker: { uid: champ!.uid, name: 'Champion' } });
  a = core.addCasualty(ctx(a), { victim: { uid: capt!.uid, name: 'Mercenary Captain', wb: 'merc' }, attacker: { name: 'Assassin Adept', wb: 'skaven' } });
  a = core.resolveCasualtyRoll(ctx(a), a.campaign!.casualties!.at(-1)!.id, '11-15');
  a = core.applyPendingXp(ctx(a));
  a = core.setModelExp(ctx(a), champ!.uid, 2);
  a = core.addAdvance(ctx(a), champ!.uid, 'WS');
  a = core.addSkillFromList(ctx(a), champ!.uid, 'Strike to Injure');
  const wsKey = core.diffWarbands(data, beforeA, a, 1).find((c) => c.kind === 'stat')!.changeKey;
  a = { ...a, story: { explain: { [wsKey]: 'He learned from watching the captain die.' }, interludes: { 1: 'They buried him by the river.' } },
    canon: { name_de: 'Die Silberne Karawane', name_en: 'The Silver Caravan' },
    models: a.models.map((m) => (m.uid === champ!.uid ? { ...m, profile: { name_de: 'Honnung', name_en: 'Honnung', title_en: 'the Grim', voice: 'terse' } } : m)) };

  // their side: the adept is wounded
  let b = core.addCasualty(ctx(beforeB), { victim: { uid: adept!.uid, name: 'Assassin Adept', wb: 'skaven' }, attacker: { name: 'Champion', wb: 'merc' } });
  b = core.resolveCasualtyRoll(ctx(b), b.campaign!.casualties!.at(-1)!.id, '26');

  const md = core.buildBriefing(data, {
    campaign: 'The Autumn of Rats',
    battle: { round: 1, title: 'Ambush at the Well', district: data.DISTRICTS[0]!.id, playedAt: '2026-09-26' },
    warbands: [
      { player: 'Rob', outcome: 'Defeat', before: beforeA, after: a },
      { player: 'Anna', outcome: 'Victory', before: beforeB, after: b },
    ],
    notes: [
      { kind: 'scene', text: 'Fog rolled in from the river.', turn: 1, author: 'Rob' },
      { kind: 'quote', text: '"Hold the line!"', author: 'Mercenary Captain' },
      { kind: 'hook', text: 'Who paid the Eshin to strike?' },
    ],
  });

  it('names the battle, the place and who fought', () => {
    expect(md).toMatch(/^# The Autumn of Rats — Battle 1: Ambush at the Well/);
    expect(md).toContain(`Location: ${data.DISTRICTS[0]!.name}`);
    expect(md).toContain('- **Silver Caravan** (Mercenaries), played by Rob — Defeat');
    expect(md).toContain('- **Clan Eshin Raiders** (Skaven), played by Anna — Victory');
  });

  it('tells the course from the protocol and the notes, quotes apart', () => {
    expect(md).toContain('- Assassin Adept (Skaven) was put out of action by Champion (Silver Caravan)');
    expect(md).toContain('- Mercenary Captain (Silver Caravan) was put out of action by Assassin Adept (Skaven) — dead: Dead');
    expect(md).toContain('- [scene] (turn 1) Fog rolled in from the river. — Rob');
    expect(md).toContain('> "Hold the line!" — Mercenary Captain');
    expect(md).toContain('## Open threads\n\n- Who paid the Eshin to strike?');
  });

  it('lists the aftermath per warband', () => {
    const after = md.slice(md.indexOf('## Aftermath'), md.indexOf('## Advances'));
    expect(after).toContain('### Silver Caravan');
    expect(after).toContain('**Mercenary Captain** was slain.');
    expect(after).toContain('### Clan Eshin Raiders');
    expect(after).toContain('**Assassin Adept** suffered Chest Wound.');
  });

  it('gives each advance its explanation and what the warrior did in this battle', () => {
    const adv = md.slice(md.indexOf('## Advances'), md.indexOf('## Other changes') >= 0 ? md.indexOf('## Other changes') : md.indexOf('## Interludes'));
    expect(adv).toContain('**Champion** +1 WS. In this battle: put Assassin Adept out of action. Explanation: He learned from watching the captain die.');
    expect(adv).toContain('**Champion** learned Strike to Injure. In this battle: put Assassin Adept out of action.');
  });

  it('carries interludes and the canon in both languages', () => {
    expect(md).toContain('## Interludes\n\n### Silver Caravan\n\nThey buried him by the river.');
    expect(md).toContain('- Warband: DE “Die Silberne Karawane”, EN “The Silver Caravan”');
    expect(md).toContain('- Champion (Silver Caravan): DE “Honnung”; EN “Honnung, the Grim”; voice: terse');
  });

  it('counts the explanations still missing', () => {
    const miss = md.slice(md.indexOf('## Missing explanations'));
    expect(miss).toContain('- Silver Caravan: 2 (Champion learned Strike to Injure; Mercenary Captain was slain)');
    expect(miss).toContain('- Clan Eshin Raiders: 1 (Assassin Adept suffered Chest Wound)');
  });
});

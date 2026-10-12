/* core/narrative: the AI pack for one battle – the briefing's material plus the
   background with its hard rules, in a versioned layout. Pure formatting: the
   input is plain data, as a leader's device gathers it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { PackInput, PackPart } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

const change = (kind: core.ChangeKind, uid: number | null, name: string, payload: Record<string, unknown>, unexplained = false): core.PackChange =>
  ({ kind, uid, name, payload, changeKey: `1:${uid ?? 'wb'}:${kind}:${Object.values(payload).join('/')}`, unexplained });

const wsKey = change('stat', 2, 'Ulrich the Grey', { stat: 'WS', before: 4, after: 5 }).changeKey;

const INPUT: PackInput = {
  campaign: 'The Hel Fenn Campaign',
  battle: { round: 5, title: 'The Old Mill', district: 'Merchants’ Quarter', playedAt: '2026-09-22', scenario: { title: 'Fog on the Stir', rules: 'Fog covers the table.\nNo shooting beyond 8".' } },
  warbands: [
    {
      warbandId: 'w-silver', name: 'The Silver Caravan', type: 'Mercenaries', player: 'Anna', outcome: 'Victory',
      changes: [
        change('died', 7, 'Hans', { hero: true }),
        change('injury', 5, 'Magda', { added: true, injury: 'Leg Wound' }, true),
        change('stat', 2, 'Ulrich the Grey', { stat: 'WS', before: 4, after: 5 }),
        change('recruited', null, 'The Silver Caravan', { unit: 'Warrior', qty: 1 }),
      ],
      explain: { [wsKey]: 'He learned it the hard way.' },
      interlude: 'They buried Hans by the river.',
    },
    { warbandId: 'w-skrittle', name: 'Clan Skrittle', type: 'Skaven', player: 'Ben', outcome: 'Defeat', changes: [], explain: {}, interlude: '' },
  ],
  casualties: [
    { victim: { warbandId: 'w-skrittle', uid: 3, name: 'Grot' }, attacker: { warbandId: 'w-silver', uid: 2, name: 'Ulrich the Grey' } },
    { victim: { warbandId: 'w-silver', uid: 7, name: 'Hans' }, attacker: { warbandId: 'w-skrittle', uid: 4, name: 'Skritch' } },
  ],
  story: [
    { segment: 'before', label: 'Scene', quote: false, turn: null, author: 'Ben', text: 'Skritch goes for the captain.', opened: true },
    { segment: 'course', label: 'Protocol', quote: false, turn: 2, author: 'Anna', text: 'Grot was put out of action by Ulrich the Grey', opened: false },
    { segment: 'course', label: 'Quote', quote: true, turn: 3, author: 'Ulrich the Grey', text: 'Hold the door.\nHold it.', opened: false },
  ],
  roundNotes: [{ label: 'Note', author: 'Ben', text: 'The rats drag Grot home on a door.', quote: false }],
  canon: [{ name: 'Ulrich the Grey', warband: 'The Silver Caravan', de: 'Ulrich der Graue', en: 'Ulrich the Grey', voice: 'few words, all of them orders', origin: '' }],
  world: {
    districts: [{ name: 'Merchants’ Quarter', heldBy: 'The Silver Caravan' }],
    factions: [{ name: 'The Ferrymen', other: 'Die Fährleute', status: 'hold the Stir crossing' }],
    people: [{ name: 'Old Marek', other: '', faction: 'The Ferrymen', status: 'alive' }],
    reputation: [{ warband: 'The Silver Caravan', faction: 'The Ferrymen', value: -2 }],
  },
  background: [
    { kind: 'thread', title: 'The eel coin', truth: 'The Countess pays the ferrymen.', playersKnow: 'A coin with an eel on it.', rule: 'hint', hintLimits: 'a coin, an eel, wet money', revealedFrom: '' },
    { kind: 'figure', title: 'The Pale Man', truth: 'He is the ferryman’s brother.', playersKnow: '', rule: 'hidden', hintLimits: '', revealedFrom: '' },
    { kind: 'place', title: 'The Old Mill', truth: 'It was a smugglers’ cellar.', playersKnow: 'The mill burned.', rule: 'revealed', hintLimits: '', revealedFrom: 'Battle 4' },
  ],
  chapters: [{ label: 'Prolog', title: 'On Wings of Fire', icDate: '', place: '', victor: '' }, { label: 'Chapter 4', title: 'The Ferry', icDate: '3rd of Nachgeheim', place: 'Stir', victor: 'The Silver Caravan' }],
  lastChapter: { heading: 'Chapter 4 · The Ferry', text: 'The ferry came out of the fog.\n' },
  style: 'German, past tense, close third person.\nNo dice, no game terms.',
};

const ALL = core.PACK_PARTS as readonly PackPart[];
const pack = (o: Partial<{ parts: readonly PackPart[]; lang: core.PackLang }> = {}, input: PackInput = INPUT) => core.buildPack(data, input, { parts: ALL, lang: 'de', ...o });

describe('buildPack', () => {
  const md = pack();

  it('says which layout it is, names the battle and tells the writer the rules of the job', () => {
    expect(md.split('\n')[0]).toBe(`<!-- mordheim-ai-pack format=${core.PACK_FORMAT} -->`);
    expect(core.PACK_FORMAT).toBe(1);
    expect(md).toContain('# The Hel Fenn Campaign — Battle 5: The Old Mill');
    expect(md).toContain('Never state what the background marks as hidden, and hint only where it allows.');
    expect(md).toContain('Quotes are verbatim');
  });

  it('names who fought, where and the scenario with its rules', () => {
    expect(md).toContain('Location: Merchants’ Quarter · Scenario: Fog on the Stir · Played: 2026-09-22');
    expect(md).toContain('- **The Silver Caravan** (Mercenaries), played by Anna — Victory');
    expect(md).toContain('- **Clan Skrittle** (Skaven), played by Ben — Defeat');
    expect(md).toContain('### The scenario: Fog on the Stir\n\nFog covers the table.\nNo shooting beyond 8".');
  });

  it('tells the battle in story order: before, course, aftermath; a quote verbatim and apart; a sealed note marked as opened', () => {
    const at = (s: string) => md.indexOf(s);
    expect(at('### Before the battle')).toBeGreaterThan(0);
    expect(at('### Before the battle')).toBeLessThan(at('### The course of the battle'));
    expect(md).not.toContain('### Aftermath\n\n- '); // nothing recorded after the battle in this input
    expect(md).toContain('- Scene (sealed, opened) (Ben): Skritch goes for the captain.');
    expect(md).toContain('- Protocol (turn 2, Anna): Grot was put out of action by Ulrich the Grey');
    expect(md).toContain('- Quote (turn 3, Ulrich the Grey):\n> Hold the door.\n> Hold it.');
  });

  it('gives the aftermath and advances per warband, with the explanation and what the warrior did in this battle', () => {
    expect(md).toContain('## Aftermath\n\n### The Silver Caravan');
    expect(md).toContain('- **Hans** was slain.');
    expect(md).toContain('- **Magda** suffered Leg Wound. *(no recorded cause)*');
    expect(md).toContain('- **Ulrich the Grey** +1 WS. In this battle: put Grot out of action. Explanation: He learned it the hard way.');
    expect(md).toContain('- **The Silver Caravan** joined the warband (Warrior).');
    expect(md).toContain('## Interludes\n\n### The Silver Caravan\n\nThey buried Hans by the river.');
  });

  it('counts the explanations still missing: only a change with no cause and no words', () => {
    expect(md).toContain('## Missing explanations\n\n- The Silver Caravan: 1 (Magda suffered Leg Wound)');
    const told = pack({}, { ...INPUT, warbands: [{ ...INPUT.warbands[0]!, explain: { ...INPUT.warbands[0]!.explain, [change('injury', 5, 'Magda', { added: true, injury: 'Leg Wound' }).changeKey]: 'A rat bit her.' } }, INPUT.warbands[1]!] });
    expect(told).toContain('None — every change has its explanation or its cause.');
    expect(told).toContain('Explanation: A rat bit her. *(no recorded cause)*');
  });

  it('writes the canon as a table with both languages, voice and origin; a pipe cannot break the table', () => {
    expect(md).toContain('| Ulrich the Grey | Ulrich der Graue | voice: few words, all of them orders | The Silver Caravan |');
    const odd = pack({}, { ...INPUT, canon: [{ name: 'A|B', warband: 'X', de: '', en: '', voice: 'one\ntwo', origin: '' }] });
    expect(odd).toContain('| A/B | A/B | voice: one two | X |');
  });

  it('writes the world: districts, factions, people and the standing', () => {
    expect(md).toContain('Districts held:\n- Merchants’ Quarter — The Silver Caravan');
    expect(md).toContain('- **The Ferrymen** (Die Fährleute) — hold the Stir crossing');
    expect(md).toContain('- **Old Marek**, The Ferrymen — alive');
    expect(md).toContain('- The Silver Caravan with The Ferrymen: −2');
  });

  it('gives every piece of the background its rule as a hard rule, with the truth for the writer', () => {
    expect(md).toContain('## Background — hard rules ⚑');
    expect(md).toContain('### The eel coin (thread)\n\nRule: HINT ONLY — never state the truth. May be hinted, within these limits: a coin, an eel, wet money.');
    expect(md).toContain('The truth: The Countess pays the ferrymen.');
    expect(md).toContain('What the players know: A coin with an eel on it.');
    expect(md).toContain('### The Pale Man (figure)\n\nRule: HIDDEN — the players know nothing of this. Do not state it and do not hint at it');
    expect(md).toContain('### The Old Mill (place)\n\nRule: REVEALED — public since Battle 4; may be told as the players know it.');
  });

  it('names the chapters so far and gives the last one in full', () => {
    expect(md).toContain('- Prolog · On Wings of Fire');
    expect(md).toContain('- Chapter 4 · The Ferry (3rd of Nachgeheim, Stir, victor: The Silver Caravan)');
    expect(md).toContain('### The last chapter in full: Chapter 4 · The Ferry\n\nThe ferry came out of the fog.');
  });

  it('ends with the style, and the notes of the round come before the background', () => {
    expect(md.trimEnd().endsWith('## Style\n\nGerman, past tense, close third person.\nNo dice, no game terms.')).toBe(true);
    expect(md.indexOf('## Notes of the round')).toBeLessThan(md.indexOf('## Background'));
    expect(md).toContain('- Note (Ben): The rats drag Grot home on a door.');
  });
});

describe('buildPack – what a leader chooses', () => {
  it('leaves out a part that is not chosen; the battle is always in', () => {
    const without = (p: PackPart) => pack({ parts: ALL.filter((x) => x !== p) });
    expect(without('background')).not.toContain('Background — hard rules');
    expect(without('background')).not.toContain('The Countess pays the ferrymen.');
    expect(without('aftermath')).not.toContain('## Aftermath');
    expect(without('canon')).not.toContain('## Canon');
    expect(without('world')).not.toContain('## World');
    expect(without('notes')).not.toContain('## Notes of the round');
    expect(without('story')).not.toContain('## The story so far');
    expect(without('style')).not.toContain('## Style');
    const bare = pack({ parts: [] });
    expect(bare).toContain('## The battle, in story order');
    expect(bare).toContain('## Who fought');
    for (const h of ['## Aftermath', '## Canon', '## World', '## Notes of the round', '## Background', '## The story so far', '## Style']) expect(bare).not.toContain(h);
  });

  it('says in which language the chapter is to be written', () => {
    expect(pack({ lang: 'de' })).toContain('Write the chapter in German.');
    expect(pack({ lang: 'en' })).toContain('Write the chapter in English.');
    expect(pack({ lang: 'both' })).toContain('Write the chapter in German, then give an English version of it.');
  });

  it('leaves out a section that has nothing in it, instead of an empty heading', () => {
    const empty = pack({}, { ...INPUT, canon: [], world: { districts: [], factions: [], people: [], reputation: [] }, roundNotes: [], background: [], chapters: [], lastChapter: null, style: '  ' });
    for (const h of ['## Canon', '## World', '## Notes of the round', '## Background', '## The story so far', '## Style']) expect(empty).not.toContain(h);
  });

  it('says so when nothing was recorded of the battle', () => {
    expect(pack({}, { ...INPUT, story: [] })).toContain('## The battle, in story order\n\nNothing was recorded.');
  });
});

describe('ruleText and packSize', () => {
  it('a hint without limits says it may be hinted only in passing', () => {
    expect(core.ruleText({ rule: 'hint', hintLimits: '  ', revealedFrom: '' })).toBe('HINT ONLY — never state the truth. May be hinted in passing, so that a careful reader can guess.');
    expect(core.ruleText({ rule: 'revealed', hintLimits: '', revealedFrom: '' })).toBe('REVEALED — public; may be told as the players know it.');
  });
  it('counts characters and about four to a token', () => {
    expect(core.packSize('x'.repeat(400))).toEqual({ chars: 400, tokens: 100 });
  });
});

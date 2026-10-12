/* core/narrative/story: what a player writes about their warband – prologue,
   interludes, explanations, profiles, the warband's names – lives in the
   save and is held to the limits the schema (and so the server) enforces. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { warbandSaveSchema } from '../src/format/schema.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const band = () => {
  let s: WarbandState = { ...core.newWarband(data, 'merc'), name: 'Silver Caravan' };
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'champ');
  return { ...s, hired: [{ key: 'ogre', uid: 'hs1' }] } as WarbandState;
};

describe('the prologue and the interludes', () => {
  it('keeps what is written, trimmed, and nothing when it is emptied again', () => {
    const s0 = band();
    expect(core.storyOf(s0)).toEqual({ prologue: '', interludes: {}, explain: {} });
    const s1 = core.setPrologue(ctx(s0), '  The Caravan came up the Reik.\r\n\r\nSalt and powder.  ');
    expect(core.storyOf(s1).prologue).toBe('The Caravan came up the Reik.\n\nSalt and powder.');
    expect(s1.story).toEqual({ prologue: 'The Caravan came up the Reik.\n\nSalt and powder.', interludes: {}, explain: {} });
    const s2 = core.setInterlude(ctx(s1), 2, 'Two quiet days at the Blind Cat.');
    expect(core.storyOf(s2).interludes).toEqual({ 2: 'Two quiet days at the Blind Cat.' });
    // emptied: gone; the last text gone: no story key left in the save
    const s3 = core.setInterlude(ctx(s2), 2, '   ');
    expect(core.storyOf(s3).interludes).toEqual({});
    const s4 = core.setPrologue(ctx(s3), '');
    expect('story' in s4).toBe(false);
  });

  it('returns the very state it was given when nothing changes', () => {
    const s = core.setPrologue(ctx(band()), 'Once.');
    expect(core.setPrologue(ctx(s), 'Once.')).toBe(s);
    expect(core.setPrologue(ctx(s), '  Once.  ')).toBe(s);
    const b = band();
    expect(core.setPrologue(ctx(b), '')).toBe(b);
    expect(core.setInterlude(ctx(b), 3, '')).toBe(b);
    expect(core.setExplanation(ctx(b), '1:2:stat:WS', '')).toBe(b);
  });

  it('only writes an interlude for a round that can exist', () => {
    const b = band();
    for (const round of [0, -1, 201, NaN]) expect(core.setInterlude(ctx(b), round, 'x')).toBe(b);
    expect(core.storyOf(core.setInterlude(ctx(b), 200, 'x')).interludes).toEqual({ 200: 'x' });
    expect(core.storyOf(core.setInterlude(ctx(b), 3.9, 'x')).interludes).toEqual({ 3: 'x' });
  });

  it('cuts a text at its limit', () => {
    const long = 'a'.repeat(core.STORY_LIMITS.prologue + 500);
    expect(core.storyOf(core.setPrologue(ctx(band()), long)).prologue).toHaveLength(core.STORY_LIMITS.prologue);
  });

  it('reads a story hand-edited into junk as an empty one, and writes over it', () => {
    const junk = { ...band(), story: { prologue: 7, interludes: ['a'], explain: { 'k': 3, 'j': 'fine' } } } as WarbandState;
    expect(core.storyOf(junk)).toEqual({ prologue: '', interludes: {}, explain: { j: 'fine' } });
    const fixed = core.setPrologue(ctx(junk), 'Now text.');
    expect(fixed.story).toEqual({ prologue: 'Now text.', interludes: {}, explain: { j: 'fine' } });
  });
});

describe('the explanation of a change', () => {
  it('hangs on the change key and is taken away when emptied', () => {
    const s0 = band();
    const s1 = core.setExplanation(ctx(s0), '1:2:stat:WS', 'He learned from watching the captain die.');
    expect(core.storyOf(s1).explain).toEqual({ '1:2:stat:WS': 'He learned from watching the captain die.' });
    const s2 = core.setExplanation(ctx(s1), '1:2:stat:WS', '');
    expect('story' in s2).toBe(false);
  });

  it('refuses a key that is too long and a swarm of explanations', () => {
    const b = band();
    expect(core.setExplanation(ctx(b), 'k'.repeat(core.STORY_LIMITS.key + 1), 'x')).toBe(b);
    let s = b;
    for (let i = 0; i < core.STORY_LIMITS.explanations; i++) s = core.setExplanation(ctx(s), `k${i}`, 'x');
    expect(Object.keys(core.storyOf(s).explain)).toHaveLength(core.STORY_LIMITS.explanations);
    expect(core.setExplanation(ctx(s), 'one more', 'x')).toBe(s);
    // an explanation already there may still be changed or taken away
    expect(core.storyOf(core.setExplanation(ctx(s), 'k0', 'y')).explain.k0).toBe('y');
  });

  it('is what the briefing counts as missing', () => {
    const before = band();
    const after = core.setModelExp(ctx(before), before.models[1]!.uid, 2);
    const advanced = core.addAdvance(ctx(after), before.models[1]!.uid, 'WS');
    const changes = core.diffWarbands(data, before, advanced, 1);
    const stat = changes.find((c) => c.kind === 'stat')!;
    expect(core.missingExplanations(changes, {}).map((c) => c.changeKey)).toContain(stat.changeKey);
    const explained = core.setExplanation(ctx(advanced), stat.changeKey, 'Training in the cellar.');
    expect(core.missingExplanations(changes, core.storyOf(explained).explain).map((c) => c.changeKey)).not.toContain(stat.changeKey);
  });
});

describe('a profile', () => {
  it('belongs to a hero by his uid, to a Hired Sword by his text uid, and keeps only what is filled in', () => {
    const s0 = band();
    const hero = s0.models[1]!.uid;
    const s1 = core.setProfile(ctx(s0), hero, { name_de: ' Honnung ', name_en: 'Honnung', title_en: 'the Grim', voice: 'terse', origin: '', text: 'Once a ferryman.' });
    expect(core.profileOf(s1.models[1])).toEqual({ name_de: 'Honnung', name_en: 'Honnung', title_en: 'the Grim', voice: 'terse', text: 'Once a ferryman.' });
    const s2 = core.setProfile(ctx(s1), 'hs1', { name_de: 'Großer Gunnar', voice: 'rumbles' });
    expect(core.profileOf(s2.hired![0])).toEqual({ name_de: 'Großer Gunnar', voice: 'rumbles' });
    // a field changed by a patch that does not name the others
    const s3 = core.setProfile(ctx(s2), hero, { voice: 'terse, then loud' });
    expect(core.profileOf(s3.models[1])).toEqual({ name_de: 'Honnung', name_en: 'Honnung', title_en: 'the Grim', voice: 'terse, then loud', text: 'Once a ferryman.' });
    // the roster itself is untouched
    expect(s3.models[1]!.name).toBe(s0.models[1]!.name);
  });

  it('goes away with its last field, and changes nothing for a warrior who is not there', () => {
    const s0 = band();
    const hero = s0.models[1]!.uid;
    const s1 = core.setProfile(ctx(s0), hero, { voice: 'terse' });
    const s2 = core.setProfile(ctx(s1), hero, { voice: '' });
    expect('profile' in s2.models[1]!).toBe(false);
    expect(core.setProfile(ctx(s0), 999, { voice: 'x' })).toBe(s0);
    expect(core.setProfile(ctx(s0), 'nobody', { voice: 'x' })).toBe(s0);
    expect(core.setProfile(ctx(s1), hero, { voice: 'terse' })).toBe(s1);
  });

  it('cuts every field at its limit', () => {
    const s0 = band();
    const hero = s0.models[1]!.uid;
    const s1 = core.setProfile(ctx(s0), hero, { name_de: 'n'.repeat(500), voice: 'v'.repeat(5000), text: 't'.repeat(9000) });
    const p = core.profileOf(s1.models[1]);
    expect([p.name_de!.length, p.voice!.length, p.text!.length]).toEqual([core.STORY_LIMITS.name, core.STORY_LIMITS.voice, core.STORY_LIMITS.text]);
  });
});

describe('the warband’s names', () => {
  it('are kept in both languages', () => {
    const s1 = core.setCanon(ctx(band()), { name_de: 'Die Silberne Karawane', name_en: 'The Ardent Caravan' });
    expect(core.canonOf(s1)).toEqual({ name_de: 'Die Silberne Karawane', name_en: 'The Ardent Caravan' });
    const s2 = core.setCanon(ctx(s1), { name_de: '' });
    expect(core.canonOf(s2)).toEqual({ name_en: 'The Ardent Caravan' });
    expect('canon' in core.setCanon(ctx(s2), { name_en: '' })).toBe(false);
    expect(core.setCanon(ctx(s1), { name_en: 'The Ardent Caravan' })).toBe(s1);
  });
});

describe('in the save', () => {
  const written = () => {
    let s = band();
    s = core.setPrologue(ctx(s), 'The Caravan came up the Reik.');
    s = core.setInterlude(ctx(s), 1, 'Two quiet days.');
    s = core.setExplanation(ctx(s), '1:2:stat:WS', 'Training.');
    s = core.setProfile(ctx(s), s.models[1]!.uid, { name_de: 'Honnung', voice: 'terse' });
    s = core.setProfile(ctx(s), 'hs1', { name_de: 'Gunnar' });
    return core.setCanon(ctx(s), { name_de: 'Die Karawane', name_en: 'The Caravan' });
  };

  it('is written and read back whole, and the schema takes it', () => {
    const s = written();
    const file = JSON.parse(JSON.stringify(core.writeSave(ctx(s)))) as Record<string, unknown>;
    expect(warbandSaveSchema.safeParse(file).success).toBe(true);
    const back = core.loadSave(data, file);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.notes).toEqual([]);
    expect(back.state.story).toEqual(s.story);
    expect(back.state.canon).toEqual(s.canon);
    expect(core.profileOf(back.state.models[1])).toEqual({ name_de: 'Honnung', voice: 'terse' });
    expect(core.profileOf(back.state.hired![0])).toEqual({ name_de: 'Gunnar' });
  });

  it('is refused by the schema beyond its limits (the server keeps nothing larger)', () => {
    const file = () => JSON.parse(JSON.stringify(core.writeSave(ctx(written())))) as { story: { prologue: string; interludes: Record<string, string>; explain: Record<string, string> }; models: { profile?: Record<string, string> }[]; hired: { profile?: Record<string, string> }[]; canon: Record<string, string> };
    const refused = (change: (f: ReturnType<typeof file>) => void) => { const f = file(); change(f); return !warbandSaveSchema.safeParse(f).success; };
    expect(refused((f) => { f.story.prologue = 'a'.repeat(core.STORY_LIMITS.prologue + 1); })).toBe(true);
    expect(refused((f) => { f.story.interludes['1'] = 'a'.repeat(core.STORY_LIMITS.interlude + 1); })).toBe(true);
    expect(refused((f) => { f.story.explain['k'] = 'a'.repeat(core.STORY_LIMITS.explanation + 1); })).toBe(true);
    expect(refused((f) => { f.story.explain['k'.repeat(core.STORY_LIMITS.key + 1)] = 'x'; })).toBe(true);
    expect(refused((f) => { for (let i = 0; i <= core.STORY_LIMITS.explanations; i++) f.story.explain[`k${i}`] = 'x'; })).toBe(true);
    expect(refused((f) => { for (let i = 0; i <= core.STORY_LIMITS.interludes; i++) f.story.interludes[String(i)] = 'x'; })).toBe(true);
    expect(refused((f) => { f.models[1]!.profile!.voice = 'a'.repeat(core.STORY_LIMITS.voice + 1); })).toBe(true);
    expect(refused((f) => { f.hired[0]!.profile!.text = 'a'.repeat(core.STORY_LIMITS.text + 1); })).toBe(true);
    expect(refused((f) => { f.canon.name_en = 'a'.repeat(core.STORY_LIMITS.name + 1); })).toBe(true);
    expect(refused(() => undefined)).toBe(false);
  });

  it('is written without touching the state it was made from', () => {
    const s = deepFreeze(written());
    const next = core.setProfile(ctx(s), s.models[1]!.uid, { voice: 'louder' });
    expect(core.profileOf(next.models[1]).voice).toBe('louder');
    expect(core.profileOf(s.models[1]).voice).toBe('terse');
    expect(core.setPrologue(ctx(s), 'Another beginning.').story).toMatchObject({ prologue: 'Another beginning.' });
    expect(core.setExplanation(ctx(s), '1:2:stat:WS', '').story).toMatchObject({ explain: {} });
  });
});

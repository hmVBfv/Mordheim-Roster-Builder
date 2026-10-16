/* The chronicle as one file (phase 4b5a): in the story's order, in the chosen language, the other one named where a chapter lacks it. */
import { describe, expect, it } from 'vitest';
import type { Chapter } from '../timeline/api.ts';
import { chronicleMarkdown, told } from './download.ts';

const lang = (title: string, text: string, o: Partial<{ label: string; icDate: string; place: string; victor: string }> = {}) => ({ label: '', icDate: '', place: '', victor: '', ...o, title, text });
const chapter = (id: string, de: ReturnType<typeof lang> | null, en: ReturnType<typeof lang> | null): Chapter =>
  ({ id, refKey: id, kind: 'chapter', publishedOn: null, createdAt: '', updatedAt: '', de, en });

const prologue = chapter('prolog', lang('Der Weg nach Mordheim', 'Der Regen fiel.', { label: 'Prolog' }), lang('The road to Mordheim', 'The rain fell.', { label: 'Prologue' }));
const one = chapter('battle-1', lang('Das Rathaus', 'Das Rathaus stand noch.', { label: 'Kapitel 1', icDate: '3. Nachgeheim', place: 'Mordheim', victor: 'Die Silberne Karavane' }), null);
const two = chapter('battle-2', null, lang('What the rats took', 'In the morning a man was missing.', { label: 'Chapter 2' }));

describe('told', () => {
  it('gives the language asked for, else the other one, and says so; nothing when there is none', () => {
    expect(told(prologue, 'en')).toMatchObject({ lang: 'en', fallback: false });
    expect(told(one, 'en')).toMatchObject({ lang: 'de', fallback: true });
    expect(told(chapter('x', null, null), 'de')).toBeNull();
  });
});

describe('chronicleMarkdown', () => {
  const all = [{ segment: 'Before the campaign', chapter: prologue }, { segment: 'Battle 1 · course', chapter: one }, { segment: 'Battle 2 · course', chapter: two }];

  it('puts the chapters in the order given, each under its heading, with its place and its text as written', () => {
    const { md, fallbacks } = chronicleMarkdown('The Hel Fenn Campaign', 'de', all);
    expect(md.split('\n')[0]).toBe('# The Hel Fenn Campaign — Chronicle (Deutsch)');
    expect(md.indexOf('## Prolog · Der Weg nach Mordheim')).toBeLessThan(md.indexOf('## Kapitel 1 · Das Rathaus'));
    expect(md).toContain('*3. Nachgeheim · Mordheim · Battle 1 · course*');
    expect(md).toContain('> Die Silberne Karavane');
    expect(md).toContain('Der Regen fiel.');
    expect(md.split('\n---\n')).toHaveLength(3);
    expect(fallbacks).toBe(1); // chapter 2 only in English
    expect(md).toContain('*(Only available in English.)*');
    expect(md).toContain('In the morning a man was missing.');
  });

  it('in English, the German-only chapter is given in German', () => {
    const { md, fallbacks } = chronicleMarkdown('The Hel Fenn Campaign', 'en', all);
    expect(md.split('\n')[0]).toBe('# The Hel Fenn Campaign — Chronicle (English)');
    expect(md).toContain('## Prologue · The road to Mordheim');
    expect(md).toContain('*(Only available in Deutsch.)*');
    expect(fallbacks).toBe(1);
  });

  it('without a chapter it says so instead of being empty', () => {
    expect(chronicleMarkdown('The Hel Fenn Campaign', 'de', []).md).toContain('No chapter has been published yet.');
  });
});

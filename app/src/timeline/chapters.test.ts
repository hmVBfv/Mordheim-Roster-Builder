/* The chronicle's files read (phase 4a5, part 2): front matter and body,
   German and English of one ref put together, the place in the story,
   the text as plain pieces. The files here are made up in the chronicle's
   form; the real ones were read with the same code before the import. */
import { describe, expect, it } from 'vitest';
import type { BattleSummary } from '../battle/api.ts';
import { chapterPlace, groupChapters, guessLang, readChapterFile, readText, splitFrontMatter, type ChapterFile } from './chapters.ts';

const BATTLE_DE = `---
ref: "battle-1"
title: "Das Urteil im Nebel"
chapter: "Erste Schlacht"
ic_date: "Frühes Jahr 2000 IC"
place: "Quayside, Mordheim"
victor: >-
  Das Feld blieb den Reavers — die Karawane wich
  in den Nebel.
date: 2026-06-14
image: "quayside.jpg"
---

### Am Kai

Der Nebel lag über dem Stir, und die Möwen schrien nicht.
Niemand hatte den anderen erwartet.

**Ottilie** rang den Great Crest **Wonton** zu Boden.

---

Die Kinder des Sotek zogen sich zurück.
`;
const BATTLE_EN = `---
ref: "battle-1"
title: "The Verdict in the Fog"
chapter: "First Battle"
date: 2026-06-14
---

### At the Quay

The fog lay over the Stir, and the gulls did not cry. Nobody had expected the others.
`;
const PITS = `---
ref: "pits-interlude"
kind: "interlude"
title: 'What the Buyers Bid'
chapter: "Interlude"
---

They went down where it was cool, and the tallow smelled honest at least.
`;

const T = '2026-10-09T10:00:00Z';
const battle = (id: string, round: number, takenOver = true): BattleSummary => ({ id, round, title: '', status: 'closed', turn: 1, warbands: [], createdAt: `${T.slice(0, 18)}${round}Z`, closedAt: T, takenOver });

describe('a chronicle file', () => {
  it('its front matter – quoted, plain, a folded block – and its body', () => {
    const r = splitFrontMatter(BATTLE_DE)!;
    expect(r.front).toMatchObject({ ref: 'battle-1', title: 'Das Urteil im Nebel', chapter: 'Erste Schlacht', date: '2026-06-14', victor: 'Das Feld blieb den Reavers — die Karawane wich in den Nebel.' });
    expect(r.body.startsWith('### Am Kai')).toBe(true);
    expect(splitFrontMatter('no front matter')).toBeNull();
  });

  it('read: its ref, kind, language and day; what is missing is said', () => {
    expect(readChapterFile('2026-06-14-das-urteil-im-nebel.md', BATTLE_DE)).toMatchObject({ refKey: 'battle-1', kind: 'battle', lang: 'de', publishedOn: '2026-06-14', fields: { label: 'Erste Schlacht', icDate: 'Frühes Jahr 2000 IC', place: 'Quayside, Mordheim' } });
    expect(readChapterFile('x.md', BATTLE_EN)).toMatchObject({ lang: 'en' });
    // saved on Windows: a byte order mark, CRLF line ends
    expect(readChapterFile('x.md', `\uFEFF${BATTLE_EN.replace(/\n/g, '\r\n')}`)).toMatchObject({ refKey: 'battle-1', fields: { title: 'The Verdict in the Fog', text: expect.stringMatching(/^### At the Quay\n\nThe fog/) } });
    // the day from the file's name when the front matter has none
    expect(readChapterFile('2026-08-21-what-the-buyers-bid.md', PITS)).toMatchObject({ refKey: 'pits-interlude', kind: 'interlude', lang: 'en', publishedOn: '2026-08-21', fields: { title: 'What the Buyers Bid' } });
    expect(readChapterFile('notes.md', '# Notes\n\nNothing.')).toEqual({ file: 'notes.md', problem: 'no front matter (the lines between ---)' });
    expect(readChapterFile('a.md', '---\ntitle: "A"\n---\nText')).toMatchObject({ problem: expect.stringMatching(/no ref/) });
    expect(readChapterFile('a.md', '---\nref: "battle-9"\n---\nText')).toMatchObject({ problem: 'no title' });
    expect(guessLang('Der Nebel und die Stadt')).toBe('de');
    expect(guessLang('The fog and the city')).toBe('en');
  });

  it('German and English of a ref become one chapter, in the order they were published', () => {
    const files = [readChapterFile('p.md', PITS), readChapterFile('en.md', BATTLE_EN), readChapterFile('de.md', BATTLE_DE)] as ChapterFile[];
    const all = groupChapters(files);
    expect(all.map((c) => [c.refKey, c.de?.title ?? null, c.en?.title ?? null])).toEqual([
      ['battle-1', 'Das Urteil im Nebel', 'The Verdict in the Fog'],
      ['pits-interlude', null, 'What the Buyers Bid'],
    ]);
  });

  it('its place: by its ref, else after the last battle chapter published before it, else before the campaign', () => {
    const battles = [battle('b2', 2), battle('b1', 1), battle('b3', 3, false)];
    const segments = ['pre', 'bb1:battle', 'i1', 'bb2:battle', 'i2', 'bb3:before', 'bb3:battle', 'bb3:after', 'i3'];
    const all = [{ refKey: 'battle-1', publishedOn: '2026-06-14' }, { refKey: 'battle-2', publishedOn: '2026-06-28' }, { refKey: 'pits', publishedOn: '2026-07-01' }];
    expect(chapterPlace({ refKey: 'prolog', kind: 'prologue', publishedOn: '2026-06-01' }, all, battles, segments)).toBe('pre');
    expect(chapterPlace({ refKey: 'battle-2', kind: 'battle', publishedOn: '2026-06-28' }, all, battles, segments)).toBe('bb2:battle');
    expect(chapterPlace({ refKey: 'battle-3', kind: 'battle', publishedOn: null }, all, battles, segments)).toBe('bb3:battle');
    expect(chapterPlace({ refKey: 'interlude-1', kind: 'interlude', publishedOn: '2026-06-21' }, all, battles, segments)).toBe('i1');
    expect(chapterPlace({ refKey: 'pits', kind: 'interlude', publishedOn: '2026-07-01' }, all, battles, segments)).toBe('i2');
    expect(chapterPlace({ refKey: 'battle-7', kind: 'battle', publishedOn: '2026-05-01' }, all, battles, segments)).toBe('pre');
  });

  it('the text as plain pieces: headings, rules, paragraphs with the names in bold', () => {
    const r = readChapterFile('de.md', BATTLE_DE) as ChapterFile;
    expect(readText(r.fields.text)).toEqual([
      { kind: 'heading', text: 'Am Kai' },
      { kind: 'para', pieces: [{ strong: false, text: 'Der Nebel lag über dem Stir, und die Möwen schrien nicht. Niemand hatte den anderen erwartet.' }] },
      { kind: 'para', pieces: [{ strong: true, text: 'Ottilie' }, { strong: false, text: ' rang den Great Crest ' }, { strong: true, text: 'Wonton' }, { strong: false, text: ' zu Boden.' }] },
      { kind: 'rule' },
      { kind: 'para', pieces: [{ strong: false, text: 'Die Kinder des Sotek zogen sich zurück.' }] },
    ]);
    // markup it does not know stays text: nothing becomes HTML
    expect(readText('<script>alert(1)</script>')).toEqual([{ kind: 'para', pieces: [{ strong: false, text: '<script>alert(1)</script>' }] }]);
  });
});

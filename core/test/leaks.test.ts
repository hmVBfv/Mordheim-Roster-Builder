/* core/narrative: the check of a chapter text against the hidden background.
   It finds words, not meaning, and only warns – these tests pin down which
   words, and which it must leave alone. */
import { describe, expect, it } from 'vitest';
import { checkLeaks, ruleAtRound, MAX_FINDINGS, MAX_TERMS } from '../src/index.ts';
import type { LeakEntry } from '../src/index.ts';

const entry = (o: Partial<LeakEntry> = {}): LeakEntry => ({
  title: 'The Countess’s ferryman', rule: 'hidden', hintLimits: '', playersKnow: 'A woman pays for the crossing.',
  truth: 'Gerhard Voss ferries the Countess across the Stir. He serves the Grey Penitents and kills witnesses.', ...o,
});

describe('ruleAtRound', () => {
  const rounds: Record<string, number> = { b1: 1, b2: 2, b3: 3 };
  const roundOf = (id: string) => rounds[id];
  it('keeps hidden and hint as they are, whatever the round', () => {
    expect(ruleAtRound({ reveal: 'hidden', revealFromBattle: null }, 9, roundOf)).toBe('hidden');
    expect(ruleAtRound({ reveal: 'hint', revealFromBattle: 'b1' }, 9, roundOf)).toBe('hint');
  });
  it('a revealed piece is public from its battle on, including that battle’s own chapter', () => {
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: null }, 0, roundOf)).toBe('revealed');
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: 'b2' }, 1, roundOf)).toBe('hidden');
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: 'b2' }, 2, roundOf)).toBe('revealed');
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: 'b2' }, 3, roundOf)).toBe('revealed');
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: 'b3' }, Infinity, roundOf)).toBe('revealed');
  });
  it('a battle the device does not know keeps the piece hidden', () => {
    expect(ruleAtRound({ reveal: 'revealed', revealFromBattle: 'gone' }, Infinity, roundOf)).toBe('hidden');
  });
});

describe('checkLeaks', () => {
  it('finds the title and the names of a hidden piece, with an excerpt around the first hit', () => {
    const r = checkLeaks('Der Nebel lag schwer. Gerhard Voss wartete am Ufer, und Voss schwieg.', [entry()]);
    expect(r.more).toBe(0);
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0]!;
    expect(f).toMatchObject({ title: 'The Countess’s ferryman', rule: 'hidden', allowed: '' });
    const terms = Object.fromEntries(f.terms.map((t) => [t.term, t]));
    expect(terms['Gerhard']).toMatchObject({ hits: 1 });
    expect(terms['Voss']).toMatchObject({ hits: 2 });
    expect(terms['Voss']!.excerpt).toContain('Gerhard Voss wartete am Ufer');
  });

  it('says nothing about a text that tells none of it, and skips what is public', () => {
    expect(checkLeaks('Ein ruhiger Morgen am Fluss.', [entry()]).findings).toEqual([]);
    expect(checkLeaks('Gerhard Voss wartete.', [entry({ rule: 'revealed' })]).findings).toEqual([]);
  });

  it('a hint may be told within its limits: the finding carries them for the leader', () => {
    const r = checkLeaks('Eine Gräfin zahlte den Fährmann Gerhard.', [entry({ rule: 'hint', hintLimits: 'A ferryman may be mentioned, no name, no master.' })]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ rule: 'hint', allowed: 'A ferryman may be mentioned, no name, no master.' });
    expect(r.findings[0]!.terms.map((t) => t.term)).toEqual(['Gerhard']);
  });

  it('leaves out words the players know: from the piece’s own “players know”, and from the public names', () => {
    const e = entry({ playersKnow: 'Everybody knows that Gerhard Voss ferries people.' });
    expect(checkLeaks('Gerhard Voss ferried.', [e]).findings).toEqual([]);
    const secret = entry({ title: 'The mole', truth: 'Brother Aldous sells the plans to the Penitents.', playersKnow: '' });
    expect(checkLeaks('Aldous schwieg.', [secret]).findings).toHaveLength(1);
    expect(checkLeaks('Aldous schwieg.', [secret], ['Brother Aldous']).findings).toEqual([]);
    // a part of a known name counts as known, and so does a part of the warband’s name
    expect(checkLeaks('Die Penitents kamen.', [secret], ['The Grey Penitents']).findings).toEqual([]);
  });

  it('leaves function words and plain words alone: only capitalised, only names, at least four letters', () => {
    const e = entry({ title: '', playersKnow: '', truth: 'The ferryman will kill. The Countess waits. They sail. Kill is what he does.' });
    // “They”, “The” are function words; “Kill” is a plain word the truth also writes in lower case
    const r = checkLeaks('They sail. The ferryman waits. Kill them. The Countess nods.', [e]);
    expect(r.findings.flatMap((f) => f.terms.map((t) => t.term))).toEqual(['Countess']);
  });

  it('finds names with the endings they take, but not inside another word', () => {
    const e = entry({ title: '', playersKnow: '', truth: 'Voss serves the Penitents.' });
    const terms = (t: string) => checkLeaks(t, [e]).findings.flatMap((f) => f.terms.map((x) => x.term));
    expect(terms('Vossens Boot, Voss’s Boot, Vosss')).toEqual(['Voss']);
    expect(terms('Vossel und Vossenhof')).toEqual([]);
    expect(terms('die Penitents')).toEqual(['Penitents']);
    expect(terms('VOSS')).toEqual(['Voss']);
  });

  it('does not take a name as a pattern: regex characters in a title or a truth are text', () => {
    const e = entry({ title: 'Who (or what)? [x]', playersKnow: '', truth: 'a.b*c' });
    expect(() => checkLeaks('Who (or what)? [x] and a.b*c', [e])).not.toThrow();
    expect(checkLeaks('Who (or what)? [x]', [e]).findings).toHaveLength(1);
  });

  it('puts what must not appear before what may be hinted, and caps the list and the words', () => {
    const many = Array.from({ length: MAX_FINDINGS + 5 }, (_, i) => entry({ title: `Secret${String.fromCharCode(97 + (i % 26))}${i}`, truth: '', rule: i === MAX_FINDINGS + 4 ? 'hidden' : 'hint' }));
    const text = many.map((e) => e.title).join(' ');
    const r = checkLeaks(text, many);
    expect(r.findings).toHaveLength(MAX_FINDINGS);
    expect(r.more).toBe(5);
    expect(r.findings[0]!.rule).toBe('hidden');
    const names = Array.from({ length: MAX_TERMS + 4 }, (_, i) => `Name${'abcdefghij'[i]}x`).join(' ');
    const r2 = checkLeaks(names, [entry({ title: '', playersKnow: '', truth: names })]);
    expect(r2.findings[0]!.terms).toHaveLength(MAX_TERMS);
  });

  it('is deterministic and never mutates its input', () => {
    const es = Object.freeze([Object.freeze(entry())]);
    const a = checkLeaks('Gerhard Voss.', es);
    const b = checkLeaks('Gerhard Voss.', es);
    expect(a).toEqual(b);
  });
});

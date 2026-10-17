/* core/narrative: the canon export (phase 4b4b, ADR 0018) – the names the
   campaign uses in German and English, as a text for the chronicle's linter.
   Names only: nothing of the background, the notes or a profile's voice. */
import { describe, expect, it } from 'vitest';
import { canonText, CANON_FORMAT } from '../src/index.ts';
import type { CanonInput } from '../src/index.ts';

const INPUT: CanonInput = {
  campaign: 'The Hel Fenn Campaign',
  warbands: [
    {
      name: 'The Caravan',
      canon: { name_de: 'Die Silberne Karavane', name_en: 'The Ardent Caravan' },
      models: [
        { name: 'Robba', profile: { name_de: 'Roberta van Dorp', name_en: 'Roberta van Dorp', title_de: 'Händlerin', title_en: 'Merchant' } },
        { name: 'Ottilie', profile: { name_de: 'Ottilie', name_en: 'Ottilie', title_de: 'Lehrling', title_en: 'Apprentice' } },
        { name: 'Henchmen' },
      ],
      hired: [{ name: 'Magister', profile: { name_de: 'Magister Julius Broun', name_en: 'Magister Julius Broun' } }],
      fallen: [{ m: { name: 'Dieter', profile: { name_de: 'Sir Dieter von Wurtzen', name_en: 'Sir Dieter von Wurtzen' } } }],
    },
    {
      name: 'Rangvald’s Reavers',
      canon: { name_de: 'Rangvalds Reaver', name_en: 'Rangvald’s Reavers' },
      models: [
        { profile: { name_de: 'Ulfrik der Pfähler', name_en: 'Ulfrik the Impaler', title_de: 'Champion', title_en: 'Champion' } },
        { profile: { name_de: 'Wulfrik Shiptaker' } },
      ],
    },
    { name: 'Clan Skrittle' },
  ],
  factions: [{ nameDe: 'Die Fährleute', nameEn: 'The Ferrymen' }],
  people: [{ nameDe: 'Alter Marek', nameEn: 'Old Marek', faction: 'Die Fährleute' }, { nameDe: 'Vilem Nedelka', nameEn: 'Vilem Nedelka', faction: '' }],
};

const section = (text: string, name: string) => {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => l.startsWith(`# == ${name}:`));
  const rest = lines.slice(from + 1);
  const to = rest.findIndex((l) => l.startsWith('# =='));
  return (to < 0 ? rest : rest.slice(0, to)).filter((l) => l.trim() && !l.startsWith('#'));
};

describe('canonText', () => {
  const { text, stats } = canonText(INPUT, '2026-10-17');

  it('says what it is, where from and that it holds names only; every other line is one name', () => {
    const head = text.split('\n').slice(0, 8).join('\n');
    expect(head).toContain('# Canon of The Hel Fenn Campaign');
    expect(head).toContain(`2026-10-17`);
    expect(head).toContain(`canon export format ${CANON_FORMAT}`);
    expect(head).toMatch(/Names only/);
    expect(head).toMatch(/not spielbegriffe\.txt/);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('puts what differs between the languages in one list each, without the article, sorted', () => {
    expect(section(text, 'only-de')).toEqual(['Alter Marek', 'Fährleute', 'Händlerin', 'Lehrling', 'Rangvalds Reaver', 'Silberne Karavane', 'Ulfrik der Pfähler']);
    expect(section(text, 'only-en')).toEqual(['Apprentice', 'Ardent Caravan', 'Ferrymen', 'Merchant', 'Old Marek', 'Rangvald’s Reavers', 'Ulfrik the Impaler']);
  });

  it('lists names that are the same in both languages apart – they may stand in either', () => {
    expect(section(text, 'same')).toEqual(['Champion', 'Magister Julius Broun', 'Ottilie', 'Roberta van Dorp', 'Sir Dieter von Wurtzen', 'Vilem Nedelka']);
  });

  it('lists what is not finished: one language only, or a warband without a canon name', () => {
    expect(section(text, 'incomplete')).toEqual([
      'Clan Skrittle – warband: no canon name yet',
      'Wulfrik Shiptaker – warrior of Rangvald’s Reavers: no English name',
    ]);
  });

  it('keeps every pair for reading, as comments, with what each is', () => {
    expect(text).toContain('#   Die Silberne Karavane | The Ardent Caravan | warband');
    expect(text).toContain('#   Ulfrik der Pfähler | Ulfrik the Impaler | warrior of Rangvald’s Reavers');
    expect(text).toContain('#   Sir Dieter von Wurtzen | Sir Dieter von Wurtzen | warrior of The Caravan (fallen)');
    expect(text).toContain('#   Magister Julius Broun | Magister Julius Broun | hired sword or dramatis personae of The Caravan');
    expect(text).toContain('#   Händlerin | Merchant | title');
    expect(text).toContain('#   Die Fährleute | The Ferrymen | faction');
    expect(text).toContain('#   Alter Marek | Old Marek | person of Die Fährleute');
    expect(text).toContain('#   Vilem Nedelka | Vilem Nedelka | person');
  });

  it('counts what it wrote, for the message to the leader', () => {
    expect(stats).toEqual({ names: 13, onlyDe: 7, onlyEn: 7, same: 6, incomplete: 2 });
  });

  it('never carries what a profile or the campaign keeps private: voice, origin, texts', () => {
    const { text: t } = canonText({
      campaign: 'X',
      warbands: [{ name: 'W', canon: { name_de: 'A', name_en: 'B' }, models: [{ profile: { name_de: 'Hans', name_en: 'John', voice: 'SECRET-VOICE', origin: 'SECRET-ORIGIN', text: 'SECRET-TEXT' } as never }] }],
      factions: [], people: [],
    }, '2026-10-17');
    expect(t).not.toMatch(/SECRET/);
  });

  it('is deterministic, does not mutate its input and copes with nothing at all', () => {
    const frozen = JSON.parse(JSON.stringify(INPUT)) as CanonInput;
    expect(canonText(frozen, '2026-10-17').text).toBe(text);
    expect(frozen).toEqual(INPUT);
    const none = canonText({ campaign: 'Empty', warbands: [], factions: [], people: [] }, '2026-10-17');
    expect(none.stats).toEqual({ names: 0, onlyDe: 0, onlyEn: 0, same: 0, incomplete: 0 });
    expect(none.text).toContain('# (none)');
  });

  it('a name set twice is listed once, whatever its case', () => {
    const r = canonText({
      campaign: 'X',
      warbands: [{ name: 'A', canon: { name_de: 'Die Krähen', name_en: 'The Crows' }, models: [{ profile: { name_de: 'Hauptmann', name_en: 'Captain' } }, { profile: { name_de: 'hauptmann', name_en: 'captain' } }] }],
      factions: [{ nameDe: 'Die Krähen', nameEn: 'The Crows' }], people: [],
    }, '2026-10-17');
    expect(section(r.text, 'only-de')).toEqual(['Hauptmann', 'Krähen']);
    expect(section(r.text, 'only-en')).toEqual(['Captain', 'Crows']);
  });
});

/* The canon export (phase 4b4b, ADR 0018): the names a campaign uses in
   German and English – its warbands, the warriors with a profile, their
   titles, the world's factions and people – as one text for the chronicle's
   linter (the lists of what may stand in only one language version). The
   leader downloads it and hands it on by hand; the app writes nothing into
   the chronicle's repository, which is public.

   Names only. A profile's voice, origin and text, the background, the notes:
   none of it is read here. Pure formatting; the caller gathers the input from
   what the leader's device can already read (ADR 0005). */

/** The version of the file's layout; it rises when a marker or a line's meaning changes. */
export const CANON_FORMAT = 1;

interface Profile { name_de?: string; name_en?: string; title_de?: string; title_en?: string }
interface Person { name?: string; profile?: Profile }

export interface CanonWarband {
  /** The warband's own name (what stands on its list). */
  name: string;
  canon?: { name_de?: string; name_en?: string };
  models?: Person[];
  hired?: Person[];
  dp?: Person[];
  fallen?: { m: Person }[];
}
export interface CanonInput {
  campaign: string;
  warbands: CanonWarband[];
  factions: { nameDe: string; nameEn: string }[];
  people: { nameDe: string; nameEn: string; faction: string }[];
}

interface Entry { de: string; en: string; what: string }
export interface CanonStats { names: number; onlyDe: number; onlyEn: number; same: number; incomplete: number }

const lower = (s: string) => s.toLocaleLowerCase('de');
const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** A name without its article: `Die Silberne Karavane` → `Silberne Karavane`, as the linter's lists have them. */
const bare = (s: string) => s.replace(/^(?:die|der|das|den|dem|des|the)\s+(?=\S)/i, '');

function entries(input: CanonInput): { done: Entry[]; open: string[] } {
  const done: Entry[] = [];
  const open: string[] = [];
  const add = (de: string, en: string, what: string, who: string) => {
    de = clean(de); en = clean(en);
    if (de && en) done.push({ de, en, what });
    else if (de || en) open.push(`${de || en} – ${who}: no ${de ? 'English' : 'German'} name`);
  };
  for (const w of input.warbands) {
    const wb = clean(w.name);
    const c = w.canon ?? {};
    if (!clean(c.name_de) && !clean(c.name_en)) open.push(`${wb} – warband: no canon name yet`);
    else add(c.name_de ?? '', c.name_en ?? '', 'warband', `warband`);
    const groups: [Person[], string, string][] = [
      [w.models ?? [], `warrior of ${wb}`, `warrior of ${wb}`],
      [w.hired ?? [], `hired sword or dramatis personae of ${wb}`, `hired sword or dramatis personae of ${wb}`],
      [w.dp ?? [], `hired sword or dramatis personae of ${wb}`, `hired sword or dramatis personae of ${wb}`],
      [(w.fallen ?? []).map((f) => f.m), `warrior of ${wb} (fallen)`, `warrior of ${wb}`],
    ];
    for (const [people, what, who] of groups) {
      for (const p of people) {
        const pr = p.profile;
        if (!pr) continue;
        add(pr.name_de ?? '', pr.name_en ?? '', what, who);
        if (clean(pr.title_de) || clean(pr.title_en)) add(pr.title_de ?? '', pr.title_en ?? '', 'title', `title of ${clean(pr.name_de) || clean(pr.name_en) || 'a warrior'}`);
      }
    }
  }
  for (const f of input.factions) add(f.nameDe, f.nameEn, 'faction', 'faction');
  for (const p of input.people) add(p.nameDe, p.nameEn, p.faction ? `person of ${clean(p.faction)}` : 'person', 'person');
  return { done, open };
}

/** Distinct by lower case, the first spelling kept, sorted the German way. */
const distinct = (names: string[]) => {
  const seen = new Map<string, string>();
  for (const n of names) if (n && !seen.has(lower(n))) seen.set(lower(n), n);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'de'));
};

export function canonText(input: CanonInput, date: string): { text: string; stats: CanonStats } {
  const { done, open } = entries(input);
  const differs = done.filter((e) => lower(e.de) !== lower(e.en));
  const onlyDe = distinct(differs.map((e) => bare(e.de)));
  const onlyEn = distinct(differs.map((e) => bare(e.en)));
  const same = distinct(done.filter((e) => lower(e.de) === lower(e.en)).map((e) => e.de));
  const incomplete = [...new Set(open)].sort((a, b) => a.localeCompare(b, 'de'));
  // every pair once, as it is for reading
  const seen = new Set<string>();
  const pairs = done.filter((e) => { const k = lower(`${e.de}|${e.en}|${e.what}`); if (seen.has(k)) return false; seen.add(k); return true; });

  const block = (marker: string, what: string, lines: string[]) => ['', `# == ${marker}: ${what}`, ...(lines.length ? lines : ['# (none)'])];
  const text = [
    `# Canon of ${clean(input.campaign)}`,
    '# The names the campaign uses in German and English: warbands, warriors, titles, factions, people –',
    '# for the chronicle’s linter (the lists NUR_DEUTSCH and NUR_ENGLISCH).',
    `# Exported ${date} from Mordheim Campaign · canon export format ${CANON_FORMAT}.`,
    '# Names only: no background, no notes, no profile text. This is not spielbegriffe.txt (the game terms that stay out of the prose).',
    '# Lines starting with # are comments; every other line is one name, a leading article left off.',
    ...block('only-de', 'may stand only in the German version (NUR_DEUTSCH)', onlyDe),
    ...block('only-en', 'may stand only in the English version (NUR_ENGLISCH)', onlyEn),
    ...block('same', 'spelled the same in both languages', same),
    ...block('incomplete', 'not finished yet: one language only, or no canon name', incomplete),
    '',
    '# == pairs: German | English | what it is',
    ...(pairs.length ? pairs.map((e) => `#   ${e.de} | ${e.en} | ${e.what}`) : ['# (none)']),
    '',
  ].join('\n');
  return { text, stats: { names: pairs.length, onlyDe: onlyDe.length, onlyEn: onlyEn.length, same: same.length, incomplete: incomplete.length } };
}

/* The backstory as a leader brings it in: one text – pasted, or read from a
   .md or .txt file of the group's old chronicle – cut into sections at its
   headings. A heading is a Markdown heading, or a line of its own that
   begins "Battle 3 …" (or "Schlacht 3 …"); the number it names says which
   battle the section tells of. What stands before the first heading is a
   prologue. A heading with nothing under it is dropped: a title page is not
   a section. Kept apart from React so it can be tested. */
export interface BackstorySection { heading: string; battleNo: number | null; text: string }

export const MAX_HEADING = 160;
export const MAX_SECTION_TEXT = 60_000;
export const MAX_SECTIONS = 200;
export const MAX_BACKSTORY = 400_000;

const MARKDOWN = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/;
/** "Battle 3", "Schlacht 3 – die Fähre", "**Battle 3: the quay**" – a short line of its own, not a sentence. */
const NUMBERED = /^(?:\*\*|__)?\s*(?:battle|schlacht|runde|round)\s*(?:no\.?|nr\.?|#)?\s*(\d{1,3})\b[^\n]{0,100}$/i;
const NUMBER_IN = /(?:battle|schlacht|runde|round)\s*(?:no\.?|nr\.?|#)?\s*(\d{1,3})\b/i;
const PLAIN = /^(?:\*\*|__)?\s*(?:prologue|prolog|vorgeschichte|backstory)\s*(?:\*\*|__)?:?\s*$/i;

const clean = (h: string) => h.replace(/^(?:\*\*|__)|(?:\*\*|__)$/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_HEADING);

/** The heading a line is, or null. */
function headingOf(line: string): string | null {
  const md = MARKDOWN.exec(line);
  if (md) return clean(md[1]!);
  const t = line.trim();
  if (!t || /[.!?…]$/.test(t)) return null;
  if (NUMBERED.test(t) || PLAIN.test(t)) return clean(t.replace(/:$/, ''));
  return null;
}

/** The battle a heading names, or null. */
export function battleOf(heading: string): number | null {
  const n = NUMBER_IN.exec(heading)?.[1];
  const no = n ? Number(n) : 0;
  return no >= 1 && no <= 999 ? no : null;
}

export function splitBackstory(source: string): BackstorySection[] {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const found: { heading: string | null; body: string[] }[] = [{ heading: null, body: [] }];
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : headingOf(line);
    if (h !== null) found.push({ heading: h, body: [] });
    else found.at(-1)!.body.push(line);
  }
  const named = found.some((f) => f.heading !== null);
  return found
    .map((f) => ({ heading: f.heading ?? (named ? 'Prologue' : 'Backstory'), battleNo: f.heading ? battleOf(f.heading) : null, text: f.body.join('\n').trim() }))
    .filter((s) => s.text);
}

/** What stops a backstory from being saved, in words; null when it may be. */
export function problemWith(sections: BackstorySection[]): string | null {
  if (sections.length === 0) return 'There is no text to bring in.';
  if (sections.length > MAX_SECTIONS) return `More than ${MAX_SECTIONS} sections: join some of them.`;
  const long = sections.find((s) => s.text.length > MAX_SECTION_TEXT);
  if (long) return `“${long.heading}” is longer than ${MAX_SECTION_TEXT.toLocaleString('en')} characters: split it with a heading.`;
  if (sections.reduce((n, s) => n + s.text.length, 0) > MAX_BACKSTORY) return `The whole backstory is longer than ${MAX_BACKSTORY.toLocaleString('en')} characters.`;
  return null;
}

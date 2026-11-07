/* A warband's unit choice as a list (report of 7.11.2026): the page of a warband words it as a sentence – "Exactly 1 Boss. Max. 2 Black Orcs,
   2 Young'uns; any number of Boyz" – which reads as if two Young'uns were needed. The same text, read into one row for each unit with its limit
   in the same few words for every warband. */

export interface ChoiceRow {
  name: string;
  /** "exactly 1", "0–2", "any number" or "1 or more". */
  limit: string;
  /** What binds the unit besides its number ("never more than Boyz", "only with a Beastmaster"). */
  note: string | null;
}

type Mode = { kind: 'exact' | 'max' | 'least' | 'any'; n: number };

/** "(≤ Boyz)" is "never more than Boyz"; other notes keep their words. */
const noteOf = (n: string): string => n.replace(/^≤\s*/, 'never more than ').replace(/^never more (\w+) than/i, 'never more $1 than');

/** The rows of a unit choice text, or null where the text is not of this form (a rule about something else). */
export function unitChoice(text: string): ChoiceRow[] | null {
  const rows: ChoiceRow[] = [];
  // "Max." is no end of a sentence; clauses end at a full stop or a semicolon
  const clauses = text.replace(/<[^>]*>/g, '').replace(/\bMax\./gi, 'max').split(/[.;](?=\s|$)/).map((c) => c.trim()).filter(Boolean);
  let mode: Mode | null = null;
  for (const clause of clauses) {
    // items at the top level of the clause, split at commas outside brackets
    const items: string[] = [];
    let depth = 0, cur = '';
    for (const ch of clause) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { items.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());
    for (const item of items) {
      let rest = item, m: RegExpMatchArray | null;
      if ((m = /^exactly\s+(\d+)\s+(.+)$/i.exec(rest))) { mode = { kind: 'exact', n: Number(m[1]) }; rest = m[2]!; }
      else if ((m = /^(?:at most\s+|max\s+)(\d+)\s+(.+)$/i.exec(rest))) { mode = { kind: 'max', n: Number(m[1]) }; rest = m[2]!; }
      else if ((m = /^at least\s+(\d+)\s+(.+)$/i.exec(rest))) { mode = { kind: 'least', n: Number(m[1]) }; rest = m[2]!; }
      else if ((m = /^any number of\s+(.+)$/i.exec(rest))) { mode = { kind: 'any', n: 0 }; rest = m[1]!; }
      else if ((m = /^(\d+)\s+(.+)$/.exec(rest)) && mode && mode.kind === 'max') { mode = { kind: 'max', n: Number(m[1]) }; rest = m[2]!; }
      else if (!mode) return null;
      if (!mode) return null;
      // "Clansmen and Beardlings" after "any number of": two units
      const names = mode.kind === 'any' ? rest.split(/\s+and\s+(?![^()]*\))/) : [rest];
      for (const part of names) {
        const nm = /^([^()]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(part.trim());
        if (!nm) return null;
        let name = nm[1]!.trim();
        let note = nm[2] ? noteOf(nm[2].trim()) : null;
        let kind = mode.kind, n = mode.n;
        // "(at least 1)" after "any number of" is the other way to say 1 or more
        const least = note ? /^at least (\d+)$/i.exec(note) : null;
        if (least && kind === 'any') { kind = 'least'; n = Number(least[1]); note = null; }
        if (!name || /\d/.test(name)) return null;
        name = name.replace(/\s+/g, ' ');
        rows.push({
          name,
          limit: kind === 'exact' ? `exactly ${n}` : kind === 'max' ? `0–${n}` : kind === 'least' ? `${n} or more` : 'any number',
          note,
        });
      }
    }
  }
  return rows.length ? rows : null;
}

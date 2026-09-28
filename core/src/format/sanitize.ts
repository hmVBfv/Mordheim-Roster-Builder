/* Cleaning a save before it becomes a test fixture (docs/security.md §6).

   Both repositories are public, and a save from the running campaign carries
   what the players wrote themselves: the story, a warrior's background,
   notes in the chronicle, accounts of battles, remarks on casualties,
   house-rule notes, and in a campaign file the players' own names. All of it
   is removed or replaced by a fixed placeholder. Everything the rules work
   with stays, and a text that was there stays non-empty, so a cleaned save
   takes the same branches as the original (a battle with an account still
   has one). Warband and warrior names stay: they are public in the chronicle.

   Cleaning is idempotent, so "sanitizeSave(x) deep-equals x" is the test
   that a file is clean. Works on a warband save and on a campaign file,
   whatever is nested inside (snapshots, rosters of other warbands). */
import type { GameData } from '../data/types.ts';
import { CF_TYPE } from '../campaign/file.ts';

/** What replaces a text a player wrote. */
export const SANITIZED = {
  /** a chronicle note, a note on a casualty */
  note: 'Note.',
  /** the account of a battle, house-rule notes */
  notes: 'Notes.',
  /** what a player typed as the detail of a casualty */
  detail: 'Detail.',
} as const;

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => !!x && typeof x === 'object' && !Array.isArray(x);
const filled = (x: unknown) => typeof x === 'string' && x !== '';

/** A copy of the save with everything players wrote themselves taken out. */
export function sanitizeSave(data: GameData, raw: unknown): unknown {
  // details the app writes itself: the name or code of an injury result
  const generated = new Set<string>(Object.values(data.INJEN));
  for (const j of data.INJURIES) { generated.add(j.code); if (j.name) generated.add(j.name); }

  const clean = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(clean);
    if (!isRec(x)) return x;
    const out: Rec = {};
    for (const [k, v] of Object.entries(x)) {
      if (k === 'story') continue; // the narrative of the new builder
      out[k] = clean(v);
    }
    // a warrior's background
    if (isRec(out.profile) && 'text' in out.profile) {
      const p = { ...out.profile };
      delete p.text;
      out.profile = p;
    }
    // a chronicle entry written or corrected by hand
    if ((out.type === 'note' || out.edited === true) && typeof out.id === 'number' && filled(out.text)) out.text = SANITIZED.note;
    if (filled(out.note)) out.note = SANITIZED.note;
    if (filled(out.notes)) out.notes = SANITIZED.notes;
    // a casualty: the detail is either an injury result or typed in the form
    if (isRec(out.victim) && 'result' in out && filled(out.detail) && !generated.has(out.detail as string)) out.detail = SANITIZED.detail;
    return out;
  };

  const out = clean(raw);
  // a campaign file names the players; number them in order of appearance
  if (isRec(out) && out.type === CF_TYPE && Array.isArray(out.warbands)) {
    const seen = new Map<string, string>();
    out.warbands = out.warbands.map((w: unknown) => {
      if (!isRec(w) || !filled(w.player)) return w;
      const who = (w.player as string).trim();
      if (!seen.has(who)) seen.set(who, `Player ${seen.size + 1}`);
      return { ...w, player: seen.get(who) };
    });
  }
  return out;
}

/* Does a chapter text give away what the players may not know yet? (4b5b)

   A leader brings a chapter in as a draft; before it is published, the text is
   held against the background: every piece that is hidden or only to be hinted
   at *at the chapter's place in the story*, with the words that would give it
   away – its title, and the names in its truth that the players do not know.
   The check only warns. It cannot read, so it finds words, not meaning; the
   leader reads the excerpts and decides (ADR 0002: only narrative is hidden,
   and what it means for the story is the leader's call).

   Pure and deterministic: the same text and entries give the same findings.
   The caller (the leader's device, ADR 0005) passes what it already reads. */
import type { PackRule } from './pack.ts';

/** The reveal state of a background piece, as the server keeps it. */
export interface RevealState {
  reveal: PackRule;
  /** The battle from which a revealed piece is public, or `null` for always. */
  revealFromBattle: string | null;
}

/** The rule of a piece at a given round of the campaign (`Infinity`: today, after every battle).
    A piece revealed from a battle is public in that battle's own chapter and after it; a
    battle the device does not know keeps the piece hidden. */
export function ruleAtRound(e: RevealState, round: number, roundOf: (battleId: string) => number | undefined): PackRule {
  if (e.reveal !== 'revealed') return e.reveal;
  if (!e.revealFromBattle) return 'revealed';
  const from = roundOf(e.revealFromBattle);
  return from !== undefined && from <= round ? 'revealed' : 'hidden';
}

/** What the check needs of one piece of the background. */
export interface LeakEntry {
  title: string;
  truth: string;
  playersKnow: string;
  /** The rule at the chapter's place; `revealed` pieces are skipped. */
  rule: PackRule;
  hintLimits: string;
}

export interface LeakTerm { term: string; hits: number; excerpt: string }
export interface LeakFinding {
  title: string;
  /** `hint`: it may be hinted at, within `allowed`; `hidden`: it must not appear at all. */
  rule: 'hint' | 'hidden';
  allowed: string;
  terms: LeakTerm[];
}
export interface LeakCheck {
  findings: LeakFinding[];
  /** Pieces with findings that are left out of the list (it is capped). */
  more: number;
}

export const MAX_FINDINGS = 30;
export const MAX_TERMS = 6;
const EXCERPT = 48;

/* Capitalised function words that open a sentence – they are not names. */
const FUNCTION_WORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'er', 'sie', 'es', 'wir', 'ihr', 'ich', 'man', 'wer', 'was', 'wie', 'wo', 'wann', 'warum',
  'und', 'oder', 'aber', 'doch', 'denn', 'dann', 'dort', 'hier', 'noch', 'nur', 'auch', 'als', 'wenn', 'weil', 'dass', 'nach', 'vor', 'mit', 'von', 'zu', 'bei', 'aus', 'auf', 'für', 'ohne', 'seit', 'durch',
  'the', 'a', 'an', 'he', 'she', 'it', 'we', 'they', 'you', 'his', 'her', 'its', 'their', 'this', 'that', 'these', 'those', 'there', 'then', 'when', 'where', 'what', 'who', 'why', 'how',
  'and', 'or', 'but', 'for', 'nor', 'yet', 'so', 'in', 'on', 'at', 'by', 'to', 'of', 'if', 'as', 'with', 'from', 'after', 'before', 'since', 'while', 'because', 'although', 'not', 'no', 'all', 'some', 'every', 'each',
]);

const WORD = /[\p{L}][\p{L}\p{N}'’-]*/gu;
const lower = (s: string) => s.toLocaleLowerCase('de');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words of a text that look like names: capitalised, not a function word, not a plain word that
    the same text also writes in lower case, at least four letters. */
function nameWords(truth: string): string[] {
  const all = truth.match(WORD) ?? [];
  const small = new Set(all.filter((w) => w === lower(w)).map(lower));
  const out: string[] = [];
  for (const w of all) {
    const l = lower(w);
    if (w === l || w.length < 4 || FUNCTION_WORDS.has(l) || small.has(l) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

const wordSet = (s: string) => new Set((s.match(WORD) ?? []).map(lower));

/** A term as a whole word, with the endings a name takes in German (`Ulrichs`, `Gräfin` → `Gräfinnen`) and English (`Ulrich’s`). */
function termPattern(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?:['’]s|s|es|n|en|nen)?(?![\\p{L}\\p{N}])`, 'giu');
}

function excerpt(text: string, at: number, len: number): string {
  const from = Math.max(0, at - EXCERPT);
  const to = Math.min(text.length, at + len + EXCERPT);
  const cut = text.slice(from, to).replace(/\s+/g, ' ').trim();
  return `${from > 0 ? '…' : ''}${cut}${to < text.length ? '…' : ''}`;
}

/** Holds a chapter text against the background pieces that are not public at its place.
    `known` is every name the players know anyway (warbands, warriors, public people and
    factions, districts): a word that is one of them, or part of one, is never a finding. */
export function checkLeaks(text: string, entries: readonly LeakEntry[], known: readonly string[] = []): LeakCheck {
  const knownWords = new Set(known.flatMap((k) => [...wordSet(k)]));
  const found: LeakFinding[] = [];
  for (const e of entries) {
    if (e.rule === 'revealed') continue;
    const told = wordSet(e.playersKnow);
    const terms: string[] = [];
    const title = e.title.trim();
    if (title) terms.push(title);
    for (const w of nameWords(e.truth)) {
      const l = lower(w);
      if (told.has(l) || knownWords.has(l) || (title && lower(title).includes(l))) continue;
      terms.push(w);
    }
    const hits: LeakTerm[] = [];
    for (const term of terms) {
      const re = termPattern(term);
      let n = 0;
      let first = '';
      for (let m = re.exec(text); m; m = re.exec(text)) {
        if (!n) first = excerpt(text, m.index, m[0].length);
        n++;
      }
      if (n) hits.push({ term, hits: n, excerpt: first });
    }
    // a title alone that the players already know by another name is not worth a warning
    if (hits.length) found.push({ title: e.title, rule: e.rule, allowed: e.rule === 'hint' ? e.hintLimits : '', terms: hits.slice(0, MAX_TERMS) });
  }
  // what must not appear at all comes first, then the more words, the more likely
  found.sort((a, b) => Number(b.rule === 'hidden') - Number(a.rule === 'hidden') || b.terms.length - a.terms.length || a.title.localeCompare(b.title, 'de'));
  return { findings: found.slice(0, MAX_FINDINGS), more: Math.max(0, found.length - MAX_FINDINGS) };
}

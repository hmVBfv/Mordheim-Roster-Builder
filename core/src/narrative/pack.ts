/* The AI pack for one battle (concept 4.10, ADR 0004): everything a writer –
   a person, or Claude in a chat – needs to turn the battle into a chapter,
   as one Markdown prompt. The app itself calls no AI. It is the briefing's
   material (who fought, the battle in the order of the story, what changed
   and why) plus what only a leader may hand over: the hidden background,
   each piece with the rule how much of it may be hinted.

   Pure formatting. The caller gathers the input – the leader's device, from
   what it already reads (ADR 0005) – and chooses the parts and the language.
   The format is versioned (`PACK_FORMAT`), so a chat, the pipeline and a
   later connector all get the same thing; the first line says which. */
import type { GameData } from '../data/types.ts';
import type { Change } from '../changes/diff.ts';
import { describeChange } from './briefing.ts';

/** The version of the pack's layout; it rises whenever a heading or a rule changes. */
export const PACK_FORMAT = 2;

export type PackLang = 'de' | 'en' | 'both';
/** What a leader may leave out; the battle itself is always in. */
export const PACK_PARTS = ['aftermath', 'canon', 'world', 'notes', 'background', 'story', 'style'] as const;
export type PackPart = (typeof PACK_PARTS)[number];

export type PackChange = Change & { unexplained: boolean };

export interface PackWarband {
  warbandId: string;
  name: string;
  /** The kind of warband, as the player reads it ("Mercenaries"). */
  type: string;
  player: string;
  outcome: string;
  /** The changes frozen with its mark after this battle (ADR 0003). */
  changes: PackChange[];
  /** The player's explanations, by change key. */
  explain: Record<string, string>;
  /** The interlude the player wrote after this battle's round. */
  interlude: string;
}

/** One side of a protocol entry. */
export interface PackSide { warbandId?: string; uid?: number | null; name: string }
export interface PackCasualty { victim: PackSide; attacker: PackSide | null }

/** A block of the battle's story, as the timeline orders it. */
export interface PackStoryItem {
  segment: 'before' | 'course' | 'aftermath';
  /** What it is, as the app names it: "Protocol", "Scene", "Note", "Dice moment", "Picture". */
  label: string;
  /** Said by someone, to be kept word for word. */
  quote: boolean;
  turn: number | null;
  author: string;
  text: string;
  /** A sealed note that was opened when the battle closed. */
  opened: boolean;
}

export interface PackCanon { name: string; warband: string; de: string; en: string; voice: string; origin: string }

export interface PackWorld {
  districts: { name: string; heldBy: string }[];
  factions: { name: string; other: string; status: string }[];
  people: { name: string; other: string; faction: string; status: string }[];
  reputation: { warband: string; faction: string; value: number }[];
}

/** How far a piece of the background may be told. */
export type PackRule = 'hidden' | 'hint' | 'revealed';
export interface PackBackground {
  kind: string;
  title: string;
  /** The truth, for the writer to know and keep consistent. */
  truth: string;
  playersKnow: string;
  rule: PackRule;
  hintLimits: string;
  /** For `revealed`: from which battle it is public. */
  revealedFrom: string;
}

/** A section of the backstory – what came before the app – as a leader brought it in. */
export interface PackBackstory { heading: string; /** The battle it tells of; null: the time before the first. */ battleNo: number | null; text: string }

export interface PackChapter { label: string; title: string; icDate: string; place: string; victor: string }

export interface PackInput {
  campaign: string;
  battle: { round: number; title: string; district: string; playedAt: string | null; scenario: { title: string; rules: string } | null };
  warbands: PackWarband[];
  /** The protocol's casualties, for what each warrior did in this battle. */
  casualties: PackCasualty[];
  story: PackStoryItem[];
  /** The notes of the round that belong to no single moment of the battle. */
  roundNotes: { label: string; author: string; text: string; quote: boolean }[];
  canon: PackCanon[];
  world: PackWorld;
  background: PackBackground[];
  /** The chapters written so far, oldest first; the last one comes in full. */
  chapters: PackChapter[];
  lastChapter: { heading: string; text: string } | null;
  /** What came before the app, in the order the leader gave it – only what precedes this battle (the caller chooses). */
  backstory?: PackBackstory[];
  style: string;
}

export interface PackOptions { parts: readonly PackPart[]; lang: PackLang }

/** The rule a piece of background carries into the prompt, in words a writer cannot misread. */
export function ruleText(b: Pick<PackBackground, 'rule' | 'hintLimits' | 'revealedFrom'>): string {
  switch (b.rule) {
    case 'hidden': return 'HIDDEN — the players know nothing of this. Do not state it and do not hint at it; the writer may only keep the story consistent with it.';
    case 'hint': return `HINT ONLY — never state the truth. May be hinted${b.hintLimits.trim() ? `, within these limits: ${b.hintLimits.trim()}` : ' in passing, so that a careful reader can guess'}.`;
    case 'revealed': return `REVEALED — public${b.revealedFrom ? ` since ${b.revealedFrom}` : ''}; may be told as the players know it.`;
  }
}

const LANG_RULE: Record<PackLang, string> = {
  de: 'Write the chapter in German.',
  en: 'Write the chapter in English.',
  both: 'Write the chapter in German, then give an English version of it.',
};

const SEGMENT_TITLE: Record<PackStoryItem['segment'], string> = { before: 'Before the battle', course: 'The course of the battle', aftermath: 'Aftermath' };

const ADVANCE_KINDS = new Set(['stat', 'skill', 'spell', 'promoted']);
const AFTERMATH_KINDS = new Set(['died', 'injury']);
const GEAR_KINDS = new Set(['gear_added', 'gear_removed', 'gold']);
const OTHER_KINDS = new Set(['recruited', 'released', 'hired', 'rare_added', 'rare_removed', 'district', 'renamed', 'group_size']);

/** What one warrior did in this battle, from the protocol. */
function deeds(cas: PackCasualty[], warbandId: string, uid: number | string | null): string {
  if (uid == null) return '';
  const is = (s: PackSide | null) => !!s && s.warbandId === warbandId && s.uid != null && String(s.uid) === String(uid);
  const put = cas.filter((c) => is(c.attacker));
  const fell = cas.filter((c) => is(c.victim));
  const parts: string[] = [];
  if (put.length) parts.push(`put ${put.map((c) => c.victim.name || 'an enemy').join(', ')} out of action`);
  if (fell.length) parts.push(`went down${fell[0]!.attacker?.name ? ` to ${fell[0]!.attacker.name}` : ''}`);
  return parts.length ? ` In this battle: ${parts.join('; ')}.` : ' In this battle: nothing recorded.';
}

const quoted = (text: string) => text.split('\n').map((l) => `> ${l}`).join('\n');
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ');

/** The Markdown prompt for one battle. */
export function buildPack(data: GameData, input: PackInput, options: PackOptions): string {
  const on = (p: PackPart) => options.parts.includes(p);
  const b = input.battle;
  const L: string[] = [];
  L.push(`<!-- mordheim-ai-pack format=${PACK_FORMAT} -->`);
  L.push(`# ${input.campaign} — Battle ${b.round}${b.title ? `: ${b.title}` : ''}`, '');
  L.push('Write the chapter of this battle for the campaign’s chronicle from the material below. Keep to the canon spellings. Quotes are verbatim: keep their wording. Never state what the background marks as hidden, and hint only where it allows. Do not invent facts about the people listed here; what is missing, leave open.');
  L.push(LANG_RULE[options.lang]);

  /* ---- who fought and where ---- */
  L.push('', '## Who fought', '');
  const meta = [b.district && `Location: ${b.district}`, b.scenario && `Scenario: ${b.scenario.title}`, b.playedAt && `Played: ${b.playedAt}`].filter(Boolean);
  if (meta.length) L.push(meta.join(' · '), '');
  for (const w of input.warbands) L.push(`- **${w.name}** (${w.type})${w.player ? `, played by ${w.player}` : ''}${w.outcome ? ` — ${w.outcome}` : ''}`);
  if (b.scenario?.rules.trim()) L.push('', `### The scenario: ${b.scenario.title}`, '', b.scenario.rules.trim());

  /* ---- the battle in the order of the story ---- */
  L.push('', '## The battle, in story order');
  const segments = (['before', 'course', 'aftermath'] as const).map((s) => ({ s, items: input.story.filter((i) => i.segment === s) })).filter((x) => x.items.length);
  if (!segments.length) L.push('', 'Nothing was recorded.');
  for (const { s, items } of segments) {
    L.push('', `### ${SEGMENT_TITLE[s]}`, '');
    for (const i of items) {
      const who = [i.turn != null && `turn ${i.turn}`, i.author].filter(Boolean).join(', ');
      if (i.quote) L.push(`- ${i.label}${who ? ` (${who})` : ''}:`, quoted(i.text));
      else L.push(`- ${i.label}${i.opened ? ' (sealed, opened)' : ''}${who ? ` (${who})` : ''}: ${i.text}`);
    }
  }

  /* ---- aftermath and advances ---- */
  if (on('aftermath')) {
    const section = (title: string, kinds: Set<string>, withDeeds: boolean) => {
      const rows = input.warbands.map((w) => ({ w, cs: w.changes.filter((c) => kinds.has(c.kind)) })).filter((r) => r.cs.length);
      if (!rows.length) return;
      L.push('', `## ${title}`);
      for (const { w, cs } of rows) {
        L.push('', `### ${w.name}`, '');
        for (const c of cs) {
          const why = (w.explain[c.changeKey] ?? '').trim();
          L.push(`- **${c.name}** ${describeChange(data, c)}.${withDeeds ? deeds(input.casualties, w.warbandId, c.uid) : ''}${why ? ` Explanation: ${why}` : ''}${c.unexplained ? ' *(no recorded cause)*' : ''}`);
        }
      }
    };
    section('Aftermath', AFTERMATH_KINDS, false);
    section('Advances', ADVANCE_KINDS, true);
    section('Equipment and gold', GEAR_KINDS, false);
    section('Other changes', OTHER_KINDS, false);
    const inter = input.warbands.filter((w) => w.interlude.trim());
    if (inter.length) {
      L.push('', '## Interludes');
      for (const w of inter) L.push('', `### ${w.name}`, '', w.interlude.trim());
    }
    const missing = input.warbands.map((w) => ({ w, open: w.changes.filter((c) => c.unexplained && !(w.explain[c.changeKey] ?? '').trim()) })).filter((r) => r.open.length);
    L.push('', '## Missing explanations', '');
    if (!missing.length) L.push('None — every change has its explanation or its cause.');
    for (const { w, open } of missing) L.push(`- ${w.name}: ${open.length} (${open.map((c) => `${c.name} ${describeChange(data, c)}`).join('; ')})`);
  }

  /* ---- canon ---- */
  if (on('canon') && input.canon.length) {
    L.push('', '## Canon', '', '| Name (EN) | Name (DE) | Voice and origin | Belongs to |', '| --- | --- | --- | --- |');
    for (const c of input.canon) L.push(`| ${cell(c.en || c.name)} | ${cell(c.de || c.name)} | ${cell([c.voice && `voice: ${c.voice}`, c.origin && `origin: ${c.origin}`].filter(Boolean).join('; '))} | ${cell(c.warband)} |`);
  }

  /* ---- world ---- */
  const w = input.world;
  if (on('world') && (w.districts.length || w.factions.length || w.people.length || w.reputation.length)) {
    L.push('', '## World');
    if (w.districts.length) { L.push('', 'Districts held:'); for (const d of w.districts) L.push(`- ${d.name} — ${d.heldBy}`); }
    if (w.factions.length) { L.push('', 'Factions:'); for (const f of w.factions) L.push(`- **${f.name}**${f.other ? ` (${f.other})` : ''}${f.status ? ` — ${f.status}` : ''}`); }
    if (w.people.length) { L.push('', 'People:'); for (const p of w.people) L.push(`- **${p.name}**${p.other ? ` (${p.other})` : ''}${p.faction ? `, ${p.faction}` : ''}${p.status ? ` — ${p.status}` : ''}`); }
    if (w.reputation.length) { L.push('', 'Reputation:'); for (const r of w.reputation) L.push(`- ${r.warband} with ${r.faction}: ${r.value > 0 ? '+' : r.value < 0 ? '−' : ''}${Math.abs(r.value)}`); }
  }

  /* ---- notes of the round ---- */
  if (on('notes') && input.roundNotes.length) {
    L.push('', '## Notes of the round', '');
    for (const n of input.roundNotes) {
      if (n.quote) L.push(`- ${n.label}${n.author ? ` (${n.author})` : ''}:`, quoted(n.text));
      else L.push(`- ${n.label}${n.author ? ` (${n.author})` : ''}: ${n.text}`);
    }
  }

  /* ---- background: hard rules ---- */
  if (on('background') && input.background.length) {
    L.push('', '## Background — hard rules ⚑', '', 'This is for the writer alone. Every piece carries the rule how far it may be told; the rule is not a suggestion.');
    for (const e of input.background) {
      L.push('', `### ${e.title} (${e.kind})`, '', `Rule: ${ruleText(e)}`);
      if (e.truth.trim()) L.push('', `The truth: ${e.truth.trim()}`);
      if (e.playersKnow.trim()) L.push('', `What the players know: ${e.playersKnow.trim()}`);
    }
  }

  /* ---- the story so far ---- */
  const told = (input.backstory ?? []).filter((s) => s.text.trim());
  if (on('story') && (told.length || input.chapters.length || input.lastChapter)) {
    L.push('', '## The story so far');
    if (told.length) {
      L.push('', '### Backstory — before the app', '', 'What happened before this chronicle began, as the group wrote it down. It is canon: keep to it.');
      for (const s of told) L.push('', `#### ${s.heading}`, '', s.text.trim());
    }
    if (input.chapters.length) {
      L.push('', 'Chapters written:');
      for (const c of input.chapters) L.push(`- ${c.label ? `${c.label} · ` : ''}${c.title}${[c.icDate, c.place, c.victor && `victor: ${c.victor}`].filter(Boolean).length ? ` (${[c.icDate, c.place, c.victor && `victor: ${c.victor}`].filter(Boolean).join(', ')})` : ''}`);
    }
    if (input.lastChapter) L.push('', `### The last chapter in full: ${input.lastChapter.heading}`, '', input.lastChapter.text.trim());
  }

  /* ---- style ---- */
  if (on('style') && input.style.trim()) L.push('', '## Style', '', input.style.trim());

  return L.join('\n') + '\n';
}

/** A rough size: the characters and, at about four to a token, the tokens. */
export function packSize(text: string): { chars: number; tokens: number } {
  return { chars: text.length, tokens: Math.round(text.length / 4) };
}

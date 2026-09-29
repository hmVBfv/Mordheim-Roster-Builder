/* The briefing for one battle (concept 4.10): everything a writer — a person
   or Claude in a chat — needs to turn the battle into a chapter, complete and
   in order, as Markdown. It is material, not prose.

   Sections: who fought and how it ended; the course of the battle from the
   protocol and the notes, quotes kept apart; the aftermath per warband
   (deaths, injuries) with the players' explanations; advances per warband
   with their explanations AND what that warrior did in this very battle;
   other changes; interludes; open threads; the canon (names, titles, voices
   in German and English); and how many explanations are still missing.

   The caller assembles the input (the server in phase 4b; the notes,
   protocol and profiles live there). Core only formats and derives. */
import type { GameData } from '../data/types.ts';
import type { Casualty, LogEntry, Model, WarbandState } from '../state/types.ts';
import { ctxOf } from '../rules/context.ts';
import { roundLabel, wbName } from '../rules/casualties.ts';
import { unitDef } from '../rules/lookup.ts';
import { diffWarbands, type Change } from '../changes/diff.ts';
import { missingExplanations, reconcile, type ReconciledChange } from '../changes/reconcile.ts';
import { districtName } from '../campaign/territory.ts';

export type NoteKind = 'general' | 'scene' | 'quote' | 'dice' | 'hook';

export interface BriefingNote {
  kind: NoteKind;
  text: string;
  author?: string;
  lang?: string;
  turn?: number;
}

/** One warband that fought: its marked states around the battle. */
export interface BriefingWarband {
  player?: string;
  outcome?: string;
  before: WarbandState;
  after: WarbandState;
  /** Events and casualty records between the two states; by default those
      `after` has and `before` has not. */
  log?: LogEntry[];
  casualties?: Casualty[];
}

export interface BriefingInput {
  campaign: string;
  battle: { round: number; title?: string; district?: string | null; scenario?: string; playedAt?: string };
  warbands: BriefingWarband[];
  notes?: BriefingNote[];
}

/** A warrior's profile for the canon (data-model: models[].profile). */
interface Profile { name_de?: string; name_en?: string; title_de?: string; title_en?: string; voice?: string; origin?: string }

const since = <T extends { id: number }>(a: T[] | undefined, b: T[] | undefined) => (b ?? []).filter((y) => !(a ?? []).some((x) => x.id === y.id));

/** One change in words, e.g. "+1 WS", "learned Strike to Injure". */
export function describeChange(data: GameData, c: Change): string {
  const p = c.payload;
  switch (c.kind) {
    case 'recruited': return `joined the warband (${p.unit}${Number(p.qty) > 1 ? ` ×${p.qty}` : ''})`;
    case 'died': return p.hero ? 'was slain' : `${p.memberName ? `${p.memberName} ` : 'one man '}was slain`;
    case 'released': return 'left the warband';
    case 'promoted': return 'was promoted to Hero (The Lad’s Got Talent)';
    case 'renamed': return `was renamed from “${p.before}” to “${p.after}”`;
    case 'group_size': return `group went from ${p.before} to ${p.after}`;
    case 'experience': return `gained ${p.gained} experience (now ${p.after})`;
    case 'stat': { const d = Number(p.after) - Number(p.before); return `${d > 0 ? '+' : ''}${d} ${p.stat}`; }
    case 'skill': return p.added ? `learned ${p.skill}` : `lost the skill ${p.skill}`;
    case 'spell': return p.added ? `learned the spell ${p.spell}` : `lost the spell ${p.spell}`;
    case 'injury': return p.added ? `suffered ${p.injury}` : `recovered from ${p.injury}`;
    case 'gear_added': return `took up ${data.EQEN[p.item as string] || p.item}`;
    case 'gear_removed': return `gave up ${data.EQEN[p.item as string] || p.item}`;
    case 'rare_added': return `acquired ${p.itemEn}`;
    case 'rare_removed': return `lost ${p.itemEn}`;
    case 'hired': return `was hired${p.dramatis ? ' (Dramatis Personae)' : ''}`;
    case 'district': return `${p.before === 'none' ? 'gained' : p.after === 'none' ? 'lost' : 'changed'} a hold on this district (${p.after})`;
    case 'house_rules': return `house rule “${p.label}” changed`;
    case 'gold': case 'rating': case 'worth': return `${c.kind} ${p.before} → ${p.after}`;
    default: return c.kind;
  }
}

const ADVANCE_KINDS = new Set(['stat', 'skill', 'spell', 'promoted']);
const AFTERMATH_KINDS = new Set(['died', 'injury']);
const OTHER_KINDS = new Set(['recruited', 'released', 'hired', 'rare_added', 'rare_removed', 'district', 'renamed', 'group_size']);

/** The Markdown briefing for one battle. */
export function buildBriefing(data: GameData, input: BriefingInput): string {
  const b = input.battle;
  const L: string[] = [];
  const where = b.district ? districtName(ctxOf(data, input.warbands[0]?.after ?? ({ wb: null, models: [] } as WarbandState)), b.district) : '';
  L.push(`# ${input.campaign} — Battle ${b.round}${b.title ? `: ${b.title}` : ''}`);
  const meta = [where && `Location: ${where}`, b.scenario && `Scenario: ${b.scenario}`, b.playedAt && `Played: ${b.playedAt}`, `Stage: ${roundLabel(b.round)}`].filter(Boolean);
  L.push('', meta.join(' · '));

  const wbs = input.warbands.map((w) => {
    const c = ctxOf(data, w.after);
    const log = w.log ?? (since(w.before.campaign?.log, w.after.campaign?.log) as LogEntry[]);
    const cas = w.casualties ?? (since(w.before.campaign?.casualties, w.after.campaign?.casualties) as Casualty[]);
    const changes = reconcile(diffWarbands(data, w.before, w.after, b.round), { log, casualties: cas });
    const explain = ((w.after as { story?: { explain?: Record<string, string> } }).story?.explain) ?? {};
    const name = w.after.name || wbName(c, w.after.wb);
    return { w, c, log, cas, changes, explain, name };
  });

  /* ---- who fought ---- */
  L.push('', '## Who fought', '');
  for (const x of wbs) L.push(`- **${x.name}** (${wbName(x.c, x.w.after.wb)})${x.w.player ? `, played by ${x.w.player}` : ''}${x.w.outcome ? ` — ${x.w.outcome}` : ''}`);

  /* ---- the course of the battle ---- */
  L.push('', '## The course of the battle', '');
  const protocol = wbs.flatMap((x) => x.cas.map((r) => ({ r, x })));
  if (protocol.length) {
    L.push('Protocol:');
    for (const { r, x } of protocol) {
      const v = r.victim.name || 'a warrior', a = r.attacker.name;
      const vSide = r.victim.uid != null ? x.name : (r.victim.wb ? wbName(x.c, r.victim.wb) : '');
      const aSide = r.attacker.uid != null ? x.name : (r.attacker.wb ? wbName(x.c, r.attacker.wb) : '');
      L.push(`- ${v}${vSide ? ` (${vSide})` : ''} was put out of action by ${a ? `${a}${aSide ? ` (${aSide})` : ''}` : 'an unknown hand'}${r.result !== 'pending' ? ` — ${r.result}${r.detail ? `: ${r.detail}` : ''}` : ''}${r.note ? `. Note: ${r.note}` : ''}`);
    }
  } else L.push('No casualties were recorded.');
  const notes = (input.notes ?? []).slice().sort((p, q) => (p.turn ?? 0) - (q.turn ?? 0));
  const story = notes.filter((n) => n.kind !== 'quote' && n.kind !== 'hook');
  if (story.length) {
    L.push('', 'Notes:');
    for (const n of story) L.push(`- ${n.kind !== 'general' ? `[${n.kind}] ` : ''}${n.turn != null ? `(turn ${n.turn}) ` : ''}${n.text}${n.author ? ` — ${n.author}` : ''}`);
  }
  const quotes = notes.filter((n) => n.kind === 'quote');
  if (quotes.length) {
    L.push('', 'Quotes (verbatim):');
    for (const n of quotes) L.push(`> ${n.text}${n.author ? ` — ${n.author}` : ''}`);
  }

  /* what one warrior did in this battle, from the protocol */
  const deeds = (x: typeof wbs[number], uid: number | null) => {
    if (uid == null) return '';
    const put = x.cas.filter((r) => r.attacker.uid === uid);
    const fell = x.cas.filter((r) => r.victim.uid === uid);
    const parts: string[] = [];
    if (put.length) parts.push(`put ${put.map((r) => r.victim.name || 'an enemy').join(', ')} out of action`);
    if (fell.length) parts.push(`went down${fell[0]!.attacker.name ? ` to ${fell[0]!.attacker.name}` : ''}`);
    return parts.length ? ` In this battle: ${parts.join('; ')}.` : ' In this battle: nothing recorded.';
  };
  const line = (x: typeof wbs[number], ch: ReconciledChange, withDeeds: boolean) => {
    const why = (x.explain[ch.changeKey] || '').trim();
    return `- **${ch.name}** ${describeChange(data, ch)}.${withDeeds ? deeds(x, ch.uid) : ''}${why ? ` Explanation: ${why}` : ''}${ch.unexplained ? ' *(no recorded cause)*' : ''}`;
  };

  /* ---- aftermath, advances, other changes: per warband ---- */
  const section = (title: string, kinds: Set<string>, withDeeds: boolean) => {
    const rows = wbs.map((x) => ({ x, cs: x.changes.filter((c) => kinds.has(c.kind)) })).filter((r) => r.cs.length);
    if (!rows.length) return;
    L.push('', `## ${title}`);
    for (const { x, cs } of rows) { L.push('', `### ${x.name}`, ''); for (const ch of cs) L.push(line(x, ch, withDeeds)); }
  };
  section('Aftermath', AFTERMATH_KINDS, false);
  section('Advances', ADVANCE_KINDS, true);
  section('Other changes', OTHER_KINDS, false);

  /* ---- interludes ---- */
  const inter = wbs.map((x) => ({ x, text: (((x.w.after as { story?: { interludes?: Record<string, string> } }).story?.interludes) ?? {})[String(b.round)] })).filter((r) => r.text);
  if (inter.length) {
    L.push('', '## Interludes');
    for (const { x, text } of inter) L.push('', `### ${x.name}`, '', String(text));
  }

  /* ---- open threads ---- */
  const hooks = notes.filter((n) => n.kind === 'hook');
  if (hooks.length) { L.push('', '## Open threads', ''); for (const n of hooks) L.push(`- ${n.text}`); }

  /* ---- canon ---- */
  const canon: string[] = [];
  for (const x of wbs) {
    const wc = (x.w.after as { canon?: { name_de?: string; name_en?: string } }).canon;
    if (wc && (wc.name_de || wc.name_en)) canon.push(`- Warband: ${[wc.name_de && `DE “${wc.name_de}”`, wc.name_en && `EN “${wc.name_en}”`].filter(Boolean).join(', ')}`);
    const involved = new Set<number>(x.changes.map((c) => c.uid).filter((u): u is number => u != null));
    for (const r of x.cas) { if (r.victim.uid != null) involved.add(r.victim.uid); if (r.attacker.uid != null) involved.add(r.attacker.uid); }
    const all: Model[] = [...x.w.after.models, ...(x.w.after.fallen ?? []).map((f) => f.m)];
    for (const uid of involved) {
      const m = all.find((y) => y.uid === uid);
      const pr = m?.profile as Profile | undefined;
      if (!m || !pr) continue;
      const bits = [pr.name_de && `DE “${pr.name_de}${pr.title_de ? `, ${pr.title_de}` : ''}”`, pr.name_en && `EN “${pr.name_en}${pr.title_en ? `, ${pr.title_en}` : ''}”`, pr.voice && `voice: ${pr.voice}`, pr.origin && `origin: ${pr.origin}`].filter(Boolean);
      if (bits.length) canon.push(`- ${m.name || unitDef(x.c, m.uid_def)?.name} (${x.name}): ${bits.join('; ')}`);
    }
  }
  if (canon.length) L.push('', '## Canon', '', ...canon);

  /* ---- what is still missing ---- */
  const missing = wbs.map((x) => ({ x, open: missingExplanations(x.changes, x.explain) })).filter((r) => r.open.length);
  L.push('', '## Missing explanations', '');
  if (!missing.length) L.push('None — every change has its explanation.');
  for (const { x, open } of missing) L.push(`- ${x.name}: ${open.length} (${open.map((c) => `${c.name} ${describeChange(data, c)}`).join('; ')})`);
  return L.join('\n') + '\n';
}

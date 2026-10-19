/* What the AI pack is made of (phase 4b4a; concept.md 4.10): gathered on the
   leader's device from what the app already reads – the timeline in its
   order, the battle's protocol, the frozen changes of each warband's mark,
   the explanations and profiles in each warband's save, the world, the
   scenario, the background, the leaders' plan, the backstory, the chapters and the style – and handed to
   core's `buildPack`. Kept apart from React so it can be tested.

   What a writer is told is chosen here, not by the leader piece by piece:
   leaders' own notes stay out (what may be told belongs in the background,
   with a rule), so do GM notes and scenario plans there; an entry that has
   not started is not in it; a truth that is public only from a later battle
   goes in as hidden. */
import { ruleAtRound } from '@mordheim/core';
import type { GameData, PackBackground, PackCanon, PackCasualty, PackChange, PackInput, PackLang, PackStoryItem } from '@mordheim/core';
import { getBackground, type Entry } from '../background/api.ts';
import { before as backstoryBefore, getBackstory } from '../backstory/api.ts';
import { getPlans } from '../plans/api.ts';
import { casualtyText, getBattle, type BattleSummary, type CasualtyPayload } from '../battle/api.ts';
import { readWarband, type CampaignView } from '../campaign/api.ts';
import { campaignMap } from '../campaign/map.ts';
import { isSealed, KIND_NAMES, type Note } from '../notes/api.ts';
import { getScenarios } from '../scenarios/api.ts';
import { getChapter, type Chapter, type ChapterSummary } from '../timeline/api.ts';
import type { Block, Segment } from '../timeline/build.ts';
import { getWorld, nameOf, otherName, standings } from '../world/api.ts';
import { getStyle } from './api.ts';

/** The save of a warband, as far as the pack reads it. */
interface SaveBits {
  name?: string;
  canon?: { name_de?: string; name_en?: string };
  story?: { explain?: Record<string, string>; interludes?: Record<string, string> };
  models?: { uid: number; name?: string; profile?: Profile }[];
  fallen?: { m: { uid: number; name?: string; profile?: Profile } }[];
}
interface Profile { name_de?: string; name_en?: string; title_de?: string; title_en?: string; voice?: string; origin?: string }

export interface GatherArgs {
  cid: string;
  campaign: string;
  view: CampaignView;
  battle: BattleSummary;
  segs: Segment[];
  data: GameData;
}

/** Everything but what depends on the language. */
export interface Gathered {
  base: Omit<PackInput, 'chapters' | 'lastChapter'>;
  /** The chapters before this battle, in story order. */
  chapters: ChapterSummary[];
  last: Chapter | null;
  /** What is missing or not the way a writer would want it, to tell the leader. */
  warnings: string[];
}

const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** A note a writer may be given: said in public, or sealed and opened; never a leaders' note or a placeholder. */
function noteForWriter(n: Note): n is Exclude<Note, { sealed: true }> {
  return !isSealed(n) && n.visibility !== 'leader';
}

/** The segments of this battle, in the order of the story. */
function battleSegments(segs: Segment[], b: BattleSummary): { before: Block[]; course: Block[]; after: Block[]; round: Block[] } {
  const blocks = (key: string) => segs.find((s) => s.key === key)?.blocks ?? [];
  const history = !!b.takenOver;
  return {
    before: history ? [] : blocks(`b${b.id}:before`),
    course: blocks(`b${b.id}:battle`),
    after: history ? [] : blocks(`b${b.id}:after`),
    round: blocks(`i${b.round}`),
  };
}

export async function gatherPack(a: GatherArgs): Promise<Gathered> {
  const { cid, view, battle, segs, data } = a;
  const warnings: string[] = [];
  const names = Object.fromEntries(view.enrolments.map((e) => [e.warbandId, e.name || e.wbName]));
  const [bv, world, scenarios, background, style, backstory, plans] = await Promise.all([getBattle(cid, battle.id), getWorld(cid), getScenarios(cid), getBackground(cid), getStyle(cid), getBackstory(cid).catch(() => null), getPlans(cid).catch(() => null)]);
  if (!bv) throw new Error('The battle did not come back.');
  const fought = bv.participants;

  /* ---- each warband that fought: its mark, its changes, its save ---- */
  const reads = await Promise.all(fought.map((p) => readWarband(cid, p.warbandId).catch(() => null)));
  const involved = new Map<string, Set<string>>();
  const warbands = fought.map((p, i) => {
    const r = reads[i];
    const save = (r?.head.data ?? {}) as SaveBits;
    const tag = r?.tags.find((t) => t.kind === 'after_battle' && t.battleId === battle.id) ?? null;
    if (!r) warnings.push(`${p.name}: the warband could not be read.`);
    else if (!tag && !battle.takenOver) warnings.push(`${p.name} has not been marked after this battle: its aftermath is missing.`);
    const changes: PackChange[] = (tag?.changes ?? []).map((c) => ({
      kind: c.kind as PackChange['kind'], uid: typeof c.uid === 'number' ? c.uid : null, name: c.name, payload: c.payload, changeKey: c.changeKey, unexplained: c.unexplained,
    }));
    involved.set(p.warbandId, new Set(changes.map((c) => c.uid).filter((u): u is number => u != null).map(String)));
    return {
      warbandId: p.warbandId, name: p.name, type: p.wbName || p.wbType, player: p.player, outcome: p.outcome ? p.outcome[0]!.toUpperCase() + p.outcome.slice(1) : '',
      changes, explain: save.story?.explain ?? {}, interlude: (save.story?.interludes ?? {})[String(battle.round)] ?? '', save,
    };
  });

  /* ---- the protocol ---- */
  const casualties: PackCasualty[] = bv.entries.filter((e) => e.kind === 'casualty').map((e) => {
    const c = (e as { payload: CasualtyPayload }).payload;
    for (const side of [c.victim, c.attacker]) if (side?.warbandId && side.uid != null) involved.get(side.warbandId)?.add(String(side.uid));
    return { victim: { warbandId: c.victim.warbandId, uid: c.victim.uid ?? null, name: c.victim.name }, attacker: c.attacker ? { warbandId: c.attacker.warbandId, uid: c.attacker.uid ?? null, name: c.attacker.name } : null };
  });

  /* ---- the canon: the warbands, and the warriors the battle touched ---- */
  const canon: PackCanon[] = [];
  const profileOf = (p: Profile) => ({
    de: [p.name_de, p.title_de].filter(Boolean).join(', '), en: [p.name_en, p.title_en].filter(Boolean).join(', '), voice: p.voice ?? '', origin: p.origin ?? '',
  });
  for (const w of warbands) {
    const c = w.save.canon;
    if (c && (c.name_de || c.name_en)) canon.push({ name: w.name, warband: w.name, de: c.name_de ?? '', en: c.name_en ?? '', voice: '', origin: '' });
    const all = [...(w.save.models ?? []), ...(w.save.fallen ?? []).map((f) => f.m)];
    for (const uid of involved.get(w.warbandId) ?? []) {
      const m = all.find((x) => String(x.uid) === uid);
      if (!m?.profile) continue;
      const pr = profileOf(m.profile);
      if (pr.de || pr.en || pr.voice || pr.origin) canon.push({ name: m.name || w.changes.find((c) => String(c.uid) === uid)?.name || `warrior ${uid}`, warband: w.name, ...pr });
    }
  }

  /* ---- the story in order, and the notes of the round ---- */
  const seg = battleSegments(segs, battle);
  const item = (segment: PackStoryItem['segment'], b: Block): PackStoryItem | null => {
    if (b.type === 'note') {
      const n = b.note;
      if (!noteForWriter(n)) return null;
      const speaker = n.kind === 'quote' ? n.mentions[0]?.name : undefined;
      return { segment, label: KIND_NAMES[n.kind], quote: n.kind === 'quote', turn: n.turn ?? null, author: speaker ?? n.author, text: n.text, opened: n.visibility === 'sealed' };
    }
    if (b.type === 'entry') {
      const e = b.entry;
      if (e.kind === 'casualty') {
        const t = casualtyText(e.payload as CasualtyPayload, names);
        return { segment, label: 'Protocol', quote: false, turn: e.turn, author: e.author, text: `${t.victim} was put out of action${t.by ? ` by ${t.by}` : ''}`, opened: false };
      }
      return { segment, label: 'Protocol', quote: false, turn: e.turn, author: e.author, text: (e.payload as { text: string }).text, opened: false };
    }
    if (b.type === 'picture') {
      const p = b.picture;
      if (p.visibility === 'leader') return null;
      return { segment, label: 'Picture', quote: false, turn: p.turn ?? null, author: p.uploader, text: p.caption || '(a picture without a caption)', opened: false };
    }
    return null;
  };
  const story: PackStoryItem[] = [
    ...seg.before.map((b) => item('before', b)), ...seg.course.map((b) => item('course', b)), ...seg.after.map((b) => item('aftermath', b)),
  ].filter((x): x is PackStoryItem => x !== null);
  const roundNotes = seg.round.flatMap((b) => {
    if (b.type !== 'note' || !noteForWriter(b.note)) return [];
    const n = b.note;
    return [{ label: KIND_NAMES[n.kind], author: n.kind === 'quote' ? (n.mentions[0]?.name ?? n.author) : n.author, text: n.text, quote: n.kind === 'quote' }];
  });

  /* ---- the world, the scenario ---- */
  const standing = world.factions.flatMap((f) => standings(world, f.id).map((s) => ({ warband: s.warband, faction: nameOf(f), value: s.value })));
  const factionName = (fid: string | null) => { const f = world.factions.find((x) => x.id === fid); return f ? nameOf(f) : ''; };
  const scenario = scenarios.scenarios.find((s) => s.playedInBattle === battle.id) ?? null;
  const district = bv.battle.district ? (data.DISTRICTS.find((d) => d.id === bv.battle.district)?.name ?? bv.battle.district) : '';

  /* ---- the background, with each piece's rule ---- */
  const roundOf = (bid: string | null) => (bid ? (view.battles ?? []).find((x) => x.id === bid) : undefined);
  const bg: PackBackground[] = background.entries
    .filter((e: Entry) => e.status !== 'planned' && e.kind !== 'gm_note' && e.kind !== 'scenario')
    .map((e: Entry) => {
      const from = roundOf(e.revealFromBattle);
      return {
        kind: e.kind === 'figure' ? 'person' : e.kind, title: e.title, truth: e.truth, playersKnow: e.playersKnow,
        rule: ruleAtRound(e, battle.round, (id) => roundOf(id)?.round), hintLimits: e.hintLimits, revealedFrom: from ? `Battle ${from.round}` : '',
      } as PackBackground;
    });

  /* ---- the chapters before this battle, the last one in full ---- */
  const upTo = segs.findIndex((s) => s.key === `b${battle.id}:before` || s.key === `b${battle.id}:battle`);
  const chapters = segs.slice(0, upTo < 0 ? segs.length : upTo).flatMap((s) => s.blocks.flatMap((b) => (b.type === 'chapter' ? [b.chapter] : [])));
  const last = chapters.length ? await getChapter(cid, chapters.at(-1)!).catch(() => null) : null;
  if (chapters.length && !last) warnings.push('The last chapter could not be read; it is not in the pack.');

  /* ---- the backstory: what came before the app, as far as it precedes this battle ---- */
  if (!backstory) warnings.push('The backstory could not be read; it is not in the pack.');
  if (!plans) warnings.push('The leaders’ plans could not be read; the plan for this battle is not in the pack.');

  const base: Gathered['base'] = {
    campaign: a.campaign,
    battle: { round: battle.round, title: battle.title, district, playedAt: dayOf(bv.battle.playedAt ?? battle.closedAt ?? battle.createdAt), scenario: scenario ? { title: scenario.title, rules: scenario.body } : bv.battle.scenario ? { title: bv.battle.scenario, rules: '' } : null },
    warbands: warbands.map((w) => ({ warbandId: w.warbandId, name: w.name, type: w.type, player: w.player, outcome: w.outcome, changes: w.changes, explain: w.explain, interlude: w.interlude })),
    casualties,
    story,
    roundNotes,
    canon,
    world: {
      districts: campaignMap(view).map((d) => ({ name: d.name, heldBy: d.holders.join(', ') })),
      factions: world.factions.map((f) => ({ name: nameOf(f), other: otherName(f), status: f.publicStatus })),
      people: world.npcs.map((n) => ({ name: nameOf(n), other: otherName(n), faction: factionName(n.factionId), status: n.publicStatus })),
      reputation: standing,
    },
    background: bg,
    backstory: backstory ? backstoryBefore(backstory, battle.round) : [],
    plan: plans?.find((p) => p.round === battle.round)?.text ?? '',
    style: style.text,
  };
  if (!story.length) warnings.push('Nothing was recorded of the battle itself: no protocol, no notes.');
  return { base, chapters, last, warnings };
}

/** The input for core, in the language chosen: the chapters are named and the last one told in it, where it has one. */
export function packInput(g: Gathered, lang: PackLang): PackInput {
  const pick = <T,>(c: { de: T | null; en: T | null }): T | null => (lang === 'en' ? (c.en ?? c.de) : (c.de ?? c.en));
  const listed = g.chapters.flatMap((c) => { const l = pick(c); return l ? [{ label: l.label, title: l.title, icDate: l.icDate, place: l.place, victor: l.victor }] : []; });
  const lastLang = g.last ? pick(g.last) : null;
  return { ...g.base, chapters: listed, lastChapter: lastLang ? { heading: [lastLang.label, lastLang.title].filter(Boolean).join(' · '), text: lastLang.text } : null };
}

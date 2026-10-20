/* An NPC of a scenario: the values of an NPC of the world (npc.ts) with a name
   of its own and the parts the leader keeps from the players – the name, single
   characteristics or all of them, the save, skills, equipment, special rules.
   Where the players read the scenario, a hidden part is a "?": the server
   replaces it before it answers (ADR 0022), and the Tabletop Simulator copy
   carries the same "?". After the release what was hidden may be revealed,
   never changed. Pure. */
import type { StatKey } from '../data/types.ts';
import { ttsOpponentName, ttsOpponentText } from '../export/tts.ts';
import { emptyNpcProfile, npcAsOpponent, npcProfileFrom, type NpcProfile } from './npc.ts';
import { OPPONENT_STATS, type OpponentTemplate } from './opponents.ts';

/** The parts of an NPC that can be hidden: the name, each characteristic, the save, skills, equipment, special rules. */
export const HIDABLE = ['name', 'M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'sv', 'skills', 'equipment', 'rules'] as const;
export type Hidable = (typeof HIDABLE)[number];

/** The characteristics and the save: what "all stats" means. */
export const STAT_PARTS: readonly Hidable[] = [...OPPONENT_STATS, 'sv'];

export const HIDDEN_MARK = '?';

export interface ScenarioNpc extends NpcProfile {
  /** The device's id, so an NPC keeps its identity through edits – the release rule compares by it. */
  id: string;
  name: string;
  hidden: Hidable[];
}

export const emptyScenarioNpc = (id: string): ScenarioNpc => ({ id, name: '', hidden: [], ...emptyNpcProfile() });

/** A new NPC copied from a template (a model of the game, an NPC of the world …); nothing hidden yet. */
export const scenarioNpcFrom = (id: string, t: OpponentTemplate): ScenarioNpc => ({ id, name: t.name, hidden: [], ...npcProfileFrom(t) });

/** The same parts once, in the order of `HIDABLE`. */
export const normalizeHidden = (hidden: readonly string[]): Hidable[] => HIDABLE.filter((k) => hidden.includes(k));

/** An NPC as the players read it: every hidden part a "?". Where it was copied from is the leader's own note and goes. The type is never read by anybody, not even as a "?": it is too much of the game for our table (Rob, 20.10.2026), so it goes out empty. */
export function redactNpc(n: ScenarioNpc): ScenarioNpc {
  const hidden = new Set<string>(n.hidden);
  const profile = { ...n.profile };
  for (const k of OPPONENT_STATS) if (hidden.has(k)) profile[k] = HIDDEN_MARK;
  return {
    id: n.id, hidden: normalizeHidden(n.hidden),
    name: hidden.has('name') ? HIDDEN_MARK : n.name,
    type: '',
    profile,
    sv: hidden.has('sv') ? HIDDEN_MARK : n.sv,
    // skills are read as rules in the card: with the rules hidden as well, one "?" says it
    skills: hidden.has('skills') ? (hidden.has('rules') ? [] : [{ name: HIDDEN_MARK, text: '' }]) : n.skills.map((s) => ({ name: s.name, text: s.text })),
    equipment: hidden.has('equipment') ? HIDDEN_MARK : n.equipment,
    rules: hidden.has('rules') ? HIDDEN_MARK : n.rules,
    from: null,
  };
}

/** The two fields of the Tabletop Simulator card, as the table gets them: hidden parts a "?" (`all`: every value, for the leader's own use).
    The type plays no part: the name has the colour of every NPC, whoever copies the card. */
export function scenarioNpcCard(n: ScenarioNpc, all = false): { name: string; text: string } {
  const shown = all ? n : redactNpc(n);
  const card = npcAsOpponent(shown.name, { ...shown, type: '' });
  return { name: ttsOpponentName(card), text: ttsOpponentText(card) };
}

/** What a hidden part holds, as one string to compare. */
function valueOf(n: ScenarioNpc, k: Hidable): string {
  if (k === 'name') return n.name;
  if (k === 'sv') return n.sv;
  if (k === 'skills') return JSON.stringify(n.skills.map((s) => [s.name, s.text]));
  if (k === 'equipment') return n.equipment;
  if (k === 'rules') return n.rules;
  return n.profile[k as StatKey] ?? '';
}

/** The rule after the release: what was hidden may be revealed but never changed, an NPC with hidden parts stays, and nothing new is hidden that the players have read. `null`: the change is allowed. */
export function releasedChangeProblem(cur: readonly ScenarioNpc[], next: readonly ScenarioNpc[]): string | null {
  for (const c of cur) {
    const n = next.find((x) => x.id === c.id);
    if (!n) {
      if (c.hidden.length > 0) return `${c.name || 'an NPC'} has hidden parts and stays in a released scenario`;
      continue;
    }
    const added = n.hidden.find((k) => !c.hidden.includes(k));
    if (added) return `what the players have read cannot be hidden after the release (${added})`;
    const changed = c.hidden.find((k) => valueOf(c, k) !== valueOf(n, k));
    if (changed) return `what is hidden cannot be changed after the release, only revealed (${changed})`;
  }
  return null;
}

/** What a change reveals: for every NPC that was there, the parts that were hidden and are not any more. */
export function revealedBy(cur: readonly ScenarioNpc[], next: readonly ScenarioNpc[]): { npc: string; parts: Hidable[] }[] {
  const out: { npc: string; parts: Hidable[] }[] = [];
  for (const c of cur) {
    const n = next.find((x) => x.id === c.id);
    const parts = c.hidden.filter((k) => !n || !n.hidden.includes(k));
    if (n && parts.length) out.push({ npc: c.id, parts });
  }
  return out;
}

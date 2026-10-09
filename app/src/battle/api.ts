/* A campaign's battles on the server (phase 4a2; server/src/routes-battles.ts).
   The last state of a battle is kept on the device, so the game night
   shows it offline; with its seq the device asks only for what is newer. */
import { api } from '../account/api.ts';
import { ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export type Outcome = '' | 'victory' | 'defeat' | 'draw' | 'routed';
export const OUTCOME_NAMES: Record<Exclude<Outcome, ''>, string> = { victory: 'Victory', defeat: 'Defeat', draw: 'Draw', routed: 'Routed' };

/** One side of a casualty (as server/src/battles.ts checks it). */
export interface Side { warbandId?: string; uid?: number | null; idx?: number; fallenIdx?: number; name: string; grade?: 'hero' | 'hench'; wb?: string; env?: true }
export interface CasualtyPayload { victim: Side; attacker: Side | null; note: string }
export interface EventPayload { text: string }
export type EntryBody = { turn: number; kind: 'casualty'; payload: CasualtyPayload } | { turn: number; kind: 'event'; payload: EventPayload };
export type Entry = EntryBody & { id: string; author: string; createdAt: string; updatedAt: string };
export interface Proposal { id: string; targetType: 'battle' | 'protocol_entry'; targetId: string; authorId: string; author: string; payload: { text: string }; status: 'open' | 'accepted' | 'rejected'; decidedBy: string | null; createdAt: string }
export interface Participant { warbandId: string; name: string; wbType: string; wbName: string; playerId: string; player: string; outcome: Outcome; revBefore: number | null }
/** A warband marked "after battle N" (phase 4a4): its version, and how many changes were frozen with it. */
export interface Mark { tagId: string; rev: number; totals: unknown; changes: number; unexplained: number; createdAt: string }
export interface BattleView {
  battle: {
    id: string; campaignId: string; round: number; title: string; scenario: string; district: string; status: 'open' | 'closed'; turn: number; createdAt: string; updatedAt: string; closedAt: string | null;
    /** Phase 4a5 (absent in a view kept from before): a battle of the history, played before the app, and the day it was played. */
    takenOver?: boolean; playedAt?: string | null;
  };
  seq: number;
  participants: Participant[];
  entries: Entry[];
  proposals: Proposal[];
  /** Phase 4a4; absent in a view kept from before it. */
  marks?: Record<string, Mark>;
}
/** A change frozen with a mark, as core found and explained it (server/src/aftermath.ts). */
export interface FrozenChange { kind: string; uid: number | string | null; name: string; changeKey: string; payload: Record<string, unknown>; eventRef: string | null; unexplained: boolean }
/** `warbandIds`, `marked`: phase 4a4 (who fought, whose warband is marked after it); `takenOver`, `playedAt`: phase 4a5 (a battle of the
    history, played before the app; the day it was played). Absent in a summary kept from before. */
export interface BattleSummary {
  id: string; round: number; title: string; status: 'open' | 'closed'; turn: number; warbands: string[]; warbandIds?: string[]; marked?: string[]; createdAt: string; closedAt: string | null;
  takenOver?: boolean; playedAt?: string | null;
}

const key = (bid: string) => ownKey('battle:', bid);
export const battleTitle = (b: { round: number; title: string }) => `Battle ${b.round}${b.title ? ` · ${b.title}` : ''}`;

export async function cachedBattle(bid: string): Promise<BattleView | null> {
  return ((await db.meta.get(key(bid)))?.value as BattleView | undefined) ?? null;
}
async function keep(v: BattleView): Promise<BattleView> {
  await db.meta.put({ key: key(v.battle.id), value: v });
  return v;
}

/** The battle; with `since`, null when nothing is newer than that. */
export async function getBattle(cid: string, bid: string, since?: number): Promise<BattleView | null> {
  const r = await api<BattleView | { unchanged: true; seq: number }>(`/campaigns/${cid}/battles/${bid}${since !== undefined ? `?since=${since}` : ''}`);
  return 'unchanged' in r ? null : keep(r);
}
export const createBattle = (cid: string, b: { id: string; title: string; district: string; warbandIds: string[] }) => api<BattleView>(`/campaigns/${cid}/battles`, { body: b }).then(keep);
export const patchBattle = (cid: string, bid: string, p: { title?: string; district?: string; turn?: number; outcomes?: Record<string, Outcome> }) =>
  api<BattleView>(`/campaigns/${cid}/battles/${bid}`, { method: 'PATCH', body: p }).then(keep);
/** Closes the battle (a leader): the protocol is fixed, its sealed notes open. */
export const closeBattle = (cid: string, bid: string) => api<BattleView>(`/campaigns/${cid}/battles/${bid}/close`, { body: {} }).then(keep);
/** Marks a version of one's warband "after" this battle; marked again, the newer mark corrects the earlier. */
export const markBattle = (cid: string, bid: string, warbandId: string, rev: number) =>
  api<{ tag: { id: string; rev: number; round: number }; changes: FrozenChange[] }>(`/campaigns/${cid}/battles/${bid}/marks`, { body: { warbandId, rev } });
export const decideProposal = (cid: string, bid: string, pid: string, accept: boolean) => api<BattleView>(`/campaigns/${cid}/battles/${bid}/proposals/${pid}/${accept ? 'accept' : 'reject'}`, { body: {} }).then(keep);

/** A casualty in words: "Magda (The Silver Caravan) is out of action – by Skritch (Clan Skrittle)." */
export function casualtyText(c: CasualtyPayload, names: Record<string, string>): { victim: string; by: string | null } {
  const who = (s: Side) => {
    const wb = s.warbandId ? names[s.warbandId] : undefined;
    if (!wb) return s.name;
    // nobody picked of that warband
    return s.uid == null && s.name === wb ? `someone of ${wb}` : `${s.name} (${wb})`;
  };
  return { victim: who(c.victim), by: c.attacker ? (c.attacker.env ? 'the surroundings' : who(c.attacker)) : null };
}

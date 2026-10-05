/* A campaign's battles on the server (phase 4a2; server/src/routes-battles.ts).
   The last state of a battle is kept on the device, so the game night
   shows it offline; with its seq the device asks only for what is newer. */
import { api } from '../account/api.ts';
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
export interface BattleView {
  battle: { id: string; campaignId: string; round: number; title: string; scenario: string; district: string; status: 'open' | 'closed'; turn: number; createdAt: string; updatedAt: string; closedAt: string | null };
  seq: number;
  participants: Participant[];
  entries: Entry[];
  proposals: Proposal[];
}
export interface BattleSummary { id: string; round: number; title: string; status: 'open' | 'closed'; turn: number; warbands: string[]; createdAt: string; closedAt: string | null }

const key = (bid: string) => `battle:${bid}`;
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

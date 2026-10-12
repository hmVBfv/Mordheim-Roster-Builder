/* A warrior's life (phase 4b2; concept.md 4.6 "Lebenslauf"): derived, never
   stored. What the marks froze as changes – each with the explanation its
   player gave – the protocol entries he took part in, the notes that
   mention him, in the order they happened. Pure: the caller brings what it
   has (marks and notes come from the server and may be missing offline).

   Without any mark – a warband not in a campaign, or one not marked yet –
   the save's own chronicle stands in for the changes: what the tool wrote
   down as it happened (advances, promotion, recruiting, items). */
import type { GameData } from '../data/types.ts';
import { casualtyText } from '../rules/casualties.ts';
import { ctxOf } from '../rules/context.ts';
import type { Casualty, LogEntry, WarbandState } from '../state/types.ts';
import { describeChange } from './briefing.ts';
import type { Change } from '../changes/diff.ts';
import { STORY_KINDS } from '../changes/reconcile.ts';

/** A change as a mark froze it (the server's record of what core found and explained). */
export interface LifeChange {
  kind: string; uid: number | string | null; hireUid?: string; name: string; changeKey: string; payload: Record<string, unknown>; eventRef: string | null; unexplained: boolean;
}
/** The changes of one mark ("after battle N"). */
export interface LifeMark { round: number; changes: LifeChange[] }
/** A note that mentions the warrior, as far as the reader may read it; `round` of the battle it hangs on, null for the campaign in general. */
export interface LifeNote { id: string; round: number | null; text: string; kind: string; author: string; at: string }

export type LifeKind = 'protocol' | 'change' | 'event' | 'note';
export interface LifeEntry {
  key: string;
  /** The round of the battle it belongs to: 0 the founding, null the campaign in general. */
  round: number | null;
  kind: LifeKind;
  text: string;
  /** What the player wrote about it (changes only). */
  why?: string;
  /** No cause was found for it, and its player has not explained it either. */
  unexplained?: boolean;
  /** Notes: who wrote it. */
  by?: string;
}

export interface LifeInput {
  /** A hero's or group's `uid`, or a Hired Sword's (text) `uid`. */
  uid: number | string;
  marks?: LifeMark[];
  notes?: LifeNote[];
}

/** "Founding", "Battle 3", "The campaign". */
export const lifeLabel = (round: number | null): string => (round == null ? 'The campaign' : round === 0 ? 'Founding' : `Battle ${round}`);

/** Kinds that read as a life: what happened to him, not the bookkeeping around it. */
const LIFE_KINDS: ReadonlySet<string> = new Set([...STORY_KINDS, 'renamed']);
/** The tool's own chronicle entries that stand for changes. */
const LOG_KINDS: ReadonlySet<string> = new Set(['advance', 'promote', 'recruit', 'item', 'death']);

const same = (a: unknown, b: number | string) => a != null && String(a) === String(b);
const ORDER: Record<LifeKind, number> = { protocol: 0, change: 1, event: 1, note: 2 };

export function lifeOf(data: GameData, s: WarbandState, input: LifeInput): LifeEntry[] {
  const { uid } = input;
  const ctx = ctxOf(data, s);
  const explain = (s.story as { explain?: Record<string, string> } | undefined)?.explain ?? {};
  const out: LifeEntry[] = [];
  const marks = input.marks ?? [];

  /* what the marks froze */
  const covered = new Set<string>();
  for (const m of marks) {
    for (const c of m.changes) {
      if (!LIFE_KINDS.has(c.kind) || !(same(c.hireUid, uid) || (c.hireUid == null && same(c.uid, uid)))) continue;
      if (c.eventRef) covered.add(c.eventRef);
      const why = (typeof explain[c.changeKey] === 'string' ? explain[c.changeKey]! : '').trim();
      out.push({
        key: `c:${m.round}:${c.changeKey}`, round: m.round, kind: 'change', text: `${describeChange(data, c as unknown as Change)}.`,
        ...(why ? { why } : {}), ...(c.unexplained && !why ? { unexplained: true } : {}),
      });
    }
  }

  /* the protocol: what happened to him in a battle, what he did to others */
  const cas = ((s.campaign?.casualties ?? []) as Casualty[]).filter((c) => same(c.victim?.uid, uid) || same(c.attacker?.uid, uid));
  for (const c of cas) {
    if (covered.has(`cas:${c.id}`)) continue;
    out.push({ key: `p:${c.id}`, round: Number(c.round) || 0, kind: 'protocol', text: casualtyText(ctx, c) });
  }

  /* no mark yet: the tool's own chronicle for the changes */
  if (!marks.length) {
    const dead = cas.some((c) => same(c.victim?.uid, uid) && c.result === 'dead');
    for (const e of (s.campaign?.log ?? []) as LogEntry[]) {
      if (!LOG_KINDS.has(e.type) || !same(e.data?.uid, uid) || (e.type === 'death' && dead)) continue;
      out.push({ key: `e:${e.id}`, round: Number(e.round) || 0, kind: 'event', text: e.text });
    }
  }

  /* the notes that mention him */
  for (const n of input.notes ?? []) out.push({ key: `n:${n.id}`, round: n.round, kind: 'note', text: n.text, by: n.author });

  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.round ?? Infinity) - (b.e.round ?? Infinity) || ORDER[a.e.kind] - ORDER[b.e.kind] || a.i - b.i)
    .map((x) => x.e);
}

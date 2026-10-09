/* The timeline put together (phase 4a3, part 2; concept.md 4.7, docs/
   data-model.md section 5): a frame of fixed anchors – before the
   campaign, each battle's before, course and aftermath, the interlude
   after each round – and in it every block the user may see: notes,
   pictures, the protocol. A block stands where it was moved to; one never
   moved stands where its battle and time put it, ordered by turn and by
   when it was recorded. Battle reports and marks are fixed. A battle of
   the campaign's history, played before the app (4a5), is a single
   segment. Kept apart from React so it can be tested. */
import type { BattleSummary } from '../battle/api.ts';
import { isSealed, type Note } from '../notes/api.ts';
import type { ShownPicture } from '../pictures/api.ts';
import type { ChapterSummary, ItemType, Position, TimelineData, TimelineEntry, TimelineMark, TimelineOutcome } from './api.ts';
import { defaultKey } from './order.ts';

export type Block =
  | { type: 'note'; id: string; key: string; at: string; note: Note & { pending?: boolean } }
  | { type: 'picture'; id: string; key: string; at: string; picture: ShownPicture }
  | { type: 'entry'; id: string; key: string; at: string; entry: TimelineEntry }
  | { type: 'chapter'; id: string; key: string; at: string; chapter: ChapterSummary };

export interface Segment {
  key: string;
  title: string;
  /** Fixed in place: the battle's report (who fought, how it ended), the marks. */
  report: { battle: BattleSummary; outcomes: TimelineOutcome[] } | null;
  marks: TimelineMark[];
  blocks: Block[];
}

const ordered = (bs: BattleSummary[]) => [...bs].sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt));

/** Where a block stands that was never moved. */
function defaultSegment(battles: BattleSummary[], battleId: string | null, at: string, sealed: boolean): string {
  const b = battleId ? battles.find((x) => x.id === battleId) : undefined;
  if (b) {
    if (sealed || at < b.createdAt) return `b${b.id}:before`;
    if (b.closedAt && at > b.closedAt) return `b${b.id}:after`;
    return `b${b.id}:battle`;
  }
  // about the campaign in general: after the last battle begun before it
  const last = ordered(battles).filter((x) => x.createdAt <= at).at(-1);
  if (!last) return 'pre';
  return last.closedAt && last.closedAt <= at ? `i${last.round}` : `b${last.id}:battle`;
}

export function buildTimeline(battles: BattleSummary[], notes: (Note & { pending?: boolean })[], pictures: ShownPicture[], data: TimelineData): Segment[] {
  const list = ordered(battles);
  const segs: Segment[] = [{ key: 'pre', title: 'Before the campaign', report: null, marks: [], blocks: [] }];
  // a battle of the history (4a5), played before the app, is one segment: its before and aftermath are that too
  const alias = new Map<string, string>();
  list.forEach((b, i) => {
    const name = `Battle ${b.round}${b.title ? ` · ${b.title}` : ''}`;
    const report = { battle: b, outcomes: data.outcomes.filter((o) => o.battleId === b.id) };
    if (b.takenOver) {
      segs.push({ key: `b${b.id}:battle`, title: `${name} · before the app`, report, marks: [], blocks: [] });
      alias.set(`b${b.id}:before`, `b${b.id}:battle`).set(`b${b.id}:after`, `b${b.id}:battle`);
    } else {
      segs.push(
        { key: `b${b.id}:before`, title: `${name} · before`, report: null, marks: [], blocks: [] },
        { key: `b${b.id}:battle`, title: `${name} · course`, report, marks: [], blocks: [] },
        { key: `b${b.id}:after`, title: `${name} · aftermath`, report: null, marks: [], blocks: [] },
      );
    }
    // the interlude after the round's last battle
    if (list[i + 1]?.round !== b.round) segs.push({ key: `i${b.round}`, title: `Interlude ${b.round}`, report: null, marks: [], blocks: [] });
  });
  const by = new Map(segs.map((s) => [s.key, s]));
  for (const [from, to] of alias) by.set(from, by.get(to)!);
  for (const m of data.marks) {
    // a warband entered after a battle – or at the takeover, after the history – starts in that round's interlude
    const seg = m.kind === 'start' ? (m.round > 0 && by.has(`i${m.round}`) ? `i${m.round}` : 'pre') : m.kind === 'after_battle' && m.battleId ? `b${m.battleId}:after` : `i${m.round}`;
    by.get(seg)?.marks.push(m);
  }
  const moved = new Map(data.positions.map((p) => [`${p.itemType}:${p.itemId}`, p]));
  const place = (type: ItemType, id: string, fallback: string, at: string, turn: number | null): { seg: Segment; key: string } => {
    const p: Position | undefined = moved.get(`${type}:${id}`);
    const seg = (p && by.get(p.segment)) ?? by.get(fallback) ?? by.get('pre')!;
    return { seg, key: p && by.get(p.segment) ? p.pos : defaultKey(at, turn) };
  };
  for (const n of notes) {
    const turn = isSealed(n) ? null : n.turn;
    const { seg, key } = place('note', n.id, defaultSegment(list, n.battleId, n.createdAt, n.visibility === 'sealed'), n.createdAt, turn);
    seg.blocks.push({ type: 'note', id: n.id, key, at: n.createdAt, note: n });
  }
  for (const p of pictures) {
    const { seg, key } = place('picture', p.id, defaultSegment(list, p.battleId, p.createdAt, false), p.createdAt, p.turn);
    seg.blocks.push({ type: 'picture', id: p.id, key, at: p.createdAt, picture: p });
  }
  for (const e of data.entries) {
    if (!list.some((b) => b.id === e.battleId)) continue;
    const { seg, key } = place('entry', e.id, `b${e.battleId}:battle`, e.createdAt, e.turn);
    seg.blocks.push({ type: 'entry', id: e.id, key, at: e.createdAt, entry: e });
  }
  // a chapter (4a5) stands where its import put it; one without a place, before the campaign
  for (const c of data.chapters ?? []) {
    const { seg, key } = place('chapter', c.id, 'pre', c.createdAt, 0);
    seg.blocks.push({ type: 'chapter', id: c.id, key, at: c.publishedOn ?? c.createdAt, chapter: c });
  }
  for (const s of segs) s.blocks.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.at.localeCompare(b.at)));
  return segs;
}

/** Where a block goes one step up or down: the place between its new neighbours (crossing into the next segment at an edge), or null at the very start or end. */
export function stepPlace(segs: Segment[], id: string, dir: -1 | 1): { segment: string; before: string | null; after: string | null } | null {
  const si = segs.findIndex((s) => s.blocks.some((b) => b.id === id));
  if (si < 0) return null;
  const seg = segs[si]!;
  const i = seg.blocks.findIndex((b) => b.id === id);
  const others = seg.blocks.filter((b) => b.id !== id);
  if (dir === -1 && i > 0) return { segment: seg.key, before: others[i - 2]?.key ?? null, after: others[i - 1]!.key };
  if (dir === 1 && i < seg.blocks.length - 1) return { segment: seg.key, before: others[i]!.key, after: others[i + 1]?.key ?? null };
  // across the edge: to the end of the segment before, the start of the one after
  const next = segs[si + dir];
  if (!next) return null;
  return dir === -1
    ? { segment: next.key, before: next.blocks.at(-1)?.key ?? null, after: null }
    : { segment: next.key, before: null, after: next.blocks[0]?.key ?? null };
}

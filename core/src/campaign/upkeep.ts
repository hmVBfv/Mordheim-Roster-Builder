/* The upkeep of Hired Swords and Dramatis Personae (N10, docs/plan-postbattle.md; mordheimer.net, Campaigns: Hired Swords – hire fee): after
   each battle he fights, the first included, the upkeep is paid if he is to stay; one who is dead or no longer wanted costs nothing. The page
   lists them, the player pays or dismisses, and the round records it (ADR 0032). */
import { ctxOf, type Ctx } from '../rules/context.ts';
import type { WarbandState } from '../state/types.ts';
import { goldCurrent } from '../rules/costs.ts';
import { hsUpkeepFor } from '../rules/hire.ts';
import { dismissHire } from '../trade/market.ts';
import { update } from '../warband/update.ts';
import { bookGoldOn } from './locationApply.ts';
import { postbattleOn, type Find, type PostBattleState } from './postbattle.ts';

export interface UpkeepLine {
  uid: string;
  key: string;
  kind: 'hs' | 'dp';
  name: string;
  /** The upkeep in gold. */
  gc: number;
  /** An upkeep that is not (only) gold, in words. */
  note?: string;
  /** Paid this round. */
  paid: boolean;
}

const roundRec = (s: WarbandState, round: number): PostBattleState | undefined =>
  (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];

/** Who is on the roster and owed upkeep this round. */
export function upkeepDue(ctx: Ctx, round: number): UpkeepLine[] {
  const paid = new Set((roundRec(ctx.s, round)?.upkeep?.paid ?? []).map((p) => p.uid));
  const out: UpkeepLine[] = [];
  for (const h of ctx.s.hired ?? []) {
    const e = ctx.data.HIREDSWORDS[h.key];
    out.push({ uid: h.uid, key: h.key, kind: 'hs', name: h.name || e?.name || h.key, gc: hsUpkeepFor(ctx, h.key), paid: paid.has(h.uid) });
  }
  for (const d of ctx.s.dp ?? []) {
    const e = ctx.data.DRAMATIS[d.key];
    const note = (e as { upkeepNote?: string } | undefined)?.upkeepNote;
    out.push({ uid: d.uid, key: d.key, kind: 'dp', name: d.name || e?.name || d.key, gc: Number(e?.upkeep) || 0, ...(note ? { note } : {}), paid: paid.has(d.uid) });
  }
  return out;
}

/** What is wrong with paying these (null if nothing): an unknown or already paid one. A treasury that cannot bear it is not a refusal – the
    page warns and the player decides – but it is said (`afford`). */
export function upkeepProblem(ctx: Ctx, round: number, uids: readonly string[], opts: { free?: readonly string[] } = {}): string | null {
  const due = upkeepDue(ctx, round);
  for (const u of uids) {
    const l = due.find((x) => x.uid === u);
    if (!l) return `${u} is not on the roster.`;
    if (l.paid) return `${l.name} is paid already.`;
  }
  const total = uids.reduce((n, u) => n + (opts.free?.includes(u) ? 0 : (due.find((x) => x.uid === u)?.gc ?? 0)), 0);
  return goldCurrent(ctx) < total ? `Not enough gold in hand: ${total} gc to pay, ${goldCurrent(ctx)} gc in hand (afford).` : null;
}

/** Pays the upkeep of these (those in `free` cost nothing: Returning a Favour): the gold leaves the treasury – a booking that names its
    origin with the ledger – and each is recorded with a find. An unknown or already paid one leaves the state as it was. */
export function payUpkeep(ctx: Ctx, round: number, uids: readonly string[], opts: { free?: readonly string[] } = {}): WarbandState {
  const due = upkeepDue(ctx, round);
  if (!uids.length || uids.some((u) => !due.some((x) => x.uid === u && !x.paid))) return ctx.s;
  return update(ctx, (d, c) => {
    const rec = postbattleOn(d, c, round);
    const up = rec.upkeep ?? { paid: [], dismissed: [] };
    const finds = rec.finds ?? [];
    for (const u of uids) {
      const l = due.find((x) => x.uid === u)!;
      const gc = opts.free?.includes(u) ? 0 : l.gc;
      if (gc) bookGoldOn(d, c, -gc, `Upkeep of ${l.name}`, 'upkeep');
      up.paid.push({ uid: u, gc });
      finds.push({ id: finds.reduce((m, f) => Math.max(m, f.id), 0) + 1, kind: 'gold', source: 'upkeep', amount: -gc, uid: u, text: gc ? `Paid ${gc} gc upkeep to ${l.name}.` : `${l.name} stays free of charge.` } satisfies Find);
    }
    rec.upkeep = up;
    rec.finds = finds;
  });
}

/** Takes the upkeep paid this round back: the gold returns and the records go. */
export function undoUpkeep(ctx: Ctx, round: number): WarbandState {
  const rec = roundRec(ctx.s, round);
  if (!rec?.upkeep?.paid.length) return ctx.s;
  const gc = rec.upkeep.paid.reduce((n, p) => n + p.gc, 0);
  return update(ctx, (d, c) => {
    const r = postbattleOn(d, c, round);
    if (gc) bookGoldOn(d, c, gc, 'Upkeep taken back', 'upkeep');
    r.upkeep = { paid: [], dismissed: r.upkeep?.dismissed ?? [] };
    r.finds = (r.finds ?? []).filter((f) => f.source !== 'upkeep');
  });
}

/** Sends a hireling away: he leaves the roster (core dismissHire) and the round records it. He costs nothing. */
export function dismissUpkeep(ctx: Ctx, round: number, uid: string): WarbandState {
  const l = upkeepDue(ctx, round).find((x) => x.uid === uid);
  if (!l) return ctx.s;
  const next = dismissHire(ctx, uid, l.kind);
  if (next === ctx.s) return ctx.s;
  return update(ctxOf(ctx.data, next), (d, c) => {
    const rec = postbattleOn(d, c, round);
    const up = rec.upkeep ?? { paid: [], dismissed: [] };
    if (!up.dismissed.includes(uid)) up.dismissed.push(uid);
    rec.upkeep = up;
  });
}

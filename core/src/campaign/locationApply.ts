/* Taking a place of the Exploration chart (N8): what `resolveLocation` found is booked – gold into the treasury (or the ledger, naming its
   origin), shards and items into the stash, experience held like the battle's, lasting advantages kept in the campaign – and recorded as the
   round's finds with their origin. Taking it back undoes it (not a death: the editor's Undo does that). */
import type { Casualty, Model, Perk, WarbandState } from '../state/types.ts';
import { leaderUid } from '../rules/profile.ts';
import type { Ctx } from '../rules/context.ts';
import { goldTreasury } from '../rules/costs.ts';
import { bookOn, ledgerOn } from '../trade/ledger.ts';
import { campState, logEvent } from '../warband/log.ts';
import { killHeroOn } from '../warband/casualties.ts';
import { grantXpOn } from '../warband/xp.ts';
import { update, type WarbandDraft } from '../warband/update.ts';
import { postbattleOn, type Find, type PostBattleState } from './postbattle.ts';
import { resolveLocation, type Answer, type LocFind } from './locations.ts';

export interface ApplyLocationInput {
  key: string;
  answers: Record<string, Answer>;
  /** For an item with several to choose from: the index of the find (in the order of the resolution) → the item chosen. */
  pick?: Record<number, string>;
  /** For experience "distributed among the Heroes": the Hero (uid) → his points. They must add up. */
  spread?: Record<number, number>;
}

const roundRec = (s: WarbandState, round: number): PostBattleState | undefined =>
  (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];
const SOURCE = (key: string) => `location:${key}`;

/** Why this cannot be taken (null if it can). */
export function locationProblem(ctx: Ctx, round: number, input: ApplyLocationInput): string | null {
  if (roundRec(ctx.s, round)?.location) return 'A place was already taken this round: take it back first.';
  const r = resolveLocation(ctx, input.key, input.answers);
  if (!r.done) return r.problems[0] ?? 'Answer every question first.';
  if (r.problems.length) return r.problems[0] as string;
  for (const [i, f] of r.finds.entries()) {
    const pick = input.pick?.[i];
    if (f.options && pick != null && !f.options.includes(pick)) return `Choose ${f.options.join(' or ')}.`;
  }
  const loose = r.finds.filter((f) => f.kind === 'exp' && f.uid == null).reduce((n, f) => n + (f.amount ?? 0), 0);
  if (loose > 0) {
    const given = Object.values(input.spread ?? {}).reduce((n, v) => n + (Number(v) || 0), 0);
    if (input.spread && given !== loose) return `Spread ${loose} experience among the Heroes (now ${given}).`;
    const heroes = new Set(ctx.s.models.map((m) => m.uid));
    if (input.spread && Object.keys(input.spread).some((u) => !heroes.has(Number(u)))) return 'That is not one of your Heroes.';
  }
  return null;
}

const nextId = (finds: Find[]): number => finds.reduce((n, f) => Math.max(n, f.id), 0) + 1;

/** Gold into (or out of) the treasury: a booking naming its origin when the ledger is kept, else the treasury itself. */
export function bookGoldOn(d: WarbandDraft, c: Ctx, n: number, text: string, source: string): void {
  if (!n) return;
  if (ledgerOn(d as WarbandState)) {
    const e = bookOn(d, c, 'adjust', n, { text });
    if (e) e.source = source;
  } else {
    d.stash = d.stash ?? { wyrd: 0, gold: null, items: [] };
    d.stash.gold = goldTreasury(c) + n;
  }
}

/** Books what the place brought and records it. Anything that cannot be taken (see locationProblem) leaves the state as it was. */
export function applyLocation(ctx: Ctx, round: number, input: ApplyLocationInput): WarbandState {
  if (locationProblem(ctx, round, input)) return ctx.s;
  const r = resolveLocation(ctx, input.key, input.answers);
  const source = SOURCE(input.key);
  return update(ctx, (d, c) => {
    const rec = postbattleOn(d, c, round);
    const camp = campState(d);
    const finds: Find[] = [];
    const add = (f: Omit<Find, 'id'>): Find => { const x = { ...f, id: nextId([...(rec.finds ?? []), ...finds]) } as Find; finds.push(x); return x; };
    d.stash = d.stash ?? { wyrd: 0, gold: null, items: [] };
    d.stash.items = d.stash.items ?? [];
    const leader = leaderUid(c);
    r.finds.forEach((f: LocFind, i) => {
      if (f.kind === 'gold') { bookGoldOn(d, c, f.amount ?? 0, f.text, source); add({ kind: 'gold', source, amount: f.amount, text: f.text }); }
      else if (f.kind === 'wyrd') { d.stash!.wyrd = (Number(d.stash!.wyrd) || 0) + (f.amount ?? 0); add({ kind: 'wyrd', source, amount: f.amount, text: f.text }); }
      else if (f.kind === 'item') {
        const name = f.options ? (input.pick?.[i] ?? f.item as string) : f.item as string;
        const cat = c.data.CATALOG.find((x) => x.en.toLowerCase() === name.toLowerCase());
        d.stash!.items!.push({
          name, qty: f.qty ?? 1, paid: 0, source, ...(cat ? { key: cat.de, ...(cat.rare && cat.rare !== 'Common' ? { rare: true } : {}) } : {}),
          ...(f.gem ? { gem: true, value: f.worth } : {}),
        });
        add({ kind: 'item', source, item: name, qty: f.qty ?? 1, ...(f.worth != null ? { worth: f.worth } : {}), text: f.text });
      } else if (f.kind === 'exp') {
        const grant = (uid: number, amount: number) => { const x = grantXpOn(d, c, uid, amount, f.text || 'found a place', round); add({ kind: 'exp', source, amount, uid, ...(x ? { xpId: x.id } : {}), text: f.text }); };
        if (f.uid != null) grant(Number(f.uid), f.amount ?? 0);
        else if (input.spread) for (const [u, pts] of Object.entries(input.spread)) { if (Number(pts) > 0) grant(Number(u), Number(pts)); }
        else if (leader != null) grant(leader as number, f.amount ?? 0);
      } else if (f.act === 'miss' && f.uid != null) {
        const m = (d.models as Model[]).find((x) => x.uid === f.uid);
        if (m) { m.miss = (Number(m.miss) || 0) + 1; m.missWhy = f.text || 'tainted water'; }
        add({ kind: 'note', source, uid: f.uid, act: 'miss', text: f.text });
      } else if (f.act === 'lose' && f.uid != null) {
        killHeroOn(d, c, Number(f.uid), f.text, null as unknown as Casualty);
        add({ kind: 'note', source, uid: f.uid, act: 'lose', text: f.text });
      } else add({ kind: 'note', source, text: f.text });
    });
    const perks = (camp.perks ?? []) as Perk[];
    for (const p of r.perks) {
      if (p.unique && perks.some((x) => x.id === p.id && x.unique)) continue;
      perks.push({ id: p.id, text: p.text, round, key: input.key, ...(p.uid != null ? { uid: p.uid } : {}), ...(p.unique ? { unique: true } : {}), ...(p.explore ? { explore: p.explore } : {}) });
    }
    camp.perks = perks;
    rec.finds = [...(rec.finds ?? []), ...finds];
    rec.location = { key: input.key, answers: input.answers };
    logEvent(d, 'explore', `Found a place: ${c.data.PB_LOCATIONS.find((l) => l[0] === input.key)?.[1] ?? input.key}.`, { round });
  });
}

/** Takes the place back: gold, shards, items, held experience, advantages and the miss are as before. A hero lost to the Pit is not brought
    back here (the editor's Undo does that): then nothing is undone. */
export function undoLocation(ctx: Ctx, round: number): WarbandState {
  const rec = roundRec(ctx.s, round);
  if (!rec?.location) return ctx.s;
  const key = rec.location.key, source = SOURCE(key);
  const mine = (rec.finds ?? []).filter((f) => f.source === source);
  if (mine.some((f) => f.act === 'lose')) return ctx.s;
  return update(ctx, (d, c) => {
    const rr = postbattleOn(d, c, round);
    d.stash = d.stash ?? { wyrd: 0, gold: null, items: [] };
    const gold = mine.filter((f) => f.kind === 'gold').reduce((n, f) => n + (f.amount ?? 0), 0);
    if (gold) bookGoldOn(d, c, -gold, 'Taken back: a place of the chart', source);
    d.stash.wyrd = Math.max(0, (Number(d.stash.wyrd) || 0) - mine.filter((f) => f.kind === 'wyrd').reduce((n, f) => n + (f.amount ?? 0), 0));
    for (const f of mine.filter((x) => x.kind === 'item')) {
      const items = d.stash.items ?? [];
      const i = items.findIndex((it) => it.name === f.item && it.source === source);
      if (i >= 0) { const it = items[i]!; if (it.qty > (f.qty ?? 1)) it.qty -= f.qty ?? 1; else items.splice(i, 1); }
    }
    const camp = campState(d);
    for (const f of mine.filter((x) => x.kind === 'exp' && x.xpId != null)) {
      const x = (camp.xp ?? []).find((e) => e.id === f.xpId);
      if (!x) continue;
      if (x.applied) { const m = (d.models as Model[]).find((mm) => mm.uid === x.uid); if (m) m.exp = Math.max(0, (Number(m.exp) || 0) - x.amount); }
      camp.xp = (camp.xp ?? []).filter((e) => e.id !== f.xpId);
    }
    for (const f of mine.filter((x) => x.act === 'miss')) {
      const m = (d.models as Model[]).find((mm) => mm.uid === f.uid);
      if (m && (Number(m.miss) || 0) > 0) m.miss = Number(m.miss) - 1;
    }
    camp.perks = ((camp.perks ?? []) as Perk[]).filter((p) => !(p.key === key && p.round === round));
    rr.finds = (rr.finds ?? []).filter((f) => f.source !== source);
    delete rr.location;
  });
}

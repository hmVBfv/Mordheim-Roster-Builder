/* Trading after the first battle (V4–V6, docs/behaviour-changes.md "V4 bis
   V7"). New logic, not a port of the Roster Builder.

   Sources: Mordheim rulebook p. 46, 79 and 104–105; the Ultimate FAQ 10.1
   errata to the post-battle sequence (steps 6, 8 and 9); mordheimer.net
   *Campaigns* and *Trading*. Rob's decisions of 29.09.2026 are cited where
   they apply.

   Items are named as the rosters name them: a common item by its German
   list name (`m.eq`), a rare one by its catalogue key (`m.rare`). A
   henchman group is always equipped alike, so an item of a group is one
   piece per man. The first dagger of a warrior is his free one and stays
   with him. */
import type { CatalogItem, EquipmentEntry, UnitDef } from '../data/types.ts';
import type { Model, RareHolding, StashItem, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { catalogAllowed, rareEligibleItems } from '../rules/equipment.ts';
import { eqListFor, isUpgrade, unitDef, warbandDef } from '../rules/lookup.ts';
import { adjPrice, catalogDefaultPaid } from '../rules/pricing.ts';
import { memberCount } from '../rules/profile.ts';
import { enItem } from '../export/rulesText.ts';
import { dismissMember, removeUnit } from '../warband/roster.ts';
import { unhireDP, unhireHS } from '../warband/hiring.ts';
import { findModel, rememberUids, update, type WarbandDraft } from '../warband/update.ts';
import { bookOn, ensureLedger, keepGold, syncTreasury, tradeLocked } from './ledger.ts';

/** Where an item is: a warrior (model uid) or the warband's stash. */
export type Holder = number | 'stash';

/** An item: its key, and whether it is a rare catalogue item. */
export interface Goods { key: string; rare: boolean }

export interface Verdict { ok: boolean; reason: string }

const FREE_DAGGER = '(1. gratis)';

const catalogItem = (ctx: Ctx, de: string): CatalogItem | undefined => ctx.data.CATALOG.find((it) => it.de === de);

/** The English name of an item, as the screens show it. */
export function goodsName(ctx: Ctx, g: Goods): string {
  return g.rare ? (catalogItem(ctx, g.key)?.en ?? enItem(ctx.data, g.key)) : enItem(ctx.data, g.key);
}

function listEntry(ctx: Ctx, def: UnitDef | undefined, key: string): EquipmentEntry | undefined {
  const list = def ? eqListFor(ctx, def) : undefined;
  if (!list) return undefined;
  for (const cat of Object.keys(list)) {
    const e = (list[cat] ?? []).find(([nm]) => nm === key);
    if (e) return e;
  }
  return undefined;
}

/** Men of a warrior: a henchman group counts each, a Hero is one. */
function menOf(ctx: Ctx, m: Model): number {
  return unitDef(ctx, m.uid_def)?.t === 'hen' ? memberCount(m) : 1;
}

/** What a common item costs now: its price in the warband's lists after
    house rules and districts, else the catalogue price. */
export function commonPrice(ctx: Ctx, key: string): number | null {
  for (const u of warbandDef(ctx)?.units ?? []) {
    const e = listEntry(ctx, u, key);
    if (e) return adjPrice(ctx, key, e[1]);
  }
  const it = catalogItem(ctx, key);
  return it && typeof it.cost === 'number' ? it.cost : null;
}

/** The base price of a rare item: dice prices at their base (Rob,
    29.09.2026: selling one brings half of it). */
export function rareBasePrice(ctx: Ctx, de: string): number {
  return catalogDefaultPaid(ctx, catalogItem(ctx, de));
}

/** Pieces of an item a holder can part with. */
export function piecesHeld(ctx: Ctx, from: Holder, g: Goods): number {
  if (from === 'stash') {
    return (ctx.s.stash?.items ?? []).filter((it) => it.key === g.key && !!it.rare === g.rare).reduce((n, it) => n + (Number(it.qty) || 0), 0);
  }
  const m = findModel(ctx.s, from);
  if (!m) return 0;
  const perMan = g.rare ? Number(m.rare?.[g.key]?.q) || 0 : Math.max(0, (Number(m.eq?.[g.key]) || 0) - (g.key.includes(FREE_DAGGER) ? 1 : 0));
  return perMan * menOf(ctx, m);
}

/** Pieces a warrior needs to take one of an item: one per man. */
export function piecesNeeded(ctx: Ctx, to: Holder): number {
  if (to === 'stash') return 1;
  const m = findModel(ctx.s, to);
  return m ? menOf(ctx, m) : 0;
}

/** May this warrior carry the item? Weapons and armour from his own list;
    rare items by the catalogue rule; equipment only Heroes may have. Hired
    Swords are not models and never get here (they take no equipment). The
    weapon limits stay a warning of the roster, as in the Roster Builder. */
export function canReceive(ctx: Ctx, to: Holder, g: Goods): Verdict {
  if (to === 'stash') return { ok: true, reason: '' };
  const m = findModel(ctx.s, to);
  if (!m) return { ok: false, reason: 'not in the roster' };
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.eq) return { ok: false, reason: 'carries no equipment' };
  const hero = def.t === 'hero' || !!m.promoted;
  if (!g.rare) {
    const e = listEntry(ctx, def, g.key);
    if (!e) return { ok: false, reason: `not in the equipment list of a ${def.name}` };
    // (entries of another variant are not in the list at all: eqListFor)
    if (e[2]?.heroes && !hero) return { ok: false, reason: 'for Heroes only' };
    return { ok: true, reason: '' };
  }
  const it = catalogItem(ctx, g.key);
  if (!it) return { ok: false, reason: 'not in the catalogue' };
  if (isUpgrade(ctx.data, g.key)) return { ok: false, reason: 'a weapon upgrade stays with its weapon' };
  if (!catalogAllowed(ctx, it, m)) return { ok: false, reason: 'kept for other warbands or warriors' };
  if (!rareEligibleItems(ctx, m).some((x) => x.de === g.key)) return { ok: false, reason: `nothing of this kind in the equipment of a ${def.name}` };
  return { ok: true, reason: '' };
}

/* ---- moving pieces in a draft ---- */

function stashItems(d: WarbandDraft): StashItem[] {
  d.stash = d.stash ?? { wyrd: 0, gold: 0, items: [] };
  d.stash.items = d.stash.items ?? [];
  return d.stash.items as StashItem[];
}

function intoStash(d: WarbandDraft, c: Ctx, g: Goods, qty: number, paid: number | undefined): void {
  if (qty <= 0) return;
  const items = stashItems(d);
  const ex = items.find((it) => it.key === g.key && !!it.rare === g.rare && (it.paid ?? null) === (paid ?? null));
  if (ex) { ex.qty += qty; return; }
  const it: StashItem = { name: goodsName(c, g), qty, key: g.key };
  if (g.rare) it.rare = true;
  if (paid != null) it.paid = paid;
  items.push(it);
}

/** Takes pieces out of the stash, oldest first; returns what each cost. */
function outOfStash(d: WarbandDraft, g: Goods, qty: number): number[] {
  const items = stashItems(d);
  const paid: number[] = [];
  for (let i = 0; i < items.length && paid.length < qty;) {
    const it = items[i]!;
    if (it.key !== g.key || !!it.rare !== g.rare) { i++; continue; }
    const take = Math.min(it.qty, qty - paid.length);
    for (let k = 0; k < take; k++) paid.push(Number(it.paid) || 0);
    it.qty -= take;
    if (it.qty <= 0) items.splice(i, 1); else i++;
  }
  return paid;
}

/** Takes every tradeable piece from a warrior; returns pieces and what one
    cost (rare items keep their paid price). */
function outOfWarrior(d: WarbandDraft, c: Ctx, uid: number, g: Goods): { pieces: number; paid: number | undefined } {
  const m = findModel(d, uid);
  if (!m) return { pieces: 0, paid: undefined };
  const men = menOf(c, m as Model);
  if (g.rare) {
    const r = m.rare?.[g.key];
    const q = Number(r?.q) || 0;
    if (!q) return { pieces: 0, paid: undefined };
    const paid = Number(r?.paid) || 0;
    delete m.rare![g.key];
    return { pieces: q * men, paid };
  }
  const have = Number(m.eq?.[g.key]) || 0;
  const keep = g.key.includes(FREE_DAGGER) ? Math.min(1, have) : 0;
  const q = have - keep;
  if (q <= 0) return { pieces: 0, paid: undefined };
  if (keep) m.eq![g.key] = keep; else delete m.eq![g.key];
  return { pieces: q * men, paid: commonPrice(c, g.key) ?? undefined };
}

/** Gives a warrior one more of an item per man. */
function toWarrior(d: WarbandDraft, uid: number, g: Goods, paid: number | undefined): void {
  const m = findModel(d, uid);
  if (!m) return;
  if (g.rare) {
    m.rare = m.rare ?? {};
    const r: RareHolding = m.rare[g.key] ?? { q: 0 };
    r.q = (Number(r.q) || 0) + 1;
    if (paid != null) r.paid = paid;
    m.rare[g.key] = r;
    return;
  }
  m.eq = m.eq ?? {};
  m.eq[g.key] = (Number(m.eq[g.key]) || 0) + 1;
}

/* ---- the Trading Post ---- */

/** Why a trade cannot happen now: before the first battle the warband buys
    from its lists (as in the Roster Builder), afterwards only here. */
function closed(ctx: Ctx): string | null {
  return tradeLocked(ctx) ? null : 'before its first battle the warband buys from its lists';
}

export interface Trade { state: WarbandState; ok: boolean; reason: string }
const refuse = (ctx: Ctx, reason: string): Trade => ({ state: ctx.s, ok: false, reason });

/** Buys a common item for a warrior (one per man) or `qty` pieces for the
    stash, at its price now or the price given. Booked in the ledger. */
export function buyItem(ctx: Ctx, to: Holder, key: string, opts: { qty?: number; price?: number } = {}): Trade {
  const why = closed(ctx);
  if (why) return refuse(ctx, why);
  const g: Goods = { key, rare: false };
  const v = canReceive(ctx, to, g);
  if (!v.ok) return refuse(ctx, v.reason);
  const each = opts.price ?? commonPrice(ctx, key);
  if (each == null) return refuse(ctx, 'no price is known for it');
  const pieces = to === 'stash' ? Math.max(1, Math.round(Number(opts.qty) || 1)) : piecesNeeded(ctx, to);
  const s0 = ensureLedger(ctx);
  const state = update(ctxOf(ctx.data, s0), (d, c) => {
    if (to === 'stash') intoStash(d, c, g, pieces, each); else toWarrior(d, to, g, each);
    bookOn(d, c, 'buy', -each * pieces, { text: `Bought ${goodsName(c, g)}${pieces > 1 ? ` ×${pieces}` : ''}`, uid: to === 'stash' ? undefined : to, item: key, qty: pieces });
  });
  return { state, ok: true, reason: '' };
}

/** What selling brings by default (Rob, 29.09.2026): half the price that
    applies now – for a rare item with a dice price, half its base price –
    for all pieces together, rounded down, but at least 1 gc. */
export function sellPrice(ctx: Ctx, g: Goods, pieces: number, paid?: number): number {
  if (pieces <= 0) return 0;
  const each = g.rare ? rareBasePrice(ctx, g.key) || Number(paid) || 0 : commonPrice(ctx, g.key) ?? (Number(paid) || 0);
  return Math.max(1, Math.floor((each * pieces) / 2));
}

/** Sells an item: everything a warrior has of it (a group sells its pieces
    together), or `qty` pieces from the stash. The price is proposed by
    sellPrice and may be changed (Haggle, Trade). */
export function sellItem(ctx: Ctx, from: Holder, g: Goods, opts: { qty?: number; price?: number } = {}): Trade {
  const why = closed(ctx);
  if (why) return refuse(ctx, why);
  const have = piecesHeld(ctx, from, g);
  if (!have) return refuse(ctx, 'there is nothing of it to sell');
  const s0 = ensureLedger(ctx);
  let sold = 0, price = 0;
  const state = update(ctxOf(ctx.data, s0), (d, c) => {
    let paid: number | undefined;
    if (from === 'stash') {
      const ps = outOfStash(d, g, Math.min(have, Math.max(1, Math.round(Number(opts.qty) || have))));
      sold = ps.length; paid = ps[0];
    } else {
      const out = outOfWarrior(d, c, from, g);
      sold = out.pieces; paid = out.paid;
    }
    price = opts.price != null ? Math.max(0, Math.round(opts.price)) : sellPrice(c, g, sold, paid);
    bookOn(d, c, 'sell', price, { text: `Sold ${goodsName(c, g)}${sold > 1 ? ` ×${sold}` : ''}`, uid: from === 'stash' ? undefined : from, item: g.key, qty: sold });
  });
  return { state, ok: true, reason: '' };
}

/** Reallocates an item (V4, post-battle step 9): from a warrior or the
    stash to another warrior or the stash, without gold; a rare item keeps
    what was paid for it. A group gives up its item for all its men – what
    the receiver does not need goes to the stash – and takes one only when
    there is one for each man. */
export function giveItem(ctx: Ctx, from: Holder, to: Holder, g: Goods): Trade {
  const why = closed(ctx);
  if (why) return refuse(ctx, why);
  if (from === to) return refuse(ctx, 'it is there already');
  const have = piecesHeld(ctx, from, g);
  if (!have) return refuse(ctx, 'there is nothing of it to give');
  const v = canReceive(ctx, to, g);
  if (!v.ok) return refuse(ctx, v.reason);
  const need = piecesNeeded(ctx, to);
  if (to !== 'stash' && from === 'stash' && have < need) return refuse(ctx, `the group needs ${need}, one for each man; the stash has ${have}`);
  if (to !== 'stash' && from !== 'stash' && have < need) return refuse(ctx, `the group needs ${need}, one for each man`);
  const s0 = ensureLedger(ctx);
  const state = update(ctxOf(ctx.data, s0), (d, c) => {
    let pieces: number, paid: number | undefined;
    if (from === 'stash') {
      const ps = outOfStash(d, g, to === 'stash' ? have : need);
      pieces = ps.length; paid = ps[0];
    } else {
      ({ pieces, paid } = outOfWarrior(d, c, from, g));
    }
    let left = pieces;
    if (to !== 'stash') { toWarrior(d, to, g, paid); left -= need; }
    intoStash(d, c, g, left, paid);
    // no gold moves: what the warband owns changed, gold in hand did not
    syncTreasury(d, c);
  });
  return { state, ok: true, reason: '' };
}

/* ---- searching for rare items ---- */

/** One modifier of the roll to find a rare item. */
export interface SearchModifier { label: string; value: number; source: string }

/** The rarity of a catalogue item ("Rare 9" → 9), or null for common items
    and those without a rarity. A pair's own rarity ("Paar Rare 10") is not
    used here. */
export function rarityOf(ctx: Ctx, de: string): number | null {
  const m = /Rare\s+(\d+)/.exec(catalogItem(ctx, de)?.rare ?? '');
  return m ? Number(m[1]) : null;
}

/* Modifiers the rules data states for a warband variant. Each is quoted
   from data/warbands.json; anything else (a Hired Sword, the Merchant's
   reputation, a scenario) is entered by hand as `extra`. */
const VARIANT_MODIFIERS: { wb: string; sub: string; value: number; label: string; source: string; except?: string[] }[] = [
  { wb: 'merc', sub: 'mari', value: 1, label: 'Marienburg', source: 'Marienburg: "+1 when finding rare items"' },
  { wb: 'maraudersofchaos', sub: 'norse', value: 1, label: 'Norse – Reavers', source: 'Norse, Reavers: "+1 when searching for rare items"' },
  { wb: 'maraudersofchaos', sub: 'kurgan', value: -1, label: 'Kurgan – Difficult Customers', source: 'Kurgan, Difficult Customers: "−1 when searching for rare items — except Great Axe and Barbed Whip"', except: ['Great axe', 'Barbed whip'] },
];

/** The modifiers to a Hero's roll for an item. */
export function searchModifiers(ctx: Ctx, uid: number, de: string): SearchModifier[] {
  const out: SearchModifier[] = [];
  const m = findModel(ctx.s, uid);
  if (m && (m.skills ?? []).includes('Streetwise')) out.push({ label: 'Streetwise', value: 2, source: 'Academic skill Streetwise: "+2 to the roll to find rare items"' });
  const en = (catalogItem(ctx, de)?.en ?? '').toLowerCase();
  for (const v of VARIANT_MODIFIERS) {
    if (ctx.s.wb !== v.wb || ctx.s.subtype !== v.sub) continue;
    if (v.except?.some((x) => x.toLowerCase() === en)) continue;
    out.push({ label: v.label, value: v.value, source: v.source });
  }
  return out;
}

/** P(2D6 ≥ target). */
export function chance2d6(target: number): number {
  let hits = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= target) hits++;
  return hits / 36;
}

export interface SearchOdds { rarity: number; modifiers: SearchModifier[]; target: number; chance: number }

/** What a Hero needs on 2D6 to find an item: its rarity less his modifiers
    (and any `extra` entered by hand). Null for an item that needs no search. */
export function searchOdds(ctx: Ctx, uid: number, de: string, extra = 0): SearchOdds | null {
  const rarity = rarityOf(ctx, de);
  if (rarity == null) return null;
  const modifiers = searchModifiers(ctx, uid, de);
  const target = rarity - modifiers.reduce((s, x) => s + x.value, 0) - (Number(extra) || 0);
  return { rarity, modifiers, target, chance: chance2d6(target) };
}

/** Why a warrior may not search now, or null. One roll per Hero and stage. */
export function searchBlock(ctx: Ctx, uid: number): string | null {
  const why = closed(ctx);
  if (why) return why;
  const m = findModel(ctx.s, uid);
  if (!m) return 'not in the roster';
  const def = unitDef(ctx, m.uid_def);
  if (!(def?.t === 'hero' || m.promoted)) return 'only Heroes search for rare items';
  const round = Number(ctx.s.campaign?.round) || 0;
  if ((ctx.s.ledger ?? []).some((e) => e.kind === 'search' && e.uid === uid && (Number(e.round) || 0) === round)) return 'he has searched after this battle already';
  return null;
}

/** Records a Hero's search: found or not. A found item is bought at the
    price paid (dice included) and goes to the stash (post-battle step 6) or
    straight to a warrior who may carry it. */
export function recordSearch(ctx: Ctx, uid: number, de: string, result: { found: false } | { found: true; paid: number; to?: Holder }): Trade {
  const block = searchBlock(ctx, uid);
  if (block) return refuse(ctx, block);
  const g: Goods = { key: de, rare: true };
  if (!catalogItem(ctx, de)) return refuse(ctx, 'not in the catalogue');
  const to = result.found ? result.to ?? 'stash' : 'stash';
  if (result.found && to !== 'stash') {
    const v = canReceive(ctx, to, g);
    if (!v.ok) return refuse(ctx, v.reason);
    if (piecesNeeded(ctx, to) !== 1) return refuse(ctx, 'a found item goes to one warrior; a group takes it from the stash');
  }
  const s0 = ensureLedger(ctx);
  const state = update(ctxOf(ctx.data, s0), (d, c) => {
    const who = findModel(d, uid);
    const name = goodsName(c, g);
    const hero = who?.name || unitDef(c, String(who?.uid_def))?.name || 'A Hero';
    if (!result.found) {
      bookOn(d, c, 'search', 0, { text: `${hero} looked for ${name} – not found`, uid, item: de, found: false });
      return;
    }
    const paid = Math.max(0, Math.round(result.paid));
    if (to === 'stash') intoStash(d, c, g, 1, paid); else toWarrior(d, to, g, paid);
    bookOn(d, c, 'search', -paid, { text: `${hero} found ${name}`, uid, item: de, qty: 1, found: true });
  });
  return { state, ok: true, reason: '' };
}

/* ---- leaving the warband after the first battle ---- */

/** Puts everything a warrior carries into the stash, `men` of his men's
    worth (all of a Hero; one man of a group). The free dagger goes with him. */
function gearToStash(d: WarbandDraft, c: Ctx, m: Model, men: number): void {
  for (const key of Object.keys(m.eq ?? {})) {
    const per = Math.max(0, (Number(m.eq![key]) || 0) - (key.includes(FREE_DAGGER) ? 1 : 0));
    intoStash(d, c, { key, rare: false }, per * men, commonPrice(c, key) ?? undefined);
  }
  for (const de of Object.keys(m.rare ?? {})) {
    const r = m.rare![de];
    intoStash(d, c, { key: de, rare: true }, (Number(r?.q) || 0) * men, Number(r?.paid) || 0);
  }
}

/** Lets a warrior go. Before the first battle that is the Roster Builder's
    removal, every gold piece back. Afterwards nothing is refunded: his
    equipment goes to the stash first (Tuomas, "Dismiss Hero Equipment"),
    and gold in hand stays as it is. */
export function dismissWarrior(ctx: Ctx, uid: number): WarbandState {
  if (!tradeLocked(ctx)) return removeUnit(ctx, uid);
  const m0 = findModel(ctx.s, uid);
  if (!m0) return ctx.s;
  const s0 = ensureLedger(ctx);
  return update(ctxOf(ctx.data, s0), (d, c) => {
    const m = findModel(d, uid)!;
    gearToStash(d, c, m as Model, menOf(c, m as Model));
    rememberUids(d);
    d.models = d.models.filter((x) => x.uid !== uid);
    syncTreasury(d, c);
  });
}

/** Lets one man of a group go: after the first battle his share of the
    group's equipment goes to the stash and nothing is refunded. */
export function dismissMan(ctx: Ctx, uid: number, i: number): WarbandState {
  if (!tradeLocked(ctx)) return dismissMember(ctx, uid, i);
  const m0 = findModel(ctx.s, uid);
  if (!m0 || memberCount(m0) <= 1) return ctx.s;
  const s0 = ensureLedger(ctx);
  const withGear = update(ctxOf(ctx.data, s0), (d, c) => { gearToStash(d, c, findModel(d, uid) as Model, 1); });
  const c1 = ctxOf(ctx.data, withGear);
  return keepGold(c1, dismissMember(c1, uid, i));
}

/** Dismisses a Hired Sword or Dramatis Personae: his upkeep ends; after the
    first battle his hire fee is not refunded. */
export function dismissHire(ctx: Ctx, uid: string, kind: 'hs' | 'dp'): WarbandState {
  const next = kind === 'hs' ? unhireHS(ctx, uid) : unhireDP(ctx, uid);
  if (!tradeLocked(ctx) || next === ctx.s) return next;
  const c0 = ctxOf(ctx.data, ensureLedger(ctx));
  return keepGold(c0, kind === 'hs' ? unhireHS(c0, uid) : unhireDP(c0, uid));
}

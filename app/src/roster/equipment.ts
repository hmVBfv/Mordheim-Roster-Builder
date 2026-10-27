/* What the equipment screens show, worked out by core (phase 3b): a
   warrior's list while the warband is founded, and the Trading Post after
   its first battle (V4–V7). Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { CatalogItem, Model, WarbandState } from '@mordheim/core';
import { priceAverage, priceRange, priceText } from './rarePrice.ts';
import { rosterView, type StatCell } from './view.ts';

const CATS: Record<string, string> = { Nahkampf: 'Close combat', Fernkampf: 'Missile weapons', Rüstung: 'Armour', Besonderes: 'Other', 'Besonderes (nur Heldinnen)': 'Other (Heroines only)' };
export const KINDS = [['all', 'All'], ['cc', 'Close'], ['missile', 'Missile'], ['armour', 'Armour'], ['misc', 'Other']] as const;
export type Kind = (typeof KINDS)[number][0];
const KIND_OF: Record<string, Kind> = { Nahkampf: 'cc', Fernkampf: 'missile', Rüstung: 'armour', Besonderes: 'misc', 'Besonderes (nur Heldinnen)': 'misc', cc: 'cc', missile: 'missile', bp: 'missile', armour: 'armour', misc: 'misc' };

const FREE = '(1. gratis)';

/** The rules text of an item, for the tooltip of every entry (V6). */
export function itemText(data: core.GameData, key: string): string {
  return core.itemInfo(data, key)?.text ?? core.itemInfo(data, core.enItem(data, key))?.text ?? '';
}

/* ---- a warrior's list, while the warband is founded ---- */

export interface ListRow { key: string; name: string; price: number; qty: number; /** The least the stepper goes to: the free dagger stays (#117). */ min: number; free: boolean; text: string; /** Why no more may be taken from the list, or ''. */ more: string }
export interface ListGroup { label: string; rows: ListRow[] }
export interface RareRow { de: string; /** Which copy of a weapon upgrade this row is (0 for the first, and for items that are not upgrades). */ slot: number; /** Used up in one game: the sheet says "Used" for taking it off. */ once: boolean; name: string; q: number; /** Most the stepper goes to: armour is had once. */ max: number; paid: number; upgrade: boolean; on: string | null; targets: { key: string; name: string }[]; text: string }
/** One thing he carries – every one on a line of its own, never "2×" (#115). */
export interface CarriedRow {
  id: string;
  /** The list item or the catalogue key it stands for, and where taking one away goes. */
  key: string; name: string; group: string; from: 'list' | 'rare';
  price: string; free: boolean; text: string;
  /** He keeps it: the free dagger is never given away or sold. */
  keep: boolean;
  /** A weapon takes upgrades, and the upgrades it has. */
  weapon: boolean;
  ups: { de: string; name: string; paid: number; slot: number; once: boolean }[];
  /** What it could be upgraded to now, each with the price on this weapon. */
  options: { de: string; name: string; price: number }[];
  /** How many of the key he has (what the − of this line sets it to, less one). */
  qty: number;
}
export interface RareOffer { de: string; name: string; price: string; rarity: string }

export interface EquipmentView {
  uid: number;
  name: string;
  /** The free dagger's row is priced as in the Roster Builder: the first one costs nothing. */
  groups: ListGroup[];
  rare: RareRow[];
  offer: RareOffer[];
  /** Everything he carries, one line each, the upgrades on their weapons. */
  carried: CarriedRow[];
  /** One price per man: a henchman group pays for every man. */
  men: number;
  /** Hired after the warband's first battle, before his own: common items
      from his list, rare ones only by searching. */
  recruit: boolean;
}

const menOf = (ctx: core.Ctx, m: Model) => (core.unitDef(ctx, m.uid_def)?.t === 'hen' ? core.memberCount(m) : 1);

export function equipmentView(ctx: core.Ctx, uid: number): EquipmentView | null {
  const m = ctx.s.models.find((x) => x.uid === uid);
  if (!m) return null;
  const def = core.unitDef(ctx, m.uid_def);
  const list = core.eqListFor(ctx, def) ?? {};
  const hero = def?.t === 'hero' || !!m.promoted;
  const groups: ListGroup[] = Object.keys(list).map((cat) => ({
    label: CATS[cat] ?? cat,
    rows: (list[cat] ?? [])
      .filter(([, , fl]) => hero || !fl?.heroes)
      .filter(([nm]) => !ctx.data.BRACE_HIDE[nm])
      .map(([nm, pr]) => {
        const qty = Number(m.eq?.[nm]) || 0;
        return { key: nm, name: core.enItem(ctx.data, nm), price: core.adjPrice(ctx, nm, pr), qty, min: nm.includes(FREE) ? 1 : 0, free: nm.includes(FREE), text: itemText(ctx.data, nm), more: core.listProblem(ctx, uid, nm, qty + 1) };
      }),
  })).filter((g) => g.rows.length);
  // one row for an item; a weapon upgrade has one row for every weapon it sits on (reports #109, #110)
  const rare: RareRow[] = Object.entries(m.rare ?? {}).filter(([de]) => !core.isUpgrade(ctx.data, de)).flatMap(([de, r]) => {
    const it = ctx.data.CATALOG.find((x) => x.de === de);
    const upgrade = core.isUpgrade(ctx.data, de);
    const base = { de, name: it?.en ?? core.enItem(ctx.data, de), upgrade, once: core.upgradeOnce(ctx, de), text: itemText(ctx.data, it?.en ?? de) };
    if (!upgrade) return [{ ...base, slot: 0, q: Number(r?.q) || 0, max: core.isArmourItem(ctx, de) ? 1 : 9, paid: Number(r?.paid) || 0, on: (r?.on as string | undefined) ?? null, targets: [] }];
    const free = core.upgradeFree(ctx, m, de);
    return core.upgradeSlots(m, de).map((s, slot) => ({
      ...base, slot, q: 1, max: 1, paid: s.paid, on: s.on,
      // the weapons this copy could move to: those without one, and its own
      targets: core.upgradeTargets(ctx, m, de).filter((w) => w.nm === s.on || free.some((f) => f.nm === w.nm)).map((w) => ({ key: w.nm, name: core.enItem(ctx.data, w.nm) })),
    }));
  });
  const recruit = core.isNewRecruit(ctx, m);
  const held = new Set(Object.keys(m.rare ?? {}));
  // Until his first battle a warrior has no Trading Post: his list, and the rare
  // items the warband gives at the start (gromril at the founding price …).
  // A recruit searches; the free market opens the catalogue (Rob, 22.10.2026, #47).
  const free = !!core.houseRules(ctx.s).freeMarket;
  const atStart = (de: string) => core.isUpgrade(ctx.data, de) && !!(core.upgradeStart(ctx, de) || core.upgradeAlways(ctx, de, m));
  // upgrades are put on a weapon in the table of what he carries; the rest is picked here
  const offer = recruit || !free ? [] : core.rareEligibleItems(ctx, m)
    .filter((it) => !core.isUpgrade(ctx.data, it.de))
    .filter((it) => !(held.has(it.de) && core.isArmourItem(ctx, it.de)))
    .map((it) => ({ de: it.de, name: it.en, price: typeof it.cost === 'number' ? `${core.catalogDefaultPaid(ctx, it)} gc` : String(it.cost), rarity: it.rare || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const carried = carriedRows(ctx, m, { recruit, free, atStart });
  return { uid, name: m.name || def?.name || m.uid_def, groups, rare, offer, carried, men: menOf(ctx, m), recruit };
}

/** Everything a warrior carries, a line for each piece: the list items, then the rare ones that are not upgrades; the upgrades
    sit on their weapon (first on the plain pieces from the top, never on the free dagger), and a weapon without one offers
    those it could take now (#115). */
function carriedRows(ctx: core.Ctx, m: Model, when: { recruit: boolean; free: boolean; atStart: (de: string) => boolean }): CarriedRow[] {
  const def = core.unitDef(ctx, m.uid_def);
  const list = core.eqListFor(ctx, def) ?? {};
  const hero = def?.t === 'hero' || !!m.promoted;
  const upgrades = Object.keys(ctx.data.UPGRADES).filter((de) => core.isUpgrade(ctx.data, de));
  const out: CarriedRow[] = [];
  for (const cat of Object.keys(list)) {
    for (const [nm, pr, fl] of list[cat] ?? []) {
      if (ctx.data.BRACE_HIDE[nm] || (!hero && fl?.heroes)) continue;
      const qty = Number(m.eq?.[nm]) || 0;
      const weapon = cat === 'Nahkampf';
      for (let i = 0; i < qty; i++) {
        const freeOne = nm.includes(FREE) && i === 0;
        // the pieces after the free one, counted from the first: upgrades fill them in turn
        const plain = i - (nm.includes(FREE) ? 1 : 0);
        const ups = weapon && !freeOne ? upgrades.flatMap((de) => {
          const slots = core.upgradeSlots(m, de).map((s, slot) => ({ ...s, slot })).filter((s) => s.on === nm);
          const s = slots[plain];
          return s ? [{ de, name: ctx.data.CATALOG.find((x) => x.de === de)?.en ?? de, paid: s.paid, slot: s.slot, once: core.upgradeOnce(ctx, de) }] : [];
        }) : [];
        const options = weapon && !freeOne && !when.recruit ? upgrades.flatMap((de) => {
          const it = ctx.data.CATALOG.find((x) => x.de === de);
          const u = ctx.data.UPGRADES[de];
          if (!it || !u || ups.some((x) => x.de === de) || !(when.free || when.atStart(de))) return [];
          if ((u.heroesOnly && !hero) || !core.catalogAllowed(ctx, it, m)) return [];
          if (u.wb && u.wb.indexOf(ctx.s.wb ?? '') < 0) return [];
          if (!core.upgradeFree(ctx, m, de).some((w) => w.nm === nm)) return [];
          return [{ de, name: it.en, price: core.upgradePaid(ctx, m, de, nm) }];
        }) : [];
        out.push({
          id: `l:${nm}:${i}`, key: nm, name: core.enItem(ctx.data, nm), group: CATS[cat] ?? cat, from: 'list',
          price: freeOne ? 'free' : `${core.adjPrice(ctx, nm, pr)} gc`, free: freeOne, keep: freeOne, text: itemText(ctx.data, nm), weapon, ups, options, qty,
        });
      }
    }
  }
  for (const [de, r] of Object.entries(m.rare ?? {})) {
    if (core.isUpgrade(ctx.data, de)) continue;
    const it = ctx.data.CATALOG.find((x) => x.de === de);
    for (let i = 0; i < (Number(r?.q) || 0); i++) {
      out.push({ id: `r:${de}:${i}`, key: de, name: it?.en ?? core.enItem(ctx.data, de), group: 'Rare and trading-post items', from: 'rare',
        price: `${Number(r?.paid) || 0} gc`, free: false, keep: false, text: itemText(ctx.data, it?.en ?? de), weapon: false, ups: [], options: [], qty: Number(r?.q) || 0 });
    }
  }
  return out;
}

/* ---- the Trading Post, after the first battle ---- */

/** Who could take an item, and why not. */
export interface Recipient { to: core.Holder; name: string; ok: boolean; note: string; cost: number }

export interface ShopItem { key: string; name: string; kind: Kind; price: number; text: string; /** Not in the price chart: the table decides. */ unlisted: boolean }

/** Common items on sale: every item of the warband's lists that the price
    chart calls common, once, at its price now – and, marked, those it does
    not list at all (core tradeKind). Rare items are found by searching. */
export function shopItems(ctx: core.Ctx): ShopItem[] {
  const seen = new Map<string, ShopItem>();
  for (const u of core.warbandDef(ctx)?.units ?? []) {
    const list = core.eqListFor(ctx, u) ?? {};
    for (const cat of Object.keys(list)) for (const [nm, , fl] of list[cat] ?? []) {
      if (seen.has(nm) || fl?.start || ctx.data.BRACE_HIDE[nm]) continue;
      const tk = core.tradeKind(ctx, nm);
      if (tk.kind === 'rare') continue;
      const price = core.commonPrice(ctx, nm);
      if (price == null) continue;
      seen.set(nm, { key: nm, name: core.enItem(ctx.data, nm), kind: KIND_OF[cat] ?? 'misc', price, text: itemText(ctx.data, nm), unlisted: tk.kind === 'unknown' });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const warriorName = (ctx: core.Ctx, m: Model) => m.name || core.unitDef(ctx, m.uid_def)?.name || m.uid_def;

/** Where a bought item could go: the stash, or a warrior who may carry it
    (a group pays for every man). */
export function buyRecipients(ctx: core.Ctx, key: string, price: number): Recipient[] {
  const g: core.Goods = { key, rare: false };
  return [
    { to: 'stash', name: 'Stash', ok: true, note: 'keep it for later', cost: price },
    ...ctx.s.models.map((m) => {
      const v = core.canReceive(ctx, m.uid, g);
      const men = core.piecesNeeded(ctx, m.uid);
      return { to: m.uid, name: warriorName(ctx, m), ok: v.ok, note: v.ok ? (men > 1 ? `${men} men: ${price * men} gc` : `${price} gc`) : v.reason, cost: price * men };
    }),
  ];
}

/** One item somebody holds: what the Sell and Give lists show. */
export interface Holding { from: core.Holder; owner: string; goods: core.Goods; name: string; pieces: number; paid: number | undefined; sell: number; text: string;
  /** Typed in by hand and not in the catalogue: the player names the price. */ unpriced?: boolean;
  /** The free dagger every warrior starts with (#52): shown so that all his equipment is there, but it stays with him. */ free?: boolean }

export function holdings(ctx: core.Ctx): Holding[] {
  const out: Holding[] = [];
  for (const m of ctx.s.models) {
    for (const key of Object.keys(m.eq ?? {})) {
      const g = { key, rare: false };
      const pieces = core.piecesHeld(ctx, m.uid, g);
      if (pieces) out.push({ from: m.uid, owner: warriorName(ctx, m), goods: g, name: core.goodsName(ctx, g), pieces, paid: core.commonPrice(ctx, key) ?? undefined, sell: core.sellPrice(ctx, g, pieces), text: itemText(ctx.data, key) });
    }
    for (const [de, r] of Object.entries(m.rare ?? {})) {
      const g = { key: de, rare: true };
      const pieces = core.piecesHeld(ctx, m.uid, g);
      if (pieces) out.push({ from: m.uid, owner: warriorName(ctx, m), goods: g, name: core.goodsName(ctx, g), pieces, paid: Number(r?.paid) || 0, sell: core.sellPrice(ctx, g, pieces, Number(r?.paid) || 0), text: itemText(ctx.data, core.goodsName(ctx, g)) });
    }
  }
  const stash = new Map<string, Holding>();
  for (const it of ctx.s.stash?.items ?? []) {
    // items typed in by hand are looked up in the catalogue each time (core stashGoods)
    const g = core.stashGoods(ctx, it);
    if (!g.key) continue;
    const id = `${g.rare ? 'r' : 'c'}:${g.key}`;
    if (stash.has(id)) continue;
    const pieces = core.piecesHeld(ctx, 'stash', g);
    if (!pieces) continue;
    const unpriced = !g.rare && core.commonPrice(ctx, g.key) == null && !(Number(it.paid) > 0);
    stash.set(id, { from: 'stash', owner: 'Stash', goods: g, name: it.name, pieces, paid: it.paid, sell: unpriced ? 0 : core.sellPrice(ctx, g, 1, it.paid), text: itemText(ctx.data, it.name), unpriced });
  }
  return [...out, ...stash.values()];
}


/** What a stash line says it cost: nothing for an item that was found at no price or whose price is unknown (#62). */
export function stashPaid(paid: number | undefined): string {
  return Number(paid) > 0 ? `${paid} gc each` : '';
}

/** The free dagger of every warrior that has one, one per man (#52). It is listed under Give, marked, and never offered for a trade. */
export function freeDaggers(ctx: core.Ctx): Holding[] {
  const out: Holding[] = [];
  for (const m of ctx.s.models) {
    for (const key of Object.keys(m.eq ?? {})) {
      if (!key.includes(FREE) || !(Number(m.eq![key]) >= 1)) continue;
      const g = { key, rare: false };
      out.push({ from: m.uid, owner: warriorName(ctx, m), goods: g, name: `${core.goodsName(ctx, g).replace(/\s*\(.*\)\s*$/, '')} (free)`, pieces: core.piecesNeeded(ctx, m.uid), paid: undefined, sell: 0, text: itemText(ctx.data, key), free: true });
    }
  }
  return out;
}

/** One holder on the Give board (wish #32): a warrior with what he is and can do – so one sees whom an item helps most – and what he
    holds; the stash is the last card. */
export interface GiveCard { holder: core.Holder; name: string; type: string; men: number; stats: StatCell[]; save: string; rules: string[]; items: Holding[] }

export function giveCards(ctx: core.Ctx): GiveCard[] {
  const held = [...holdings(ctx), ...freeDaggers(ctx)];
  const view = rosterView(ctx.data, ctx.s);
  const cards: GiveCard[] = [...view.heroes, ...view.henchmen].map((w) => ({
    holder: w.uid, name: w.name, type: w.type, men: w.count, stats: w.stats, save: w.save,
    rules: [...w.rules, ...w.skills, ...w.spells, ...w.mutations].map((f) => f.label),
    items: held.filter((h) => h.from === w.uid),
  }));
  return [...cards, { holder: 'stash', name: 'Stash', type: '', men: 1, stats: [], save: '', rules: [], items: held.filter((h) => h.from === 'stash') }];
}

/** Where a held item could go, and why not. */
export function giveRecipients(ctx: core.Ctx, h: Holding): Recipient[] {
  const out: Recipient[] = [];
  if (h.from !== 'stash') out.push({ to: 'stash', name: 'Stash', ok: true, note: 'keep it for later', cost: 0 });
  for (const m of ctx.s.models) {
    if (m.uid === h.from) continue;
    const v = core.canReceive(ctx, m.uid, h.goods);
    const need = core.piecesNeeded(ctx, m.uid);
    let ok = v.ok, note = v.ok ? (need > 1 ? `one for each of the ${need} men` : 'may use it') : v.reason;
    if (ok && need > h.pieces) { ok = false; note = `the group needs ${need}, one for each man – only ${h.pieces} here`; }
    out.push({ to: m.uid, name: warriorName(ctx, m), ok, note, cost: 0 });
  }
  return out;
}

/** Where a found item may go: the stash, or a warrior who may carry it. A group is listed too, with the reason it cannot take it:
    a find is one piece and a group needs one for each man (#58). */
export function searchDestinations(ctx: core.Ctx, key: string, rare: boolean): Recipient[] {
  return [
    { to: 'stash', name: 'Stash', ok: true, note: 'after the battle, found items go to the stash', cost: 0 },
    ...ctx.s.models.map((m) => {
      const v = core.canReceive(ctx, m.uid, { key, rare });
      const need = core.piecesNeeded(ctx, m.uid);
      const group = v.ok && need > 1;
      return { to: m.uid, name: warriorName(ctx, m), ok: v.ok && !group, note: group ? `the group needs ${need}, one for each man – a find is one piece` : v.ok ? 'may use it' : v.reason, cost: 0 };
    }),
  ];
}

/** A Hero who may look for a rare item now, or why not. */
export interface Searcher { uid: number; name: string; why: string | null; last: string | null }

/** With `de`: who may look for that item – a Familiar is looked for by a Spellcaster only (#60). */
export function searchers(ctx: core.Ctx, de?: string | null): Searcher[] {
  const round = Number(ctx.s.campaign?.round) || 0;
  return ctx.s.models.filter((m) => core.isHeroModel(ctx, m)).map((m) => {
    const e = (ctx.s.ledger ?? []).filter((x) => x.kind === 'search' && x.uid === m.uid && (Number(x.round) || 0) === round).at(-1);
    return { uid: m.uid, name: warriorName(ctx, m), why: de ? core.searchBlockFor(ctx, m.uid, de) : core.searchBlock(ctx, m.uid), last: e ? e.text : null };
  });
}

export interface RareItem { de: string; name: string; kind: Kind; rarity: number; /** with its unit: "35 gc", "20+1D6 gc" */ price: string; /** what a dice price comes to on average */ avg: number | null; /** lowest and highest a dice price can come to */ range: [number, number] | null; fixed: number | null; text: string; usable: boolean; /** the campaign settings and warbands whose pages list it; none: the core chart */ settings: string[]; /** the grade of the warband it belongs to, where the page says */ grade: string | null }

/** Rare items the warband may find: those the catalogue keeps for it (or for
    nobody in particular), with whether someone here may carry one. With `everything`, those kept for other warbands as well. */
export function rareItems(ctx: core.Ctx, everything = false): RareItem[] {
  const out: RareItem[] = [];
  for (const it of ctx.data.CATALOG as CatalogItem[]) {
    const r = core.rarityOf(ctx, it.de);
    if (r == null) continue;
    const allowedSomewhere = ctx.s.models.some((m) => core.catalogAllowed(ctx, it, m));
    // what the catalogue keeps for other warbands is listed only when everything is asked for (#27), marked as unusable here
    if (it.only && !allowedSomewhere && !everything) continue;
    const usable = ctx.s.models.some((m) => core.canReceive(ctx, m.uid, { key: it.de, rare: true }).ok);
    out.push({ de: it.de, name: it.en, kind: KIND_OF[it.cat] ?? 'misc', rarity: r, price: priceText(it.cost), avg: priceAverage(it.cost), range: priceRange(it.cost), fixed: typeof it.cost === 'number' ? it.cost : null, text: itemText(ctx.data, it.en), usable, settings: it.settings ?? [], grade: it.grade ?? null });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The ledger as the screen lists it, newest last. */
export interface LedgerLine { id: number; amount: number; text: string; when: string }

export function ledgerLines(s: WarbandState): LedgerLine[] {
  return (s.ledger ?? []).map((e) => ({ id: e.id, amount: e.amount, text: e.text, when: core.roundLabel(e.round) }));
}

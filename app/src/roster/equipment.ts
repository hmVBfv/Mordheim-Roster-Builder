/* What the equipment screens show, worked out by core (phase 3b): a
   warrior's list while the warband is founded, and the Trading Post after
   its first battle (V4–V7). Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { CatalogItem, Model, WarbandState } from '@mordheim/core';

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

export interface ListRow { key: string; name: string; price: number; qty: number; free: boolean; text: string; /** Why no more may be taken from the list, or ''. */ more: string }
export interface ListGroup { label: string; rows: ListRow[] }
export interface RareRow { de: string; name: string; q: number; paid: number; upgrade: boolean; on: string | null; targets: { key: string; name: string }[]; text: string }
export interface RareOffer { de: string; name: string; price: string; rarity: string }

export interface EquipmentView {
  uid: number;
  name: string;
  /** The free dagger's row is priced as in the Roster Builder: the first one costs nothing. */
  groups: ListGroup[];
  rare: RareRow[];
  offer: RareOffer[];
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
        return { key: nm, name: core.enItem(ctx.data, nm), price: core.adjPrice(ctx, nm, pr), qty, free: nm.includes(FREE), text: itemText(ctx.data, nm), more: core.listProblem(ctx, uid, nm, qty + 1) };
      }),
  })).filter((g) => g.rows.length);
  const rare: RareRow[] = Object.entries(m.rare ?? {}).map(([de, r]) => {
    const it = ctx.data.CATALOG.find((x) => x.de === de);
    const upgrade = core.isUpgrade(ctx.data, de);
    return {
      de, name: it?.en ?? core.enItem(ctx.data, de), q: Number(r?.q) || 0, paid: Number(r?.paid) || 0, upgrade, on: (r?.on as string | undefined) ?? null,
      targets: upgrade ? core.upgradeTargets(ctx, m, de).map((w) => ({ key: w.nm, name: core.enItem(ctx.data, w.nm) })) : [],
      text: itemText(ctx.data, it?.en ?? de),
    };
  });
  const recruit = core.isNewRecruit(ctx, m);
  const held = new Set(Object.keys(m.rare ?? {}));
  // the catalogue's rare items belong to founding; a recruit searches
  const offer = recruit ? [] : core.rareEligibleItems(ctx, m)
    .filter((it) => !(held.has(it.de) && core.isUpgrade(ctx.data, it.de)))
    .map((it) => ({ de: it.de, name: it.en, price: typeof it.cost === 'number' ? `${core.catalogDefaultPaid(ctx, it)} gc` : String(it.cost), rarity: it.rare || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { uid, name: m.name || def?.name || m.uid_def, groups, rare, offer, men: menOf(ctx, m), recruit };
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
export interface Holding { from: core.Holder; owner: string; goods: core.Goods; name: string; pieces: number; paid: number | undefined; sell: number; text: string }

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
    if (!it.key) continue;
    const g = { key: it.key, rare: !!it.rare };
    const id = `${g.rare ? 'r' : 'c'}:${g.key}`;
    if (stash.has(id)) continue;
    const pieces = core.piecesHeld(ctx, 'stash', g);
    stash.set(id, { from: 'stash', owner: 'Stash', goods: g, name: it.name, pieces, paid: it.paid, sell: core.sellPrice(ctx, g, 1, it.paid), text: itemText(ctx.data, it.name) });
  }
  return [...out, ...stash.values()];
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

/** A Hero who may look for a rare item now, or why not. */
export interface Searcher { uid: number; name: string; why: string | null; last: string | null }

export function searchers(ctx: core.Ctx): Searcher[] {
  const round = Number(ctx.s.campaign?.round) || 0;
  return ctx.s.models.filter((m) => core.isHeroModel(ctx, m)).map((m) => {
    const e = (ctx.s.ledger ?? []).filter((x) => x.kind === 'search' && x.uid === m.uid && (Number(x.round) || 0) === round).at(-1);
    return { uid: m.uid, name: warriorName(ctx, m), why: core.searchBlock(ctx, m.uid), last: e ? e.text : null };
  });
}

export interface RareItem { de: string; name: string; kind: Kind; rarity: number; price: string; fixed: number | null; text: string; usable: boolean }

/** Rare items the warband may find: those the catalogue keeps for it (or for
    nobody in particular), with whether someone here may carry one. */
export function rareItems(ctx: core.Ctx): RareItem[] {
  const out: RareItem[] = [];
  for (const it of ctx.data.CATALOG as CatalogItem[]) {
    const r = core.rarityOf(ctx, it.de);
    if (r == null) continue;
    const allowedSomewhere = ctx.s.models.some((m) => core.catalogAllowed(ctx, it, m));
    if (it.only && !allowedSomewhere) continue;
    const usable = ctx.s.models.some((m) => core.canReceive(ctx, m.uid, { key: it.de, rare: true }).ok);
    out.push({ de: it.de, name: it.en, kind: KIND_OF[it.cat] ?? 'misc', rarity: r, price: typeof it.cost === 'number' ? `${it.cost} gc` : String(it.cost), fixed: typeof it.cost === 'number' ? it.cost : null, text: itemText(ctx.data, it.en), usable });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The ledger as the screen lists it, newest last. */
export interface LedgerLine { id: number; amount: number; text: string; when: string }

export function ledgerLines(s: WarbandState): LedgerLine[] {
  return (s.ledger ?? []).map((e) => ({ id: e.id, amount: e.amount, text: e.text, when: core.roundLabel(e.round) }));
}

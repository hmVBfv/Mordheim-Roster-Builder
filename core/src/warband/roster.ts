/* Building a roster: warband, subtype, units, equipment, rare items,
   mutations, gold and stash (legacy app.js pickSub, addUnit … toggleMut,
   stash*, setGoldCurrent). Every action returns a new state. */
import type { Model, StashItem, WarbandState } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { henchRecruitSurcharge, modelsOf, totalSpent, unitMax, goldCurrent } from '../rules/costs.ts';
import { withFreeDagger, upgradePaid, upgradeTargets } from '../rules/equipment.ts';
import { eqListFor, isUpgrade, unitDef, warbandDef } from '../rules/lookup.ts';
import { catalogDefaultPaid } from '../rules/pricing.ts';
import { logEvent } from './log.ts';
import { fixPersonas } from './normalize.ts';
import { findModel, nextModelUid, rememberUids, update } from './update.ts';

/** Has the warband's leader type (the unit marked `req`) already died? */
export function leaderUnitDied(ctx: Ctx): boolean {
  const req = (warbandDef(ctx)?.units ?? []).find((u) => u.req);
  if (!req) return false;
  return (ctx.s.fallen ?? []).some((e) => {
    const f = e as { uid_def?: string; m?: { uid_def?: string } };
    return (f.uid_def || (f.m && f.m.uid_def)) === req.id;
  });
}

/** Switches the subtype; sets budget and treasury to its starting gold and
    drops equipment the new subtype may not carry (e.g. the Kurgan bow). */
export function pickSubtype(ctx: Ctx, key: string): WarbandState {
  return update(ctx, (d, c) => {
    const wb = warbandDef(c);
    const sub = wb?.subtypes?.find((s) => s.key === key);
    if (!wb || !sub) return;
    d.subtype = key;
    d.budget = sub.gold;
    if (d.stash) d.stash.gold = sub.gold;
    for (const m of d.models) {
      const list = eqListFor(c, unitDef(c, m.uid_def));
      if (!list) continue;
      const valid = new Set<string>();
      for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) valid.add(nm);
      for (const nm of Object.keys(m.eq ?? {})) if (!valid.has(nm)) delete (m.eq as Record<string, unknown>)[nm];
    }
    // personas allowed may depend on the subtype
    fixPersonas(d, c);
  });
}

/** Recruits one unit (a hero, or a henchman group of one) with its free
    dagger. Refused at the unit's maximum, and for the leader type once the
    leader has died (unless the house rule allows hiring a new one). */
export function addUnit(ctx: Ctx, id: string): WarbandState {
  const def = unitDef(ctx, id);
  if (!def) return ctx.s;
  const mx = unitMax(ctx, def);
  if (mx != null && modelsOf(ctx, id) >= mx) return ctx.s;
  if (def.req && leaderUnitDied(ctx) && !houseRules(ctx.s).hireNewLeader) return ctx.s;
  return update(ctx, (d, c) => {
    const m: Model = { uid: nextModelUid(d), uid_def: id, name: def.name, exp: def.exp as number, qty: 1, eq: {}, rare: {}, mut: [], adv: {}, skills: [], inj: [], spells: [] };
    d.models.push(withFreeDagger(c, m));
    logEvent(d, 'recruit', `Recruited ${def.name} (${def.cost || 0} gc).`, { uid: m.uid, name: m.name, uid_def: id, cost: def.cost || 0, grade: def.t === 'hero' ? 'hero' : 'hench' });
  });
}

/** Removes an entry for good (for a death use the fallen path instead). */
export function removeUnit(ctx: Ctx, uid: number): WarbandState {
  return update(ctx, (d) => { rememberUids(d); d.models = d.models.filter((m) => m.uid !== uid); });
}

export function setModelName(ctx: Ctx, uid: number, name: string): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) m.name = name; });
}

export function setModelExp(ctx: Ctx, uid: number, v: unknown): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) m.exp = Math.max(0, Number(v) || 0); });
}

/** Sets a henchman group's size (1–5, within the unit maximum). Men joining a
    blooded group cost the experience surcharge, paid once and recorded in
    xpPaid; shrinking the group refunds it for the men removed, never more
    than was paid. Names of removed men go with them. */
export function setQty(ctx: Ctx, uid: number, v: unknown): WarbandState {
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    if (!m) return;
    const def = unitDef(c, m.uid_def);
    if (!def) return;
    let q = Math.min(5, Math.max(1, Number(v) || 1));
    const umx = unitMax(c, def);
    if (umx !== null) {
      const others = d.models.filter((x) => x.uid_def === m.uid_def && x.uid !== m.uid).reduce((s, x) => s + (x.qty || 1), 0);
      q = Math.max(1, Math.min(q, (umx as number) - others));
    }
    if (Array.isArray(m.names) && m.names.length > q) {
      m.names = m.names.slice(0, q);
      if (!m.names.some((x) => (x || '').trim())) delete m.names;
    }
    const was = Math.max(1, Number(m.qty) || 1);
    if (q > was) m.xpPaid = (Number(m.xpPaid) || 0) + (q - was) * henchRecruitSurcharge(c, m);
    else if (q < was) m.xpPaid = Math.max(0, (Number(m.xpPaid) || 0) - (was - q) * henchRecruitSurcharge(c, m));
    m.qty = q;
  });
}

export function toggleEq(ctx: Ctx, uid: number, nm: string, on: boolean): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.eq = m.eq ?? {};
    if (on) m.eq[nm] = 1; else delete m.eq[nm];
  });
}

/** Sets an equipment quantity (0–9). Setting a dagger to 0 records that the
    player removed the free one. */
export function setEqQty(ctx: Ctx, uid: number, nm: string, qty: unknown): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    if (/^Dolch/i.test(nm)) m._noDagger = (Number(qty) || 0) <= 0;
    const q = Math.max(0, Math.min(9, Number(qty) || 0));
    m.eq = m.eq ?? {};
    if (q <= 0) delete m.eq[nm]; else m.eq[nm] = q;
  });
}

/** Adds a rare / trading-post item; a second one of the same kind raises the
    quantity (upgrades exist once and sit on a weapon). */
export function addRare(ctx: Ctx, uid: number, de: string): WarbandState {
  if (!de) return ctx.s;
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.rare = m.rare || {};
    const have = m.rare[de];
    if (have && !isUpgrade(c.data, de)) { have.q = (Number(have.q) || 1) + 1; return; }
    if (have) return;
    const it = c.data.CATALOG.find((x) => x.de === de);
    const o: { q: number; paid: number; on?: string | null } = { q: 1, paid: catalogDefaultPaid(c, it) };
    if (isUpgrade(c.data, de)) {
      const t = upgradeTargets(c, m, de);
      o.on = t.length ? (t[0]?.nm ?? null) : null;
      o.paid = upgradePaid(c, m, de, o.on as string);
    }
    m.rare[de] = o as { q: number; paid: number; on?: string };
    const who = m.name || unitDef(c, m.uid_def)?.name;
    logEvent(d, 'item', `${who} acquired ${it ? it.en : de}${o.paid ? ` (${o.paid} gc)` : ''}.`, { uid: m.uid, name: who, item: de, itemEn: it ? it.en : de, paid: o.paid || 0 });
  });
}

export function setRareTarget(ctx: Ctx, uid: number, de: string, nm: string): WarbandState {
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    const r = m?.rare?.[de];
    if (!m || !r) return;
    r.on = nm;
    if (c.data.UPGRADES[de]?.mult) r.paid = upgradePaid(c, m, de, nm);
  });
}

export function setRareQty(ctx: Ctx, uid: number, de: string, qty: unknown): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m || !m.rare || !m.rare[de]) return;
    const q = Math.max(0, Math.min(9, Number(qty) || 0));
    if (q <= 0) delete m.rare[de]; else (m.rare[de] as { q: number }).q = q;
  });
}

export function setRarePaid(ctx: Ctx, uid: number, de: string, v: unknown): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m || !m.rare || !m.rare[de]) return;
    (m.rare[de] as { paid: number }).paid = Math.max(0, Number(v) || 0);
  });
}

export function removeRare(ctx: Ctx, uid: number, de: string): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m?.rare) delete m.rare[de]; });
}

/** Flat weapon upgrades (Dark Elf Blade, Dark Venom) shown next to the weapon. */
export function toggleWeaponUpgrade(ctx: Ctx, uid: number, de: string, nm: string, on: boolean): WarbandState {
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.rare = m.rare || {};
    if (on) m.rare[de] = { q: 1, on: nm, paid: c.data.UPGRADES[de]?.base || 0 };
    else delete m.rare[de];
  });
}

export function toggleMutation(ctx: Ctx, uid: number, nm: string, on: boolean): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    const mut = m.mut ?? [];
    if (on) { if (!mut.includes(nm)) mut.push(nm); m.mut = mut; }
    else m.mut = mut.filter((x) => x !== nm);
  });
}

/** Kislev: which of the Captain's items is the half-price heirloom. */
export function setHeirloom(ctx: Ctx, uid: number, nm: string | null): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) m.heirloom = nm || null; });
}

/** Sets gold in hand: stored as treasury = gold + everything owned. */
export function setGoldCurrent(ctx: Ctx, v: unknown): WarbandState {
  return update(ctx, (d, c) => {
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = Math.max(0, Number(v) || 0) + totalSpent(c);
  });
}

export function adjustGoldCurrent(ctx: Ctx, delta: number): WarbandState {
  return setGoldCurrent(ctx, goldCurrent(ctx) + delta);
}

type StashField = 'wyrd' | 'gold';
const emptyStash = () => ({ wyrd: 0, gold: 0, items: [] as StashItem[] });

export function stashAdjust(ctx: Ctx, field: StashField, delta: number): WarbandState {
  return update(ctx, (d) => { d.stash = d.stash || emptyStash(); d.stash[field] = Math.max(0, (Number(d.stash[field]) || 0) + delta); });
}

export function stashSet(ctx: Ctx, field: StashField, v: unknown): WarbandState {
  return update(ctx, (d) => { d.stash = d.stash || emptyStash(); d.stash[field] = Math.max(0, Math.round(Number(v) || 0)); });
}

/** Puts items into the stash; an item already there gains the quantity. */
export function stashAddItem(ctx: Ctx, name: string, qty: unknown): WarbandState {
  const nm = (name || '').trim();
  if (!nm || nm === '—') return ctx.s;
  return update(ctx, (d) => {
    d.stash = d.stash || emptyStash();
    const q = Math.max(1, Number(qty) || 1);
    d.stash.items = d.stash.items ?? [];
    const ex = d.stash.items.find((it) => it.name === nm);
    if (ex) ex.qty += q; else d.stash.items.push({ name: nm, qty: q });
  });
}

export function stashRemoveItem(ctx: Ctx, index: number): WarbandState {
  return update(ctx, (d) => { if (d.stash && d.stash.items) d.stash.items.splice(index, 1); });
}

export function stashItemQty(ctx: Ctx, index: number, v: unknown): WarbandState {
  return update(ctx, (d) => { const it = d.stash?.items?.[index]; if (it) it.qty = Math.max(1, Number(v) || 1); });
}

export function setWarbandName(ctx: Ctx, name: string): WarbandState {
  return update(ctx, (d) => { d.name = name; });
}

export function setDistrict(ctx: Ctx, id: string, hold: 'none' | 'foothold' | 'control'): WarbandState {
  return update(ctx, (d) => {
    if (!d.campaign) d.campaign = { districts: {} };
    if (!d.campaign.districts) d.campaign.districts = {};
    d.campaign.districts[id] = hold;
  });
}

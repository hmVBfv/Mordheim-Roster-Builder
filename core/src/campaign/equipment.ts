/* The equipment a profile can be armed from: every weapon, armour and piece of
   equipment the rules data lists, once each, with the tooltip the rules give
   it – the stats of a weapon and what it does. A leader picks an item and the
   NPC carries its name; the tooltip goes with it and can be kept from the
   players on its own, so that they see the scythe and not what it does
   (ADR 0022). Pure; the caller searches and stores. */
import type { CatalogCategory, GameData } from '../data/types.ts';
import { itemInfo } from '../rules/lookup.ts';

export const GEAR_CATEGORY_NAMES: Record<CatalogCategory, string> = { cc: 'Close combat', missile: 'Missile', bp: 'Blackpowder', armour: 'Armour', misc: 'Equipment' };

export interface CatalogGear {
  /** The English name, which is what a profile's equipment is written in. */
  name: string;
  de: string;
  category: CatalogCategory;
  categoryName: string;
  /** The tooltip: the line of the item (its kind, range, strength, save) and its rules; empty where the data has none. */
  tip: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plain = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim();

/** What an item does, for a tooltip: its line without the price, the rarity and who may buy it, then its rules. */
function tipOf(data: GameData, name: string): string {
  const info = itemInfo(data, name);
  if (!info) return '';
  const line = String(info.line ?? '').split('·').map((x) => x.trim()).filter((x) => x && !/\bgc\b|^Rare\b|\bonly$/i.test(x)).join(' · ');
  return [line, plain(String(info.text ?? ''))].filter(Boolean).join(' — ');
}

/** Everything the game lists to carry, once by name: close-combat and missile weapons, blackpowder, armour, the rest. */
export function equipmentCatalog(data: GameData): CatalogGear[] {
  const seen = new Set<string>();
  const out: CatalogGear[] = [];
  for (const c of data.CATALOG) {
    const name = c.en.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, de: c.de, category: c.cat, categoryName: GEAR_CATEGORY_NAMES[c.cat], tip: tipOf(data, name) });
  }
  return out;
}

/** The items with every word of the query in their name (either language) or their kind; the names that start with it first. `category` narrows to one kind. */
export function searchEquipment(list: readonly CatalogGear[], query: string, category?: CatalogCategory): CatalogGear[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const q = fold(query.trim());
  return list.filter((g) => (!category || g.category === category) && words.every((w) => fold(`${g.name} ${g.de} ${g.categoryName}`).includes(w)))
    .map((g, i) => ({ g, i, r: !q ? 2 : fold(g.name).startsWith(q) ? 0 : fold(g.name).includes(q) ? 1 : 2 }))
    .sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.g);
}

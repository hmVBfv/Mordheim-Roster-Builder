/* Where an item was released (wishes #164, #165): the core rules' price chart, the price chart of a campaign setting, or the list of
   a warband. A campaign that plays in some areas keeps the items of those – and, always, what the core chart lists and what a warband
   brings with it. Pure: it only reads the catalogue entry and the data. */
import type { CatalogItem, GameData } from '../data/types.ts';

/** The sources of an item: the settings that list it, `warband` for a warband's own, and `core` for what the core chart has
    (an item no setting names is the core chart's). */
export function itemSources(item: Pick<CatalogItem, 'settings'>): string[] {
  const named = item.settings ?? [];
  if (!named.length) return ['core'];
  const out = new Set<string>();
  for (const s of named) out.add(s.startsWith('warband:') ? 'warband' : s);
  return [...out];
}

/** Is the item for a campaign that plays in these settings? What the core chart lists and a warband's own items always are. */
export function itemInSettings(item: Pick<CatalogItem, 'settings'>, played: readonly string[]): boolean {
  return itemSources(item).some((k) => k === 'core' || k === 'warband' || played.includes(k));
}

/** The catalogue as a campaign that plays in these settings has it. */
export function catalogIn(data: Pick<GameData, 'CATALOG'>, played: readonly string[]): CatalogItem[] {
  return data.CATALOG.filter((i) => itemInSettings(i, played));
}

const titled = (slug: string) => slug.split('-').map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');

/** What a source is called: a setting by its name, `warband` for a warband's own item, anything else by its slug made readable. */
export function settingName(data: Pick<GameData, 'SETTINGS'>, key: string): string {
  if (key === 'warband') return 'A warband\'s own item';
  return data.SETTINGS.find((s) => s.id === key)?.name ?? titled(key);
}

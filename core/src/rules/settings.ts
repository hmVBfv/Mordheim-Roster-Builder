/* Where an item was released (wishes #164, #165): the core rules' price chart, the price chart of a campaign setting, or the list of
   a warband. A campaign that plays in some areas keeps the items of those – and, always, what the core chart lists and what a warband
   brings with it. Pure: it only reads the catalogue entry and the data. */
import type { CatalogItem, GameData } from '../data/types.ts';
import type { WarbandState } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { update } from '../warband/update.ts';

/** The sources of an item: the settings whose price chart lists it, `warband` for a warband's own, and `core` for the rulebook's items
    (`vanilla`). An item that none of these names comes from a list the data does not trace to a setting: no source. */
export function itemSources(item: Pick<CatalogItem, 'settings' | 'vanilla'>): string[] {
  const out = new Set<string>();
  if (item.vanilla) out.add('core');
  for (const s of item.settings ?? []) out.add(s.startsWith('warband:') ? 'warband' : s);
  return [...out];
}

/** Is the item for a campaign that plays in these settings? The rulebook's items and a warband's own always are, and so is one that
    no setting claims; the rest only where one of its settings is played. */
export function itemInSettings(item: Pick<CatalogItem, 'settings' | 'vanilla'>, played: readonly string[]): boolean {
  const sources = itemSources(item);
  return !sources.length || sources.some((k) => k === 'core' || k === 'warband' || played.includes(k));
}

/** The catalogue as a campaign that plays in these settings has it. */
export function catalogIn(data: Pick<GameData, 'CATALOG'>, played: readonly string[]): CatalogItem[] {
  return data.CATALOG.filter((i) => itemInSettings(i, played));
}

const titled = (slug: string) => slug.split('-').map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');

/** What a source is called: a setting by its name, `warband` for a warband's own item, anything else by its slug made readable. */
export function settingName(data: Pick<GameData, 'SETTINGS'>, key: string): string {
  if (key === 'warband') return 'A warband\'s own item';
  if (key === 'other') return 'Not from the rulebook';
  return data.SETTINGS.find((s) => s.id === key)?.name ?? titled(key);
}

/** Is the item in the original rulebook (the vanilla option keeps only these)? */
export const itemIsVanilla = (item: Pick<CatalogItem, 'vanilla'>): boolean => item.vanilla === true;

/** The catalogue of a campaign that plays vanilla: the rulebook's items only. */
export const catalogVanilla = (data: Pick<GameData, 'CATALOG'>): CatalogItem[] => data.CATALOG.filter(itemIsVanilla);

/** The catalogue as a campaign has it: vanilla (off unless switched on) keeps only the rulebook's items, otherwise every item. */
export function catalogForCampaign(data: Pick<GameData, 'CATALOG'>, options: { vanilla?: boolean }): CatalogItem[] {
  return options.vanilla ? catalogVanilla(data) : [...data.CATALOG];
}

/** Is this skill list the rulebook's? Every skill of the five lists is. */
export const isVanillaSkillList = (data: Pick<GameData, 'VANILLA'>, list: string): boolean => data.VANILLA.skillLists.includes(list);

/** Is this a warband of the rulebook (grade core)? Only these enter, and are made for, a campaign that plays Vanilla Mordheim (wish #167). */
export const isVanillaWarband = (data: Pick<GameData, 'WARBANDS'>, wb: unknown): boolean => typeof wb === 'string' && data.WARBANDS[wb]?.grade === 'core';

/** Does this warband play Vanilla Mordheim: only the rulebook's items and skills (wish #167, step 1)? */
export const isVanillaOnly = (s: Pick<WarbandState, 'vanilla'>): boolean => s.vanilla === true;

/** The warband as one that plays Vanilla Mordheim. Meant for a new one; only a warband of the rulebook (grade core) can, any other is left as it is. */
export function asVanillaWarband(ctx: Ctx): WarbandState {
  return isVanillaWarband(ctx.data, ctx.s.wb) ? update(ctx, (d) => { d.vanilla = true; }) : ctx.s;
}

/** Turns the option on or off; a warband that cannot play Vanilla stays as it is. Off, the key goes (an ordinary warband has none). */
export function setVanillaWarband(ctx: Ctx, on: boolean): WarbandState {
  if (on) return asVanillaWarband(ctx);
  return isVanillaOnly(ctx.s) ? update(ctx, (d) => { delete d.vanilla; }) : ctx.s;
}

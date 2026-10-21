/* The lore catalogue (data/lore.json): regions, factions and groups of the setting, each summarised from
   mordheimer.net with its source. Fetched on first use, so it is not part of the app shell. */
export type LoreKind = 'region' | 'faction' | 'group';
export interface LoreEntry { id: string; kind: LoreKind; name: string; de: string; status: string; text: string; source: string[] }
export interface Lore { sources: Record<string, { title: string; url: string }>; entries: LoreEntry[] }

export const LORE_KINDS: { kind: LoreKind; label: string }[] = [
  { kind: 'region', label: 'Regions' },
  { kind: 'faction', label: 'Factions' },
  { kind: 'group', label: 'Groups' },
];

const file = import.meta.glob<{ SOURCES: Lore['sources']; LORE: LoreEntry[] }>('../../../data/lore.json', { import: 'default' });

let loading: Promise<Lore> | null = null;
export function loadLore(): Promise<Lore> {
  loading ??= file['../../../data/lore.json']!().then((d) => ({ sources: d.SOURCES, entries: d.LORE }));
  return loading;
}

/** What goes into the Library's text field: the summary and, last, where it was read. */
export function loreText(e: LoreEntry, lore: Lore): string {
  return `${e.text}\n\nSource: ${e.source.map((s) => `${lore.sources[s]!.title} – ${lore.sources[s]!.url}`).join('; ')}`;
}

/* The description of each unit on its page on mordheimer.net (data/unitlore.json), word for word: the default of a warrior's story.
   Fetched on first use, so it is not part of the app shell. */
const file = import.meta.glob<{ LORE: Record<string, Record<string, string>> }>('../../../data/unitlore.json', { import: 'default' });

let loading: Promise<Record<string, Record<string, string>>> | null = null;
export function loadUnitLore(): Promise<Record<string, Record<string, string>>> {
  loading ??= file['../../../data/unitlore.json']!().then((d) => d.LORE);
  return loading;
}

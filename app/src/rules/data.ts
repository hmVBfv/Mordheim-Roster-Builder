/* The rulebook chapters (data/rulesref.json): the text word for word, read from mordheimer.net. Fetched on first use, so it
   is not part of the app shell. */
export type Block =
  | { t: 'h'; l: 2 | 3 | 4; id: string; text: string }
  | { t: 'p'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] };
export interface Chapter { id: string; title: string; url: string; blocks: Block[] }

const file = import.meta.glob<{ CHAPTERS: Chapter[] }>('../../../data/rulesref.json', { import: 'default' });

let loading: Promise<Chapter[]> | null = null;
export function loadRules(): Promise<Chapter[]> {
  loading ??= file['../../../data/rulesref.json']!().then((d) => d.CHAPTERS);
  return loading;
}

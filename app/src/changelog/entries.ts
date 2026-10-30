/* The entries this build carries: every file of `changelog/`, read when the app is built. */
import { newestFirst, parseEntry, type Entry } from './parse.ts';

const files = import.meta.glob('../../../changelog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const ENTRIES: Entry[] = newestFirst(Object.entries(files).map(([path, text]) => parseEntry(path.replace(/^.*\/|\.md$/g, ''), text)));

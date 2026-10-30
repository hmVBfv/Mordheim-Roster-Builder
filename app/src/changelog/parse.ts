/* The changelog (wish #154): one small file for each change in `changelog/`, collected at build time.
   A file is `date: YYYY-MM-DD` and then one line a change, "- New: …", "- Changed: …" or "- Fixed: …" – plain words for the
   players, no numbers of reports. Pure, so the build (vite.config.ts) and the app read it the same way. */

export type ChangeKind = 'New' | 'Changed' | 'Fixed';
export interface Change { kind: ChangeKind; text: string }
export interface Entry { id: string; date: string; changes: Change[] }

const KINDS: ChangeKind[] = ['New', 'Changed', 'Fixed'];

/** One file as an entry; `id` is the file's name without its ending. Throws, saying what is wrong, on a file that breaks the form. */
export function parseEntry(id: string, text: string): Entry {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  const head = /^date: (\d{4}-\d{2}-\d{2})$/.exec(lines[0] ?? '');
  if (!head) throw new Error(`${id}: the first line must be "date: YYYY-MM-DD"`);
  const changes = lines.slice(1).map((l): Change => {
    const m = /^- (New|Changed|Fixed): (.+)$/.exec(l);
    if (!m) throw new Error(`${id}: "${l}" must be "- New: …", "- Changed: …" or "- Fixed: …"`);
    return { kind: m[1] as ChangeKind, text: m[2]! };
  });
  if (!changes.length) throw new Error(`${id}: no change listed`);
  return { id, date: head[1]!, changes };
}

/** Newest first: by date, then by file name. */
export const newestFirst = (entries: Entry[]): Entry[] => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** What a version holds that `have` does not: the notice offers it before a reload. */
export const notIn = (all: Entry[], have: Entry[]): Entry[] => newestFirst(all.filter((e) => !have.some((h) => h.id === e.id)));

export const KIND_ORDER = KINDS;

/** The entries as the build writes them to `changelog.json`; anything that does not look like one is dropped. */
export function readJson(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is Entry => !!e && typeof e === 'object' && typeof (e as Entry).id === 'string' && typeof (e as Entry).date === 'string'
    && Array.isArray((e as Entry).changes) && (e as Entry).changes.every((c) => KINDS.includes(c?.kind) && typeof c.text === 'string'));
}

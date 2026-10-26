/* Folders in the Library (wish #99, Rob, 26.10.2026): an entry of any tab – idea, faction, NPC, group, scenario, place – can
   stand in a folder of one's own to sort the ideas roughly. A folder is only a name; it exists as long as an entry carries it, and
   the same name in two tabs is one folder. A tab shows its entries under the folders, those without one last. */
import type { ReactNode } from 'react';
import ui from '../ui/ui.module.css';
import type { LibraryItem } from './api.ts';
import styles from './Library.module.css';

export const MAX_FOLDER = 60;
const NONE = 'No folder';

export const folderOf = (i: LibraryItem): string => ((i.body as { folder?: string } | null)?.folder ?? '').trim();

/** Every folder in use among the entries, by name. */
export const foldersIn = (items: LibraryItem[] | null): string[] => [...new Set((items ?? []).map(folderOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** In a form: the folder of the entry, with the folders already in use to choose from (or a new name to write). */
export function FolderField({ items, value, onChange }: { items: LibraryItem[] | null; value: string; onChange: (v: string) => void }) {
  return (
    <div className={ui.field}>
      <label className={ui.field}>
        <span>Folder</span>
        <input className={ui.input} list="library-folders" value={value} maxLength={MAX_FOLDER} autoComplete="off" placeholder="none – or a name to sort it by" onChange={(e) => onChange(e.target.value)} />
      </label>
      <datalist id="library-folders">{foldersIn(items).map((f) => <option key={f} value={f} />)}</datalist>
      <small className={ui.muted}>The same name in another tab is the same folder. Leave it empty for none.</small>
    </div>
  );
}

/** The entries of a tab as one list, or – once one of them stands in a folder – under the folders, those without one last. */
export function FolderLists<T extends LibraryItem>({ label, entries, render }: { label: string; entries: T[]; render: (e: T) => ReactNode }) {
  if (!entries.some((e) => folderOf(e))) return <ul className={styles.list} aria-label={label}>{entries.map(render)}</ul>;
  const names = [...new Set(entries.map(folderOf))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  return (
    <>
      {names.map((f) => (
        <section key={f || '—'} className={styles.folder} aria-label={`${label}: ${f || NONE}`}>
          <h3 className={styles.folderTitle}>{f || NONE}</h3>
          <ul className={styles.list} aria-label={`${label} in ${f || NONE}`}>{entries.filter((e) => folderOf(e) === f).map(render)}</ul>
        </section>
      ))}
    </>
  );
}

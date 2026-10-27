/* The Locations tab of the Library (wish #73, Rob, 25.10.2026): places of one's own world – regions, towns, ruins – written
   outside any campaign and kept with the account, private like the rest. A place has a free tag ("Region", "Town" …) to
   sort and find it by, and links to factions, NPCs, groups, scenarios and other places (links.tsx). A campaign does not
   take places yet; they are the Library's own. */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { MAX_IDEA, MAX_NAME, putLocation, removeItem, staleItem, type LibraryItem, type LibraryLocation, type LocationBody } from './api.ts';
import styles from './Library.module.css';
import { FolderField, FolderLists } from './folders.tsx';
import { LinkChips, LinksField, keepLinks } from './links.tsx';
import { locationsOf, useLibrary } from './useLibrary.ts';

/** The limit the server holds to for the tag (server/src/library.ts). */
const MAX_TYPE = 40;

function LocationForm({ place, items, online, close, onSaved, onRemoved }: {
  place: LibraryLocation | null; items: LibraryItem[] | null; online: boolean; close: (then?: () => void) => void; onSaved: (p: LibraryLocation) => void; onRemoved: (p: LibraryLocation) => void;
}) {
  const [name, setName] = useState(place?.name ?? '');
  const [de, setDe] = useState(place?.body.de ?? '');
  const [type, setType] = useState(place?.body.type ?? '');
  const [lore, setLore] = useState(place?.body.lore ?? '');
  const [folder, setFolder] = useState(place?.body.folder ?? '');
  const [links, setLinks] = useState<string[]>(place?.body.links ?? []);
  const [base, setBase] = useState<number | undefined>(place?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => place?.id ?? newId());

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await putLocation(id, name.trim(), { de: de.trim(), type: type.trim(), lore, links: keepLinks(items, links), folder: folder.trim() }, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem<LocationBody>(e);
      if (cur) {
        setBase(cur.seq);
        setError(`This place was changed on another device while you were writing. Theirs: “${cur.name}${cur.body.type ? ` – ${cur.body.type}` : ''}” – save again to replace it with yours.`);
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeItem(id);
      close(() => onRemoved(place!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="location-form-title">{place ? 'Edit place' : 'A new place'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <label className={ui.field}>
        <span>Name (English)</span>
        <input className={ui.input} value={name} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Name (German)</span>
        <input className={ui.input} value={de} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setDe(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Kind of place</span>
        <input className={ui.input} value={type} maxLength={MAX_TYPE} autoComplete="off" placeholder="Region · Town · Ruin …" onChange={(e) => setType(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>The lore</span>
        <textarea className={ui.textarea} rows={8} value={lore} maxLength={MAX_IDEA} onChange={(e) => setLore(e.target.value)} />
      </label>
      <FolderField items={items} value={folder} onChange={setFolder} />
      <LinksField items={items} selfId={id} links={links} onChange={setLinks} />
      <p className={ui.muted}>Only you see the Library. Places stay here for now: a campaign’s own place is chosen when it starts.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device.</p>
          <div className={ui.actions}>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
          </div>
        </div>
      ) : (
        <div className={ui.actions}>
          {place && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this place</button>}
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          <button type="submit" className={ui.button} disabled={busy || !online || !name.trim()}>Save</button>
        </div>
      )}
    </form>
  );
}

export function LocationsTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('location-form');
  const [editing, setEditing] = useState<{ place: LibraryLocation | null; key: number } | null>(null);
  const places = locationsOf(items);
  const edit = (place: LibraryLocation | null) => { setEditing((e) => ({ place, key: (e?.key ?? 0) + 1 })); open(); };
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="locations-title">
      <h2 id="locations-title" className={styles.title}>Locations</h2>
      <p className={ui.muted}>Regions, towns, ruins and other places of your own world, linked to the factions, NPCs, groups and scenarios that belong there. Only you see this.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the places…</p>}
      {items && places.length === 0 && <p className={ui.muted}>No places yet. Write the first one down.</p>}
      {places.length > 0 && (
        <FolderLists label="Places" entries={places} render={(p) => (
            <li key={p.id} className={styles.idea}>
              <div className={styles.head}>
                <strong>{p.name}</strong>
                {p.body.type && <span className={styles.chip}>{p.body.type}</span>}
              </div>
              {p.body.de && p.body.de !== p.name && <p className={styles.excerpt}>{p.body.de}</p>}
              {p.body.lore && <p className={styles.excerpt}>{p.body.lore.length > 200 ? `${p.body.lore.slice(0, 200)}…` : p.body.lore}</p>}
              <LinkChips items={items} id={p.id} />
              <small className={styles.meta}>Changed <time dateTime={p.updatedAt}>{stamp(p.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${p.name}`} onClick={() => edit(p)}>Edit</button></div>
            </li>
          )} />
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New place</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="location-form-title">
        {editing && (
          <LocationForm key={editing.key} place={editing.place} items={items} online={reachable} close={close}
            onSaved={(p) => { setItems((cur) => [p, ...(cur ?? []).filter((x) => x.id !== p.id)]); notify('Place saved. Only you see it.'); }}
            onRemoved={(p) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== p.id)); notify('Place removed.'); }} />
        )}
      </dialog>
    </section>
  );
}

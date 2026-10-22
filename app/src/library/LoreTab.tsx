/* The Lore tab of the Library (ADR 0023): the setting's regions, factions and groups as a read-only catalogue
   (data/lore.json). "Add" copies an entry into the person's own Library – a faction or group as a faction, a region
   as an idea about a campaign – where it can be changed freely. */
import { useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { putFaction, putIdea } from './api.ts';
import styles from './Library.module.css';
import { ancestors, inPlace, loadLore, LORE_KINDS, loreText, placeOptions, type Lore, type LoreEntry, type LoreKind } from './lore.ts';
import { useLibrary } from './useLibrary.ts';

export function LoreTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const [lore, setLore] = useState<Lore | null>(null);
  const [kind, setKind] = useState<LoreKind | null>(null);
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { void loadLore().then(setLore); }, []);

  const have = new Set((items ?? []).filter((i) => i.kind === 'faction' || i.kind === 'idea').map((i) => i.name));
  const add = async (e: LoreEntry) => {
    if (!lore) return;
    setBusy(e.id);
    setProblem(null);
    try {
      const text = loreText(e, lore);
      const saved = e.kind === 'region'
        ? await putIdea(newId(), e.name, { text: `${e.status}\n\n${text}`, topic: 'campaign' })
        : await putFaction(newId(), e.name, { de: e.de, status: e.status, lore: text });
      setItems((cur) => [saved, ...(cur ?? [])]);
      notify(`${e.name} is in your Library now.`);
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const shown = lore ? lore.entries.filter((e) => (!kind || e.kind === kind) && inPlace(lore, e, place)) : [];
  const places = lore ? placeOptions(lore) : [];
  const nameOf = (id: string) => lore?.entries.find((x) => x.id === id)?.name ?? id;
  /** Where an entry lies: a region under what contains it (Ostermark › Mordheim), a group or faction where it comes from. */
  const whereLine = (e: LoreEntry): string => {
    if (!lore) return '';
    if (e.kind === 'region') { const up = ancestors(lore, e.id); return up.length ? `In ${up.map((a) => a.name).join(' › ')}` : ''; }
    return e.regions?.length ? `From ${e.regions.map((r) => [...ancestors(lore, r).slice(-1), { name: nameOf(r) }].map((a) => a.name).join(' › ')).join(' · ')}` : '';
  };
  return (
    <section className={ui.page} aria-labelledby="lore-title">
      <h2 id="lore-title" className={styles.title}>Lore</h2>
      <p className={ui.muted}>Places, powers and groups of the Mordheim setting, summarised from mordheimer.net with their source. Add one to your Library to make it your own and change it freely; the catalogue itself stays as it is.</p>
      <div className={ui.row} role="group" aria-label="Show">
        <button type="button" className={kind === null ? ui.button : ui.buttonQuiet} aria-pressed={kind === null} onClick={() => setKind(null)}>All</button>
        {LORE_KINDS.map((k) => (
          <button key={k.kind} type="button" className={kind === k.kind ? ui.button : ui.buttonQuiet} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>{k.label}</button>
        ))}
      </div>
      {places.length > 0 && (
        <label className={ui.field}><span className={ui.muted}>Place</span>
          <select className={ui.select} value={place} aria-label="Place" onChange={(ev) => setPlace(ev.target.value)}>
            <option value="">anywhere in the world</option>
            {places.map((o) => <option key={o.id} value={o.id}>{`${'– '.repeat(o.depth)}${o.name}`}</option>)}
          </select>
        </label>
      )}
      {(error || problem) && <p className={ui.message} role="status">{problem ?? error}</p>}
      {!lore && <p className={ui.muted}>Loading the lore…</p>}
      {lore && (
        <ul className={styles.list} aria-label="Lore">
          {shown.map((e) => {
            const kept = have.has(e.name);
            return (
              <li key={e.id} className={styles.idea}>
                <div className={styles.head}>
                  <strong>{e.name}</strong>
                  <span className={styles.chip}>{LORE_KINDS.find((k) => k.kind === e.kind)!.label.replace(/s$/, '')}</span>
                </div>
                {whereLine(e) && <p className={styles.where}>{whereLine(e)}</p>}
                <p className={styles.excerpt}>{e.status}</p>
                <p className={styles.excerpt}>{e.text}</p>
                <div className={styles.sources}>
                  <span>Source</span>
                  {e.source.map((s) => <a key={s} className={styles.source} href={lore.sources[s]!.url} target="_blank" rel="noreferrer noopener">{lore.sources[s]!.title}</a>)}
                </div>
                <div className={ui.row}>
                  <button type="button" className={ui.buttonQuiet} disabled={kept || !online || !!error || busy !== null}
                    aria-label={kept ? `${e.name} is in the Library` : `Add ${e.name} to the Library`} onClick={() => void add(e)}>
                    {kept ? 'In your Library' : 'Add to Library'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

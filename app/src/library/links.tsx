/* Links between the entries of the Library (wish #74, Rob, 25.10.2026): a faction, an NPC, a group, a scenario or a
   place can point to others of the five – an NPC to its group, a group to a place. The Library shows them openly, from
   both ends. A copy into a campaign takes no link along: what the Library knows of how things belong together stays
   there. A link to an entry that is not in the list (taken out, or not yet synced from another device) is not shown, and a save keeps it. */
import { useEffect, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { LibraryItem } from './api.ts';
import styles from './Library.module.css';
import { loadLore, LORE_KINDS, type Lore, type LoreEntry } from './lore.ts';

export const LINK_KINDS = ['faction', 'npc', 'group', 'scenario', 'location'] as const;
const KIND_NAMES: Record<string, string> = { faction: 'Faction', npc: 'NPC', group: 'Group', scenario: 'Scenario', location: 'Place' };
const isLinkable = (i: LibraryItem) => (LINK_KINDS as readonly string[]).includes(i.kind);
const linksOf = (i: LibraryItem): string[] => (i.body as { links?: string[] } | null)?.links ?? [];

/* Report #100: an entry also points to the lore catalogue (data/lore.json) – an NPC to Mordheim, a faction to a realm. Such a link
   is stored as `lore:<id>`; the catalogue is read-only and not part of the Library, so it is only followed from the entry. */
const LORE_PREFIX = 'lore:';
const loreIdOf = (link: string) => (link.startsWith(LORE_PREFIX) ? link.slice(LORE_PREFIX.length) : null);

/** The lore catalogue once it is needed; none before (it is fetched on first use, not part of the app shell). */
function useLoreWhen(needed: boolean): Lore | null {
  const [lore, setLore] = useState<Lore | null>(null);
  useEffect(() => { if (needed) void loadLore().then(setLore); }, [needed]);
  return lore;
}

/** The entries linked with `id`, from either end, once each, by kind and name. */
export function linkedWith(items: LibraryItem[] | null, id: string): LibraryItem[] {
  const all = (items ?? []).filter(isLinkable);
  const mine = new Set(linksOf(all.find((i) => i.id === id) ?? ({ body: null } as unknown as LibraryItem)));
  return all
    .filter((i) => i.id !== id && (mine.has(i.id) || linksOf(i).includes(id)))
    .sort((a, b) => LINK_KINDS.indexOf(a.kind as (typeof LINK_KINDS)[number]) - LINK_KINDS.indexOf(b.kind as (typeof LINK_KINDS)[number]) || a.name.localeCompare(b.name));
}

/** The links a save sends: all of them. An id this device does not show may be an entry written on another device that has not
    synced yet, so a save never drops what it cannot see; the list simply does not show it. */
export const keepLinks = (_items: LibraryItem[] | null, links: string[]): string[] => links;

/** On a card: what the entry is linked with. Nothing when there is nothing. */
export function LinkChips({ items, id }: { items: LibraryItem[] | null; id: string }) {
  const linked = linkedWith(items, id);
  const loreIds = linksOf((items ?? []).find((i) => i.id === id) ?? ({ body: null } as unknown as LibraryItem)).map(loreIdOf).filter((l): l is string => l !== null);
  const lore = useLoreWhen(loreIds.length > 0);
  const places = lore ? loreIds.map((l) => lore.entries.find((e) => e.id === l)).filter((e): e is LoreEntry => !!e) : [];
  if (linked.length === 0 && places.length === 0) return null;
  return (
    <ul className={styles.links} aria-label="Linked entries">
      {linked.map((i) => <li key={i.id}><span className={styles.chip}>{KIND_NAMES[i.kind]}</span> {i.name}</li>)}
      {places.map((e) => <li key={e.id}><span className={styles.chip}>{loreLabel(e)}</span> {e.name}</li>)}
    </ul>
  );
}

const loreLabel = (e: LoreEntry) => LORE_KINDS.find((k) => k.kind === e.kind)!.label.replace(/s$/, '');

/** In a form: the links of the entry as it is written. Only what can be linked is offered, never the entry itself. */
export function LinksField({ items, selfId, links, onChange }: { items: LibraryItem[] | null; selfId: string; links: string[]; onChange: (l: string[]) => void }) {
  const all = (items ?? []).filter((i) => isLinkable(i) && i.id !== selfId);
  const byId = new Map(all.map((i) => [i.id, i]));
  const lore = useLoreWhen(true);
  const loreById = new Map((lore?.entries ?? []).map((e) => [LORE_PREFIX + e.id, e]));
  // an id that is not shown (gone, or not yet synced) stays in the entry
  const shown = links.filter((l) => byId.has(l) || loreById.has(l));
  const offered = all
    .filter((i) => !links.includes(i.id))
    .sort((a, b) => LINK_KINDS.indexOf(a.kind as (typeof LINK_KINDS)[number]) - LINK_KINDS.indexOf(b.kind as (typeof LINK_KINDS)[number]) || a.name.localeCompare(b.name));
  return (
    <div className={ui.field}>
      <span>Linked to</span>
      {shown.length > 0 && (
        <ul className={styles.links} aria-label="Links of this entry">
          {shown.map((l) => {
            const i = byId.get(l);
            const e = loreById.get(l);
            const [kind, name] = i ? [KIND_NAMES[i.kind], i.name] : [loreLabel(e!), e!.name];
            return (
              <li key={l}>
                <span className={styles.chip}>{kind}</span> {name}{' '}
                <button type="button" className={ui.buttonQuiet} aria-label={`Remove link to ${name}`} onClick={() => onChange(links.filter((x) => x !== l))}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
      <label className={ui.field}>
        <span className={ui.muted}>Add a link</span>
        <select className={ui.select} value="" disabled={offered.length === 0 && !lore} onChange={(e) => { if (e.target.value) onChange([...links, e.target.value]); }}>
          <option value="">Choose …</option>
          {offered.map((i) => <option key={i.id} value={i.id}>{i.name} ({KIND_NAMES[i.kind]})</option>)}
          {lore && LORE_KINDS.map((k) => {
            const list = lore.entries.filter((e) => e.kind === k.kind && !links.includes(LORE_PREFIX + e.id)).sort((a, b) => a.name.localeCompare(b.name));
            return list.length > 0 && (
              <optgroup key={k.kind} label={`Lore – ${k.label}`}>
                {list.map((e) => <option key={e.id} value={LORE_PREFIX + e.id}>{e.name} ({loreLabel(e)})</option>)}
              </optgroup>
            );
          })}
        </select>
      </label>
      <small className={ui.muted}>Seen openly here, from both ends; the lore only from here. A copy in a campaign does not carry the links.</small>
    </div>
  );
}

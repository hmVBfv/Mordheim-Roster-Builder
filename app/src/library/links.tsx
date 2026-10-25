/* Links between the entries of the Library (wish #74, Rob, 25.10.2026): a faction, an NPC, a group, a scenario or a
   place can point to others of the five – an NPC to its group, a group to a place. The Library shows them openly, from
   both ends. A copy into a campaign takes no link along: what the Library knows of how things belong together stays
   there. A link to an entry that is not in the list (taken out, or not yet synced from another device) is not shown, and a save keeps it. */
import ui from '../ui/ui.module.css';
import type { LibraryItem } from './api.ts';
import styles from './Library.module.css';

export const LINK_KINDS = ['faction', 'npc', 'group', 'scenario', 'location'] as const;
const KIND_NAMES: Record<string, string> = { faction: 'Faction', npc: 'NPC', group: 'Group', scenario: 'Scenario', location: 'Place' };
const isLinkable = (i: LibraryItem) => (LINK_KINDS as readonly string[]).includes(i.kind);
const linksOf = (i: LibraryItem): string[] => (i.body as { links?: string[] } | null)?.links ?? [];

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
  if (linked.length === 0) return null;
  return (
    <ul className={styles.links} aria-label="Linked entries">
      {linked.map((i) => <li key={i.id}><span className={styles.chip}>{KIND_NAMES[i.kind]}</span> {i.name}</li>)}
    </ul>
  );
}

/** In a form: the links of the entry as it is written. Only what can be linked is offered, never the entry itself. */
export function LinksField({ items, selfId, links, onChange }: { items: LibraryItem[] | null; selfId: string; links: string[]; onChange: (l: string[]) => void }) {
  const all = (items ?? []).filter((i) => isLinkable(i) && i.id !== selfId);
  const byId = new Map(all.map((i) => [i.id, i]));
  // an id that is not shown (gone, or not yet synced) stays in the entry
  const shown = links.filter((l) => byId.has(l));
  const offered = all
    .filter((i) => !links.includes(i.id))
    .sort((a, b) => LINK_KINDS.indexOf(a.kind as (typeof LINK_KINDS)[number]) - LINK_KINDS.indexOf(b.kind as (typeof LINK_KINDS)[number]) || a.name.localeCompare(b.name));
  return (
    <div className={ui.field}>
      <span>Linked to</span>
      {shown.length > 0 && (
        <ul className={styles.links} aria-label="Links of this entry">
          {shown.map((l) => {
            const i = byId.get(l)!;
            return (
              <li key={l}>
                <span className={styles.chip}>{KIND_NAMES[i.kind]}</span> {i.name}{' '}
                <button type="button" className={ui.buttonQuiet} aria-label={`Remove link to ${i.name}`} onClick={() => onChange(links.filter((x) => x !== l))}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
      <label className={ui.field}>
        <span className={ui.muted}>Add a link</span>
        <select className={ui.select} value="" disabled={offered.length === 0} onChange={(e) => { if (e.target.value) onChange([...links, e.target.value]); }}>
          <option value="">Choose …</option>
          {offered.map((i) => <option key={i.id} value={i.id}>{i.name} ({KIND_NAMES[i.kind]})</option>)}
        </select>
      </label>
      <small className={ui.muted}>Seen openly here, from both ends. A copy in a campaign does not carry the links.</small>
    </div>
  );
}

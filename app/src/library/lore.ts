/* The lore catalogue (data/lore.json): regions, factions and groups of the setting, each summarised from
   mordheimer.net with its source. Fetched on first use, so it is not part of the app shell. */
import { stem, words } from '../rules/search.ts';

export type LoreKind = 'region' | 'faction' | 'group';
export interface LoreEntry {
  id: string; kind: LoreKind; name: string; de: string; status: string; text: string; source: string[];
  /** A region: the region that contains it (the Pit lies in Mordheim, Mordheim in Ostermark …); none for a realm. */
  parent?: string | null;
  /** A faction or group: the regions it comes from or is based in. */
  regions?: string[];
  /** What it belongs with (data/lore.json `TAGS`): a search for "chaos" finds the Norse by it. */
  tags?: string[];
}
export interface Lore { sources: Record<string, { title: string; url: string }>; /** the tags and what each stands for */ tags: Record<string, string>; entries: LoreEntry[] }

export const LORE_KINDS: { kind: LoreKind; label: string }[] = [
  { kind: 'region', label: 'Regions' },
  { kind: 'faction', label: 'Factions' },
  { kind: 'group', label: 'Groups' },
];

const file = import.meta.glob<{ SOURCES: Lore['sources']; TAGS: Lore['tags']; LORE: LoreEntry[] }>('../../../data/lore.json', { import: 'default' });

let loading: Promise<Lore> | null = null;
export function loadLore(): Promise<Lore> {
  loading ??= file['../../../data/lore.json']!().then((d) => ({ sources: d.SOURCES, tags: d.TAGS, entries: d.LORE }));
  return loading;
}

/** What goes into the Library's text field: the summary and, last, where it was read. */
export function loreText(e: LoreEntry, lore: Lore): string {
  const where = placeLine(e, lore);
  return `${e.text}\n\n${where ? `${where}\n\n` : ''}Source: ${e.source.map((s) => `${lore.sources[s]!.title} – ${lore.sources[s]!.url}`).join('; ')}`;
}

/* ---- places nest (report #39) ---- */

const regionById = (lore: Lore) => new Map(lore.entries.filter((e) => e.kind === 'region').map((e) => [e.id, e]));

/** The regions that contain a place, the widest first (a catalogue that loops is cut where it repeats). */
export function ancestors(lore: Lore, id: string): LoreEntry[] {
  const by = regionById(lore);
  const out: LoreEntry[] = [];
  const seen = new Set([id]);
  for (let p = by.get(id)?.parent; p && by.has(p) && !seen.has(p); p = by.get(p)?.parent) { seen.add(p); out.unshift(by.get(p)!); }
  return out;
}

/** Every place for a choice, each directly under what contains it, the depth to indent by. */
export function placeOptions(lore: Lore): { id: string; name: string; depth: number }[] {
  const regions = lore.entries.filter((e) => e.kind === 'region');
  const known = new Set(regions.map((r) => r.id));
  const kids = (parent: string | null) => regions.filter((r) => (r.parent && known.has(r.parent) ? r.parent : null) === parent).sort((a, b) => a.name.localeCompare(b.name));
  const out: { id: string; name: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const r of kids(parent)) {
      if (seen.has(r.id)) continue;
      out.push({ id: r.id, name: r.name, depth });
      walk(r.id, depth + 1, new Set([...seen, r.id]));
    }
  };
  walk(null, 0, new Set());
  return out;
}

/** Whether an entry is in a place: a region in it or itself that place, a group or faction from it or from what lies in it. No place: all. */
export function inPlace(lore: Lore, e: LoreEntry, place: string): boolean {
  if (!place) return true;
  const within = (id: string) => id === place || ancestors(lore, id).some((a) => a.id === place);
  return e.kind === 'region' ? within(e.id) : (e.regions ?? []).some(within);
}

/** Where an entry lies as a line of the text it is kept as: a place under what contains it, a group or faction
    where it comes from, each place with everything around it (Old World › The Empire › Ostermark). Empty without one. */
export function placeLine(e: LoreEntry, lore: Lore): string {
  const by = regionById(lore);
  const chain = (id: string) => [...ancestors(lore, id), by.get(id)].filter((x): x is LoreEntry => !!x).map((x) => x.name).join(' › ');
  if (e.kind === 'region') { const up = ancestors(lore, e.id).map((x) => x.name).join(' › '); return up ? `Place: ${up}` : ''; }
  const from = (e.regions ?? []).map(chain).filter(Boolean).join(' · ');
  return from ? `Comes from: ${from}` : '';
}

/** Does an entry answer a search? Every word of the query is among the words of its name, German name, status, text or tags, in any form
    (the stems of the Rules search); the entries whose name or tags hold them come first. */
export function searchLore(entries: LoreEntry[], query: string): LoreEntry[] {
  const q = words(query).filter((w) => w.length >= 2).map(stem);
  if (!q.length) return entries;
  const has = (text: string) => { const w = words(text).map(stem); return (s: string) => w.some((x) => x === s || (Math.min(x.length, s.length) >= 3 && (x.startsWith(s) || s.startsWith(x)))); };
  const ranked: { e: LoreEntry; first: boolean }[] = [];
  for (const e of entries) {
    const head = has(`${e.name} ${e.de} ${(e.tags ?? []).join(' ')}`);
    const all = has(`${e.name} ${e.de} ${e.status} ${e.text} ${(e.tags ?? []).join(' ')}`);
    if (q.every(all)) ranked.push({ e, first: q.every(head) });
  }
  return [...ranked.filter((r) => r.first), ...ranked.filter((r) => !r.first)].map((r) => r.e);
}

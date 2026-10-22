/* The lore catalogue (data/lore.json): regions, factions and groups of the setting, each summarised from
   mordheimer.net with its source. Fetched on first use, so it is not part of the app shell. */
export type LoreKind = 'region' | 'faction' | 'group';
export interface LoreEntry {
  id: string; kind: LoreKind; name: string; de: string; status: string; text: string; source: string[];
  /** A region: the region that contains it (the Pit lies in Mordheim, Mordheim in Ostermark …); none for a realm. */
  parent?: string | null;
  /** A faction or group: the regions it comes from or is based in. */
  regions?: string[];
}
export interface Lore { sources: Record<string, { title: string; url: string }>; entries: LoreEntry[] }

export const LORE_KINDS: { kind: LoreKind; label: string }[] = [
  { kind: 'region', label: 'Regions' },
  { kind: 'faction', label: 'Factions' },
  { kind: 'group', label: 'Groups' },
];

const file = import.meta.glob<{ SOURCES: Lore['sources']; LORE: LoreEntry[] }>('../../../data/lore.json', { import: 'default' });

let loading: Promise<Lore> | null = null;
export function loadLore(): Promise<Lore> {
  loading ??= file['../../../data/lore.json']!().then((d) => ({ sources: d.SOURCES, entries: d.LORE }));
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

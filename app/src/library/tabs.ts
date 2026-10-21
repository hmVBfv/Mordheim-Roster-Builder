/* The tabs of the Library (ADR 0023): the tabs on top of the page on a phone, the entries under Library in the
   side navigation from 900 px (app/navChildren.ts). More come with their slices: NPCs, Groups, Scenarios, Lore. */
export const LIBRARY_TABS = [
  { key: 'ideas', label: 'Ideas' },
  { key: 'factions', label: 'Factions' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'groups', label: 'Groups' },
  { key: 'scenarios', label: 'Scenarios' },
  { key: 'lore', label: 'Lore' },
] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

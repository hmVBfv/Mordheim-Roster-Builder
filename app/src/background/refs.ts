/* What an entry of the Background refers to: a battle, a faction of the world,
   a Named NPC, or a few words. The label written when the reference was made
   is kept, but the name shown is the current one when the device knows it – a
   faction that was renamed is still the same faction. Pure. */
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { nameOf, type World } from '../world/api.ts';
import type { Ref } from './api.ts';

type Battles = NonNullable<CampaignView['battles']>;

export const REF_KIND_NAMES: Record<Ref['kind'], string> = { battle: 'Battle', faction: 'Faction', npc: 'Named NPC', entry: 'Entry', warrior: 'Warrior', note: 'Note', text: 'Other' };

/** The kinds the form offers, in the order of its chooser. */
export const REF_CHOICES = ['battle', 'faction', 'npc', 'text'] as const;
export type RefChoice = (typeof REF_CHOICES)[number];

export interface RefOption { id: string; label: string; hint: string }

/** What can be picked for a kind: every battle, every faction, every NPC marked Named (with its faction as the hint). */
export function refOptions(kind: Exclude<RefChoice, 'text'>, battles: Battles, world: World | null): RefOption[] {
  if (kind === 'battle') return battles.map((b) => ({ id: b.id, label: battleTitle(b), hint: '' }));
  if (!world) return [];
  if (kind === 'faction') return world.factions.map((f) => ({ id: f.id, label: nameOf(f), hint: '' }));
  return world.npcs.filter((n) => n.named).map((n) => ({ id: n.id, label: nameOf(n), hint: world.factions.find((f) => f.id === n.factionId) ? nameOf(world.factions.find((f) => f.id === n.factionId)!) : '' }));
}

/** The name to show for a reference: the current one, else the one written down – and a note when a faction or NPC has left the world. */
export function refLabel(r: Ref, world: World | null, battles: Battles | undefined): { label: string; gone: boolean } {
  if (r.kind === 'battle') { const b = battles?.find((x) => x.id === r.id); return { label: b ? battleTitle(b) : r.label, gone: false }; }
  if (r.kind === 'faction' || r.kind === 'npc') {
    if (!world) return { label: r.label, gone: false };
    const found = r.kind === 'faction' ? world.factions.find((x) => x.id === r.id) : world.npcs.find((x) => x.id === r.id);
    return found ? { label: nameOf(found), gone: false } : { label: r.label, gone: true };
  }
  return { label: r.label, gone: false };
}

export const sameRef = (a: Pick<Ref, 'kind' | 'id'>, b: Pick<Ref, 'kind' | 'id'>) => a.kind === b.kind && a.id === b.id;

/* An NPC's values while the form is open, and the NPCs as templates to copy
   from. Pure; the form itself (NpcFields) is loaded when a leader opens it. */
import { emptyNpcProfile, hasValues, npcStatline, npcTemplate, parseStatline, type NpcProfile, type OpponentTemplate } from '@mordheim/core';
import { LIMITS, nameOf, type Faction, type Npc } from './api.ts';

/** `values`: the grid of characteristics (the way to write an NPC); `text`: the plain text the Tabletop Simulator copy reads – the fallback. */
export interface NpcDraft { mode: 'values' | 'text'; profile: NpcProfile; text: string }

/** Whether nothing was filled in: no characteristic, no save, no skill, equipment or rule. */
export const isBlank = (p: NpcProfile): boolean => !hasValues(p) && p.skills.length === 0 && !p.equipment.trim() && !p.rules.trim();

/** The form's start: an NPC with values opens as values, one written as text opens as text, a new one opens as an empty grid. */
export function draftOf(n: Pick<Npc, 'profile' | 'statlineTts'> | null): NpcDraft {
  if (n?.profile) return { mode: 'values', profile: n.profile, text: n.statlineTts };
  if (n && n.statlineTts.trim()) return { mode: 'text', profile: emptyNpcProfile(), text: n.statlineTts };
  return { mode: 'values', profile: emptyNpcProfile(), text: '' };
}

/** What is stored: the values and the text written from them – or, in text mode, the text alone. */
export function bodyOf(d: NpcDraft): Pick<Npc, 'profile' | 'statlineTts'> {
  if (d.mode === 'text') return { profile: null, statlineTts: d.text.trim().slice(0, LIMITS.statline) };
  if (isBlank(d.profile)) return { profile: null, statlineTts: '' };
  return { profile: d.profile, statlineTts: npcStatline(d.profile).slice(0, LIMITS.statline) };
}

/** The values of an NPC: the ones filled in, or what can be read from its text. */
export const valuesOf = (n: Pick<Npc, 'profile' | 'statlineTts'>): NpcProfile | null => n.profile ?? parseStatline(n.statlineTts);

/** The NPCs of the world as templates for the copy picker, `except` one (the one being changed). */
export function npcTemplates(npcs: Npc[], factions: Faction[], except?: string): OpponentTemplate[] {
  return npcs.flatMap((n) => {
    const p = n.id === except ? null : valuesOf(n);
    const f = factions.find((x) => x.id === n.factionId);
    return p ? [npcTemplate(n.id, `NPC · ${f ? nameOf(f) : 'no faction'}`, nameOf(n), p)] : [];
  });
}

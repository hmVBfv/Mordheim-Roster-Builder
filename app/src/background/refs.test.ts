/* What an entry refers to: what can be picked, and the name shown. */
import { describe, expect, it } from 'vitest';
import type { World } from '../world/api.ts';
import type { Ref } from './api.ts';
import { refLabel, refOptions, sameRef } from './refs.ts';

const battles = [{ id: 'b1', round: 1, title: 'Hel Fenn ferry' }, { id: 'b2', round: 2, title: '' }] as never;
const world = {
  seq: 1, reputation: [],
  factions: [{ id: 'f1', nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: '', updatedAt: '', seq: 1 }],
  npcs: [
    { id: 'n1', factionId: 'f1', nameEn: 'Old Marek', nameDe: '', publicStatus: '', statlineTts: '', named: true, profile: null, updatedAt: '', seq: 1 },
    { id: 'n2', factionId: 'f1', nameEn: 'A deckhand', nameDe: '', publicStatus: '', statlineTts: '', named: false, profile: null, updatedAt: '', seq: 1 },
    { id: 'n3', factionId: null, nameEn: '', nameDe: 'Der Fremde', publicStatus: '', statlineTts: '', named: true, profile: null, updatedAt: '', seq: 1 },
  ],
} as World;

describe('what can be picked', () => {
  it('every battle, every faction, and only the NPCs marked Named – with their faction as the hint', () => {
    expect(refOptions('battle', battles, null)).toEqual([{ id: 'b1', label: 'Battle 1 · Hel Fenn ferry', hint: '' }, { id: 'b2', label: 'Battle 2', hint: '' }]);
    expect(refOptions('faction', battles, world)).toEqual([{ id: 'f1', label: 'The Ferrymen', hint: '' }]);
    expect(refOptions('npc', battles, world)).toEqual([{ id: 'n1', label: 'Old Marek', hint: 'The Ferrymen' }, { id: 'n3', label: 'Der Fremde', hint: '' }]);
  });

  it('nothing of the world before it is read', () => {
    expect(refOptions('faction', battles, null)).toEqual([]);
    expect(refOptions('npc', battles, null)).toEqual([]);
  });
});

describe('the name shown', () => {
  const ref = (kind: Ref['kind'], id: string, label: string): Ref => ({ kind, id, label });
  it('is the current one: a renamed faction or NPC, a battle by its title now', () => {
    expect(refLabel(ref('faction', 'f1', 'The Ferry Guild'), world, battles)).toEqual({ label: 'The Ferrymen', gone: false });
    expect(refLabel(ref('npc', 'n1', 'Marek'), world, battles)).toEqual({ label: 'Old Marek', gone: false });
    expect(refLabel(ref('battle', 'b1', 'Battle 1'), world, battles)).toEqual({ label: 'Battle 1 · Hel Fenn ferry', gone: false });
  });

  it('falls back to the written label – and says when a faction or NPC has left the world', () => {
    expect(refLabel(ref('faction', 'x', 'The Old Guild'), world, battles)).toEqual({ label: 'The Old Guild', gone: true });
    expect(refLabel(ref('npc', 'x', 'Nobody'), world, battles)).toEqual({ label: 'Nobody', gone: true });
    expect(refLabel(ref('battle', 'x', 'Battle 9 · Lost'), world, battles)).toEqual({ label: 'Battle 9 · Lost', gone: false });
  });

  it('does not claim anything is gone while the world is unread, or about words', () => {
    expect(refLabel(ref('faction', 'f1', 'The Ferrymen'), null, battles)).toEqual({ label: 'The Ferrymen', gone: false });
    expect(refLabel(ref('text', '', 'the ford at dusk'), world, battles)).toEqual({ label: 'the ford at dusk', gone: false });
  });

  it('knows one reference from another by kind and id', () => {
    expect(sameRef(ref('npc', 'n1', 'a'), ref('npc', 'n1', 'b'))).toBe(true);
    expect(sameRef(ref('npc', 'n1', 'a'), ref('faction', 'n1', 'a'))).toBe(false);
  });
});

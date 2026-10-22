/* The people of a warband as the Story screen and the roster's menus name
   them (phase 4b2): heroes, henchmen groups, Hired Swords and Dramatis
   Personae, and the heroes who fell. For each: where his profile is kept and
   what it asks for. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState, WarriorProfile } from '@mordheim/core';
import { rosterView } from '../roster/view.ts';
import type { Field } from './FieldsSheet.tsx';

export type Group = 'hero' | 'group' | 'hired' | 'fallen';
export interface Person {
  key: string;
  /** A hero's or group's `uid`, a Hired Sword's (text) `uid`. */
  uid: number | string;
  name: string;
  /** His title in English if the profile has one, else what he is. */
  sub: string;
  group: Group;
  profile: WarriorProfile;
}

export function peopleOf(data: GameData, s: WarbandState): Person[] {
  const v = rosterView(data, s);
  const ctx = core.ctxOf(data, s);
  const out: Person[] = [];
  const model = (uid: number) => s.models.find((m) => m.uid === uid);
  for (const w of v.heroes) {
    const p = core.profileOf(model(w.uid));
    out.push({ key: w.key, uid: w.uid, name: w.name, sub: p.title_en || w.type, group: 'hero', profile: p });
  }
  for (const w of v.henchmen) out.push({ key: w.key, uid: w.uid, name: w.name, sub: `${w.count} × ${w.type}`, group: 'group', profile: core.profileOf(model(w.uid)) });
  for (const h of v.hires) {
    const rec = [...(s.hired ?? []), ...(s.dp ?? [])].find((x) => x.uid === h.uid);
    const p = core.profileOf(rec);
    out.push({ key: h.key, uid: h.uid, name: h.name, sub: p.title_en || h.kind, group: 'hired', profile: p });
  }
  for (const f of s.fallen ?? []) {
    if (f.kind !== 'hero') continue;
    const p = core.profileOf(f.m);
    out.push({ key: `fallen-${f.id ?? f.m.uid}`, uid: f.m.uid, name: core.modelLabel(ctx, f.m), sub: p.title_en || 'fell', group: 'fallen', profile: p });
  }
  return out;
}

export const L = core.STORY_LIMITS;

/** What a warrior's profile asks for. */
export const PROFILE_FIELDS: Field[] = [
  { key: 'name_de', label: 'Name (German)', kind: 'line', max: L.name, hint: 'As the German chronicle spells it.' },
  { key: 'name_en', label: 'Name (English)', kind: 'line', max: L.name, hint: 'As the English chronicle spells it.' },
  { key: 'title_de', label: 'Title (German)', kind: 'line', max: L.title, placeholder: 'der Graue' },
  { key: 'title_en', label: 'Title (English)', kind: 'line', max: L.title, placeholder: 'the Grey' },
  { key: 'voice', label: 'How he speaks', kind: 'text', max: L.voice, rows: 3, hint: 'A few words for the chronicle: few words, all of them orders.' },
  { key: 'origin', label: 'Where he comes from', kind: 'text', max: L.origin, rows: 3 },
  { key: 'text', label: 'A few lines about him', kind: 'text', max: L.text, rows: 5 },
];

export const CANON_FIELDS: Field[] = [
  { key: 'name_de', label: 'Name (German)', kind: 'line', max: L.name, placeholder: 'Die Silberne Karawane' },
  { key: 'name_en', label: 'Name (English)', kind: 'line', max: L.name, placeholder: 'The Silver Caravan' },
];

/** The questions a prologue answers (concept.md 4.6). */
export const PROLOGUE_QUESTIONS = [
  'Where do you come from?',
  'What are you looking for in Mordheim?',
  'Who leads, and why do the others follow?',
  'What do you fear?',
];

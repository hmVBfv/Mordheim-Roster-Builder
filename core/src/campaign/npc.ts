/* The values of an NPC (a person of the world, or of a scenario): the usual
   characteristics and save, skills, equipment and special rules – an
   opponent's profile without its id, number and note. The leader fills them
   in a form (or copies them from any model of the game, or from another NPC);
   the plain text form the world and the Tabletop Simulator copy read is
   written from them. Older NPCs have only that text: `parseStatline` reads
   what it can back into values. Pure. */
import type { StatKey } from '../data/types.ts';
import { OPPONENT_STATS, profileFrom, type OpponentProfile, type OpponentTemplate } from './opponents.ts';

export type NpcProfile = Pick<OpponentProfile, 'type' | 'profile' | 'sv' | 'skills' | 'equipment' | 'equipmentTips' | 'rules' | 'from'>;

export const emptyNpcProfile = (): NpcProfile => ({ type: 'Hero', profile: {}, sv: '', skills: [], equipment: '', equipmentTips: [], rules: '', from: null });

/** The values of a template (a model of the game, an NPC …), or an empty set. */
export function npcProfileFrom(t: OpponentTemplate | null): NpcProfile {
  if (!t) return emptyNpcProfile();
  const p = profileFrom('', t);
  return { type: p.type, profile: p.profile, sv: p.sv, skills: p.skills, equipment: p.equipment, equipmentTips: p.equipmentTips, rules: p.rules, from: p.from };
}

/** An NPC's values as an opponent's profile, for what already works on those (the Tabletop Simulator card). */
export const npcAsOpponent = (name: string, p: NpcProfile, id = ''): OpponentProfile => ({ id, name, count: 1, note: '', ...p });

/** Whether any characteristic or the save has been filled in. */
export const hasValues = (p: NpcProfile): boolean => OPPONENT_STATS.some((k) => (p.profile[k] ?? '').trim()) || !!p.sv.trim();

const ruleLines = (p: NpcProfile): string[] => [
  ...p.rules.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean),
  ...p.skills.map((s) => (s.text.trim() ? `${s.name}: ${s.text.trim()}` : s.name)),
];

/** The plain text form: the statline, the equipment, a line to each rule or skill – what the world shows and `parseStatline` reads.
    The tooltips of the equipment are not in it: the text is the old, flat form, and the card reads them from the values. */
export function npcStatline(p: NpcProfile): string {
  const out: string[] = [];
  if (hasValues(p)) out.push(`${OPPONENT_STATS.map((k) => `${k}${(p.profile[k] ?? '').trim() || '-'}`).join(' ')} Sv ${p.sv.trim() || '-'}`);
  if (p.equipment.trim()) out.push(`Equipment: ${p.equipment.trim()}`);
  out.push(...ruleLines(p).map((r) => `• ${r}`));
  return out.join('\n');
}

const VALUE = String.raw`(\d+\+?(?:\(\d+\))?|D\d+|-)`;
const STAT_AT = new RegExp(String.raw`(?:^|[\s,;])(Sv|Ld|WS|BS|M|S|T|W|I|A)\s*[:=]?\s*${VALUE}(?=$|[\s,;])`, 'g');

/** Reads a statline written by hand (`M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7`, with or without `Sv 5+`) back into values: the first line that names at
    least five characteristics is the profile, `Equipment:` is the equipment, every other line a rule. Nothing found: `null`. */
export function parseStatline(text: string): NpcProfile | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const at = lines.findIndex((l) => [...l.matchAll(STAT_AT)].length >= 5);
  if (at < 0) return null;
  const p = emptyNpcProfile();
  for (const m of lines[at]!.matchAll(STAT_AT)) {
    const key = m[1]!, value = m[2]!;
    if (key === 'Sv') p.sv = value;
    else p.profile[key as StatKey] = value;
  }
  const rules: string[] = [];
  lines.forEach((l, i) => {
    if (i === at) return;
    const eq = /^equipment\s*:\s*(.*)$/i.exec(l);
    if (eq) p.equipment = eq[1]!.trim();
    else rules.push(l.replace(/^[•\-*]\s*/, ''));
  });
  p.rules = rules.join('\n');
  return p;
}

/** An NPC as a template to copy from: another NPC of the campaign's world, or of a scenario. */
export function npcTemplate(key: string, source: string, name: string, p: NpcProfile): OpponentTemplate {
  return { key: `npc/${key}`, kind: 'npc', source, name, type: p.type, count: 1, profile: { ...p.profile }, sv: p.sv, skills: p.skills.map((s) => ({ ...s })), equipment: p.equipment, equipmentTips: (p.equipmentTips ?? []).map((e) => ({ ...e })), rules: p.rules, grade: '' };
}

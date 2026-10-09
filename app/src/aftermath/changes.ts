/* What changed, in words (phase 4a4; docs/mockups/changes.html): the
   changes core finds between two states of a warband (diffWarbands) and
   explains (reconcile), grouped by warrior – the warband itself last – each
   as "what · from → to" with its cause, or the mark that it has none. The
   same for the preview before marking and for the changes frozen with a
   mark. */
import type { Casualty, GameData, LogEntry, WarbandState } from '@mordheim/core';
import * as core from '@mordheim/core';

/** A change as core reports it (and as the server freezes it). */
export interface AnyChange { kind: string; uid: number | string | null; hireUid?: string; name: string; changeKey: string; payload: Record<string, unknown>; eventRef: string | null; unexplained: boolean }

export interface ChangeLine { key: string; what: string; from: string | null; to: string; why: string | null; unexplained: boolean; free: boolean }
export interface ChangeGroup { key: string; name: string; lines: ChangeLine[] }

const FREE = new Set(['renamed', 'gear_added', 'gear_removed', 'rare_removed', 'hired', 'released', 'gold', 'rating', 'worth']);
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => Number(v) || 0;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const DISTRICT_WORDS: Record<string, string> = { none: 'nothing', foothold: 'foothold', control: 'control' };

function itemName(data: GameData | null, de: string): string {
  return data?.CATALOG.find((x) => x.de === de)?.en ?? de;
}

/** One change in words: what, from, to. */
export function lineOf(c: AnyChange, data: GameData | null = null): Pick<ChangeLine, 'what' | 'from' | 'to'> {
  const p = c.payload;
  switch (c.kind) {
    case 'recruited': return { what: 'Recruited', from: null, to: `${str(p.unit)}${num(p.qty) > 1 ? ` ×${num(p.qty)}` : ''}` };
    case 'promoted': return { what: 'Promoted', from: null, to: 'Hero' };
    case 'renamed': return { what: 'Name', from: str(p.before) || '—', to: str(p.after) || '—' };
    case 'group_size': return { what: 'Men', from: str(p.before), to: str(p.after) };
    case 'experience': return { what: 'Experience', from: str(p.before), to: str(p.after) };
    case 'stat': return { what: str(p.stat), from: null, to: signed(num(p.after) - num(p.before)) };
    case 'skill': return { what: p.added ? 'New skill' : 'Skill gone', from: null, to: str(p.skill) };
    case 'spell': return { what: p.added ? 'New spell' : 'Spell gone', from: null, to: str(p.spell) };
    case 'injury': return { what: p.added ? 'Injury' : 'Injury taken back', from: null, to: str(p.injury) };
    case 'gear_added': return { what: 'Equipment', from: null, to: `+ ${itemName(data, str(p.item))}${num(p.after) - num(p.before) > 1 ? ` ×${num(p.after) - num(p.before)}` : ''}` };
    case 'gear_removed': return { what: 'Equipment', from: null, to: `− ${itemName(data, str(p.item))}${num(p.before) - num(p.after) > 1 ? ` ×${num(p.before) - num(p.after)}` : ''}` };
    case 'rare_added': return { what: 'Rare item', from: null, to: `+ ${str(p.itemEn) || itemName(data, str(p.item))}` };
    case 'rare_removed': return { what: 'Rare item', from: null, to: `− ${str(p.itemEn) || itemName(data, str(p.item))}` };
    case 'died': return { what: p.memberName ? str(p.memberName) : 'Death', from: null, to: 'fell' };
    case 'released': return { what: p.hire ? 'Left' : 'Left the warband', from: null, to: p.hire ? (p.dramatis ? 'Dramatis Persona' : 'Hired Sword') : `${str(p.unit)}${num(p.qty) > 1 ? ` ×${num(p.qty)}` : ''}` };
    case 'hired': return { what: 'Hired', from: null, to: p.dramatis ? 'Dramatis Persona' : 'Hired Sword' };
    case 'district': return { what: c.name, from: DISTRICT_WORDS[str(p.before)] ?? str(p.before), to: DISTRICT_WORDS[str(p.after)] ?? str(p.after) };
    case 'house_rules': return { what: str(p.label) || c.name, from: JSON.stringify(p.before), to: JSON.stringify(p.after) };
    case 'gold': return { what: 'Gold', from: `${num(p.before)} gc`, to: `${num(p.after)} gc` };
    case 'rating': return { what: 'Rating', from: str(p.before), to: str(p.after) };
    case 'worth': return { what: 'Worth', from: str(p.before), to: str(p.after) };
    default: return { what: c.kind, from: null, to: '' };
  }
}

/** The cause a change was matched with, from the save it was found in. */
function causeOf(s: WarbandState | null, data: GameData | null, ref: string | null): string | null {
  if (!ref || !s) return null;
  const [type, id] = ref.split(':');
  if (type === 'evt') return (s.campaign?.log ?? []).find((e: LogEntry) => String(e.id) === id)?.text ?? null;
  if (type === 'cas') {
    const c = (s.campaign?.casualties ?? []).find((x: Casualty) => String(x.id) === id);
    return c && data ? core.casualtyText(core.ctxOf(data, s), c) : null;
  }
  return null;
}

/** The changes by warrior (in the order core found them), the warband itself last. */
export function groupChanges(changes: AnyChange[], s: WarbandState | null = null, data: GameData | null = null): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  const band: ChangeGroup = { key: 'wb', name: 'The warband', lines: [] };
  for (const c of changes) {
    const who = c.hireUid ?? (c.uid == null ? null : String(c.uid));
    const g = who == null ? band : groups.get(who) ?? groups.set(who, { key: who, name: c.name, lines: [] }).get(who)!;
    g.lines.push({ key: c.changeKey, ...lineOf(c, data), why: causeOf(s, data, c.eventRef), unexplained: c.unexplained, free: FREE.has(c.kind) });
  }
  return [...groups.values(), ...(band.lines.length ? [band] : [])];
}

/** What changed between two states, explained as the server will freeze it when the battle is marked. */
export function previewChanges(data: GameData, before: WarbandState, after: WarbandState, battleId: string, round: number): AnyChange[] {
  return core.reconcile(core.diffWarbands(data, before, after, round), core.battleEvidence(after, battleId, round));
}

/* Opponents (leaders only): the men and beasts a leader sets against the
   warbands – a gang of ferrymen, the Countess's bodyguard, a pack of wolves –
   kept in groups, each profile with the usual characteristics, skills,
   equipment and special rules, and exported to Tabletop Simulator like a
   warband's models.

   A profile starts from a template or from nothing. The templates come from
   the rules data – every model of every warband, the Hired Swords, the
   Dramatis Personae, the bestiary – and from the warriors of the campaign's
   own warbands as they stand. A template is copied, never linked: what the
   leader changes afterwards is his. Pure; the caller searches and stores. */
import type { GameData, HireEntry, Profile, StatKey, UnitDef } from '../data/types.ts';
import type { Ctx } from '../rules/context.ts';
import { isHeroModel } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { aDisp, effProfile, memberCount } from '../rules/profile.ts';
import { svFromText, svOfModel } from '../rules/saves.ts';
import { enRules, eqDisplayParts, markRulesFor, rareDisplayParts, skillText, skillTextFor } from '../export/rulesText.ts';

export const OPPONENT_STATS: readonly StatKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];

/** A skill on a profile: from the game, from the campaign's own skills (`ref`), or written in by hand. The text is the tooltip. */
export interface OpponentSkill { name: string; text: string; ref?: string }

/** The tooltip of a piece of equipment on a profile: what the item does, from the game's list or written in. It is hidden from the players on its own (ADR 0022). */
export interface EquipmentTip { name: string; text: string }

export type TemplateKind = 'unit' | 'hired' | 'dramatis' | 'beast' | 'warrior' | 'npc';
export const TEMPLATE_KIND_NAMES: Record<TemplateKind, string> = { unit: 'Warband model', hired: 'Hired Sword', dramatis: 'Dramatis Persona', beast: 'Bestiary', warrior: 'Warrior of the campaign', npc: 'NPC of the campaign' };

export interface OpponentProfile {
  /** The device's id, so a profile keeps its identity through edits. */
  id: string;
  name: string;
  /** What it is, in the leader's words: "Hero", "Henchman", "Animal" … */
  type: string;
  /** How many of it stand on the table. */
  count: number;
  /** Characteristics as written: numbers, or "3(4)", "D6", "-". */
  profile: Partial<Record<StatKey, string>>;
  /** Armour save as written ("5+", "-"). */
  sv: string;
  skills: OpponentSkill[];
  equipment: string;
  /** What the equipment does, item by item; a profile saved before they existed has none. */
  equipmentTips: EquipmentTip[];
  /** Special rules, one per line. */
  rules: string;
  note: string;
  /** Where it was copied from, for the leader's reference. */
  from: { kind: TemplateKind; key: string; label: string } | null;
}

export interface OpponentTemplate {
  /** Unique within its kind: `merc/captain`, `hired/ogre`, `beast/wardog`, `<warband id>/<uid>`. */
  key: string;
  kind: TemplateKind;
  /** Where it belongs: the warband, the grade, the source book. */
  source: string;
  name: string;
  type: string;
  count: number;
  profile: Partial<Record<StatKey, string>>;
  sv: string;
  skills: OpponentSkill[];
  equipment: string;
  /** Only an NPC of the campaign has them: a model of the game carries its gear by name. */
  equipmentTips?: EquipmentTip[];
  rules: string;
  grade: string;
}

const str = (p: Profile | null | undefined): Partial<Record<StatKey, string>> =>
  Object.fromEntries(OPPONENT_STATS.filter((k) => p && p[k] !== undefined && p[k] !== null).map((k) => [k, String(p![k])])) as Partial<Record<StatKey, string>>;
const lines = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).join('\n');
const plain = (s: string | undefined) => String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim();

function unitTemplate(data: GameData, wbKey: string, wbName: string, grade: string, u: UnitDef): OpponentTemplate | null {
  if (!u.profile || u.vehicle) return null;
  return {
    key: `${wbKey}/${u.id}`, kind: 'unit', source: wbName, name: u.name, type: u.t === 'hero' ? 'Hero' : 'Henchman', count: 1,
    profile: str(u.profile), sv: u.sv ? `${u.sv}+` : '', skills: [],
    equipment: (u.gear ?? []).map((g) => data.EQEN[g] ?? g).join(', '), rules: lines(enRules(data, u.sp)), grade,
  };
}

function hireTemplate(data: GameData, kind: 'hired' | 'dramatis', key: string, e: HireEntry): OpponentTemplate[] {
  if (!e.profile) return [];
  const fixed = Array.isArray(e.skills) ? (e.skills as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const skills: OpponentSkill[] = fixed.map((nm) => ({ name: nm, text: skillText(data, nm, e) }));
  // the save its own equipment and rules give (svOfEntry without a hire record)
  const n = [svFromText(e.eq), svFromText(e.sp)].filter((x): x is number => x != null).sort((a, b) => a - b)[0];
  const sv = n == null ? '' : `${n}+`;
  const base: OpponentTemplate = {
    key: `${kind}/${key}`, kind, source: e.src || (kind === 'hired' ? 'Hired Swords' : 'Dramatis Personae'), name: e.name, type: kind === 'hired' ? 'Hired Sword' : 'Dramatis Persona', count: 1,
    profile: str(e.profile), sv, skills, equipment: plain(e.eq), rules: lines(enRules(data, e.sp)), grade: e.grade,
  };
  const personas = (e.personas ?? []).map((p, i): OpponentTemplate => ({
    ...base, key: `${kind}/${key}/${i}`, name: `${e.name} – ${p.name}`,
    equipment: plain(p.eq ?? e.eq), rules: lines([...enRules(data, e.sp), ...enRules(data, typeof p.sp === 'string' ? p.sp : undefined)]),
  }));
  return personas.length ? personas : [base];
}

/** Every template the rules data offers: the models of all warbands, the Hired Swords, the Dramatis Personae, the bestiary. */
export function opponentTemplates(data: GameData): OpponentTemplate[] {
  const out: OpponentTemplate[] = [];
  for (const [k, w] of Object.entries(data.WARBANDS)) for (const u of w.units) { const t = unitTemplate(data, k, w.name, w.grade, u); if (t) out.push(t); }
  for (const [k, e] of Object.entries(data.HIREDSWORDS)) out.push(...hireTemplate(data, 'hired', k, e));
  for (const [k, e] of Object.entries(data.DRAMATIS)) out.push(...hireTemplate(data, 'dramatis', k, e));
  for (const b of data.BESTIARY ?? []) {
    out.push({
      key: `beast/${b.key}`, kind: 'beast', source: `Bestiary · ${b.src}`, name: b.name, type: 'Animal', count: 1, profile: str(b.profile), sv: b.sv ?? '',
      skills: [], equipment: b.equipment ?? '', rules: lines(b.rules.map(([n, t]) => `${n}: ${t}`)), grade: b.grade,
    });
  }
  return out;
}

/** The warriors of one warband of the campaign as they stand – profile with advances and injuries, skills, equipment – as templates. */
export function warriorTemplates(ctx: Ctx, warbandId: string, warbandName: string): OpponentTemplate[] {
  const out: OpponentTemplate[] = [];
  for (const m of ctx.s.models) {
    const def = unitDef(ctx, m.uid_def);
    const p = effProfile(ctx, m);
    if (!def || !p || def.vehicle) continue;
    const profile = str(p);
    if (profile.A !== undefined) profile.A = String(aDisp(ctx, m, p));
    const sv = svOfModel(ctx, m);
    const rules = [...enRules(ctx.data, def.sp), ...markRulesFor(ctx, m).map(([n, t]) => `${n}: ${t}`), ...(m.inj ?? []).map((j) => String(ctx.data.INJEN[j.code as string] ?? j.name))];
    out.push({
      key: `${warbandId}/${m.uid}`, kind: 'warrior', source: warbandName, name: (m.name || '').trim() || def.name, type: isHeroModel(ctx, m) ? 'Hero' : 'Henchman',
      count: isHeroModel(ctx, m) ? 1 : memberCount(m), profile, sv: sv == null ? '' : `${sv}+`,
      skills: (m.skills ?? []).map((nm) => ({ name: nm, text: skillTextFor(ctx, m, nm) })),
      equipment: [...eqDisplayParts(ctx, m), ...rareDisplayParts(ctx, m)].join(', '), rules: lines(rules), grade: '',
    });
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** The templates whose name, source, type or grade hold every word of the query, best first: a name that starts with the query, then a name that holds it. */
export function searchTemplates(list: OpponentTemplate[], query: string, kinds?: readonly TemplateKind[]): OpponentTemplate[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const q = fold(query.trim());
  const hits = list.filter((t) => (!kinds || kinds.length === 0 || kinds.includes(t.kind)) && words.every((w) => fold(`${t.name} ${t.source} ${t.type} ${t.grade} ${TEMPLATE_KIND_NAMES[t.kind]}`).includes(w)));
  const rank = (t: OpponentTemplate) => (!q ? 2 : fold(t.name).startsWith(q) ? 0 : fold(t.name).includes(q) ? 1 : 2);
  return hits.map((t, i) => ({ t, i, r: rank(t) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.t);
}

/** A new profile copied from a template (or an empty one). */
export function profileFrom(id: string, t: OpponentTemplate | null): OpponentProfile {
  if (!t) return { id, name: '', type: 'Henchman', count: 1, profile: {}, sv: '', skills: [], equipment: '', equipmentTips: [], rules: '', note: '', from: null };
  return {
    id, name: t.name, type: t.type, count: t.count, profile: { ...t.profile }, sv: t.sv, skills: t.skills.map((s) => ({ ...s })), equipment: t.equipment,
    equipmentTips: (t.equipmentTips ?? []).map((e) => ({ ...e })), rules: t.rules, note: '',
    from: { kind: t.kind, key: t.key, label: `${t.name} (${t.source})` },
  };
}

export interface CatalogSkill { list: string; name: string; text: string }

/** Every skill the game knows, with the list it is from: the standard lists, the warbands' own sets, the Hired Swords' own skills. */
export function skillCatalog(data: GameData): CatalogSkill[] {
  const seen = new Set<string>();
  const out: CatalogSkill[] = [];
  const add = (list: string, name: string, text: string) => { const k = `${list}\u0000${name}`; if (!seen.has(k)) { seen.add(k); out.push({ list, name, text: plain(text) }); } };
  for (const l of Object.values(data.SKILLLISTS)) for (const [n, t] of l.skills) add(l.name, n, t);
  for (const l of Object.values(data.SKILLSETS)) for (const [n, t] of l.skills) add(l.name, n, t);
  for (const e of [...Object.values(data.HIREDSWORDS), ...Object.values(data.DRAMATIS)]) for (const [n, t] of e.hsSpecial ?? []) add(e.name, n, t);
  return out;
}

/** The skills whose name, list or text hold every word of the query; names first. */
export function searchSkills(list: CatalogSkill[], query: string): CatalogSkill[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const q = fold(query.trim());
  return list.filter((s) => words.every((w) => fold(`${s.name} ${s.list}`).includes(w)) || (q.length >= 4 && fold(s.text).includes(q)))
    .map((s, i) => ({ s, i, r: !q ? 2 : fold(s.name).startsWith(q) ? 0 : fold(s.name).includes(q) ? 1 : 2 }))
    .sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}

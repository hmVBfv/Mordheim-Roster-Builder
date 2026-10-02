/* The rule texts behind the words on a roster card (docs/ui.md §5; Rob,
   02.10.2026: "essential and must be in"). Every item, skill, spell,
   mutation, Mark rule, injury and special rule a card names comes with what
   it does, looked up the way the Roster Builder's tooltips look it up
   (core tooltipInfo, keyedInfo, itemInfo …) – the same texts as in the
   Trading Post. A word core has no text for stays a plain word. */
import * as core from '@mordheim/core';
import type { GameData, HireEntry, HireRecord, ItemInfo, Model, UnitDef } from '@mordheim/core';

/** What one bubble shows: the rule's name, what kind of rule it is, its text. */
export interface Tip { name: string; line: string; text: string }

/** A word on a card and the rules behind it (more than one for a weapon
    with an upgrade); none when there is no text. */
export interface Fact { label: string; tips: Tip[] }

/* The data's texts are plain; a stray tag would show as text, so it goes. */
const plain = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** A rule as the data or core describe it: a name, perhaps a line, a text. */
type RuleText = { name?: unknown; line?: unknown; text?: unknown };

function tipOf(i: RuleText | null | undefined, name: string, line: string): Tip[] {
  const text = plain(i?.text);
  return text ? [{ name: plain(i?.name) || name, line: plain(i?.line) || line, text }] : [];
}

const fact = (label: string, tips: Tip[]): Fact => ({ label, tips });

/** An item by its data key (German, or English). */
export function itemTip(data: GameData, key: string): Tip[] {
  const en = core.enItem(data, key);
  return tipOf(core.itemInfo(data, key) ?? core.itemInfo(data, en), en, 'Equipment');
}

function equipment(ctx: core.Ctx, m: Model): Fact[] {
  return [...core.eqDisplayItems(ctx, m), ...core.rareDisplayItems(ctx, m)]
    .map((x) => fact(x.label, x.items.flatMap((k) => itemTip(ctx.data, k))));
}

/* An injury by its D66 code; older saves (and the fixtures) kept only its
   name. */
function injury(data: GameData, j: core.Injury): Fact {
  const row = (j.code ? data.INJURIES.find((x) => x.code === j.code) : undefined)
    ?? data.INJURIES.find((x) => x.name === j.name || data.INJEN[x.code] === j.name);
  const name = (row && data.INJEN[row.code]) || row?.name || j.name || '';
  return fact((j.name ?? '') + core.injModText(j), row ? tipOf(row, name, `Serious injury · ${row.code}`) : []);
}

/** The special rules of a warrior or a hired one: the abilities core finds
    in his rules (each in the owner's own wording where he defines it), then
    any other rule his text defines by name. `skip` holds names shown on
    another line of the card (a mutation is found in the rules scan too). */
function rules(chips: (ItemInfo & { key: string })[], defs: core.RuleDef[], skip: readonly string[]): Fact[] {
  const seen = new Set(skip.map(core.ruleKey));
  const out: Fact[] = [];
  for (const c of chips) {
    const k = core.ruleKey(c.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(fact(c.name, tipOf(c, c.name, 'Special rule')));
  }
  for (const d of defs) {
    const k = core.ruleKey(d.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(fact(d.name, tipOf(d, d.name, d.line)));
  }
  return out;
}

/** Everything a warrior's card names, with its rules. */
export interface WarriorFacts {
  rules: Fact[]; equipment: Fact[]; skills: Fact[]; spells: Fact[];
  mutations: Fact[]; mark: Fact[]; injuries: Fact[];
}

/* A warrior's special rules depend only on his unit, whether he is a Hero
   and leads, his mutations and the Mark he bears. Core finds them by
   testing every known ability against his rules (modelAbilities), about
   half a millisecond a warrior – on every change to the roster. So they are
   kept for each data set and those inputs. */
const RULES = new WeakMap<GameData, Map<string, Fact[]>>();

function warriorRules(ctx: core.Ctx, def: UnitDef, m: Model, skip: readonly string[]): Fact[] {
  let memo = RULES.get(ctx.data);
  if (!memo) RULES.set(ctx.data, (memo = new Map()));
  const key = JSON.stringify([ctx.s.wb, def.id, core.isHeroModel(ctx, m), core.isLeaderModel(ctx, m), [...new Set(m.mut ?? [])].sort(), skip]);
  let out = memo.get(key);
  if (!out) {
    const a = core.modelAbilities(ctx, def, m);
    out = rules(a.abilities, core.ruleDefs(a.sp, `Special rule · ${def.name}`), skip);
    memo.set(key, out);
  }
  return out;
}

export function warriorFacts(ctx: core.Ctx, m: Model): WarriorFacts {
  const data = ctx.data;
  const def = core.unitDef(ctx, m.uid_def);
  const mutations = [...new Set(m.mut ?? [])].map((x) => {
    const n = (m.mut ?? []).filter((y) => y === x).length;
    const en = core.mutEN(data, x);
    return fact(en + (n > 1 ? ` ×${n}` : ''), tipOf(core.abilityInfo(data, en), en, 'Mutation'));
  });
  const mark = core.markRulesFor(ctx, m).map(([n, t]) => fact(n, tipOf({ name: n, text: t }, n, 'Mark of Chaos')));
  return {
    rules: def ? warriorRules(ctx, def, m, [...mutations, ...mark].map((f) => f.label.replace(/ ×\d+$/, ''))) : [],
    equipment: equipment(ctx, m),
    // a skill as his own lists word it (the key modelAbilities gives it)
    skills: (m.skills ?? []).map((nm) => {
      const key = core.skillKey(data, ctx.s.wb, def ?? undefined, nm);
      return fact(nm, tipOf(core.keyedInfo(data, key) ?? core.tooltipInfo(data, nm), nm, 'Skill'));
    }),
    spells: (m.spells ?? []).map((s) => fact(s.name, tipOf(core.spellInfo(data, s.name), core.spellLabel(s.name), 'Spell'))),
    mutations,
    mark,
    injuries: (m.inj ?? []).map((j) => injury(data, j)),
  };
}

/** Everything a Hired Sword's or Dramatis Persona's card names. His skills
    are those he comes with (and his persona's) and those he learned, as the
    Roster Builder lists them; his own wording of a skill comes first. */
export interface HireFacts { rules: Fact[]; skills: Fact[]; spells: Fact[] }

export function hireFacts(ctx: core.Ctx, rec: HireRecord, e: HireEntry, kind: 'hs' | 'dp', key: string): HireFacts {
  const data = ctx.data;
  const pers = core.hsPersona(ctx, rec, e);
  const persSp = (pers as { sp?: string } | null)?.sp ?? '';
  const sp = [persSp, e.sp ?? ''].filter(Boolean).join(' ');
  const chips = core.abilityChips(data, { kind, key, persona: pers?.name ?? '' }, sp);
  const line = `Special rule · ${e.name}`;
  const defs = [...core.ruleDefs(persSp, line), ...core.ruleDefs(e.sp, line)];
  const skills = [...core.fixedSkills(ctx, e, rec), ...(rec.skills ?? [])];
  return {
    rules: rules(chips, defs, skills),
    // his own wording of the skill, a skill list's, or the rule his text defines by that name
    skills: skills.map((nm) => {
      const own = plain(core.hsSpecialText(e, nm));
      if (own) return fact(nm, [{ name: nm, line: `Skill · ${e.name}`, text: own }]);
      const listed = tipOf(core.tooltipInfo(data, nm), nm, 'Skill');
      return fact(nm, listed.length ? listed : tipOf(defs.find((d) => core.ruleKey(d.name) === core.ruleKey(nm)), nm, line));
    }),
    spells: (rec.spells ?? []).map((s) => {
      const lbl = core.spellLabel(s.name);
      return fact(lbl, tipOf(core.spellInfo(data, s.name), lbl, 'Spell'));
    }),
  };
}

/* The places of the Exploration chart as a small program (N7, docs/plan-postbattle.md; mordheimer.net, Campaigns: Income). Doubles to six of a
   kind lead to one of thirty places; each asks the player for rolls, tests and choices, and brings gold, shards, items, experience or a lasting
   advantage. `resolveLocation` walks a place's steps (data PB_LOCATION_RULES) with the answers given so far: it either returns the next
   question or – when everything is answered – what was found. It rolls nothing: core never does; the interface rolls or the player types. */
import type { Ctx } from '../rules/context.ts';
import type { GameData } from '../data/types.ts';
import { isHeroModel } from '../rules/costs.ts';
import { leaderUid } from '../rules/profile.ts';
import type { Find } from './postbattle.ts';

export type Answer = number | number[] | boolean | string;

export interface Question {
  /** Where in the place's steps it is asked; the key of its answer. */
  id: string;
  kind: 'roll' | 'pass' | 'hero' | 'choice';
  label: string;
  /** roll: the dice ("2D6", "D6*10": the dice are rolled, a multiplier is applied afterwards), and the lowest and highest total. */
  expr?: string;
  min?: number;
  max?: number;
  /** roll: the answer is the dice one by one (the rule looks at them, e.g. for a double). */
  dice?: boolean;
  options?: { id: string; label: string }[];
  /** hero: nobody may be named. */
  optional?: boolean;
  /** roll for an item that is found on N+ (the rule's "4+"). */
  needs?: number;
}

/** What a place brought: a find, as the post-battle record keeps it, with what only the place knows. */
export interface LocFind extends Omit<Find, 'id'> {
  /** An item that is one of several to choose from (Shield or Buckler). */
  options?: string[];
  /** A gem: kept or sold; `worth` is the price of one. */
  gem?: boolean;
  /** Twice the value of a normal one (the jewelled sword). */
  worthMult?: number;
  /** What the place does to a Hero: he misses the next game, or is never seen again. */
  act?: 'miss' | 'lose';
}

/** A lasting advantage or a duty that comes of a place: kept in the warband, shown where it works. */
export interface LocPerk { id: string; text: string; unique?: boolean; uid?: number; explore?: { dice?: number; reroll?: number; drop?: number } }

export interface Resolution {
  /** Every question answered. */
  done: boolean;
  /** The next one, if not. */
  question: Question | null;
  finds: LocFind[];
  perks: LocPerk[];
  /** What was wrong with an answer given (it is asked again). */
  problems: string[];
}

type Step = Record<string, unknown>;

/** The warband traits the places ask for (Rob, 13.11.2026): Undead = siteRace Undead (a Vampire is not Undead), Skaven = siteRace Skaven,
    Possessed = demon-like (the `demonic` mark), Sisters of Sigmar and Witch Hunters by their lists. */
export function warbandTags(ctx: Ctx): string[] {
  const def = ctx.data.WARBANDS[ctx.s.wb as string];
  const tags: string[] = [];
  if (def?.siteRace === 'Undead') tags.push('undead');
  if (def?.siteRace === 'Skaven') tags.push('skaven');
  if (def?.demonic) tags.push('possessed');
  if (ctx.s.wb === 'sos') tags.push('sisters');
  if (ctx.s.wb === 'wh') tags.push('witchhunters');
  return tags;
}

interface Dice { n: number; sides: number; mult: number; add: number }
const DICE = /^(\d*)D(\d+)(?:\*(\d+)|\+(\d+))?$/i;
function dice(expr: string): Dice | null {
  const m = DICE.exec(expr.trim());
  if (!m) return null;
  return { n: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), mult: m[3] ? Number(m[3]) : 1, add: m[4] ? Number(m[4]) : 0 };
}
const total = (a: Answer | undefined): number | null => (typeof a === 'number' ? a : Array.isArray(a) && a.length ? a.reduce((x, y) => x + y, 0) : null);

/** The CATALOG entry of an item by its English name. */
function catalogItem(data: GameData, en: string) {
  return data.CATALOG.find((c) => c.en.toLowerCase() === en.toLowerCase());
}

export function resolveLocation(ctx: Ctx, key: string, answers: Record<string, Answer>): Resolution {
  const out: Resolution = { done: false, question: null, finds: [], perks: [], problems: [] };
  const rules = ctx.data.PB_LOCATION_RULES[key];
  if (!rules) { out.problems.push(`No place “${key}” on the chart.`); return out; }
  const source = `location:${key}`;
  const tags = warbandTags(ctx);
  const heroes = ctx.s.models.filter((m) => isHeroModel(ctx, m)).map((m) => m.uid);
  const values: Record<string, Answer | null> = {};
  let blocked = false;

  const ask = (q: Question): void => { blocked = true; out.question = q; };
  /** A roll the player answers; null while it is not (properly) answered. */
  const roll = (id: string, label: string, expr: string, wantDice = false, needs?: number): number | null => {
    const d = dice(expr);
    if (!d) { out.problems.push(`Bad dice “${expr}”.`); return null; }
    const min = d.n, max = d.n * d.sides;
    const a = answers[id];
    const ok = (v: number) => Number.isInteger(v) && v >= 1 && v <= d.sides;
    if (a !== undefined) {
      if (wantDice ? Array.isArray(a) && a.length === d.n && a.every(ok) : (typeof a === 'number' ? Number.isInteger(a) && a >= min && a <= max : Array.isArray(a) && a.length === d.n && a.every(ok))) {
        values[id] = a;
        return total(a);
      }
      out.problems.push(`${label}: the dice show ${min} to ${max} in all.`);
    }
    ask({ id, kind: 'roll', label, expr, min, max, ...(wantDice ? { dice: true } : {}), ...(needs ? { needs } : {}) });
    return null;
  };
  const amountOf = (expr: unknown, id: string, label: string): number | null => {
    if (typeof expr === 'number') return expr;
    const s = String(expr);
    const ref = /^([a-z]\w*)\*(\d+)$/.exec(s);
    if (ref && values[ref[1] as string] != null) return (total(values[ref[1] as string] as Answer) ?? 0) * Number(ref[2]);
    const d = dice(s);
    if (!d) { out.problems.push(`Bad amount “${s}”.`); return null; }
    const t = roll(id, `${label} (${s.replace('*', ' × ')})`, `${d.n}D${d.sides}`);
    return t == null ? null : t * d.mult + d.add;
  };
  const heroUid = (as: unknown): number | undefined => { const v = values[String(as)]; return typeof v === 'number' ? v : undefined; };

  const effects = (list: Step[], path: string): void => {
    list.forEach((e, i) => {
      if (blocked) return;
      const id = `${path}.${i}`;
      const text = typeof e.text === 'string' ? e.text : '';
      if ('gold' in e) {
        const n = amountOf(e.gold, id, 'Gold found');
        if (n == null) return;
        if (e.as) values[String(e.as)] = typeof e.gold === 'string' && dice(e.gold) ? (answers[id] as Answer) : n;
        out.finds.push({ kind: 'gold', source, amount: n, text: text ? `${n} gc – ${text}` : `${n} gc found.` });
      } else if ('wyrd' in e) {
        const n = amountOf(e.wyrd, id, 'Shards of wyrdstone found');
        if (n == null) return;
        out.finds.push({ kind: 'wyrd', source, amount: n, text: text ? `${n} shard${n === 1 ? '' : 's'} – ${text}` : `${n} shard${n === 1 ? '' : 's'} of wyrdstone found.` });
      } else if ('item' in e) {
        const n = amountOf(e.qty ?? 1, id, 'How many');
        if (n == null) return;
        const names = Array.isArray(e.item) ? (e.item as string[]) : [String(e.item)];
        const cat = catalogItem(ctx.data, names[0] as string);
        const mult = typeof e.worthMult === 'number' ? e.worthMult : 1;
        out.finds.push({
          kind: 'item', source, item: names[0], qty: n, ...(typeof cat?.cost === 'number' ? { worth: cat.cost * mult } : {}),
          ...(names.length > 1 ? { options: names } : {}), ...(mult !== 1 ? { worthMult: mult } : {}), text: text || `${n} × ${names.join(' or ')} found.`,
        });
      } else if ('gem' in e) {
        const n = amountOf(e.qty ?? 1, `${id}.q`, 'How many');
        if (n == null) return;
        const v = amountOf(typeof e.value === 'string' && /^\d+$/.test(e.value) ? Number(e.value) : e.value, `${id}.v`, 'Value of one');
        if (v == null) return;
        out.finds.push({ kind: 'item', source, item: String(e.gem), qty: n, worth: v, gem: true, text: `${n > 1 ? `${n} × ` : ''}${e.gem}, worth ${v} gc${n > 1 ? ' each' : ''}.` });
      } else if ('xp' in e) {
        const n = amountOf(e.xp, id, 'Experience');
        if (n == null) return;
        const uid = e.to === 'leader' ? leaderUid(ctx) : undefined;
        out.finds.push({ kind: 'exp', source, amount: n, ...(uid != null ? { uid } : {}), text: text || `${n} experience.` });
      } else if ('perk' in e) {
        const hero = e.hero ? heroUid(e.hero) : undefined;
        out.perks.push({ id: String(e.perk), text, ...(e.unique ? { unique: true } : {}), ...(hero != null ? { uid: hero } : {}), ...(e.explore ? { explore: e.explore as LocPerk['explore'] } : {}) });
        out.finds.push({ kind: 'note', source, text });
      } else if ('note' in e) {
        out.finds.push({ kind: 'note', source, text: String(e.note) });
      } else if ('miss' in e || 'lose' in e) {
        const uid = heroUid(e.miss ?? e.lose);
        out.finds.push({ kind: 'note', source, ...(uid != null ? { uid } : {}), act: 'lose' in e ? 'lose' : 'miss', text });
      } else if ('artefact' in e) {
        const t = roll(id, 'Roll a D6 on the Magical Artefacts table', 'D6');
        if (t == null) return;
        const art = ctx.data.PB_ARTEFACTS[t - 1];
        if (art) out.finds.push({ kind: 'item', source, item: art[0], qty: 1, text: `${art[0]}: ${art[1]} (a campaign has each only once: roll again if someone has it).` });
      }
    });
  };

  const run = (steps: Step[], path: string): void => {
    steps.forEach((s, i) => {
      if (blocked) return;
      const id = `${path}.${i}`;
      if (Array.isArray(s.do) && !s.q && !s.if && !s.by && !s.each) { effects(s.do as Step[], `${id}.d`); return; }
      if (s.q === 'hero') {
        const a = answers[id];
        const none = a === 'none' && s.optional;
        if (none || (typeof a === 'number' && heroes.includes(a))) { values[String(s.as)] = none ? null : (a as number); return; }
        if (a !== undefined) out.problems.push('That is not one of your Heroes.');
        ask({ id, kind: 'hero', label: String(s.label), ...(s.optional ? { optional: true } : {}) });
      } else if (s.q === 'choice') {
        const opts = s.options as { id: string; label: string }[];
        const a = answers[id];
        if (typeof a === 'string' && opts.some((o) => o.id === a)) { values[String(s.as)] = a; return; }
        if (a !== undefined) out.problems.push('Pick one of the choices.');
        ask({ id, kind: 'choice', label: String(s.label), options: opts });
      } else if (s.q === 'pass') {
        const auto = (s.auto as string[] | undefined)?.some((t) => tags.includes(t));
        const a = auto ? true : answers[id];
        if (typeof a !== 'boolean') { if (a !== undefined) out.problems.push('Answer yes or no.'); ask({ id, kind: 'pass', label: String(s.label) }); return; }
        run((a ? s.pass : s.fail) as Step[] ?? [], `${id}.${a ? 'p' : 'f'}`);
      } else if (s.q === 'roll') {
        const t = roll(id, String(s.label ?? 'Roll'), String(s.expr), !!s.dice);
        if (t == null) return;
        if (s.as) values[String(s.as)] = answers[id] as Answer;
        const rows = (s.table as { on: number[]; do: Step[] }[] | undefined) ?? [];
        const row = rows.findIndex((r) => r.on.includes(t));
        if (rows.length && row >= 0) effects(rows[row]!.do, `${id}.t${row}`);
      } else if ('by' in s) {
        const tag = Object.keys(s).filter((k) => k !== 'by' && k !== 'else').find((k) => tags.includes(k));
        run((tag ? s[tag] : s.else) as Step[] ?? [], `${id}.${tag ?? 'else'}`);
      } else if ('if' in s) {
        const c = s.if as { as: string; eq?: number; is?: string; set?: boolean; double?: boolean };
        const v = values[c.as] ?? null;
        const yes = c.set != null ? (typeof v === 'number') === c.set
          : c.is != null ? v === c.is
            : c.double != null ? (Array.isArray(v) && new Set(v).size < v.length) === c.double
              : c.eq != null ? total(v ?? undefined) === c.eq : false;
        if (yes) { if (Array.isArray(s.do)) effects(s.do as Step[], `${id}.d`); if (Array.isArray(s.then)) run(s.then as Step[], `${id}.t`); }
        else if (Array.isArray(s.else)) run(s.else as Step[], `${id}.e`);
      } else if ('each' in s) {
        (s.each as { on: number; do: Step[] }[]).forEach((e, j) => {
          if (blocked) return;
          const what = e.do.map((x) => (x.item ? (Array.isArray(x.item) ? (x.item as string[]).join(' or ') : String(x.item)) : x.gem ? String(x.gem) : x.wyrd ? 'wyrdstone' : x.artefact ? 'a magical artefact' : 'the item')).join(', ');
          const t = roll(`${id}.${j}`, `Roll a D6 for ${what} (found on ${e.on}+)`, 'D6', false, e.on);
          if (t != null && t >= e.on) effects(e.do, `${id}.${j}.d`);
        });
      }
    });
  };

  run(rules, 's');
  out.done = !blocked;
  return out;
}

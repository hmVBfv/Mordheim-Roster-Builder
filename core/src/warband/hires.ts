/* Hiring from the Hire screen (phase 3d, mockup docs/mockups/hire.html).
   New logic around the Roster Builder's own actions (hireHS, hireDP,
   setHsOption): why someone may not join, in words, and hiring with the
   option or persona chosen beforehand. The Roster Builder offered only those
   who may join and asked for the option afterwards.

   Rulebook p. 147, as corrected by the official errata (Ultimate FAQ, Hired Swords):
   "Hired Swords do not count towards the maximum number of warriors or
   Heroes a warband may have on its roster"; "you can only have one of each
   type of Hired Sword in your warband". A few take a Hero's place all the
   same (`slot` in the data, e.g. by their own rules). */
import type { HireEntry } from '../data/types.ts';
import type { WarbandState } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { totalHeroes } from '../rules/costs.ts';
import { dpCount, dpEligibility, dpGradeAllowed, hireEligibility, hsCount, hsGradeAllowed, hsPersonasAllowed } from '../rules/hire.ts';
import { hireDP, hireHS, setHsOption } from './hiring.ts';

export type HireKind = 'hs' | 'dp';

const tableOf = (ctx: Ctx, kind: HireKind) => (kind === 'hs' ? ctx.data.HIREDSWORDS : ctx.data.DRAMATIS);

/** The entry of a Hired Sword or Dramatis Persona, or null. */
export function hireEntry(ctx: Ctx, kind: HireKind, key: string): HireEntry | null {
  return tableOf(ctx, kind)[key] ?? null;
}

/** What has to be chosen when he is hired: his weapons (`opts`) or which
    of the characters he may be (`personas`, those this warband may take);
    null when nothing. */
export function hireChoices(ctx: Ctx, kind: HireKind, key: string): { label: string; choices: string[] } | null {
  const e = hireEntry(ctx, kind, key);
  if (!e) return null;
  if (e.personas?.length) {
    const names = hsPersonasAllowed(ctx, e).map((p) => p.name);
    return names.length > 1 ? { label: 'Which one', choices: names } : null;
  }
  if (e.opts?.choices?.length) return { label: e.opts.label || 'Option', choices: [...e.opts.choices] };
  return null;
}

/** Why he may not join this warband now, or ''. `opt` is the choice of
    hireChoices, if it asks for one. Gold is not a reason, as for recruits:
    the roster warns when the warband spends more than it has. */
export function hireProblem(ctx: Ctx, kind: HireKind, key: string, opt?: string): string {
  const e = hireEntry(ctx, kind, key);
  if (!e) return 'not in the rules data';
  if (!(kind === 'hs' ? hsGradeAllowed(ctx, e.grade) : dpGradeAllowed(ctx, e.grade))) return `grade ${e.grade} is not played by this warband (house rule)`;
  const el = kind === 'hs' ? hireEligibility(ctx) : dpEligibility(ctx);
  const blocked = el.blocked.find((b) => b.key === key);
  if (blocked || !el.allowed.some((a) => a.key === key)) return blocked?.reason || 'not available to this warband';
  if ((kind === 'hs' ? hsCount(ctx, key) : dpCount(ctx, key)) >= 1) {
    return kind === 'hs' ? 'already with the warband: one of each Hired Sword' : 'already with the warband';
  }
  const max = Number(houseRules(ctx.s).heroes) || 6;
  if (kind === 'hs' && e.slot && totalHeroes(ctx) >= max) return `he takes a Hero’s place, and the warband has its ${max} Heroes`;
  const ch = hireChoices(ctx, kind, key);
  if (ch && !(opt && ch.choices.includes(opt))) return `choose ${ch.label === 'Which one' ? 'which one' : ch.label.toLowerCase()} first`;
  return '';
}

/** Hires him with the choice made, at his fee (the interface books it after
    the first battle). Nothing changes when hireProblem names a reason. */
export function hire(ctx: Ctx, kind: HireKind, key: string, opt?: string): WarbandState {
  if (hireProblem(ctx, kind, key, opt)) return ctx.s;
  const s = kind === 'hs' ? hireHS(ctx, key) : hireDP(ctx, key);
  if (s === ctx.s || !opt) return s;
  const list = (kind === 'hs' ? s.hired : s.dp) ?? [];
  const rec = list[list.length - 1]!;
  return setHsOption(ctxOf(ctx.data, s), rec.uid, opt);
}

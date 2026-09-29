/* The canonical form of a loaded warband. The legacy app reached it as a
   side effect of rendering (campState, xpLedger, HR, the persona select);
   core does it explicitly, once, e.g. after loading a save. */
import type { WarbandState } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { entryOf, hsPersona, hsPersonasAllowed } from '../rules/hire.ts';
import { campState } from './log.ts';
import { rememberUids, update, type WarbandDraft } from './update.ts';

export function normalizeState(ctx: Ctx): WarbandState {
  return update(ctx, (d, c) => {
    rememberUids(d);
    const camp = campState(d);
    if (!Array.isArray(camp.xp)) camp.xp = [];
    d.house = houseRules(d as WarbandState);
    fixPersonas(d, c);
  });
}

/** A character with personas always has one chosen that this warband may
    take; an unknown or disallowed choice falls back to the first allowed.
    Run whenever what is allowed may have changed (load, subtype, choice). */
export function fixPersonas(d: WarbandDraft, c: Ctx): void {
  for (const rec of [...(d.hired ?? []), ...(d.dp ?? [])]) {
    const e = entryOf(c, rec);
    if (!e?.personas) continue;
    const allowed = hsPersonasAllowed(c, e);
    if (!allowed.length) continue;
    const cur = hsPersona(c, rec, e);
    const name = cur && allowed.some((p) => p.name === cur.name) ? cur.name : allowed[0]?.name;
    if (name !== undefined && rec.opt !== name) rec.opt = name;
  }
}

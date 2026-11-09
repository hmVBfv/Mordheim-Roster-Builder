/* Who takes part in the next battle (wish of 9.11.2026). A unit can be marked as missing the next battle, the next N battles (the same count
   injuries use, `miss`), or as staying out until it is switched back (`sitsOut`). A unit that depends on another (`needs`: the Beasthounds on the
   Beastmaster, the Scarecrows on the Liche or the Necromancer, the Sabretusks on the Mountain Guide, the Wolves on the Wulfen) stays behind where
   none of its masters is on the roster or all of them miss the battle – worked out from the roster, never stored. Whoever stays out still counts in
   the rating and the value of the warband. */
import type { Model } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { unitDef } from './lookup.ts';

export interface Participation {
  takesPart: boolean;
  /** What to tell: "Takes part in the next battle", "Misses the next 2 battles", "Stays behind: no Beastmaster in the warband" … */
  text: string;
  /** Marked by hand or by an injury, as opposed to staying behind because of another unit. */
  own: boolean;
}

const battles = (n: number) => (n === 1 ? 'next battle' : `next ${n} battles`);

/** Is he out by what is marked on him? */
function ownText(m: Model): string | null {
  const n = Number(m.miss) || 0;
  if (n > 0) return `Misses ${battles(n)}`;
  if (m.sitsOut) return 'Not taking part until switched back';
  return null;
}

export function participation(ctx: Ctx, m: Model): Participation {
  const own = ownText(m);
  if (own) return { takesPart: false, text: own, own: true };
  const needs = unitDef(ctx, m.uid_def)?.needs;
  if (needs?.length) {
    const names = needs.map((id) => unitDef(ctx, id)?.name ?? id);
    const masters = ctx.s.models.filter((x) => needs.includes(x.uid_def));
    if (masters.length === 0) return { takesPart: false, text: `Stays behind: no ${names.join(' or ')} in the warband`, own: false };
    if (masters.every((x) => ownText(x))) {
      const who = [...new Set(masters.map((x) => unitDef(ctx, x.uid_def)?.name ?? x.uid_def))];
      return { takesPart: false, text: `Stays behind: the ${who.join(' and the ')} ${who.length === 1 ? 'misses' : 'miss'} the battle`, own: false };
    }
  }
  return { takesPart: true, text: 'Takes part in the next battle', own: false };
}

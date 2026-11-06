/* Intended difference (docs/behaviour-changes.md, "Aufgewertete Waffe nicht doppelt gezählt", report #211): a weapon that carries an upgrade
   with a line of its own ("Dagger (Gromril)") is that line in core; legacy counts it once more among the plain copies ("2× Dagger" and
   "Dagger (Gromril)"). The equipment lines, the Tabletop Simulator cards, the readable text and the fallen's tally of a state where a model
   carries such an upgrade are not compared; the rest of the export report is. */
import * as core from '../../src/index.ts';
import type { Ctx } from '../../src/index.ts';

export function hasCountedUpgrade(ctx: Ctx): boolean {
  return ctx.s.models.some((m) => Object.entries(m.rare ?? {}).some(([de, e]) => !core.inlineUpgradeActive(ctx, de) && !!ctx.data.UPGRADES[de]?.mult && !!e.on
    && (!!e.also || (Number(e.q) || 1) <= 1) && core.upgradeSlots(m, de).some((s) => !!s.on)))
    || (ctx.s.fallen ?? []).some((f) => Object.keys(f.m.rare ?? {}).some((de) => !!ctx.data.UPGRADES[de]?.mult));
}

/** The export report without the parts that count weapon copies, for a state where that is an intended difference. */
export function withoutCountedLines(report: unknown, counted: boolean): unknown {
  if (!counted) return report;
  const { text, tts, eq, fallen, ...rest } = report as Record<string, unknown>;
  void tts; void eq; void fallen;
  return { ...rest, text: { save: (text as { save: unknown }).save } };
}

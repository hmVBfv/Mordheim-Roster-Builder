/* What a warband takes off this device (phase 3e): the Roster Builder's
   exports, worked out by core – the readable text (which carries the save
   and imports back), the tool file, the Tabletop Simulator cards and the
   official roster sheet as a PDF. Kept apart from React to be tested. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';

/** One model's card for Tabletop Simulator: its Name box and its
    Description box, colour tags included (legacy js/tts.js). */
export interface TtsCard {
  /** Anchor on the export screen (`tts-<uid>`, `tts-<uid>-<man>`, `tts-<hire uid>`). */
  id: string;
  /** What the list shows. */
  label: string;
  /** For a man of a group: his group. */
  group: string | null;
  name: string;
  text: string;
}

/** Every card: Heroes and groups as the roster lists them, each man of a
    group with his own name (the group's rules, his name – so the pieces on
    the table can be told apart), then the hired ones. */
export function ttsCards(ctx: core.Ctx): TtsCard[] {
  const out: TtsCard[] = [];
  for (const m of ctx.s.models) {
    const def = core.unitDef(ctx, m.uid_def);
    const label = m.name || def?.name || m.uid_def;
    const text = core.ttsText(ctx, m);
    out.push({ id: `tts-${m.uid}`, label, group: null, name: core.ttsName(ctx, m), text });
    if (!core.isHeroModel(ctx, m) && core.memberCount(m) > 1) {
      core.memberNames(ctx, m).forEach((who, i) => {
        out.push({ id: `tts-${m.uid}-${i}`, label: who, group: label, name: core.ttsNameFor(who, false), text });
      });
    }
  }
  for (const [list, table] of [[ctx.s.hired, ctx.data.HIREDSWORDS], [ctx.s.dp, ctx.data.DRAMATIS]] as const) {
    for (const rec of list ?? []) {
      const e = table[rec.key];
      if (!e) continue;
      // hired characters count as the notable sort: the Heroes' darker gold
      out.push({ id: `tts-${rec.uid}`, label: rec.name || e.name, group: null, name: core.ttsNameFor(rec.name || e.name, true), text: core.ttsTextHS(ctx, e, rec.name, rec) });
    }
  }
  return out;
}

/** A day as the file names write it, in the device's own time zone. */
export function today(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The readable roster and its file name (it ends in the save, so it
    imports back). */
export function readableText(ctx: core.Ctx, now: Date): { text: string; filename: string } {
  return { text: core.buildText(ctx), filename: `${core.stampedName(ctx, today(now))}.txt` };
}

/** The tool file: the save as the app writes it (format, gold in hand). */
export function toolFile(ctx: core.Ctx, appVersion: string): { json: string; filename: string } {
  return { json: JSON.stringify(core.writeSave(ctx, appVersion), null, 2), filename: `${core.safeName(ctx)}.json` };
}

/** The state an export is made from: tidied as on load. */
export function exportCtx(data: core.GameData, s: WarbandState): core.Ctx {
  return core.ctxOf(data, core.normalizeState(core.ctxOf(data, s)));
}

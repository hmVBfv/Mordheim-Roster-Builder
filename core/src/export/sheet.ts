/* The official roster sheet as PDF (legacy js/pdf.js): fills the
   freebooters.org template page by page — Heroes on the first page (six per
   page), Henchmen and vehicles on the second (seven per page), Hired Swords
   and Dramatis Personae on extra pages in the same layout, and the notes
   (skill and rule texts, injuries, house rules) at the foot.

   Core does not depend on pdf-lib and loads no files: the caller hands in the
   library and the template's bytes (docs/architecture.md, export/). */
import type { HireEntry, Profile } from '../data/types.ts';
import type { HireRecord, Model } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { dpRatingTotal, hsChosenEq, hsEqParts, hsEquipOn, hsExp, hsRatingTotal } from '../rules/hire.ts';
import { isHeroModel, totalLarge, totalModels, totalRating } from '../rules/costs.ts';
import { eqListFor, spellLabel, unitDef } from '../rules/lookup.ts';
import { aDisp, effProfile, isLeaderModel, maxInfo } from '../rules/profile.ts';
import { svLabel, svOfEntry, svOfModel } from '../rules/saves.ts';
import { enItem, enRules, eqDisplayParts, houseDeviations, markRulesFor, skillText } from './rulesText.ts';
import { leaderRuleText } from '../rules/abilities.ts';
import { safeName } from './text.ts';

/* ---- the part of pdf-lib this uses ---- */
export interface PdfFont { widthOfTextAtSize(text: string, size: number): number }
export interface PdfPage {
  drawText(text: string, opts: { x: number; y: number; size: number; font: PdfFont }): void;
  drawRectangle(opts: { x: number; y: number; width: number; height: number; color: unknown }): void;
}
export interface PdfDoc {
  embedFont(name: unknown): Promise<PdfFont>;
  copyPages(src: unknown, indices: number[]): Promise<PdfPage[]>;
  addPage(page: PdfPage): unknown;
  save(): Promise<Uint8Array>;
}
export interface PdfLib {
  PDFDocument: { load(bytes: Uint8Array): Promise<unknown>; create(): Promise<PdfDoc> };
  StandardFonts: { Helvetica: unknown; HelveticaBold: unknown };
  rgb(r: number, g: number, b: number): unknown;
}

/** Positions on the template (data/sheet.json). */
interface SheetLayout {
  H: number;
  statX: number[];
  heroTops: number[];
  henTops: number[];
  heroXP: { size?: number; rows: number[]; xs: number[] };
  henXP: { size?: number; top: number; xs: number[] };
}

const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

/** The warband's type with its subtype, e.g. "Middenheim Mercenaries". */
export function defaultWarbandName(ctx: Ctx): string {
  const wb = ctx.s.wb ? ctx.data.WARBANDS[ctx.s.wb] : undefined;
  if (!wb) return 'Warband';
  const sub = ctx.s.subtype && wb.subtypes ? (wb.subtypes.find((x) => x.key === ctx.s.subtype) || { name: '' }).name : '';
  return sub ? `${sub} ${wb.name}` : wb.name;
}

/** Fills the official sheet. Returns the PDF's bytes and a file name. */
export async function buildOfficialSheet(ctx: Ctx, PDFLib: PdfLib, template: Uint8Array): Promise<{ bytes: Uint8Array; filename: string }> {
  const s = ctx.s;
  const SHEET = ctx.data.SHEET as unknown as SheetLayout;
  const { PDFDocument, StandardFonts } = PDFLib;

  const txt = (pg: PdfPage, f: PdfFont, v: unknown, x: number, top: number, size: number, opt: { center?: boolean; right?: boolean } = {}) => {
    if (v == null || v === '') return;
    const t = String(v);
    pg.drawText(t, { x: opt.center ? x - f.widthOfTextAtSize(t, size) / 2 : (opt.right ? x - f.widthOfTextAtSize(t, size) : x), y: SHEET.H - top, size, font: f });
  };
  const wrap = (pg: PdfPage, f: PdfFont, v: string, x: number, top: number, w: number, size: number, lh: number, maxLines?: number) => {
    if (!v) return;
    const words = String(v).split(/\s+/);
    let line = '', n = 0;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (f.widthOfTextAtSize(t, size) > w && line) {
        txt(pg, f, line, x, top + n * lh, size); n++; line = wd;
        if (maxLines && n >= maxLines) return;
      } else line = t;
    }
    if (line && (!maxLines || n < maxLines)) txt(pg, f, line, x, top + n * lh, size);
  };
  const wrapCount = (pg: PdfPage, f: PdfFont, v: string, x: number, top: number, w: number, size: number, lh: number) => {
    if (!v) return 0;
    const words = String(v).split(/\s+/);
    let line = '', n = 0;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (f.widthOfTextAtSize(t, size) > w && line) { txt(pg, f, line, x, top + n * lh, size); n++; line = wd; } else line = t;
    }
    if (line) { txt(pg, f, line, x, top + n * lh, size); n++; }
    return n;
  };
  const stats = (pg: PdfPage, f: PdfFont, p: Record<string, unknown> | null | undefined, top: number, size: number, sv?: string | null) => {
    STATS.forEach((key, i) => txt(pg, f, (p && p[key] !== undefined) ? p[key] : '', SHEET.statX[i] as number, top, size, { center: true }));
    if (sv !== undefined && sv !== null) txt(pg, f, sv, SHEET.statX[9] as number, top, size, { center: true });
  };
  const xpBoxes = (pg: PdfPage, xp: unknown, blockTop: number, cfg: { size?: number; xs: number[] }, rowTops: number[]) => {
    if (!xp || (xp as number) <= 0) return;
    let n = 0;
    const sz = cfg.size || 6.6, ins = 1.1;
    for (const rt of rowTops) for (const x of cfg.xs) {
      if (n >= (xp as number)) return;
      pg.drawRectangle({ x: x - sz / 2 + ins, y: SHEET.H - (blockTop + rt) - sz + ins, width: sz - 2 * ins, height: sz - 2 * ins, color: PDFLib.rgb(0, 0, 0) });
      n++;
    }
  };
  /** Equipment of ONE man of a group. */
  const eqPerModel = (m: Model) => {
    const def = unitDef(ctx, m.uid_def);
    const out: string[] = [];
    const q = Math.max(1, Number(m.qty) || 1);
    if (!def) return out;
    if (def.gear) def.gear.forEach((g) => out.push(g));
    if (def.eq) {
      const list = eqListFor(ctx, def) ?? {};
      for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
        const tot = Number((m.eq || {})[nm]) || 0;
        if (!tot) continue;
        const per = Math.max(1, Math.round(tot / q));
        out.push(per > 1 ? enItem(ctx.data, nm) + ' ×' + per : enItem(ctx.data, nm));
      }
    }
    return out;
  };

  const tpl = await PDFDocument.load(template);
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);

  const NOTES = new Map<string, string>();
  // by the unit's place in the warband's list, not by recruitment order (a
  // Marauder Chieftain prints before a Seer hired earlier); stable otherwise
  const order = (s.wb && ctx.data.WARBANDS[s.wb] && ctx.data.WARBANDS[s.wb]!.units) || [];
  const orderIdx = (m: Model) => { const i = order.findIndex((u) => u.id === m.uid_def); return i < 0 ? order.length : i; };
  const byOrder = (a: Model, b: Model) => orderIdx(a) - orderIdx(b);
  const heroes = s.models.filter((m) => isHeroModel(ctx, m)).sort(byOrder);
  const hench = s.models.filter((m) => !isHeroModel(ctx, m) && !unitDef(ctx, m.uid_def)?.vehicle).sort(byOrder);
  const veh = s.models.filter((m) => unitDef(ctx, m.uid_def)?.vehicle).sort(byOrder);
  const extra: { rec: HireRecord; e: HireEntry | undefined; kind: string }[] = [
    ...(s.dp || []).map((d) => ({ rec: d, e: ctx.data.DRAMATIS[d.key], kind: 'Dramatis Personae' })),
    ...(s.hired || []).map((h) => ({ rec: h, e: ctx.data.HIREDSWORDS[h.key], kind: 'Hired Sword' })),
  ];

  const wbDef = s.wb ? ctx.data.WARBANDS[s.wb] : undefined;
  const wbName = wbDef ? wbDef.name : '';
  const sub = s.subtype && wbDef && wbDef.subtypes ? (wbDef.subtypes.find((x) => x.key === s.subtype) || { name: '' }).name : '';
  const wbType = wbName + (sub ? ' (' + sub + ')' : '');

  /* ---- Heroes: page 1 and more ---- */
  const heroPages = Math.max(1, Math.ceil(heroes.length / 6));
  for (let pi = 0; pi < heroPages; pi++) {
    const [pg] = await doc.copyPages(tpl, [0]) as [PdfPage];
    doc.addPage(pg);
    txt(pg, fb, s.name || defaultWarbandName(ctx), 180, 50, 11);
    txt(pg, f, wbType, 447, 50, 9);
    if (pi === 0) {
      txt(pg, f, (s.stash && s.stash.gold) || 0, 106, 83, 9);
      txt(pg, f, ((s.stash && s.stash.wyrd) || 0) + ' wyrdstone', 88, 100, 8);
      const gx = s.models.reduce((t, m) => t + (((m.exp as unknown as number) || 0) * ((m.qty as unknown as number) || 1)), 0);
      txt(pg, f, gx, 357, 78, 9, { right: true });
      // Large creatures are worth 20 INSTEAD of 5, so the members ×5 line
      // leaves them out and the lines add up to the rating
      const lg = totalLarge(ctx);
      txt(pg, f, totalModels(ctx) - lg, 233, 90, 8, { center: true });
      txt(pg, f, (totalModels(ctx) - lg) * 5, 357, 90, 9, { right: true });
      txt(pg, f, lg, 264, 101, 8, { center: true });
      txt(pg, f, lg * 20, 357, 101, 9, { right: true });
      txt(pg, f, hsRatingTotal(ctx), 357, 112, 9, { right: true });
      txt(pg, f, dpRatingTotal(ctx), 357, 124, 9, { right: true });
      txt(pg, fb, totalRating(ctx), 357, 139, 11, { right: true });
      const items = ((s.stash && s.stash.items) || []).map((i) => (typeof i === 'string' ? i : (i.name || ''))).filter(Boolean);
      wrap(pg, f, items.join(', '), 420, 76, 148, 6, 7, 10);
    }
    heroes.slice(pi * 6, pi * 6 + 6).forEach((m, i) => {
      const T = SHEET.heroTops[i] as number, def = unitDef(ctx, m.uid_def);
      txt(pg, fb, m.name || def?.name, 79, T + 10, 9);
      txt(pg, f, def?.name, 69, T + 24, 8);
      const sk = (def?.sk || []).map((x) => String(x).toLowerCase());
      ([['combat', 44], ['shooting', 72], ['academic', 102], ['strength', 135], ['speed', 164]] as const).forEach(([k, x]) => {
        if (sk.includes(k)) txt(pg, fb, 'x', x, T + 37, 7, { center: true });
      });
      if (def?.sksp || (def?.sk || []).some((x) => !['combat', 'shooting', 'academic', 'strength', 'speed'].includes(String(x).toLowerCase()))) {
        txt(pg, fb, 'x', 189, T + 37, 7, { center: true });
      }
      const p = (effProfile(ctx, m) || {}) as Profile;
      const pp: Record<string, unknown> = Object.assign({}, p);
      pp.A = aDisp(ctx, m, p);
      stats(pg, f, pp, T + 65, 9, svLabel(svOfModel(ctx, m)));
      const mi = maxInfo(ctx, m);
      if (mi && mi.prof) stats(pg, f, mi.prof as Record<string, unknown>, T + 75, 6.5);
      wrap(pg, f, eqDisplayParts(ctx, m).join(', '), 222, T + 16, 170, 5.5, 6.5, 5);
      const inj = (m.inj || []).map((j) => (j.name || j.code) as string);
      inj.forEach((t, n) => { if (n < 6) wrap(pg, f, t, 220, T + 58 + n * 10.5, 28, 5, 5, 2); });
      const isLeader = isLeaderModel(ctx, m);
      const mk = markRulesFor(ctx, m);
      mk.forEach((x) => NOTES.set(x[0], x[1]));
      const sp = [...(isLeader ? ['Leader'] : []), ...mk.map((x) => x[0]), ...(m.skills || []), ...((m.spells || []).map((x) => spellLabel(x.name)))];
      sp.forEach((nm) => { const t = skillText(ctx.data, nm); if (t) NOTES.set(nm, t); });
      if (isLeader) NOTES.set('Leader', leaderRuleText());
      wrap(pg, f, sp.join(', '), 400, T + 16, 172, 6, 7, 5);
      txt(pg, fb, m.exp || 0, 546, T + 90, 10, { center: true });
      xpBoxes(pg, m.exp || 0, T, SHEET.heroXP, SHEET.heroXP.rows);
    });
  }

  /* ---- Henchmen: page 2 and more, then Hired Swords and Dramatis Personae ---- */
  const allHen = [...hench, ...veh];
  const henPages = Math.max(1, Math.ceil(allHen.length / 7));
  const exPages = Math.ceil(extra.length / 7);
  for (let pi = 0; pi < henPages + exPages; pi++) {
    const [pg] = await doc.copyPages(tpl, [1]) as [PdfPage];
    doc.addPage(pg);
    if (pi >= henPages) {
      const slice = extra.slice((pi - henPages) * 7, (pi - henPages) * 7 + 7);
      slice.forEach((x, i) => {
        const T = SHEET.henTops[i] as number, e = x.e;
        if (!e) return;
        txt(pg, fb, (x.rec.name || e.name), 79, T + 10, 9);
        txt(pg, f, e.name, 69, T + 23, 8);
        const kw = x.kind === 'Hired Sword' ? ['Hired', 'Sword'] : ['Dramatis', 'Personae'];
        txt(pg, f, kw[0], 186, T + 19, 5.5);
        txt(pg, f, kw[1], 186, T + 25, 5.5);
        stats(pg, f, (e.profile || {}) as Record<string, unknown>, T + 51, 9, svLabel(svOfEntry(ctx, e, x.rec)));
        const profile2 = e.profile2 as { p?: Record<string, unknown> } | undefined;
        if (e.pair && profile2) stats(pg, f, profile2.p || {}, T + 60, 6.5);
        else if (e.race && ctx.data.MAXPROF[e.race]) stats(pg, f, ctx.data.MAXPROF[e.race] as Record<string, unknown>, T + 60, 6.5);
        let eq = hsChosenEq(ctx, x.rec, e);
        if (hsEquipOn(ctx)) { const ex2 = hsEqParts(ctx, x.rec); if (ex2.length) eq += ', ' + ex2.join(', '); }
        wrap(pg, f, eq, 222, T + 15, 170, 5.5, 6.5, 4);
        const allSk = [...((e.skills as string[] | undefined) || []), ...((x.rec.skills) || [])];
        allSk.forEach((nm) => { const t = skillText(ctx.data, nm, e); if (t) NOTES.set(nm, t); });
        const ruleNames = enRules(ctx.data, e.sp || '').map((r) => r.split(':')[0]).filter(Boolean) as string[];
        wrap(pg, f, [...allSk, ...ruleNames].join(', '), 400, T + 15, 172, 6, 7, 6);
        const xpv = x.kind === 'Hired Sword' ? hsExp(x.rec) : 0;
        txt(pg, fb, e.noXP ? '—' : xpv, 487, T + 62, 9);
        if (!e.noXP && xpv > 0) xpBoxes(pg, xpv, T, SHEET.henXP, [SHEET.henXP.top]);
      });
      continue;
    }
    allHen.slice(pi * 7, pi * 7 + 7).forEach((m, i) => {
      const T = SHEET.henTops[i] as number, def = unitDef(ctx, m.uid_def);
      txt(pg, fb, m.name || def?.name, 79, T + 10, 9);
      txt(pg, f, def?.name, 69, T + 23, 8);
      txt(pg, f, m.qty || 1, 187, T + 23, 8);
      const p = (effProfile(ctx, m) || {}) as Profile;
      const pp: Record<string, unknown> = Object.assign({}, p);
      if (p && Object.keys(p).length) pp.A = aDisp(ctx, m, p);
      if (!def?.vehicle) stats(pg, f, pp, T + 51, 9, svLabel(svOfModel(ctx, m)));
      const mi = maxInfo(ctx, m);
      if (mi && mi.prof && !def?.vehicle) stats(pg, f, mi.prof as Record<string, unknown>, T + 60, 6.5);
      wrap(pg, f, eqPerModel(m).join(', '), 222, T + 15, 170, 5.5, 6.5, 4);
      const rules = enRules(ctx.data, def?.sp).map((r) => r.split(':')[0]);
      (m.skills || []).forEach((nm) => { const t = skillText(ctx.data, nm); if (t) NOTES.set(nm, t); });
      wrap(pg, f, [...(m.skills || []), ...rules].filter(Boolean).join(', '), 400, T + 15, 172, 6, 7, 6);
      txt(pg, fb, m.exp || 0, 487, T + 62, 9);
      xpBoxes(pg, m.exp || 0, T, SHEET.henXP, [SHEET.henXP.top]);
    });
    if (pi === henPages - 1) {
      txt(pg, fb, allHen.reduce((t, m) => t + ((m.exp as unknown as number) || 0), 0), 540, 558, 11, { center: true });
      const notes: string[] = [];
      [...NOTES.entries()].forEach(([nm, t]) => notes.push(nm + ': ' + String(t).replace(/<[^>]+>/g, '')));
      s.models.filter((m) => (m.inj || []).length).forEach((m) => notes.push('INJURY — ' + (m.name || unitDef(ctx, m.uid_def)?.name) + ': ' + (m.inj || []).map((j) => j.name || j.code).join(', ')));
      houseDeviations(ctx).forEach((x) => notes.push('HOUSE RULE — ' + x.label + ': ' + x.value));
      let ny = 586;
      for (const line of notes) {
        if (ny > 700) break;
        const used = wrapCount(pg, f, line, 44, ny, 520, 6, 7.2);
        ny += used * 7.2 + 1;
      }
    }
  }
  const bytes = await doc.save();
  return { bytes, filename: safeName(ctx) + '_official_sheet.pdf' };
}

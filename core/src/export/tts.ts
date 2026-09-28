/* Tabletop Simulator: name and description texts for model cards (legacy
   js/tts.js). TTS reads BBCode-style colour tags: [RRGGBB]text[-]. */
import type { HireEntry, UnitDef } from '../data/types.ts';
import type { HireRecord, Model } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { isHeroModel } from '../rules/costs.ts';
import { hsChosenEq, hsEqParts, hsEquipOn, hsPersona } from '../rules/hire.ts';
import { spellLabel, unitDef } from '../rules/lookup.ts';
import { aDisp, casterLore, effProfile, hsEffProfile, spellEffDiff, spellEffect } from '../rules/profile.ts';
import { svOfEntry, svOfModel } from '../rules/saves.ts';
import { attachedBlocks, enRules, eqDisplayParts, markRulesFor, rareDisplayParts, skillTextFor } from './rulesText.ts';

const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;
/** Heroes (and hired characters) in a darker gold than the rank and file. */
const TTS_GOLD_HERO = 'B8860B', TTS_GOLD_HENCH = 'E8C26B';

export function ttsNameFor(name: string, hero: boolean): string {
  return `[${hero ? TTS_GOLD_HERO : TTS_GOLD_HENCH}]${String(name || '').trim()}[-]`;
}

/** The model's name for the TTS Name box. */
export function ttsName(ctx: Ctx, m: Model): string {
  const def = unitDef(ctx, m.uid_def);
  const nm = (m.name || '').trim() || (def?.name as string);
  return `[${isHeroModel(ctx, m) ? TTS_GOLD_HERO : TTS_GOLD_HENCH}]${nm}[-]`;
}

/** The permanent armour save (armour and skills, no shields). */
function ttsSv(sv: number | null | undefined): string {
  return sv == null ? '-' : (sv + '+');
}

/** Mounts and attached creatures, with their own profile lines. */
export function ttsAttached(ctx: Ctx, def: UnitDef | null | undefined, m: Model | null | undefined): string {
  const blocks = attachedBlocks(ctx, def, m);
  if (!blocks.length) return '';
  return blocks.map((a) => {
    const q = (a.qty && a.qty > 1) ? ` ×${a.qty}` : '';
    const p = a.profile || {};
    const line = p && Object.keys(p).length ? STATS.map((x) => x + ' ' + String(p[x] !== undefined ? p[x] : '-')).join('   ') : '(no profile)';
    const note = a.note ? String(a.note).replace(/<\/?b>/g, '').replace(/<br\s*\/?>/gi, ' ').trim() : '';
    const noteLines = note ? note.split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean).map((x) => '• ' + x).join('\n') : '';
    return `\n[E8C26B]▸ ${a.label}${q}:[-]\n[7AD1A4]${line}[-]` + (noteLines ? `\n${noteLines}` : '');
  }).join('');
}

/** The description of a warband model: profile and save, special rules,
    skills, injuries, equipment, spells, mounts. */
export function ttsText(ctx: Ctx, m: Model): string {
  const def = unitDef(ctx, m.uid_def);
  const p = effProfile(ctx, m) || {};
  const hasProf = p && Object.keys(p).length > 0 && !def?.vehicle;
  const statline = hasProf ? (STATS.map((x) => x + ' ' + (x === 'A' ? String(aDisp(ctx, m, p)) : String(p[x] !== undefined ? p[x] : '-'))).join('   ')
    + '   Sv ' + ttsSv(svOfModel(ctx, m))) : '';
  const rules = enRules(ctx.data, def?.sp);
  markRulesFor(ctx, m).forEach((x) => rules.push(x[0] + ': ' + x[1]));
  (m.skills || []).forEach((sk) => { const t = skillTextFor(ctx, m, sk); rules.push(t ? `${sk}: ${t}` : sk); });
  (m.inj || []).forEach((j) => rules.push((ctx.data.INJEN[j.code as string] || j.name) as string));
  const rulesTxt = rules.length ? rules.map((r) => '• ' + r).join('\n') : 'None';
  const eq = eqDisplayParts(ctx, m).concat(rareDisplayParts(ctx, m));
  const eqTxt = eq.length ? eq.join(', ') : 'None';
  const spx = (m.spells || []).map((sp) => {
    const d = spellEffDiff(sp);
    const e = spellEffect(ctx, sp.name, casterLore(ctx, m));
    return `${spellLabel(sp.name)}${d != null ? ` (${d})` : ''}${e ? ': ' + e : ''}`;
  });
  const spLine = spx.length ? `\n[5ACFFF]Spells:[-]\n${spx.map((x) => '• ' + x).join('\n')}` : '';
  const miss = Number(m.miss) || 0;
  const missLine = miss > 0 ? `\n[FF6961]⚑ Misses next ${m.miss} game${(m.miss as number) > 1 ? 's' : ''}[-]` : '';
  const atLine = ttsAttached(ctx, def, m);
  const statBlock = statline ? `[7AD1A4]${statline}[-]${missLine}\n` : (missLine ? missLine.replace(/^\n/, '') + '\n' : '');
  return `${statBlock}[5ACFFF]Special Rules:[-]\n${rulesTxt}\n[5ACFFF]Equipment:[-] ${eqTxt}${spLine}${atLine}`;
}

/** The description of a Hired Sword or Dramatis Persona (`disp`: the name
    the player gave it). */
export function ttsTextHS(ctx: Ctx, hs: HireEntry, disp: string | null | undefined, rec: HireRecord | null | undefined): string {
  const sv = svOfEntry(ctx, hs, rec ?? undefined);
  const p = (rec && ctx.data.HIREDSWORDS[rec.key]) ? hsEffProfile(rec, hs) : (hs.profile || {});
  const ex = (rec && hsEquipOn(ctx)) ? hsEqParts(ctx, rec) : [];
  const pers = (rec && hs.personas) ? hsPersona(ctx, rec, hs) : null;
  const opt = (rec && rec.opt && !hs.personas) ? `\nChosen: ${rec.opt}` : (pers ? `\nPersona: ${pers.name}` : '');
  const xp = (rec && rec.exp) ? `\nXP: ${rec.exp}` : '';
  const adv = (rec && rec.adv && Object.keys(rec.adv).length) ? `\nAdvances: ${Object.entries(rec.adv).map(([k2, v]) => '+' + v + ' ' + k2).join(', ')}` : '';
  const sk = (rec && (rec.skills || []).length) ? `\nSkills: ${(rec.skills as string[]).join(', ')}` : '';
  const spl = (rec && (rec.spells || []).length) ? `\nSpells: ${(rec.spells ?? []).map((x) => spellLabel(x.name)).join(', ')}` : '';
  const psp = (pers && pers.sp) ? `\n${pers.sp}` : '';
  const extraEq = ex.length ? (', ' + ex.join(', ')) : '';
  const statline = STATS.map((x) => x + ' ' + String((p as Record<string, unknown>)[x] !== undefined ? (p as Record<string, unknown>)[x] : '-')).join('   ') + '   Sv ' + ttsSv(sv);
  const rules = String(hs.sp || '').replace(/<\/?b>/g, '').replace(/<br\s*\/?>/gi, ' ').split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean);
  const rulesTxt = rules.length ? rules.map((r) => '• ' + r).join('\n') : '• None';
  const title = (disp && disp !== hs.name) ? `${disp} — ${hs.name}` : hs.name;
  return `${title}  [Hired Sword · ${hs.grade}]\n${statline}${opt}${xp}${adv}${sk}${spl}\n\nEquipment: ${rec ? hsChosenEq(ctx, rec, hs) : hs.eq}${extraEq}${psp}\n\nSpecial Rules:\n${rulesTxt}`;
}

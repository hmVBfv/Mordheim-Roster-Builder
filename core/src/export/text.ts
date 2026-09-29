/* Text exports (legacy app.js exportState, buildText, wbTypeSlug, safeName,
   stampedName, rosterName, narrativeReport, campaignJSON,
   campaignTextReport).

   The readable text export carries its own save: the last line is
   `MORDHEIM-DATA: {…}`, so pasting the text back restores the warband. */
import type { Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { casualtyText, roundLabel, wbName } from '../rules/casualties.ts';
import { goldCurrent, isHeroModel, modelRating, modelTotalCost, modelUnitCost, totalRating, totalSpent } from '../rules/costs.ts';
import { activeDistrictEffects } from '../rules/districts.ts';
import { unitDef } from '../rules/lookup.ts';
import { casterLore, spellEffDiff } from '../rules/profile.ts';
import { spellLabel } from '../rules/lookup.ts';
import { characterRoster } from '../campaign/analysis.ts';
import { districtsAt, snapRows, stageSnapshots, totalsAt } from '../campaign/stages.ts';
import { districtName } from '../campaign/territory.ts';
import { eqDisplayParts, mutEN } from './rulesText.ts';

/** The save as exported: the state plus `goldNow`, the gold in hand as
    displayed, which an import adopts verbatim so later price changes can
    never shift a saved warband's gold. */
export function exportState(ctx: Ctx): WarbandState & { goldNow: number } {
  return Object.assign({}, ctx.s, { goldNow: goldCurrent(ctx) });
}

/** The roster's name for files and headers: what the player typed as the
    save name, else the warband's name. */
export function rosterName(ctx: Ctx, given?: string | null): string {
  return given || ctx.s.name || 'roster';
}

/** "Mercenaries_Middenheim": the warband type and subtype for file names. */
export function wbTypeSlug(ctx: Ctx): string {
  const wb = ctx.s.wb ? ctx.data.WARBANDS[ctx.s.wb] : undefined;
  if (!wb) return '';
  const sub = ctx.s.subtype && wb.subtypes ? (wb.subtypes.find((x) => x.key === ctx.s.subtype) || { name: '' }).name : '';
  return (wb.name + (sub ? ' ' + sub : '')).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
}

/** <given name>_<warband type>, or the type alone. */
export function safeName(ctx: Ctx, given?: string | null): string {
  const g = (given || ctx.s.name || '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
  const type = wbTypeSlug(ctx);
  const base = g || (type ? '' : 'mordheim-roster');
  return [base, type].filter(Boolean).join('_') || 'mordheim-roster';
}

/** A file name that says which warband, at what stage and when:
    <safeName>_<setup|battleN>_<YYYY-MM-DD>. */
export function stampedName(ctx: Ctx, today: string, given?: string | null): string {
  const parts = [safeName(ctx, given)];
  const c = ctx.s.campaign && ctx.s.campaign.on ? ctx.s.campaign : null;
  if (c) parts.push(Number(c.round) > 0 ? ('battle' + Number(c.round)) : 'setup');
  parts.push(today);
  return parts.join('_');
}

/** The readable roster (BattleScribe style), ending in the embedded save. */
export function buildText(ctx: Ctx, rosterNameGiven?: string | null): string {
  const s = ctx.s;
  const wb = s.wb ? ctx.data.WARBANDS[s.wb] : undefined;
  const spent = totalSpent(ctx), rating = totalRating(ctx);
  const def = (m: Model) => unitDef(ctx, m.uid_def);
  // promoted henchmen file under Heroes; a vehicle is equipment
  const heroes = s.models.filter((m) => isHeroModel(ctx, m) && !def(m)?.vehicle);
  const hench = s.models.filter((m) => !isHeroModel(ctx, m) && def(m)?.t === 'hen' && !def(m)?.vehicle);
  const vehicles = s.models.filter((m) => def(m)?.vehicle);
  const sum = (arr: Model[]) => ({
    gc: arr.reduce((t, m) => t + modelTotalCost(ctx, m), 0),
    r: arr.reduce((t, m) => t + modelRating(ctx, m) * (isHeroModel(ctx, m) ? 1 : (m.qty as unknown as number)), 0),
  });
  const hS = sum(heroes), nS = sum(hench), vS = sum(vehicles);
  const det = (m: Model) => {
    const d: string[] = [];
    if (m.exp) d.push(`${m.exp}× Experience`);
    if (m.mut && m.mut.length) d.push('Mutations: ' + m.mut.map((x) => mutEN(ctx.data, x)).join(', '));
    if (Number(m.miss) > 0) d.push(`OUT: misses next ${m.miss} game${(m.miss as number) > 1 ? 's' : ''}`);
    const adv = m.adv || {};
    const ord = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;
    const av = ord.filter((x) => adv[x]).map((x) => `+${adv[x]} ${x}`);
    if (av.length) d.push('Advances: ' + av.join(', '));
    if (m.skills && m.skills.length) d.push('Skills: ' + m.skills.join(', '));
    if (m.inj && m.inj.length) d.push('Injuries: ' + m.inj.map((j) => ctx.data.INJEN[j.code as string] || j.name).join(', '));
    const lore = casterLore(ctx, m);
    if (lore) {
      const sp = m.spells || [];
      const loreName = ctx.data.SPELLS[lore]?.name;
      if (sp.length) d.push('Spells (' + loreName + '): ' + sp.map((x) => { const dd = spellEffDiff(x); return spellLabel(x.name) + (dd != null ? ' (' + dd + ')' : ''); }).join(', '));
      else d.push('Magic: ' + loreName);
    }
    const eq = eqDisplayParts(ctx, m);
    if (eq.length) d.push('Equipment: ' + eq.join(', '));
    return d.length ? ': ' + d.join(', ') : '';
  };
  const named = (m: Model, title: string) => (m.name && m.name !== def(m)?.name) ? `${title} „${m.name}“` : title;
  const L: string[] = [];
  L.push(`${wb?.name} - ${rosterName(ctx, rosterNameGiven)} - [${rating} Warband Rating, ${spent} gc]`);
  L.push(`# ++ Warband ++ [${rating} Warband Rating, ${spent} gc]`);
  L.push(`## Heroes [${hS.r} Warband Rating, ${hS.gc} gc]`);
  for (const m of heroes) {
    const tnm = m.promoted ? `Hero ${def(m)?.name}` : (def(m)?.name as string);
    L.push(`${named(m, tnm)} [${modelUnitCost(ctx, m)} gc, ${modelRating(ctx, m)} Warband Rating]${det(m)}`);
  }
  L.push(`## Henchmen [${nS.r} Warband Rating, ${nS.gc} gc]`);
  for (const m of hench) {
    L.push(`${named(m, def(m)?.name as string)} [${modelTotalCost(ctx, m)} gc, ${modelRating(ctx, m) * (m.qty as unknown as number)} Warband Rating]:`);
    L.push(`• ${m.qty}× ${def(m)?.name} [${modelUnitCost(ctx, m)} gc, ${modelRating(ctx, m)} Warband Rating]${det(m)}`);
  }
  if (vehicles.length) {
    L.push(`## Vehicles [${vS.gc} gc]`);
    for (const m of vehicles) L.push(`${named(m, def(m)?.name as string)} [${modelTotalCost(ctx, m)} gc]${det(m)}`);
  }
  const st = s.stash || { wyrd: 0, gold: 0, items: [] };
  if ((st.wyrd || 0) || (st.gold || 0) || (st.items && st.items.length)) {
    L.push('## Stash / Store');
    if (st.wyrd) L.push(`• Wyrdstone shards: ${st.wyrd}`);
    if (st.gold) L.push(`• Gold in store: ${st.gold} gc`);
    (st.items || []).forEach((it) => L.push(`• ${it.qty}× ${it.name}`));
  }
  L.push('');
  L.push(Array(20).fill('—').join(' '));
  L.push('MORDHEIM-DATA: ' + JSON.stringify(exportState(ctx)));
  return L.join('\n');
}

/** A written account of the campaign, stage by stage: complete and specific
    enough to hand to someone (or a language model) to turn into a story. */
export function narrativeReport(ctx: Ctx): string {
  const s = ctx.s;
  const c = s.campaign ?? {};
  const L: string[] = [];
  L.push(`CAMPAIGN CHRONICLE — ${s.name || wbName(ctx, s.wb)} (${wbName(ctx, s.wb)})`);
  L.push(`Stage reached: ${roundLabel(c.round)}`);
  L.push('');
  const log = c.log || [], battles = (c.battles || []) as unknown as { round: number; opponents?: { name?: string; wb?: string }[]; district?: string; outcome?: string; notes?: string }[];
  const rounds = [...new Set([0, ...log.map((e) => e.round), ...battles.map((b) => b.round), c.round as number])].sort((a, b) => a - b);
  for (const r of rounds) {
    const evs = log.filter((e) => e.round === r);
    const bats = battles.filter((b) => b.round === r);
    const cas = (c.casualties || []).filter((x) => x.round === r);
    if (!evs.length && !bats.length && !cas.length) continue;
    L.push(`## ${roundLabel(r)}`);
    for (const b of bats) {
      const opp = b.opponents ?? [];
      const who = opp.length ? opp.map((o) => `${o.name || '?'}${o.wb ? ` of the ${wbName(ctx, o.wb)}` : ''}`).join(' and ') : 'an unnamed foe';
      L.push(`Battle against ${who}${b.district ? ` at ${districtName(ctx, b.district)}` : ''}${b.outcome ? `. Outcome: ${b.outcome}` : ''}.`);
      if (b.notes) L.push(`  Account: ${b.notes}`);
    }
    for (const x of cas) L.push(`  ${casualtyText(ctx, x)}`);
    // battles and casualties are written out above; stage markers are bookkeeping
    evs.filter((e) => !(e.data && e.data.casualtyId) && e.type !== 'battle' && e.type !== 'round').forEach((e) => L.push(`  ${e.text}`));
    const rows = snapRows(ctx, stageSnapshots(ctx)[String(r)]).filter((x) => x.alive);
    if (rows.length) L.push(`  Warband at the close of this stage: ${rows.map((x) => `${x.name} (${x.exp} XP)`).join(', ')}.`);
    const held = districtsAt(ctx, r);
    if (held.length) L.push(`  Districts held: ${held.map((x) => `${x.name} (${x.state})`).join(', ')}.`);
    const tt = totalsAt(ctx, r);
    if (tt) L.push(`  Warband rating ${tt.rating}, ${tt.models} warriors, ${tt.gold} gc in hand.`);
    L.push('');
  }
  const chars = characterRoster(ctx).filter((x) => x.events.length);
  if (chars.length) {
    L.push('## The warriors');
    for (const x of chars) {
      const fate = x.alive ? 'still standing' : (x.died != null ? `slain in ${roundLabel(x.died).toLowerCase()}` : 'no longer with the warband');
      L.push(`${x.name} — joined at ${x.joined != null ? roundLabel(x.joined).toLowerCase() : 'the outset'}, ${fate}.`
        + ` Kills: ${x.kills} (${x.killsByGrade.hero} heroes, ${x.killsByGrade.hench} henchmen), worth ${x.goldDestroyed} gc.`
        + ` Injuries suffered: ${x.injuries}.`
        + (x.curve.length ? ` Experience: ${x.curve.map((p) => `${roundLabel(p.round).toLowerCase()} ${p.exp}`).join(', ')}.` : ''));
    }
  }
  return L.join('\n');
}

/** The campaign part of the warband as JSON (the older campaign export). */
export function campaignJSON(ctx: Ctx): string {
  return JSON.stringify({ type: 'mordheim-campaign', wb: ctx.s.wb, name: ctx.s.name || '', campaign: ctx.s.campaign || { on: false, districts: {} } }, null, 2);
}

/** Districts held and their active effects, as plain text. */
export function campaignTextReport(ctx: Ctx): string {
  const cd = (ctx.s.campaign && ctx.s.campaign.districts) || {};
  const held = ctx.data.DISTRICTS.filter((d) => cd[d.id] && cd[d.id] !== 'none');
  const lines = ['MORDHEIM CAMPAIGN', 'Warband: ' + (ctx.s.name || '(unnamed)') + (ctx.s.wb ? ' [' + ctx.s.wb + ']' : ''), ''];
  if (!held.length) lines.push('No districts held.');
  else {
    const areas = [...new Set(held.map((d) => d.area))];
    for (const a of areas) {
      lines.push(String(a).toUpperCase());
      held.filter((d) => d.area === a).sort((x, y) => x.name.localeCompare(y.name))
        .forEach((d) => { lines.push('  ' + d.name + ' — ' + String(cd[d.id]).toUpperCase() + (d.hardFought ? ' (Hard Fought)' : '')); });
      lines.push('');
    }
  }
  const act = activeDistrictEffects(ctx);
  if (act.length) { lines.push('ACTIVE EFFECTS'); act.forEach((e) => lines.push('  • ' + e.district + ': ' + e.label)); }
  return lines.join('\n');
}

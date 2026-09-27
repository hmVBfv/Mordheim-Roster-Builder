/* Recording a battle and a casualty (legacy app.js battleSides, sideModels,
   openBattleForm … saveBattleForm, openCasForm … saveCasForm).

   Participants come from the campaign file when one is open, so attacker and
   victim can be picked from real rosters instead of typed; henchmen are
   listed man by man, and the Fallen too — saying who killed a warrior is
   exactly the moment he is no longer among the living.

   Legacy kept the half-filled forms in the save (S.campaign._draft, _cas);
   here a draft is a value of its own that the interface holds, and these
   functions take one and return a new one. */
import { produce } from 'immer';
import type { UnitDef } from '../data/types.ts';
import type { Casualty, CasualtySide, FallenRecord, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { ctxOf } from '../rules/context.ts';
import { wbName } from '../rules/casualties.ts';
import { addCasualtyOn, removeCasualtyOn, retypeCasualty } from '../warband/casualties.ts';
import { campState } from '../warband/log.ts';
import { update } from '../warband/update.ts';
import { addBattle, type BattleSide } from './chronicle.ts';
import { cfNew, type CampaignFile, type CampaignFileBattle } from './file.ts';
import { applyBattleTerritory, districtName, type WarbandAndFile } from './territory.ts';

/* ---- who fought ---- */

export interface SideOption { key: string; name: string; wb: string | null; mine?: true; cfId?: number }

/** Our warband and every other one in the campaign file. */
export function battleSides(ctx: Ctx, cf: CampaignFile | null): SideOption[] {
  const out: SideOption[] = [{ key: 'me', name: ctx.s.name || wbName(ctx, ctx.s.wb), wb: ctx.s.wb, mine: true }];
  if (cf) for (const w of cf.warbands) {
    // our own warband may sit in the file too; do not offer it twice
    if ((w.name || '').toLowerCase() === (ctx.s.name || '').toLowerCase() && w.wb === ctx.s.wb) continue;
    out.push({ key: 'cf' + w.id, name: w.name, wb: w.wb, cfId: w.id });
  }
  return out;
}

export function sideName(ctx: Ctx, cf: CampaignFile | null, key: string): string {
  return battleSides(ctx, cf).find((x) => x.key === key)?.name ?? '';
}

export function sideWb(ctx: Ctx, cf: CampaignFile | null, key: string): string {
  return battleSides(ctx, cf).find((x) => x.key === key)?.wb ?? '';
}

export interface SideModel { uid: number; idx: number; label: string; hero: boolean; dead?: true; fallenIdx?: number }

/** Every warrior of one side who could go down or put someone down,
    henchmen man by man, then the Fallen. */
export function sideModels(ctx: Ctx, cf: CampaignFile | null, key: string): SideModel[] {
  let models: Model[], fallen: FallenRecord[], wbKey: string | null = ctx.s.wb;
  if (key === 'me') { models = ctx.s.models; fallen = ctx.s.fallen || []; }
  else if (String(key).startsWith('cf')) {
    if (!cf) return [];
    const w = cf.warbands.find((x) => x.id === Number(String(key).slice(2)));
    if (!w || !w.roster) return [];
    models = w.roster.models || []; fallen = w.roster.fallen || [];
    wbKey = w.wb;
  } else return [];
  const defOf = (m: Model) => ((ctx.data.WARBANDS[wbKey as string] || { units: [] as UnitDef[] }).units || []).find((u) => u.id === m.uid_def) || ({} as Partial<UnitDef>);
  const out: SideModel[] = [];
  for (const m of models) {
    const def = defOf(m);
    const base = m.name || def.name || m.uid_def;
    const qty = Math.max(1, Number(m.qty) || 1);
    const hero = !!(m.promoted || def.t === 'hero');
    if (hero || qty === 1) out.push({ uid: m.uid, idx: 0, label: base, hero });
    else for (let i = 0; i < qty; i++) {
      const nm = (m.names && (m.names[i] || '').trim()) || `${def.name || base} ${i + 1}`;
      out.push({ uid: m.uid, idx: i, label: nm, hero: false });
    }
  }
  fallen.forEach((e, i) => {
    if (!e || !e.m) return;
    const def = defOf(e.m);
    out.push({ fallenIdx: i, uid: e.m.uid, idx: 0, dead: true, label: e.m.name || def.name || e.m.uid_def, hero: e.kind === 'hero' });
  });
  return out;
}

/** A side's warrior chosen in a form: `uid:idx`, or `f<fallen index>`. */
function pickFrom(opts: SideModel[], pick: string): SideModel | undefined {
  if (String(pick).charAt(0) === 'f') return opts.find((o) => o.dead && String(o.fallenIdx) === String(pick).slice(1));
  const [uid, idx] = String(pick).split(':');
  return opts.find((o) => !o.dead && String(o.uid) === uid && String(o.idx) === idx);
}

type PickedSide = Partial<CasualtySide> & { npc?: true; dead?: boolean; fallenIdx?: number };

/* ---- the battle form ---- */

export interface DraftSide { key: string; name: string; wb: string | null; outcome: string; [key: string]: unknown }
export interface DraftCasualty {
  id?: number;
  vSide: number | '' | 'env'; vPick: string; vName: string;
  aSide: number | '' | 'env'; aPick: string; aName: string;
  note: string;
}
export interface BattleDraft { editId?: number; round: number; district: string; notes: string; sides: DraftSide[]; cas: DraftCasualty[] }

const ourSideOf = (ctx: Ctx): DraftSide => ({ key: 'me', name: ctx.s.name || wbName(ctx, ctx.s.wb), wb: ctx.s.wb, outcome: '' });

/** An empty form for a new battle: our warband always fought. */
export function newBattleDraft(ctx: Ctx): BattleDraft {
  return { round: ctx.s.campaign?.round ?? 0, district: '', notes: '', sides: [ourSideOf(ctx)], cas: [] };
}

/** A recorded battle back in the form, with its casualties tied to their
    records so editing corrects them instead of writing a second set. */
export function battleDraftFor(ctx: Ctx, id: number): BattleDraft | null {
  const b = (ctx.s.campaign?.battles ?? []).find((x) => x.id === Number(id)) as (CampaignFileBattle | undefined);
  if (!b) return null;
  const draft: BattleDraft = {
    editId: b.id, round: b.round, district: b.district || '', notes: b.notes || '',
    sides: (b.sides && b.sides.length ? b.sides.map((x) => ({ ...x }) as DraftSide)
      : [{ ...ourSideOf(ctx), outcome: b.outcome || '' }]
        .concat((b.opponents || []).map((o) => ({ key: '', name: o.name || '', wb: o.wb || '', outcome: '' })))),
    cas: [],
  };
  const findSide = (who: PickedSide & { wbName?: string }): number | 'env' => {
    if (who && who.npc) return 'env';
    const i = draft.sides.findIndex((sd) => sd.key === 'me' ? who.uid != null
      : (sd.name || '').toLowerCase() === String((who && who.wbName) || '').toLowerCase());
    if (i >= 0) return i;
    const j = draft.sides.findIndex((sd) => sd.wb === (who && who.wb));
    return j >= 0 ? j : 0;
  };
  draft.cas = (ctx.s.campaign?.casualties ?? []).filter((x) => x.battleId === b.id).map((x) => ({
    id: x.id, vSide: findSide(x.victim), vPick: '', vName: x.victim.name || '',
    aSide: findSide(x.attacker), aPick: '', aName: x.attacker.name || '', note: x.note || x.detail || '',
  }));
  return draft;
}

export function draftIncludesUs(d: BattleDraft): boolean {
  return (d.sides || []).some((x) => x.key === 'me');
}

export function draftSetField(d: BattleDraft, f: 'round' | 'district' | 'notes', v: unknown): BattleDraft {
  return produce(d, (x) => { (x as unknown as Record<string, unknown>)[f] = v; });
}

/** Our warband back among the sides (first). */
export function draftAddSideMe(ctx: Ctx, d: BattleDraft): BattleDraft {
  if (draftIncludesUs(d)) return d;
  return produce(d, (x) => { x.sides.unshift(ourSideOf(ctx)); });
}

/** A warband from the campaign file, or (no key) someone not in it. */
export function draftAddSide(ctx: Ctx, cf: CampaignFile | null, d: BattleDraft, key: string): BattleDraft {
  if (!key) return produce(d, (x) => { x.sides.push({ key: '', name: '', wb: '', outcome: '' }); });
  if (d.sides.some((x) => x.key === key)) return d;
  const s0 = battleSides(ctx, cf).find((x) => x.key === key);
  return produce(d, (x) => { x.sides.push({ key, name: s0 ? s0.name : '', wb: s0 ? s0.wb : '', outcome: '' }); });
}

/** Removes a side and the casualties that name it; the last side stays.
    Our warband can be removed: then it is somebody else's battle. */
export function draftRemoveSide(d: BattleDraft, i: number): BattleDraft {
  if (d.sides.length <= 1) return d;
  return produce(d, (x) => {
    x.sides.splice(i, 1);
    x.cas = x.cas.filter((c) => c.vSide !== i && c.aSide !== i)
      .map((c) => ({ ...c, vSide: (c.vSide as number) > i ? (c.vSide as number) - 1 : c.vSide, aSide: (typeof c.aSide === 'number' && c.aSide > i) ? c.aSide - 1 : c.aSide }));
  });
}

export function draftSetSide(ctx: Ctx, cf: CampaignFile | null, d: BattleDraft, i: number, f: keyof DraftSide, v: string): BattleDraft {
  if (!d.sides[i]) return d;
  return produce(d, (x) => {
    const side = x.sides[i] as DraftSide;
    side[f] = v;
    if (f === 'key') {
      const s0 = battleSides(ctx, cf).find((y) => y.key === v);
      if (s0) { side.name = s0.name; side.wb = s0.wb; }
    }
  });
}

export function draftAddCasualty(d: BattleDraft): BattleDraft {
  return produce(d, (x) => { x.cas.push({ vSide: x.sides.length > 1 ? 1 : 0, vPick: '', vName: '', aSide: 0, aPick: '', aName: '', note: '' }); });
}

export function draftRemoveCasualty(d: BattleDraft, i: number): BattleDraft {
  return produce(d, (x) => { x.cas.splice(i, 1); });
}

/** Sets a field of a casualty row; a side is stored as a number ('' = none,
    'env' = the surroundings). */
export function draftSetCasualty(d: BattleDraft, i: number, f: keyof DraftCasualty, v: string): BattleDraft {
  if (!d.cas[i]) return d;
  return produce(d, (x) => {
    (x.cas[i] as unknown as Record<string, unknown>)[f] = (f === 'vSide' || f === 'aSide') && v !== 'env' ? (v === '' ? '' : Number(v)) : v;
  });
}

/** One row of the form as the side of a casualty record. */
function casSide(ctx: Ctx, cf: CampaignFile | null, d: BattleDraft, sideIdx: DraftCasualty['vSide'], pick: string, freeName: string): PickedSide {
  if (sideIdx === 'env') return { uid: null, name: 'The surroundings', wb: '', npc: true };
  const side = d.sides[sideIdx as number];
  if (!side) return { uid: null, name: freeName || '', wb: '' };
  if (pick) {
    const hit = pickFrom(sideModels(ctx, cf, side.key), pick);
    if (hit) {
      return {
        uid: side.key === 'me' ? hit.uid : null, name: hit.label, wb: side.wb as string,
        grade: hit.hero ? 'hero' : 'hench', dead: !!hit.dead,
        memberIdx: hit.dead ? undefined : hit.idx,
        fallenIdx: hit.dead ? hit.fallenIdx : undefined,
      };
    }
  }
  return { uid: null, name: freeName || side.name || '', wb: side.wb as string };
}

/** Saves the form. A battle our warband fought goes into our chronicle, with
    its casualties (a man already among the Fallen is recorded dead and tied
    to his record); editing corrects the battle and reconciles its
    casualties. A battle only others fought goes into the campaign file
    (started if none is open). Either way the map follows the outcome. */
export function saveBattleDraft(ctx: Ctx, cf: CampaignFile | null, d: BattleDraft): WarbandAndFile {
  const sidesOut = () => d.sides.map((x) => ({ key: x.key, name: x.name, wb: x.wb, outcome: x.outcome })) as BattleSide[];
  if (!draftIncludesUs(d)) {
    const file = produce(cf ?? cfNew('Campaign'), (f) => {
      f.battles = f.battles || [];
      const rec: CampaignFileBattle = {
        id: f.battles.reduce((m, b) => Math.max(m, Number(b.id) || 0), 0) + 1,
        round: d.round, district: d.district || '', notes: d.notes || '',
        sides: sidesOut(), opponents: d.sides.map((x) => ({ name: x.name, wb: x.wb as string })), outcome: '',
      };
      if (d.editId != null) {
        const i = f.battles.findIndex((b) => b.id === d.editId);
        if (i >= 0) { rec.id = d.editId; f.battles[i] = rec; } else f.battles.push(rec);
      } else f.battles.push(rec);
    });
    return applyBattleTerritory(ctx, file, d.sides, d.district);
  }
  const ours = d.sides.find((x) => x.key === 'me');
  if (d.editId != null) {
    const b0 = (ctx.s.campaign?.battles ?? []).find((x) => x.id === d.editId);
    if (!b0) return { s: ctx.s, cf };
    let s = update(ctx, (dr, c) => {
      const camp = campState(dr);
      const b = (camp.battles as CampaignFileBattle[]).find((x) => x.id === d.editId) as CampaignFileBattle;
      Object.assign(b, {
        round: d.round, district: d.district, notes: d.notes, sides: sidesOut(),
        opponents: d.sides.filter((x) => x.key !== 'me').map((x) => ({ name: x.name, wb: x.wb })),
        outcome: (ours || { outcome: '' }).outcome || '',
      });
      const who = (b.sides as BattleSide[]).slice(1).map((x) => x.name || wbName(c, x.wb)).join(', ') || 'an unnamed foe';
      const ev = (camp.log ?? []).find((e) => e.data && e.data.battleId === b.id);
      if (ev) { ev.text = `Battle ${b.round}: fought ${who}${b.district ? ` at ${districtName(c, b.district)}` : ''}${b.outcome ? ` — ${b.outcome}` : ''}.`; ev.edited = true; }
    });
    const b1 = (s.campaign?.battles ?? []).find((x) => x.id === d.editId) as CampaignFileBattle;
    const terr = applyBattleTerritory(ctxOf(ctx.data, s), cf, b1.sides, b1.district as string);
    s = terr.s;
    // reconcile the casualties: correct those from this battle, add new ones,
    // drop those taken out of the form
    s = update(ctxOf(ctx.data, s), (dr, c) => {
      const keep = new Set(d.cas.filter((r) => r.id != null).map((r) => r.id));
      for (const x of ((campState(dr).casualties ?? []) as Casualty[]).filter((x) => x.battleId === b1.id && !keep.has(x.id))) removeCasualtyOn(dr, x.id);
      for (const row of d.cas) {
        const victim = casSide(c, terr.cf, d, row.vSide, row.vPick, row.vName);
        if (!victim.name) continue;
        const attacker = casSide(c, terr.cf, d, row.aSide, row.aPick, row.aName);
        if (row.id != null) {
          const rec = ((campState(dr).casualties ?? []) as Casualty[]).find((x) => x.id === row.id);
          if (rec) {
            rec.victim = Object.assign({}, rec.victim, victim) as CasualtySide;
            rec.attacker = attacker as CasualtySide;
            rec.note = row.note || '';
            retypeCasualty(dr, c, rec);
            continue;
          }
        }
        addCasualtyOn(dr, c, { round: d.round, battleId: b1.id, victim, attacker, note: row.note || '', result: victim.dead ? 'dead' : 'pending', noXp: row.aSide === 'env' });
      }
    });
    return { s, cf: terr.cf };
  }
  let s = addBattle(ctx, {
    round: d.round, district: d.district, notes: d.notes, sides: sidesOut(),
    opponents: d.sides.filter((x) => x.key !== 'me').map((x) => ({ name: x.name, wb: x.wb as string })),
    outcome: (ours || { outcome: '' }).outcome || '',
  });
  const bat = (s.campaign?.battles ?? []).at(-1) as CampaignFileBattle;
  s = update(ctxOf(ctx.data, s), (dr, c) => {
    for (const row of d.cas) {
      const victim = casSide(c, cf, d, row.vSide, row.vPick, row.vName);
      if (!victim.name) continue;
      const attacker = casSide(c, cf, d, row.aSide, row.aPick, row.aName);
      const rec = addCasualtyOn(dr, c, {
        round: d.round, battleId: bat.id, victim, attacker, detail: row.note || '',
        // a warrior already in the Fallen list plainly did not survive it
        result: victim.dead ? 'dead' : 'pending',
        // the surroundings earn nobody experience
        noXp: row.aSide === 'env',
      });
      const side = d.sides[row.vSide as number];
      if (rec && victim.dead && victim.fallenIdx != null && side && side.key === 'me') {
        rec.fallenId = victim.fallenIdx;
        const fe = (dr.fallen ?? [])[victim.fallenIdx];
        if (fe) fe.casualtyId = rec.id;
      }
    }
  });
  return applyBattleTerritory(ctxOf(ctx.data, s), cf, d.sides, d.district);
}

/* ---- the casualty form ---- */

export interface CasualtyDraft { vSideKey: string; vPick: string; vName: string; aSideKey: string; aPick: string; aName: string; detail: string }

/** An empty form: our own warband on the losing end, the usual case. */
export function newCasualtyDraft(): CasualtyDraft {
  return { vSideKey: 'me', vPick: '', vName: '', aSideKey: '', aPick: '', aName: '', detail: '' };
}

/** Sets a field; choosing another warband clears the warrior picked. */
export function casualtyDraftSet(d: CasualtyDraft, f: keyof CasualtyDraft, v: string): CasualtyDraft {
  return produce(d, (x) => {
    x[f] = v;
    if (f === 'vSideKey') x.vPick = '';
    if (f === 'aSideKey') x.aPick = '';
  });
}

/** Saves the form as a casualty of the current stage, tied to its latest
    battle. A man picked from the Fallen is recorded dead and applied. A
    form without a victim changes nothing. */
export function saveCasualtyDraft(ctx: Ctx, cf: CampaignFile | null, d: CasualtyDraft): WarbandState {
  const side = (key: string, pickVal: string, freeName: string): PickedSide => {
    if (key === 'env') return { uid: null, name: 'The surroundings', wb: '', npc: true };
    if (!key) return { uid: null, name: freeName || '', wb: '' };
    const meta = battleSides(ctx, cf).find((x) => x.key === key) || ({} as Partial<SideOption>);
    if (pickVal) {
      const hit = pickFrom(sideModels(ctx, cf, key), pickVal);
      if (hit) {
        return {
          uid: key === 'me' ? hit.uid : null, name: hit.label, wb: meta.wb as string,
          grade: hit.hero ? 'hero' : 'hench', dead: !!hit.dead,
          memberIdx: hit.dead ? undefined : hit.idx,
          fallenIdx: hit.dead ? hit.fallenIdx : undefined,
        };
      }
    }
    return { uid: null, name: freeName || '', wb: meta.wb as string };
  };
  const victim = side(d.vSideKey, d.vPick, d.vName);
  if (!victim.name) return ctx.s;
  const attacker = side(d.aSideKey, d.aPick, d.aName);
  return update(ctx, (dr, c) => {
    const camp = campState(dr);
    const lastBat = (camp.battles as CampaignFileBattle[]).filter((b) => b.round === camp.round).slice(-1)[0];
    const rec = addCasualtyOn(dr, c, {
      victim, attacker, result: victim.dead ? 'dead' : 'pending',
      note: d.detail || '', detail: victim.dead ? (d.detail || '') : '',
      battleId: lastBat ? lastBat.id : null, noXp: d.aSideKey === 'env',
    });
    if (rec && victim.dead && victim.fallenIdx != null) {
      rec.fallenId = victim.fallenIdx; rec.applied = true;
      const fe = (dr.fallen ?? [])[victim.fallenIdx];
      if (fe) fe.casualtyId = rec.id;
    }
  });
}

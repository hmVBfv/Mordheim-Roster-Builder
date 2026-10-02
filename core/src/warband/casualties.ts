/* Injuries, deaths, the Fallen and casualty records (legacy app.js addInj …
   removeFallenAt, addCasualty … noteCasualtyOutcome, applyBattleResults).

   These belong together: a death moves the warrior into `fallen` AND settles
   the casualty record of the battle he fell in, and resolving a casualty's
   injury roll applies it to the roster exactly as the unit card would. So the
   chronicle and the sheet cannot drift apart.

   Where legacy asked in a dialog (Robbed: apply?, Sold to the Pits: won?,
   Captured: coming back? ransom?, Deep Wound: D3?), the answer is an argument;
   the interface asks before it calls. */
import type { Casualty, CasualtySide, FallenRecord, Injury, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { casualtyIsHero, casualtyModel, casualtyText, casualtyType, fallenEqSig, HENCH_INJ, outstandingCasualties, pendingCasualtyFor } from '../rules/casualties.ts';
import { goldTreasury, isHeroModel, lossValueOf, modelUnitCost } from '../rules/costs.ts';
import { eqListFor, isUpgrade, unitDef } from '../rules/lookup.ts';
import { memberCount, memberName, memberNamed } from '../rules/profile.ts';
import { dropMemberName } from './advance.ts';
import { campState, logEvent, logEventAt, nextLogId } from './log.ts';
import { findModel, nextModelUid, update, type WarbandDraft } from './update.ts';
import { applyPendingXpOn, grantXpOn } from './xp.ts';

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const unitName = (c: Ctx, m: Model) => unitDef(c, m.uid_def)?.name;

function stashOf(d: WarbandDraft) {
  d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
  return d.stash;
}

function casualtyList(d: WarbandDraft): Casualty[] {
  return campState(d).casualties as Casualty[];
}

/* ---- gold that goes with the dead ---- */

/** A warrior who falls takes his worth with him. It is taken out of the
    treasury once, here, and written onto the Fallen record so an undo gives
    back exactly that. */
function loseValueOnDeath(d: WarbandDraft, c: Ctx, snapshot: Model): number {
  const lost = lossValueOf(c, snapshot);
  if (lost > 0) stashOf(d).gold = Math.max(0, goldTreasury(c) - lost);
  return lost;
}

function restoreValueOnUndo(d: WarbandDraft, c: Ctx, rec: FallenRecord): number {
  const back = Number(rec && rec.lostValue) || 0;
  if (back > 0) stashOf(d).gold = goldTreasury(c) + back;
  return back;
}

/** Gear lost to an injury (Robbed, a lost pit fight). Removing items would
    normally refund them; stolen gear must not, so the same amount leaves the
    treasury in the same breath. weaponsOnly: weapons and armour only. */
export function stripGearSettled(d: WarbandDraft, c: Ctx, m: Model, weaponsOnly: boolean): number {
  const before = modelUnitCost(c, m);
  const def = unitDef(c, m.uid_def);
  if (weaponsOnly) {
    const list = def && def.eq ? eqListFor(c, def) : undefined;
    const armed = new Set<string>();
    if (list) for (const cat of ['Nahkampf', 'Fernkampf']) for (const [nm] of list[cat] ?? []) armed.add(nm);
    if (list) for (const cat of Object.keys(list)) if (/^Rüstung/.test(cat)) for (const [nm] of list[cat] ?? []) armed.add(nm);
    if (m.eq) for (const nm of Object.keys(m.eq)) if (armed.has(nm)) delete m.eq[nm];
    const r = m.rare || {};
    for (const de of Object.keys(r)) {
      const cat = c.data.CATALOG.find((x) => x.de === de)?.cat;
      // upgrades ride on a weapon that is gone; weapons and armour go too
      if (isUpgrade(c.data, de) || cat === 'cc' || cat === 'missile' || cat === 'bp' || cat === 'armour') delete r[de];
    }
    if (m.heirloom && !((m.eq || {})[m.heirloom])) m.heirloom = null;
  } else {
    m.eq = {}; m.rare = {}; m.heirloom = null;
  }
  const lost = Math.max(0, before - modelUnitCost(c, m));
  if (lost > 0) stashOf(d).gold = Math.max(0, goldTreasury(c) - lost);
  return lost;
}

/* ---- casualty records (draft level) ---- */

export interface CasualtyInput {
  round?: number | null;
  battleId?: number | null;
  victim?: Partial<CasualtySide>;
  attacker?: Partial<CasualtySide>;
  result?: string;
  detail?: string | null;
  note?: string;
  /** Do not grant the attacking Hero his +1 experience. */
  noXp?: boolean;
}

/** Rank and worth of one side: known from the roster for our own models,
    whatever was entered for an enemy. */
function enrichSide(c: Ctx, side: CasualtySide): CasualtySide {
  if (side.uid != null) {
    const m = c.s.models.find((x) => x.uid === side.uid);
    if (m) {
      side.grade = isHeroModel(c, m) ? 'hero' : 'hench';
      if (side.value == null) side.value = modelUnitCost(c, m) || 0;
      side.uid_def = m.uid_def;
    }
  }
  if (side.value != null) side.value = Number(side.value) || 0;
  return side;
}

export function addCasualtyOn(d: WarbandDraft, c: Ctx, cas: CasualtyInput): Casualty {
  const camp = campState(d);
  const rec: Casualty = {
    id: nextLogId(d), round: cas.round == null ? (camp.round ?? 0) : Number(cas.round) || 0,
    battleId: cas.battleId || null,
    victim: enrichSide(c, Object.assign({ uid: null, name: '', wb: '', grade: '', value: null, memberIdx: null }, cas.victim || {}) as CasualtySide),
    attacker: enrichSide(c, Object.assign({ uid: null, name: '', wb: '', grade: '', value: null }, cas.attacker || {}) as CasualtySide),
    result: cas.result || 'pending', detail: cas.detail || '', fallenId: null,
    note: String(cas.note || ''),
  };
  casualtyList(d).push(rec);
  logEventAt(d, rec.round, casualtyType(rec), casualtyText(c, rec), { casualtyId: rec.id });
  // Only Heroes earn the +1 for putting an enemy out of action.
  if (rec.attacker.uid != null && rec.attacker.grade === 'hero' && rec.victim.uid == null && !cas.noXp) {
    const g = grantXpOn(d, c, rec.attacker.uid, 1, `put ${rec.victim.name || 'an enemy'} out of action`, rec.round);
    if (g) rec.xpId = g.id;
  }
  return rec;
}

/** Brings the chronicle entry of a casualty in line with its result. */
export function retypeCasualty(d: WarbandDraft, c: Ctx, r: Casualty): void {
  const ev = (campState(d).log ?? []).find((e) => e.data && e.data.casualtyId === r.id);
  if (ev) { ev.text = casualtyText(c, r); ev.type = casualtyType(r); }
}

function resolveCasualtyOn(d: WarbandDraft, c: Ctx, id: unknown, result: string, detail?: string | null): Casualty | null {
  const r = casualtyList(d).find((x) => x.id === Number(id));
  if (!r) return null;
  r.result = result || 'pending';
  if (detail != null) r.detail = String(detail);
  const ev = (campState(d).log ?? []).find((e) => e.data && e.data.casualtyId === r.id);
  if (ev) { ev.text = casualtyText(c, r); ev.type = casualtyType(r); } else logEventAt(d, r.round, casualtyType(r), casualtyText(c, r), { casualtyId: r.id });
  return r;
}

/** Attaches an injury or death to the casualty record of the battle — the
    one being resolved, else the pending one for this warrior — or records
    it after the fact if nobody noted who did it. */
function noteCasualtyOutcome(d: WarbandDraft, c: Ctx, m: Model, result: string, detail: string | null, who: string | null, resolving: Casualty | null): Casualty | null {
  const camp = campState(d);
  if (!camp.on) return null;
  const name = who || m.name || unitName(c, m) || '';
  const r = resolving || pendingCasualtyFor(c, m.uid, who);
  if (r) {
    r.result = result;
    if (detail) r.detail = detail;
    if (who) r.victim.name = who;
    retypeCasualty(d, c, r);
    return r;
  }
  return addCasualtyOn(d, c, { victim: { uid: m.uid, name, wb: d.wb ?? '' }, result, detail });
}

/* ---- deaths (draft level) ---- */

export function killHeroOn(d: WarbandDraft, c: Ctx, uid: number, msg: string | null, resolving: Casualty | null): void {
  const m = findModel(d, uid);
  if (!m) return;
  const snap = copy(m);
  d.fallen = d.fallen || [];
  d.fallen.push({ kind: 'hero', m: snap, lostValue: loseValueOnDeath(d, c, snap) });
  if (m.uid === d.leaderUid) d.leaderUid = null;
  const cas = noteCasualtyOutcome(d, c, m, 'dead', null, null, resolving);
  if (cas) cas.fallenId = d.fallen.length - 1;
  const name = m.name || unitName(c, m);
  if (msg) logEvent(d, 'death', msg, { uid: m.uid, name, uid_def: m.uid_def, exp: Number(m.exp) || 0, hero: true });
  else if (!cas) logEvent(d, 'death', `${name} (${unitName(c, m)}) was slain.`, { uid: m.uid, name, uid_def: m.uid_def, exp: Number(m.exp) || 0, hero: true });
  d.models = d.models.filter((x) => x.uid !== uid);
}

/** One man of a group falls, by index, so the right name goes with the
    right death. The group's recruit surcharge stays with the group; only
    the last man takes the remainder with him. */
export function killHenchMemberOn(d: WarbandDraft, c: Ctx, uid: number, index: unknown, resolving: Casualty | null): void {
  const m = findModel(d, uid);
  if (!m) return;
  const i = Number(index) || 0;
  const who = memberName(c, m, i);
  const snap = copy(m);
  snap.qty = 1;
  delete snap.names;
  // only a man given a name of his own is remembered by it
  if (memberNamed(m, i)) snap.name = who;
  const last = (memberCount(m) - 1) <= 0;
  snap.xpPaid = last ? (Number(m.xpPaid) || 0) : 0;
  const rec: FallenRecord = { kind: 'hench', uid_def: m.uid_def, exp: Number(m.exp) || 0, m: snap, memberIdx: i, lostValue: loseValueOnDeath(d, c, snap) };
  if (memberNamed(m, i)) rec.memberName = who;
  d.fallen = d.fallen || [];
  d.fallen.push(rec);
  m.qty = memberCount(m) - 1;
  dropMemberName(m, i);
  const wasPending = !!pendingCasualtyFor(c, m.uid, who);
  const cas = noteCasualtyOutcome(d, c, m, 'dead', null, who, resolving);
  if (cas) { cas.fallenId = d.fallen.length - 1; rec.casualtyId = cas.id; rec.casFromDeath = !wasPending; }
  else logEvent(d, 'death', `${who} was slain.`, { uid: m.uid, name: who, uid_def: m.uid_def, exp: Number(m.exp) || 0, hero: false });
  if (m.qty <= 0) d.models = d.models.filter((x) => x.uid !== uid);
}

/** Which man of the group a casualty means: the index written down when it
    was recorded, else the man with that name. */
function casualtyMemberIndex(c: Ctx, r: Casualty, m: Model): number {
  if (r.victim && r.victim.memberIdx != null) return Math.min(Number(r.victim.memberIdx), memberCount(m) - 1);
  const name = r.victim.name;
  if (!name) return 0;
  for (let i = 0; i < memberCount(m); i++) if (memberName(c, m, i) === name) return i;
  return 0;
}

/* ---- actions: deaths and the Fallen ---- */

/** A Hero dies: he moves to the Fallen with everything he carried, and his
    worth leaves the treasury. `msg` replaces the chronicle's wording. */
export function killHero(ctx: Ctx, uid: number, msg?: string): WarbandState {
  if (!findModel(ctx.s, uid)) return ctx.s;
  return update(ctx, (d, c) => killHeroOn(d, c, uid, msg || null, null));
}

/** One member of a henchman group dies (by index). */
export function killHenchMember(ctx: Ctx, uid: number, index: number): WarbandState {
  if (!findModel(ctx.s, uid)) return ctx.s;
  return update(ctx, (d, c) => killHenchMemberOn(d, c, uid, index, null));
}

/** A henchman dies; without an index, the last man of the group. */
export function killHench(ctx: Ctx, uid: number, index?: number | null): WarbandState {
  const m = findModel(ctx.s, uid);
  if (!m) return ctx.s;
  return killHenchMember(ctx, uid, index == null ? memberCount(m) - 1 : Number(index) || 0);
}

/** Takes back the most recent death: the warrior returns (a henchman to a
    matching group, under his own name and in his old place), his worth
    returns to the treasury, and the casualty record goes back to awaiting
    its roll — or is dropped if the death created it. */
export function undoFallen(ctx: Ctx): WarbandState {
  if (!ctx.s.fallen || !ctx.s.fallen.length) return ctx.s;
  return update(ctx, (d, c) => {
    const fallen = d.fallen as FallenRecord[];
    const e = fallen[fallen.length - 1] as FallenRecord;
    restoreValueOnUndo(d, c, e);
    if (e.kind === 'hero') d.models.push(copy(e.m));
    else {
      const sig = fallenEqSig(e.m);
      const grp = d.models.find((x) => !isHeroModel(c, x) && fallenEqSig(x) === sig);
      if (grp) {
        grp.qty = (Number(grp.qty) || 0) + 1;
        if (e.memberName) {
          const at = e.memberIdx == null ? memberCount(grp) - 1 : Math.min(e.memberIdx, memberCount(grp) - 1);
          if (!Array.isArray(grp.names)) grp.names = [];
          while (grp.names.length < at) grp.names.push('');
          grp.names.splice(at, 0, e.memberName);
          grp.names.length = memberCount(grp);
        }
        // the recruit surcharge that died with the last man comes back with him
        grp.xpPaid = (Number(grp.xpPaid) || 0) + (Number(e.m && e.m.xpPaid) || 0);
      } else {
        const nm = copy(e.m);
        nm.uid = nextModelUid(d);
        nm.qty = 1;
        if (e.memberName) nm.names = [e.memberName];
        d.models.push(nm);
      }
    }
    if (e.casualtyId != null) {
      const camp = campState(d);
      if (e.casFromDeath) {
        camp.casualties = (camp.casualties ?? []).filter((r) => r.id !== e.casualtyId);
        camp.log = (camp.log ?? []).filter((x) => !(x.data && x.data.casualtyId === e.casualtyId));
      } else {
        const rec = (camp.casualties ?? []).find((r) => r.id === e.casualtyId);
        if (rec) { rec.applied = false; delete (rec as Partial<Casualty>).fallenId; }
        resolveCasualtyOn(d, c, e.casualtyId, 'pending', '');
      }
    }
    fallen.pop();
  });
}

/** Deletes a Fallen record for good (no gold changes; undo cannot bring it
    back). The interface asks first when the record lists equipment. */
export function removeFallenAt(ctx: Ctx, index: number): WarbandState {
  if (!ctx.s.fallen || !ctx.s.fallen[index]) return ctx.s;
  return update(ctx, (d) => { (d.fallen as FallenRecord[]).splice(index, 1); });
}

/* ---- actions: injuries ---- */

/** Answers to the questions some results ask. Defaults are what legacy did
    when it could not ask. */
export interface InjuryChoices {
  /** Sold to the Pits (65): did he win the pit fight? */
  pitWon?: boolean;
  /** Captured (61): is he coming back (ransomed or exchanged)? */
  captiveReturns?: boolean;
  /** Captured (61): ransom paid in gold; 0 for an exchange. */
  ransom?: number | string | null;
  /** Deep Wound (35): the D3, games to miss (1–3). */
  deepWoundGames?: number | string | null;
}

/** Applies a result of the Serious Injuries chart to a warrior. */
export function addInjury(ctx: Ctx, uid: number, code: string, choices: InjuryChoices = {}): WarbandState {
  const m0 = findModel(ctx.s, uid);
  const j = ctx.data.INJURIES.find((x) => x.code === code);
  if (!m0 || !j) return ctx.s;
  if (j.code === '11-15') return isHeroModel(ctx, m0) ? killHero(ctx, uid) : killHench(ctx, uid);
  const nm = m0.name || unitName(ctx, m0);
  if (j.code === '61' && choices.captiveReturns === false) {
    return killHero(ctx, uid, `${nm} was Captured and never returned — sold, killed or worse. He and his equipment are lost.`);
  }
  return update(ctx, (d, c) => {
    const m = findModel(d, uid) as Model;
    if (j.code === '36') { // Robbed: all gear lost, no refund
      const lost = stripGearSettled(d, c, m, false);
      logEvent(d, 'injury', `${nm} was Robbed — all equipment lost (${lost} gc, not refunded).`, { uid_def: m.uid_def });
      m.inj = m.inj || [];
      m.inj.push({ code: j.code, name: j.name, text: j.text, mod: null });
      return;
    }
    if (j.code === '65') { // Sold to the Pits (RAW, mordheimer Campaigns)
      if (choices.pitWon !== false) {
        stashOf(d).gold = goldTreasury(c) + 50;
        m.exp = (Number(m.exp) || 0) + 2;
        logEvent(d, 'injury', `${nm} won his pit fight — +50 gc, +2 XP.`, { uid_def: m.uid_def });
      } else {
        const lost = stripGearSettled(d, c, m, true);
        logEvent(d, 'injury', `${nm} lost his pit fight — weapons & armour lost (${lost} gc, not refunded). Roll 11–35 for injuries separately.`, { uid_def: m.uid_def });
      }
      return;
    }
    if (j.code === '61') { // Captured and coming back
      const r = Math.max(0, Number(choices.ransom) || 0);
      if (r > 0) stashOf(d).gold = Math.max(0, goldTreasury(c) - r);
      logEvent(d, 'injury', `${nm} was Captured and ${r > 0 ? `ransomed for ${r} gc` : 'exchanged'}.`, { uid_def: m.uid_def });
      return;
    }
    if (j.code === '35') { // Deep Wound: misses the next D3 games
      const n = Math.min(3, Math.max(1, Number(choices.deepWoundGames) || 1));
      m.miss = (Number(m.miss) || 0) + n;
      return;
    }
    if (j.code === '66') { // Survives Against the Odds
      m.exp = (Number(m.exp) || 0) + 1;
      logEvent(d, 'injury', `${nm} Survives Against the Odds — +1 Experience.`, { uid_def: m.uid_def });
      return;
    }
    if (j.miss) {
      m.miss = (Number(m.miss) || 0) + j.miss;
      m.missWhy = j.name || j.code;
      noteCasualtyOutcome(d, c, m, 'injured', j.name || j.code, null, null);
      return;
    }
    m.inj = m.inj || [];
    m.inj.push({ code: j.code, name: j.name, text: j.text, mod: j.mod || null });
    noteCasualtyOutcome(d, c, m, 'injured', j.name || j.code, null, null);
  });
}

export function removeInjury(ctx: Ctx, uid: number, index: number): WarbandState {
  const m0 = findModel(ctx.s, uid);
  if (!m0 || !m0.inj) return ctx.s;
  return update(ctx, (d) => { (findModel(d, uid) as Model).inj!.splice(index, 1); });
}

/** Games to miss, up or down (never below 0). */
export function adjustMiss(ctx: Ctx, uid: number, delta: number): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) m.miss = Math.max(0, (Number(m.miss) || 0) + delta); });
}

/* ---- actions: casualty records ---- */

/** Records a warrior put out of action. A Hero of ours who did it earns +1
    experience, held until applied. Returns the new state; the record is the
    last of campaign.casualties. */
export function addCasualty(ctx: Ctx, cas: CasualtyInput = {}): WarbandState {
  return update(ctx, (d, c) => { addCasualtyOn(d, c, cas); });
}

/** Sets a casualty's result by hand (no roster change). */
export function resolveCasualty(ctx: Ctx, id: number, result: string, detail?: string | null): WarbandState {
  if (!ctx.s.campaign?.casualties?.some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d, c) => { resolveCasualtyOn(d, c, id, result, detail); });
}

/** Resolves a casualty with a roll on the table that applies (Heroes: D66
    Serious Injuries; Henchmen: D6), and applies it to the roster as the unit
    card would: Dead moves him to the Fallen, a lasting injury is written
    onto him. An empty code sets the record back to pending. */
export function resolveCasualtyRoll(ctx: Ctx, id: number, code: string | null | undefined): WarbandState {
  if (!ctx.s.campaign?.casualties?.some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d, c) => {
    const r = casualtyList(d).find((x) => x.id === Number(id)) as Casualty;
    if (!code) {
      r.result = 'pending'; r.detail = ''; delete r.code; delete r.applied;
      retypeCasualty(d, c, r);
      return;
    }
    r.code = code;
    const m = casualtyModel(c, r);
    const hero = casualtyIsHero(c, r);
    const INJEN = c.data.INJEN;
    const j = hero ? c.data.INJURIES.find((x) => x.code === code) : HENCH_INJ.find((x) => x.code === code);
    if (!j) return;
    // not one of ours: just record the outcome
    if (!m) {
      r.result = (hero ? code === '11-15' : !!(j as { dead?: boolean }).dead) ? 'dead'
        : (hero && /full recovery/i.test(j.name) ? 'recovered' : (hero ? 'injured' : 'recovered'));
      r.detail = INJEN[code] || j.name;
      retypeCasualty(d, c, r);
      return;
    }
    const dead = hero ? code === '11-15' : !!(j as { dead?: boolean }).dead;
    if (dead) {
      r.detail = INJEN[code] || j.name;
      if (isHeroModel(c, m)) killHeroOn(d, c, m.uid, null, r);
      else killHenchMemberOn(d, c, m.uid, casualtyMemberIndex(c, r, m), r);
      const fallen = d.fallen as FallenRecord[];
      const fe = fallen.length - 1;
      r.result = 'dead'; r.applied = true;
      r.fallenId = fe;
      if (fallen[fe]) fallen[fe].casualtyId = r.id;
      retypeCasualty(d, c, r);
      return;
    }
    const inj = j as { code: string; name: string; text?: string; mod?: unknown; miss?: number | null };
    if (hero && inj.miss) {
      m.miss = (Number(m.miss) || 0) + inj.miss;
      m.missWhy = INJEN[code] || j.name;
      r.result = 'injured'; r.detail = INJEN[code] || j.name; r.applied = true;
    } else if (hero && !/full recovery|knocked|dazed/i.test(INJEN[code] || j.name)) {
      m.inj = m.inj || [];
      m.inj.push({ code: inj.code, name: inj.name, text: inj.text as string, mod: (inj.mod as Injury['mod']) || null });
      r.result = 'injured'; r.detail = INJEN[code] || j.name; r.applied = true;
    } else {
      r.result = 'recovered'; r.detail = INJEN[code] ? INJEN[code] : j.name;
    }
    retypeCasualty(d, c, r);
  });
}

export function setCasualtyNote(ctx: Ctx, id: number, note: string): WarbandState {
  if (!ctx.s.campaign?.casualties?.some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => { (casualtyList(d).find((x) => x.id === Number(id)) as Casualty).note = String(note || ''); });
}

/** Deletes a casualty record and its chronicle entry (draft level). */
export function removeCasualtyOn(d: WarbandDraft, id: unknown): void {
  const list = casualtyList(d);
  const i = list.findIndex((x) => x.id === Number(id));
  if (i < 0) return;
  const cid = (list[i] as Casualty).id;
  list.splice(i, 1);
  const camp = campState(d);
  camp.log = (camp.log ?? []).filter((e) => !(e.data && e.data.casualtyId === cid));
}

/** Deletes a casualty record and its chronicle entry. The interface asks first. */
export function removeCasualty(ctx: Ctx, id: number): WarbandState {
  if (!(ctx.s.campaign?.casualties ?? []).some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => { removeCasualtyOn(d, id); });
}

/** Everything the battle leaves behind, in one go: deaths rolled this round
    leave the roster (first, so the dead are not handed experience), then the
    held experience is applied. Casualties not yet rolled for are left alone;
    the interface warns about them (unrolledCasualties) before calling. */
export function applyBattleResults(ctx: Ctx): WarbandState {
  return update(ctx, (d, c) => {
    const round = campState(d).round;
    for (const cas of outstandingCasualties(c, round)) {
      const m = d.models.find((x) => x.uid === cas.victim.uid);
      if (!m) continue;
      if (isHeroModel(c, m)) killHeroOn(d, c, m.uid, null, cas);
      else killHenchMemberOn(d, c, m.uid, casualtyMemberIndex(c, cas, m), cas);
      const fallen = d.fallen as FallenRecord[];
      const fe = fallen.length - 1;
      cas.fallenId = fe; cas.applied = true;
      if (fallen[fe]) fallen[fe].casualtyId = cas.id;
    }
    applyPendingXpOn(d, c);
  });
}

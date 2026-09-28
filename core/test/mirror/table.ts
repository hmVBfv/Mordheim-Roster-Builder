/* What each legacy function a legacy test calls means in core.
 *
 * action – changes the warband, the open campaign file or a form draft; core
 *          runs the same action on the state legacy had before the call, and
 *          the results must match (recorder.ts).
 * query  – reads; core answers on the same state, the answers must match, and
 *          legacy must not have changed the state while answering.
 * ui     – draws or opens something. Not mirrored as such; where it shows the
 *          outcome of a rule, `check` compares that rule in core with what
 *          legacy drew. It must not change the state either (unless
 *          `mutates`, for the few that replace it wholesale).
 *
 * Every function a legacy test calls must be listed; the mirror test fails
 * on one that is not. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import * as core from '../../src/index.ts';
import type { BattleDraft, CampaignFile, CasualtyDraft, Ctx, WarbandState } from '../../src/index.ts';
import type { PdfLib } from '../../src/export/sheet.ts';
import { canonOf, data } from '../support/canon.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';
import { splitText } from '../parity/exportReport.ts';
import { coreAbilities, coreScreens, coreTip, coreWarbandOptions, legacyScreens, parseAbilities, parseTip, parseWarbandOptions } from '../parity/screens.ts';

export interface World { s: WarbandState; cf: CampaignFile | null; bd: BattleDraft | null; cd: CasualtyDraft | null; today: string }
export interface Io { confirms: boolean[]; prompts: (string | null)[]; dom: Record<string, string | undefined> }
export interface Call {
  /** What legacy had before the call. */
  w: World;
  /** The arguments, copied before the call (legacy may change them). */
  args: any[];
  /** The arguments as passed (legacy objects, identity intact). */
  raw: any[];
  io: Io;
  /** Legacy's return value. */
  ret: unknown;
  /** The legacy modules (originals, not the wrappers). */
  L: Legacy;
}
export type Pair = [core: unknown, legacy: unknown];

export type Spec =
  | { kind: 'action'; run: (c: Call) => Partial<World>; dom?: (args: any[]) => string[]; ret?: (c: Call, out: World) => Pair }
  | { kind: 'query'; run: (c: Call) => unknown; pure?: boolean; legacy?: (c: Call) => unknown; norm?: (v: any, c: Call) => unknown; dom?: (args: any[]) => string[] }
  | { kind: 'ui'; why: string; check?: (c: Call) => Pair | Promise<Pair>; mutates?: boolean };

const ctx = (w: World): Ctx => core.ctxOf(data, w.s);
const act = (run: (c: Call) => Partial<World>, more: Partial<Extract<Spec, { kind: 'action' }>> = {}): Spec => ({ kind: 'action', run, ...more });
const q = (run: (c: Call) => unknown, more: Partial<Extract<Spec, { kind: 'query' }>> = {}): Spec => ({ kind: 'query', run, ...more });
const pure = (run: (c: Call) => unknown): Spec => q(run, { pure: true });
const ui = (why: string, check?: (c: Call) => Pair | Promise<Pair>, mutates = false): Spec => ({ kind: 'ui', why, check, mutates });
/** Only the state changes. */
const st = (f: (x: Ctx, a: any[], c: Call) => WarbandState): Spec => act((c) => ({ s: f(ctx(c.w), c.args, c) }));
/** Answered a legacy confirm() with "no": nothing happens. */
const declined = (c: Call, i = 0) => c.io.confirms[i] === false;
const withSide = (t: { s: WarbandState; cf: CampaignFile | null }) => ({ s: t.s, cf: t.cf });
const model = (c: Call, uid: unknown) => c.w.s.models.find((m) => m.uid === uid);
/* A result without the file it was applied to (legacy returns only the rest). */
const withoutCf = (r: { cf: unknown }): Record<string, unknown> => { const o: Record<string, unknown> = { ...r }; delete o.cf; return o; };
const noIds = (v: unknown) => JSON.parse(JSON.stringify(v ?? null), (k, x) => (k === 'id' ? undefined : x));

/* The casualty form's warriors, as legacy lists them in its <select>. */
const optionNames = (html: string) => [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1] ?? '');
const unescapeHtml = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const TEMPLATE = new URL('../../../assets/sheet.pdf', import.meta.url);

/* The injury dialogs of addInj, turned into InjuryChoices (walk.ts does the
   same in the other direction). Legacy's defaults apply where a dialog is
   missing: no confirm() means yes, no prompt() means the default answer. */
function addInj(c: Call): Partial<World> {
  const [uid] = c.args;
  const code = c.io.dom[`inj-${uid}`];
  if (!code || !data.INJURIES.some((j) => j.code === code)) return {};
  const choices: core.InjuryChoices = {};
  // each of these results asks one question first
  if (code === '36' && declined(c)) return {};
  if (code === '65') choices.pitWon = !declined(c);
  if (code === '61') {
    choices.captiveReturns = !declined(c);
    if (choices.captiveReturns) choices.ransom = c.io.prompts[0] ?? '0';
  }
  if (code === '35') choices.deepWoundGames = c.io.prompts[0] ?? '1';
  return { s: core.addInjury(ctx(c.w), uid, code, choices) };
}

export const TABLE: Record<string, Spec> = {
  /* ---- the roster ---- */
  'app.addUnit': st((x, [id]) => core.addUnit(x, id)),
  'app.setQty': st((x, [u, v]) => core.setQty(x, u, v)),
  'app.setEqQty': st((x, [u, nm, n]) => core.setEqQty(x, u, nm, n)),
  'app.addRare': st((x, [u, de]) => core.addRare(x, u, de)),
  'app.toggleMut': st((x, [u, nm, on]) => core.toggleMutation(x, u, nm, on)),
  'app.setGoldCurrent': st((x, [v]) => core.setGoldCurrent(x, v)),
  'app.setMemberName': st((x, [u, i, v]) => core.setMemberName(x, u, i, v)),
  'app.addAdv': st((x, [u, k]) => core.addAdvance(x, u, k)),
  'app.spellRed': st((x, [u, i, d]) => core.spellReduce(x, u, i, d)),
  'app.promoteHench': st((x, [u, i]) => core.promoteHench(x, u, i)),
  'engine.ensureFreeDagger': act((c) => {
    // legacy changes the model it is handed, here always one of the roster
    const i = (c.L.state.S as WarbandState).models.indexOf(c.raw[0]);
    if (i < 0) return {};
    return { s: { ...c.w.s, models: c.w.s.models.map((m, k) => (k === i ? core.withFreeDagger(ctx(c.w), m) : m)) } };
  }),
  'app.chooseWb': act((c) => ({ s: core.newWarband(data, c.args[0]), bd: null, cd: null })),
  'app.applyState': act((c) => {
    const r = core.loadSave(data, c.args[0]);
    return r.ok ? { s: r.state, bd: null, cd: null } : {};
  }),
  'app.importText': act((c) => {
    const r = core.readSaveText(data, c.args[0]);
    return r.ok ? { s: r.state, bd: null, cd: null } : {};
  }),
  'app.setRareOpen': ui('opens the Trading Post panel of a card (screen state, not part of the save in core)'),

  /* ---- injuries, the Fallen, casualties, experience ---- */
  'app.addInj': act(addInj, { dom: ([u]) => [`inj-${u}`] }),
  'app.killHero': st((x, [u, msg]) => core.killHero(x, u, msg)),
  'app.killHench': st((x, [u, i]) => core.killHench(x, u, i)),
  'app.killHenchMember': st((x, [u, i]) => core.killHenchMember(x, u, i)),
  'app.undoFallen': st((x) => core.undoFallen(x)),
  'app.removeFallenAt': act((c) => (declined(c) ? {} : { s: core.removeFallenAt(ctx(c.w), c.args[0]) })),
  'app.addCasualty': st((x, [cas]) => core.addCasualty(x, cas)),
  'app.resolveCasualty': st((x, [id, r, d]) => core.resolveCasualty(x, id, r, d)),
  'app.resolveCasualtyRoll': st((x, [id, code]) => core.resolveCasualtyRoll(x, id, code)),
  'app.applyBattleResults': act((c) => (declined(c) ? {} : { s: core.applyBattleResults(ctx(c.w)) })),
  'app.applyPendingXp': st((x) => core.applyPendingXp(x)),
  'app.clearPendingXp': act((c) => (declined(c) ? {} : { s: core.clearPendingXp(ctx(c.w)) })),
  'app.awardBattleXp': st((x, [id, opts]) => core.awardBattleXp(x, id, opts)),

  /* ---- the chronicle, stages, post-battle ---- */
  'app.addLogNote': st((x, [t, r]) => core.addLogNote(x, t, r)),
  'app.editLogText': st((x, [id, t]) => core.editLogText(x, id, t)),
  'app.removeLogAt': act((c) => (declined(c) ? {} : { s: core.removeLogEntry(ctx(c.w), c.args[0]) })),
  'app.advanceRound': act((c) => ({ s: core.advanceRound(ctx(c.w), c.w.today) })),
  'app.addBattle': st((x, [b]) => core.addBattle(x, b)),
  'app.removeBattle': act((c) => (declined(c) ? {} : { s: core.removeBattle(ctx(c.w), c.args[0]) })),
  'app.pbSetStepDone': st((x, [step, on, r]) => core.setPostBattleStep(x, step, on, r)),
  'app.pbSellWyrd': st((x, [r, n]) => core.sellWyrdstone(x, r, n)),
  'app.pbClearWyrd': st((x, [r]) => core.undoWyrdstoneSale(x, r)),

  /* ---- the campaign file and the map ---- */
  'app.cfNew': act((c) => ({ cf: core.cfNew(c.args[0]) })),
  'app.cfClose': act(() => ({ cf: null })),
  'app.cfImportFile': act((c) => { const r = core.cfReadFile(c.args[0]); return r.ok ? { cf: r.cf } : {}; },
    { ret: (c) => { const r = core.cfReadFile(c.args[0]); return [r.ok ? { ok: true } : { ok: false, msg: r.msg }, c.ret]; } }),
  'app.cfImportWarband': act((c) => ({ cf: core.cfImportWarband(data, c.w.cf, c.args[0], c.args[1], c.w.today).cf }),
    { ret: (c) => [noIds(withoutCf(core.cfImportWarband(data, c.w.cf, c.args[0], c.args[1], c.w.today))), noIds(c.ret)] }),
  'app.cfMergeFrom': act((c) => ({ cf: core.cfMergeFrom(ctx(c.w), c.w.cf, c.args[0], c.w.today).cf }),
    { ret: (c) => [noIds(withoutCf(core.cfMergeFrom(ctx(c.w), c.w.cf, c.args[0], c.w.today))), noIds(c.ret)] }),
  'app.cfClearDistrict': act((c) => (declined(c) ? {} : withSide(core.cfClearDistrict(ctx(c.w), c.w.cf, c.args[0])))),
  'app.applyBattleTerritory': act((c) => withSide(core.applyBattleTerritory(ctx(c.w), c.w.cf, c.args[0], c.args[1]))),

  /* ---- the battle and casualty forms ---- */
  'app.openBattleForm': act((c) => ({ bd: core.newBattleDraft(ctx(c.w)) })),
  'app.editBattleForm': act((c) => ({ bd: core.battleDraftFor(ctx(c.w), c.args[0]) ?? c.w.bd })),
  'app.cancelBattleForm': act(() => ({ bd: null })),
  'app.addDraftSide': act((c) => ({ bd: c.w.bd && core.draftAddSide(ctx(c.w), c.w.cf, c.w.bd, c.args[0]) })),
  'app.remDraftSide': act((c) => ({ bd: c.w.bd && core.draftRemoveSide(c.w.bd, c.args[0]) })),
  'app.setDraftSide': act((c) => ({ bd: c.w.bd && core.draftSetSide(ctx(c.w), c.w.cf, c.w.bd, c.args[0], c.args[1], c.args[2]) })),
  'app.setDraftField': act((c) => ({ bd: c.w.bd && core.draftSetField(c.w.bd, c.args[0], c.args[1]) })),
  'app.addDraftCas': act((c) => ({ bd: c.w.bd && core.draftAddCasualty(c.w.bd) })),
  'app.setDraftCas': act((c) => ({ bd: c.w.bd && core.draftSetCasualty(c.w.bd, c.args[0], c.args[1], c.args[2]) })),
  'app.saveBattleForm': act((c) => (c.w.bd ? { ...withSide(core.saveBattleDraft(ctx(c.w), c.w.cf, c.w.bd)), bd: null } : {})),
  'app.openCasForm': act(() => ({ cd: core.newCasualtyDraft() })),
  'app.setCasField': act((c) => ({ cd: c.w.cd && core.casualtyDraftSet(c.w.cd, c.args[0], c.args[1]) })),
  'app.saveCasForm': act((c) => (c.w.cd ? { s: core.saveCasualtyDraft(ctx(c.w), c.w.cf, c.w.cd), cd: null } : {})),
  'app.battleDraft': q((c) => c.w.bd),

  /* ---- reading the warband ---- */
  // legacy hands out its campaign as far as it has filled it in so far
  'app.campState': q((c) => c.w.s.campaign, { norm: (v, c) => (canonOf({ ...c.w.s, campaign: v }) as WarbandState).campaign }),
  'app.campRound': q((c) => c.w.s.campaign?.round),
  'app.campDistricts': q((c) => c.w.s.campaign?.districts),
  'app.campCasualties': q((c) => core.casualties(ctx(c.w))),
  'app.casualtyText': q((c) => core.casualtyText(ctx(c.w), c.args[0])),
  'app.casualtyRollOptions': q((c) => core.casualtyRollOptions(ctx(c.w), c.args[0])),
  'app.casualtyStats': q((c) => core.casualtyStats(ctx(c.w))),
  'app.outstandingCasualties': q((c) => core.outstandingCasualties(ctx(c.w), c.args[0])),
  'app.unrolledCasualties': q((c) => core.unrolledCasualties(ctx(c.w), c.args[0])),
  'app.pendingXp': q((c) => core.pendingXp(ctx(c.w))),
  'app.pendingXpFor': q((c) => core.pendingXpFor(ctx(c.w), c.args[0])),
  'app.pendingXpTotal': q((c) => core.pendingXpTotal(ctx(c.w))),
  'app.xpLedger': q((c) => core.xpLedger(ctx(c.w))),
  'app.canEarnXp': q((c) => core.canEarnXp(ctx(c.w), c.args[0])),
  'app.modelLabel': q((c) => core.modelLabel(ctx(c.w), c.args[0])),
  'app.memberNames': q((c) => core.memberNames(ctx(c.w), c.args[0])),
  'app.memberNamed': pure((c) => core.memberNamed(c.args[0], c.args[1])),
  'app.leaderUid': q((c) => core.leaderUid(ctx(c.w))),
  'app.leaderUnitDied': q((c) => core.leaderUnitDied(ctx(c.w))),
  'app.fallenEqAgg': q((c) => core.fallenEqAgg(ctx(c.w), c.args[0])),
  'app.fallenEqSig': pure((c) => core.fallenEqSig(c.args[0])),
  'app.fallenExpEarned': q((c) => core.fallenExpEarned(ctx(c.w), c.args[0])),
  'app.fallenExpLost': q((c) => core.fallenExpLost(ctx(c.w))),
  'app.fallenGoldLost': q((c) => core.fallenGoldLost(ctx(c.w))),
  'app.fallenGoldOf': q((c) => core.fallenGoldOf(ctx(c.w), c.args[0])),
  'app.eqDisplayParts': q((c) => core.eqDisplayParts(ctx(c.w), c.args[0])),
  'app.rareDisplayParts': q((c) => core.rareDisplayParts(ctx(c.w), c.args[0])),
  'app.totalRating': q((c) => core.totalRating(ctx(c.w))),
  'app.warbandWorth': q((c) => core.warbandWorth(ctx(c.w))),
  'app.worthAdvOf': pure((c) => core.worthAdvOf(c.args[0])),
  'app.warbandSize': q((c) => core.warbandSize(ctx(c.w))),
  'app.wyrdPrice': q((c) => core.wyrdPrice(ctx(c.w), c.args[0], c.args[1])),
  'app.wyrdSizeBand': pure((c) => core.wyrdSizeBand(c.args[0])),
  'app.roundLabel': pure((c) => core.roundLabel(c.args[0])),
  'app.pbRound': q((c) => core.pbRound(ctx(c.w))),
  'app.pbActiveStep': q((c) => core.pbActiveStep(ctx(c.w), c.args[0])),
  'app.pbStepDone': q((c) => core.pbStepDone(ctx(c.w), c.args[0], c.args[1])),
  'app.pbExploreDice': q((c) => core.pbExploreDice(ctx(c.w), c.args[0])),
  'app.pbSearchingHeroes': q((c) => core.pbSearchingHeroes(ctx(c.w), c.args[0])),
  'app.stageSnapshots': q((c) => core.stageSnapshots(ctx(c.w))),
  'app.snapRows': q((c) => core.snapRows(ctx(c.w), c.args[0])),
  'app.diffStages': q((c) => core.diffStages(ctx(c.w), c.args[0], c.args[1])),
  'app.foundingMembers': q((c) => core.foundingMembers(ctx(c.w))),
  'app.districtsAt': q((c) => core.districtsAt(ctx(c.w), c.args[0])),
  'app.totalsAt': q((c) => core.totalsAt(ctx(c.w), c.args[0])),
  'app.characterTimeline': q((c) => core.characterTimeline(ctx(c.w), c.args[0])),
  'app.campaignAnalysis': q((c) => core.campaignAnalysis(ctx(c.w))),
  'app.battleSides': q((c) => core.battleSides(ctx(c.w), c.w.cf)),
  'app.sideModels': q((c) => core.sideModels(ctx(c.w), c.w.cf, c.args[0])),
  'app.draftIncludesUs': pure((c) => core.draftIncludesUs(c.args[0])),
  'app.districtStatus': q((c) => core.districtStatus(ctx(c.w), c.w.cf, c.args[0])),
  'app.cfGet': q((c) => c.w.cf),
  'app.cfControlAt': q((c) => core.cfControlAt(ctx(c.w), c.w.cf, c.args[0])),
  'app.cfTerritory': q((c) => core.cfTerritory(ctx(c.w), c.w.cf)),
  'app.cfStats': q((c) => core.cfStats(c.w.cf)),
  'app.cfMergedLog': q((c) => core.cfMergedLog(c.w.cf)),
  'app.cfAllBattles': q((c) => core.cfAllBattles(c.w.cf)),
  'app.cfAllBattlesMerged': q((c) => core.cfAllBattlesMerged(ctx(c.w), c.w.cf)),
  'app.catalogEligible': q((c) => core.catalogEligible(ctx(c.w), c.args[0], c.args[1])),
  'app.skillListsFor': q((c) => core.skillListsFor(ctx(c.w), c.args[0])),
  'app.unitFamilies': q((c) => core.unitFamilies(ctx(c.w), c.args[0])),
  'app.itemFamily': pure((c) => core.itemFamily(data, c.args[0])),
  'app.abilityMentioned': pure((c) => core.abilityMentioned(c.args[0], c.args[1])),

  /* ---- the rules of engine.js ---- */
  'engine.unitDef': q((c) => core.unitDef(ctx(c.w), c.args[0])),
  'engine.eqListFor': q((c) => core.eqListFor(ctx(c.w), c.args[0])),
  'engine.isHeroModel': q((c) => core.isHeroModel(ctx(c.w), c.args[0])),
  'engine.isTwoHanded': q((c) => core.isTwoHanded(ctx(c.w), c.args[0])),
  'engine.goldCurrent': q((c) => core.goldCurrent(ctx(c.w))),
  'engine.goldTreasury': q((c) => core.goldTreasury(ctx(c.w))),
  'engine.adjPrice': q((c) => core.adjPrice(ctx(c.w), c.args[0], c.args[1])),
  'engine.unitBaseCost': q((c) => core.unitBaseCost(ctx(c.w), c.args[0])),
  'engine.modelUnitCost': q((c) => core.modelUnitCost(ctx(c.w), c.args[0])),
  'engine.modelTotalCost': q((c) => core.modelTotalCost(ctx(c.w), c.args[0])),
  'engine.modelRating': q((c) => core.modelRating(ctx(c.w), c.args[0])),
  'engine.modelMarketValue': q((c) => core.modelMarketValue(ctx(c.w), c.args[0])),
  'engine.marketRarePrice': q((c) => core.marketRarePrice(ctx(c.w), c.args[0], c.args[1])),
  'engine.lossValueOf': q((c) => core.lossValueOf(ctx(c.w), c.args[0])),
  'engine.henchRecruitCost': q((c) => core.henchRecruitCost(ctx(c.w), c.args[0])),
  'engine.henchRecruitSurcharge': q((c) => core.henchRecruitSurcharge(ctx(c.w), c.args[0])),
  'engine.mutCost': q((c) => core.mutCost(ctx(c.w), c.args[0])),
  'engine.rareCost': pure((c) => core.rareCost(c.args[0])),
  'engine.rareEligibleItems': q((c) => core.rareEligibleItems(ctx(c.w), c.args[0])),
  'engine.svOfModel': q((c) => core.svOfModel(ctx(c.w), c.args[0])),
  'engine.totalModels': q((c) => core.totalModels(ctx(c.w))),
  'engine.totalHeroes': q((c) => core.totalHeroes(ctx(c.w))),
  'engine.totalLarge': q((c) => core.totalLarge(ctx(c.w))),
  'engine.totalSpent': q((c) => core.totalSpent(ctx(c.w))),
  'engine.warbandMax': q((c) => core.warbandMax(ctx(c.w))),
  'engine.statNum': pure((c) => core.statNum(c.args[0])),
  'engine.svFromText': pure((c) => core.svFromText(c.args[0])),
  'engine.svLabel': pure((c) => core.svLabel(c.args[0])),
  'engine._svCombine': pure((c) => core.svCombine(c.args[0], c.args[1])),
  'engine._loadoutValue': pure((c) => core.loadoutValue(c.args[0], c.args[1], c.args[2])),
  'state.houseDefaults': pure(() => core.houseDefaults()),
  'info.abilityInfo': pure((c) => core.abilityInfo(data, c.args[0])),

  /* ---- exports ---- */
  // the file as written: the gold line exactly, the state in its canonical form
  'app.exportState': q((c) => core.exportState(ctx(c.w)), { norm: (v) => { const { goldNow, ...rest } = v as { goldNow: unknown }; return { goldNow, state: canonOf(rest) }; } }),
  // the embedded save in its canonical form
  'app.buildText': q((c) => core.buildText(ctx(c.w), c.io.dom.savename || null), { dom: () => ['savename'], norm: (v) => splitText(String(v), canonOf) }),
  'app.narrativeReport': q((c) => core.narrativeReport(ctx(c.w))),
  'app.stampedName': q((c) => core.stampedName(ctx(c.w), c.w.today, c.io.dom.savename || null), { dom: () => ['savename'] }),

  /* ---- drawing ---- */
  'app.render': ui('draws the whole app'),
  'app.renderRoster': ui('draws the unit cards; their rules are mirrored where the tests read them (queries above)'),
  'app.renderCampaign': ui('draws the campaign panel; its lists come from the queries above'),
  'app.renderHouse': ui('draws the house-rules panel'),
  'app.welcomeNew': ui('switches from the welcome screen to the warband picker'),
  'app.renderSidebar': ui('draws the sidebar', (c) => [coreScreens(ctx(c.w)), legacyScreens(c.L)]),
  'app.abilitySection': ui('draws the abilities panel', (c) => [coreAbilities(ctx(c.w), c.args[1] ?? null, c.args[0]), parseAbilities(String(c.ret))]),
  'app.warbandOptions': ui('draws the warband picker', (c) => [coreWarbandOptions(data), parseWarbandOptions(String(c.ret))]),
  'app.eqSection': ui('draws the equipment panel of a card'),
  'app.xpBar': ui('draws the experience track', (c) => {
    const a = core.advanceStatus(ctx(c.w), c.args[0]);
    const html = String(c.ret);
    const earned = html.match(/Advances earned: <b>(\d+)<\/b>/);
    return [a && (a.noxp ? { noxp: true } : { earned: a.earned, due: a.due, next: a.next }),
      /Gains no experience/.test(html) ? { noxp: true } : { earned: earned ? Number(earned[1]) : null, due: /Advance due!/.test(html), next: (html.match(/next at <b>(\d+)<\/b>/) ?? [])[1] != null ? Number(html.match(/next at <b>(\d+)<\/b>/)![1]) : null }];
  }),
  'app.xpBarBlock': ui('draws the experience held for the battle', (c) => {
    // every warrior with held experience is named as core names him
    const html = String(c.ret);
    const names = [...new Set(core.pendingXp(ctx(c.w)).map((x) => { const m = model(c, x.uid); return m ? core.modelLabel(ctx(c.w), m) : x.name; }))];
    return [names.filter((n) => !unescapeHtml(html).includes(n)), []];
  }),
  'app.casFormBlock': ui('draws the casualty form', (c) => {
    // the warriors offered for the chosen sides are the ones core offers
    const cd = c.w.cd;
    if (!cd) return [[], []];
    const offered = new Set(optionNames(String(c.ret)).map(unescapeHtml));
    const want = [cd.vSideKey, cd.aSideKey].filter(Boolean).flatMap((k) => core.sideModels(ctx(c.w), c.w.cf, k).map((o) => o.label));
    return [want.filter((n) => ![...offered].some((o) => o.includes(n))), []];
  }),
  'app.casListBlock': ui('draws the casualty list; the roll options come from casualtyRollOptions', (c) => {
    const html = String(c.ret);
    const labels = core.unrolledCasualties(ctx(c.w), c.args[0]).flatMap((r) => core.casualtyRollOptions(ctx(c.w), r).map((o) => o.label));
    return [labels.filter((l) => !unescapeHtml(html).includes(l)), []];
  }),
  'app.postbattleBlock': ui('draws the post-battle checklist; its steps come from pbActiveStep and pbStepDone'),
  'info.itipBuild': ui('composes a tooltip', (c) => {
    return [coreTip(data, c.args[0]), parseTip(c.ret)];
  }),
  'tts.ttsOpen': ui('opens the Tabletop Simulator card of a warrior', (c) => {
    const m = model(c, c.args[0]);
    const lm = (c.L.state.S as WarbandState).models.find((x) => x.uid === c.args[0]);
    return m && lm ? [[core.ttsName(ctx(c.w), m), core.ttsText(ctx(c.w), m)], [c.L.tts.ttsName(lm), c.L.tts.ttsText(lm)]] : [null, null];
  }),
  'tts.ttsOpenMember': ui('opens the Tabletop Simulator card of one man of a group', (c) => {
    const m = model(c, c.args[0]);
    const lm = (c.L.state.S as WarbandState).models.find((x) => x.uid === c.args[0]);
    if (!m || !lm) return [null, null];
    const who = core.memberName(ctx(c.w), m, Number(c.args[1]) || 0);
    return [[core.ttsNameFor(who, false), core.ttsText(ctx(c.w), m)], [c.L.tts.ttsNameFor(c.L.app.memberName(lm, Number(c.args[1]) || 0), false), c.L.tts.ttsText(lm)]];
  }),
  'pdf.exportOfficialSheet': ui('downloads the official roster sheet; core must build it from the same state', async (c) => {
    const lib = (globalThis as { PDFLib?: PdfLib }).PDFLib;
    if (!lib) return [null, null];
    const out = await core.buildOfficialSheet(ctx(c.w), lib, new Uint8Array(readFileSync(TEMPLATE)));
    return [out.bytes.length > 0, true];
  }),

  /* ---- legacy's own machinery ---- */
  'state.replaceState': ui('sets the whole legacy state; in core a state is a value', undefined, true),
  'state.resyncUid': ui('the legacy uid counter; core keeps it in the state (uidSeq)'),
  'state.nextUid': ui('draws a uid from the legacy counter; core keeps it in the state (uidSeq)', undefined, true),
};

/* Taking a closed battle over into the save (phase 4a4, ADR 0016) and the
   post-battle sequence read from it: the Roster Builder's battle form and
   rules, once per battle. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import type { BattleView, Entry, Side } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { groupChanges, lineOf, previewChanges } from './changes.ts';
import { draftOf, localBattle, takeOverBattle } from './takeover.ts';
import { aftermathView, grantBattleXp } from './view.ts';

const ME = 'w-caravan', SK = 'w-skrittle', GP = 'w-penitents';
const T = '2026-10-05T20:00:00.000Z';
const ours = (uid: number, name: string, grade: 'hero' | 'hench', idx = 0): Side => ({ warbandId: ME, uid, idx, name, grade, wb: 'merc' });
const theirs = (warbandId: string, uid: number, name: string, wb: string): Side => ({ warbandId, uid, idx: 0, name, grade: 'hench', wb });
let n = 0;
const cas = (victim: Side, attacker: Side | null, turn = 2): Entry => ({ id: `e${++n}`, turn, kind: 'casualty', payload: { victim, attacker, note: '' }, author: 'Anna', createdAt: T, updatedAt: T });

/** One of ours out of action by a Skaven, the Captain putting a Skaven out of action, a Swordsman by the surroundings – and two others' business. */
const ENTRIES = (): Entry[] => [
  cas(ours(2, 'Champion', 'hero'), theirs(SK, 7, 'Skritch', 'skaven')),
  cas(theirs(SK, 9, 'Gnawer', 'skaven'), ours(1, 'Mercenary Captain', 'hero')),
  cas(ours(4, 'Swordsman', 'hench'), { name: 'The surroundings', env: true }),
  // nobody of ours: not this warband's chronicle
  cas(theirs(GP, 3, 'Sister Ada', 'sos'), theirs(SK, 7, 'Skritch', 'skaven')),
  { id: 'ev', turn: 3, kind: 'event', payload: { text: 'The ferry burns.' }, author: 'Anna', createdAt: T, updatedAt: T },
];

function battle(entries: Entry[] = ENTRIES()): BattleView {
  return {
    battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Hel Fenn ferry', scenario: '', district: 'artisanquarter', status: 'closed', turn: 6, createdAt: T, updatedAt: T, closedAt: T },
    seq: 9,
    participants: [
      { warbandId: ME, name: 'The Silver Caravan', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 },
      { warbandId: SK, name: 'Clan Skrittle', wbType: 'skaven', wbName: 'Skaven', playerId: 'u2', player: 'Ben', outcome: 'defeat', revBefore: 1 },
      { warbandId: GP, name: 'The Grey Penitents', wbType: 'sos', wbName: 'Sisters of Sigmar', playerId: 'u3', player: 'Anna', outcome: 'defeat', revBefore: 1 },
    ],
    entries,
    proposals: [],
  };
}

const ctx = (s: WarbandState) => core.ctxOf(data, s);

describe('taking a battle over', () => {
  it('after a history (4a5): a save still at Setup takes the history’s last stage first – no stages closed before it, only the one before the battle', () => {
    const s0 = sampleSave();
    s0.models[0]!.miss = 1;
    const view = battle();
    view.battle.round = 5;
    const s = takeOverBattle(data, s0, view, ME, '2026-10-05', 4);
    expect(s.campaign!.round).toBe(5);
    // the stage "After battle 4" closed with its snapshot, the game missed served there – none before
    expect(Object.keys(s.campaign!.snapshots ?? {})).toEqual(['4']);
    expect(s.models[0]!.miss).toBe(0);
    expect((s.campaign!.log ?? []).filter((e) => e.type === 'missed').map((e) => e.round)).toEqual([4]);
    // without the history, each stage up to the battle closes, as the Roster Builder's "Next stage" did
    expect(Object.keys(takeOverBattle(data, sampleSave(), view, ME, '2026-10-05').campaign!.snapshots ?? {})).toEqual(['0', '1', '2', '3', '4']);
  });

  it('records it as the battle form would: the stage moved on, every side, the casualties this warband was part of, the map', () => {
    const s0 = sampleSave();
    const s = takeOverBattle(data, s0, battle(), ME, '2026-10-05');
    const camp = s.campaign!;
    expect(camp.round).toBe(1);
    expect(Object.keys(camp.snapshots ?? {})).toEqual(['0']);
    const b = localBattle(s, 'b-1')!;
    expect(b).toMatchObject({ round: 1, serverId: 'b-1' });
    expect(camp.battles![0]).toMatchObject({ outcome: 'Victory', notes: 'Hel Fenn ferry', district: 'artisanquarter', sides: [{ key: 'me', outcome: 'Victory' }, { key: '', name: 'Clan Skrittle', outcome: 'Defeat' }, { key: '', name: 'The Grey Penitents' }] });
    const mine = (camp.casualties ?? []).filter((c) => c.battleId === b.id);
    expect(mine.map((c) => [c.victim.name, c.victim.uid, c.attacker.name, c.result])).toEqual([
      ['Champion', 2, 'Skritch', 'pending'],
      ['Gnawer', null, 'Mercenary Captain', 'pending'],
      ['Swordsman', 4, 'The surroundings', 'pending'],
    ]);
    // the Captain holds +1 for Gnawer; the surroundings earn nobody anything
    expect(core.pendingXp(ctx(s)).map((x) => [x.uid, x.amount, x.reason])).toEqual([[1, 1, 'put Gnawer out of action']]);
    // won there: a foothold
    expect(camp.districts?.artisanquarter).toBe('foothold');
    // once per battle
    expect(takeOverBattle(data, s, battle(), ME, '2026-10-06')).toBe(s);
  });

  it('a warrior picked from the Fallen is recorded dead and tied to his entry; one fallen since the game night is found by name', () => {
    const s0 = core.killHero(ctx(sampleSave()), 2);
    const view = battle([cas({ ...ours(2, 'Champion', 'hero'), idx: undefined, fallenIdx: 0 }, theirs(SK, 7, 'Skritch', 'skaven'))]);
    const s = takeOverBattle(data, s0, view, ME, '2026-10-05');
    const [c] = s.campaign!.casualties!.filter((x) => x.battleId === localBattle(s, 'b-1')!.id);
    expect(c).toMatchObject({ result: 'dead', fallenId: 0, fallenRef: s.fallen![0]!.id });
    // picked alive at the table, fallen on the roster since: the pick falls back to his name
    expect(draftOf(data, s0, battle([cas(ours(2, 'Champion', 'hero'), null)]), ME).cas[0]).toMatchObject({ vPick: 'f0' });
  });
});

describe('the post-battle sequence on the save', () => {
  it('starts with the injuries; experience is granted once; the dice and the sale read the roster', () => {
    const s0 = sampleSave();
    expect(aftermathView(data, s0, 'b-1')).toBeNull();
    let s = takeOverBattle(data, s0, battle(), ME, '2026-10-05');
    let a = aftermathView(data, s, 'b-1')!;
    expect(a.steps.map((x) => [x.key, x.active, x.locked])[0]).toEqual(['injuries', true, false]);
    expect(a.steps[1]).toMatchObject({ key: 'experience', active: false, locked: true });
    expect(a.casualties.map((c) => [c.ours, c.open])).toEqual([[true, true], [false, false], [true, true]]);
    expect(a.toRoll).toBe(2);
    // the Champion is out of action: the Captain and the Youngblood search, one die for the win
    expect(a.explore).toMatchObject({ survivors: 2, winDie: 1, capped: 3 });

    s = core.injure(ctx(s), 2, { hero: { code: '41-55' } });
    s = core.injure(ctx(s), 4, { d6: 5, member: 0 });
    s = core.setPostBattleStep(ctx(s), 'injuries', true, 1);
    a = aftermathView(data, s, 'b-1')!;
    expect(a.toRoll).toBe(0);
    expect(a.steps[1]).toMatchObject({ key: 'experience', active: true });
    s = grantBattleXp(data, ctx(s), a.local.id);
    a = aftermathView(data, s, 'b-1')!;
    expect(a.xpAwarded).toBe(true);
    // everyone survived; the leader won
    expect(a.pendingXp.filter((x) => x.reason === 'survived the battle')).toHaveLength(4);
    expect(a.pendingXp.filter((x) => x.reason === 'led the winning warband')).toHaveLength(1);
    s = core.applyBattleResults(ctx(s));
    expect(aftermathView(data, s, 'b-1')!.pendingXp).toEqual([]);
    expect(s.models.find((m) => m.uid === 1)!.exp).toBe(42 + 2);

    s = core.stashAdjust(ctx(s), 'wyrd', 3);
    a = aftermathView(data, s, 'b-1')!;
    expect(a.wyrd).toMatchObject({ shards: 3, sold: null });
    expect(a.wyrd.price(3)).toBe(core.wyrdPrice(ctx(s), 3));
  });
});

describe('what changed', () => {
  it('found and explained as the server freezes it; in words, by warrior, the warband last', () => {
    const before = sampleSave();
    let s = takeOverBattle(data, before, battle(), ME, '2026-10-05');
    s = core.applyPendingXp(ctx(s));
    // a characteristic risen with no advance rolled
    s = { ...s, models: s.models.map((m) => (m.uid === 2 ? { ...m, adv: { ...(m.adv ?? {}), WS: (Number(m.adv?.WS) || 0) + 1 } } : m)) };
    const changes = previewChanges(data, before, s, 'b-1', 1);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'experience', uid: 1, unexplained: false, eventRef: expect.stringMatching(/^evt:/) }),
      expect.objectContaining({ kind: 'stat', uid: 2, unexplained: true }),
      expect.objectContaining({ kind: 'district', unexplained: false }),
    ]));
    const groups = groupChanges(changes, s, data);
    expect(groups.map((g) => g.name)).toEqual(['Mercenary Captain', 'Champion', 'The warband']);
    expect(groups[0]!.lines[0]).toMatchObject({ what: 'Experience', from: '42', to: '43', why: 'Mercenary Captain gained 1 experience.' });
    expect(groups[1]!.lines[0]).toMatchObject({ what: 'WS', to: '+1', unexplained: true, why: null });
    expect(lineOf({ kind: 'gold', uid: null, name: '', changeKey: 'k', payload: { before: 35, after: 55 }, eventRef: null, unexplained: false })).toEqual({ what: 'Gold', from: '35 gc', to: '55 gc' });
  });
});

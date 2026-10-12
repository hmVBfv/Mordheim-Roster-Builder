/* core/narrative/life: a warrior's life, derived from the marks' frozen
   changes with their explanations, the protocol he took part in and the
   notes that mention him – or from the save's own chronicle before any mark. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { LifeChange, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** The silver caravan before and after its first battle: the champion puts an enemy down and advances, the captain falls. */
function battle() {
  let before: WarbandState = { ...core.newWarband(data, 'merc'), name: 'Silver Caravan', campaign: { on: true, districts: {} } };
  for (const u of ['capt', 'champ', 'warr']) before = core.addUnit(ctx(before), u);
  const [capt, champ] = before.models;
  // the battle is the campaign's first: what happens in it is recorded under round 1
  let a: WarbandState = { ...before, campaign: { ...before.campaign!, round: 1 } };
  a = core.addCasualty(ctx(a), { victim: { name: 'Assassin Adept', wb: 'skaven' }, attacker: { uid: champ!.uid, name: 'Champion' } });
  a = core.addCasualty(ctx(a), { victim: { uid: capt!.uid, name: 'Mercenary Captain', wb: 'merc' }, attacker: { name: 'Assassin Adept', wb: 'skaven' } });
  a = core.resolveCasualtyRoll(ctx(a), a.campaign!.casualties!.at(-1)!.id, '11-15');
  a = core.applyPendingXp(ctx(a));
  a = core.setModelExp(ctx(a), champ!.uid, 2);
  a = core.addAdvance(ctx(a), champ!.uid, 'WS');
  const log = a.campaign!.log!;
  const cas = a.campaign!.casualties!;
  const changes = core.reconcile(core.diffWarbands(data, before, a, 1), { log, casualties: cas }) as unknown as LifeChange[];
  return { before, after: a, capt: capt!.uid, champ: champ!.uid, changes };
}

describe('lifeOf', () => {
  const b = battle();
  const wsKey = b.changes.find((c) => c.kind === 'stat')!.changeKey;

  it('with a mark: the changes with what the player wrote, then the protocol he is not already in', () => {
    const after = core.setExplanation(ctx(b.after), wsKey, 'He learned from watching the captain die.');
    const life = core.lifeOf(data, after, { uid: b.champ, marks: [{ round: 1, changes: b.changes }] });
    expect(life.map((e) => [e.round, e.kind, e.text, e.why])).toEqual([
      // he put the adept down: nothing of his own changes by it, so the protocol stands
      [1, 'protocol', 'Assassin Adept (Skaven) was put out of action by Champion.', undefined],
      [1, 'change', '+1 WS.', 'He learned from watching the captain die.'],
    ]);
  });

  it('marks a change without cause and without explanation, and not one that was explained', () => {
    const lonely = core.addAdvance(ctx(core.setModelExp(ctx(b.before), b.champ, 2)), b.champ, 'BS');
    const changes = core.reconcile(core.diffWarbands(data, b.before, { ...lonely, campaign: b.before.campaign }, 1), { log: [], casualties: [] }) as unknown as LifeChange[];
    const key = changes.find((c) => c.kind === 'stat')!.changeKey;
    const bare = core.lifeOf(data, b.before, { uid: b.champ, marks: [{ round: 1, changes }] });
    expect(bare.find((e) => e.kind === 'change')).toMatchObject({ unexplained: true });
    const said = core.lifeOf(data, core.setExplanation(ctx(b.before), key, 'Years in the cellar.'), { uid: b.champ, marks: [{ round: 1, changes }] });
    const line = said.find((e) => e.kind === 'change')!;
    expect(line.why).toBe('Years in the cellar.');
    expect(line.unexplained).toBeUndefined();
  });

  it('does not repeat in the protocol what a change of his already says', () => {
    const life = core.lifeOf(data, b.after, { uid: b.capt, marks: [{ round: 1, changes: b.changes }] });
    const texts = life.map((e) => e.text);
    // the captain's death is one line (the change), not two
    expect(life.filter((e) => /slain|fell|dead/i.test(e.text))).toHaveLength(1);
    expect(texts.every((t) => t.length > 0)).toBe(true);
  });

  it('keeps to the one warrior, notes included, in the order of the story, the campaign’s own notes last', () => {
    const life = core.lifeOf(data, b.after, {
      uid: b.champ,
      marks: [{ round: 1, changes: b.changes }],
      notes: [
        { id: 'n2', round: null, text: 'Remembered at the inn.', kind: 'general', author: 'Rob', at: '2026-10-05T10:00:00Z' },
        { id: 'n1', round: 1, text: 'He held the gangway.', kind: 'scene', author: 'Anna', at: '2026-10-05T09:00:00Z' },
      ],
    });
    expect(life.map((e) => e.key.split(':')[0])).toEqual(['p', 'c', 'n', 'n']);
    expect(life.at(-1)).toMatchObject({ kind: 'note', round: null, by: 'Rob' });
    expect(life.some((e) => e.text.includes('Mercenary Captain'))).toBe(false);
  });

  it('without a mark: the save’s own chronicle stands in for the changes', () => {
    const life = core.lifeOf(data, b.after, { uid: b.champ });
    expect(life.map((e) => [e.round, e.kind])).toEqual([[0, 'event'], [1, 'protocol'], [1, 'event']]);
    expect(life[0]!.text).toMatch(/Recruited/);
    expect(life[2]!.text).toMatch(/advanced \+1 WS/);
  });

  it('a Hired Sword by his text uid', () => {
    const s = { ...b.after, hired: [{ key: 'ogre', uid: 'hs1' }] } as WarbandState;
    const hired: LifeChange = { kind: 'hired', uid: null, hireUid: 'hs1', name: 'Ogre Bodyguard', changeKey: '1:hs1:hired:ogre', payload: {}, eventRef: null, unexplained: false };
    const life = core.lifeOf(data, core.setExplanation(ctx(s), hired.changeKey, 'Hired at the Blind Cat.'), { uid: 'hs1', marks: [{ round: 1, changes: [hired, ...b.changes] }] });
    expect(life).toHaveLength(1);
    expect(life[0]).toMatchObject({ kind: 'change', round: 1, why: 'Hired at the Blind Cat.' });
    expect(life[0]!.text).toMatch(/hired/);
  });

  it('is empty for a warrior nothing has happened to, and names the rounds', () => {
    expect(core.lifeOf(data, b.after, { uid: 999 })).toEqual([]);
    expect([0, 3, null].map(core.lifeLabel)).toEqual(['Founding', 'Battle 3', 'The campaign']);
  });
});

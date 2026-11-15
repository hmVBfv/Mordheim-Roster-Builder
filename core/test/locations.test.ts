/* N7: the thirty places of the Exploration chart as steps – each can be walked to its end with answers, and what it brings is what the rules page
   says (mordheimer.net, Campaigns: Income, read 13.11.2026). Rob, 13.11.2026: Undead = siteRace Undead, Possessed = demon-like. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Answer, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function warband(wb = 'merc'): { s: WarbandState; hero: number } {
  let s = { ...core.newWarband(data, wb), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS[wb]!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  return { s, hero: s.models.find((m) => core.isHeroModel(ctx(s), m))!.uid };
}

/** Walks a place to its end, answering each question with `pick(question)`. */
function walk(s: WarbandState, key: string, pick: (q: core.Question) => Answer): core.Resolution {
  const answers: Record<string, Answer> = {};
  for (let i = 0; i < 40; i++) {
    const r = core.resolveLocation(ctx(s), key, answers);
    if (r.done) return r;
    expect(r.question, `${key}: a question while not done`).not.toBeNull();
    answers[r.question!.id] = pick(r.question!);
  }
  throw new Error(`${key} never ends`);
}
const lowest = (hero: number) => (q: core.Question): Answer => {
  if (q.kind === 'roll') return q.dice ? Array(q.min).fill(1) : (q.min as number);
  if (q.kind === 'pass') return true;
  if (q.kind === 'hero') return hero;
  return q.options![0]!.id;
};
const rolls = (...values: Answer[]) => { const rest = [...values]; return (q: core.Question): Answer => (q.kind === 'roll' ? (rest.shift() ?? (q.dice ? Array(q.min).fill(1) : (q.min as number))) : q.kind === 'pass' ? true : q.kind === 'hero' ? -1 : q.options![0]!.id); };

describe('the data of the places', () => {
  it('every place of the chart has its steps, and nothing else does', () => {
    expect(Object.keys(data.PB_LOCATION_RULES).sort()).toEqual(data.PB_LOCATIONS.map((l) => l[0]).sort());
  });
  it('every item found is in the catalogue, and the six artefacts are named', () => {
    const items = new Set<string>();
    const scan = (x: unknown): void => {
      if (Array.isArray(x)) x.forEach(scan);
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k === 'item') (Array.isArray(v) ? v : [v]).forEach((n) => items.add(String(n))); else scan(v); }
    };
    scan(data.PB_LOCATION_RULES);
    for (const n of items) expect(data.CATALOG.some((c) => c.en.toLowerCase() === n.toLowerCase()), n).toBe(true);
    expect(data.PB_ARTEFACTS.map((a) => a[0])).toHaveLength(6);
  });
});

describe('every place can be walked to its end, for every kind of warband', () => {
  const kinds: [string, string][] = [['merc', 'anyone else'], ['skaven', 'skaven'], ['undead', 'undead'], ['possessed', 'possessed'], ['sos', 'sisters'], ['wh', 'witch hunters'], ['carnival', 'carnival (demonic)']];
  for (const [wb, label] of kinds) {
    it(label, () => {
      const { s, hero } = warband(wb);
      for (const key of Object.keys(data.PB_LOCATION_RULES)) {
        const r = walk(s, key, lowest(hero));
        expect(r.problems, `${key} (${label})`).toEqual([]);
        expect(r.finds.length + r.perks.length, `${key} (${label}) brings something`).toBeGreaterThan(0);
      }
    });
  }
});

describe('the traits of a warband', () => {
  it('Undead is siteRace Undead – not a Vampire; Possessed is the demonic ones; Skaven; the Sisters and the Witch Hunters', () => {
    const t = (wb: string) => core.warbandTags(ctx(warband(wb).s));
    expect(t('undead')).toEqual(['undead']);
    expect(t('strigos')).toEqual([]); // siteRace Vampire
    expect(t('possessed')).toEqual(['possessed']);
    expect(t('carnival')).toEqual(['possessed']);
    expect(t('skaven')).toEqual(['skaven']);
    expect(t('sos')).toEqual(['sisters']);
    expect(t('wh')).toEqual(['witchhunters']);
    expect(t('merc')).toEqual([]);
  });
});

describe('what the places bring', () => {
  const merc = () => warband();
  it('the Well: a Hero is chosen; passed finds a shard, failed means he misses the next game', () => {
    const { s, hero } = merc();
    let r = core.resolveLocation(ctx(s), '1 1', {});
    expect(r.question).toMatchObject({ kind: 'hero' });
    r = core.resolveLocation(ctx(s), '1 1', { [r.question!.id]: hero });
    expect(r.question).toMatchObject({ kind: 'pass' });
    const q = r.question!.id;
    const ok = core.resolveLocation(ctx(s), '1 1', { 's.0': hero, [q]: true });
    expect(ok.finds).toMatchObject([{ kind: 'wyrd', amount: 1 }]);
    const bad = core.resolveLocation(ctx(s), '1 1', { 's.0': hero, [q]: false });
    expect(bad.finds).toMatchObject([{ kind: 'note', act: 'miss', uid: hero }]);
  });

  it('the Shop: D6 gc, and a Lucky Charm on a 1', () => {
    const { s } = merc();
    expect(walk(s, '2 2', rolls(4)).finds.map((f) => [f.kind, f.amount ?? f.item])).toEqual([['gold', 4]]);
    expect(walk(s, '2 2', rolls(1)).finds.map((f) => [f.kind, f.amount ?? f.item])).toEqual([['gold', 1], ['item', 'Lucky charm']]);
  });

  it('the Corpse: 1–2 coins, 3 a dagger, 4 an axe, 5 a sword, 6 light armour', () => {
    const { s } = merc();
    const f = (r: number, again?: number) => walk(s, '3 3', rolls(r, ...(again ? [again] : []))).finds[0]!;
    expect(f(2, 5)).toMatchObject({ kind: 'gold', amount: 5 });
    expect([3, 4, 5, 6].map((r) => f(r).item)).toEqual(['Dagger', 'Axe', 'Sword', 'Light armour']);
  });

  it('the Straggler: Skaven sell him (2D6 gc), the Possessed sacrifice him (+1 for the leader), the Undead get a Zombie, others a die more next time', () => {
    const sk = walk(warband('skaven').s, '4 4', rolls(7));
    expect(sk.finds).toMatchObject([{ kind: 'gold', amount: 7 }]);
    const po = walk(warband('possessed').s, '4 4', rolls());
    expect(po.finds).toMatchObject([{ kind: 'exp', amount: 1 }]);
    expect(po.finds[0]!.uid).toBeDefined(); // the leader
    expect(walk(warband('undead').s, '4 4', rolls()).finds[0]!.text).toMatch(/Zombie/);
    const other = walk(merc().s, '4 4', rolls());
    expect(other.perks).toEqual([expect.objectContaining({ id: 'straggler', explore: { dice: 1, drop: 1 } })]);
  });

  it('the Overturned Cart: a map, a purse of 2D6 gc, or a jewelled sword and dagger worth twice as much', () => {
    const { s } = merc();
    expect(walk(s, '5 5', rolls(2)).finds[0]).toMatchObject({ item: 'Mordheim map' });
    expect(walk(s, '5 5', rolls(4, 9)).finds[0]).toMatchObject({ kind: 'gold', amount: 9 });
    const j = walk(s, '5 5', rolls(6)).finds;
    expect(j.map((f) => f.item)).toEqual(['Sword', 'Dagger']);
    expect(j[0]).toMatchObject({ worthMult: 2, worth: 2 * (data.CATALOG.find((c) => c.en === 'Sword')!.cost as number) });
  });

  it('the Tavern: the leader’s Leadership test; the Undead, Witch Hunters and Sisters pass without one', () => {
    const { s } = merc();
    expect(core.resolveLocation(ctx(s), '1 1 1', {}).question).toMatchObject({ kind: 'pass' });
    expect(walk(s, '1 1 1', (q) => (q.kind === 'pass' ? true : 12)).finds[0]).toMatchObject({ amount: 12 }); // passed: 4D6
    expect(walk(s, '1 1 1', (q) => (q.kind === 'pass' ? false : 3)).finds[0]).toMatchObject({ amount: 3 }); // failed: D6
    for (const wb of ['undead', 'wh', 'sos']) expect(core.resolveLocation(ctx(warband(wb).s), '1 1 1', {}).question, wb).toMatchObject({ kind: 'roll', expr: '4D6' });
  });

  it('the Prisoners by warband: Possessed D3 experience, Undead D3 Zombies, Skaven 3D6 gc, the others 2D6 gc and a recruit', () => {
    expect(walk(warband('possessed').s, '3 3 3', rolls(2)).finds[0]).toMatchObject({ kind: 'exp', amount: 2 });
    expect(walk(warband('skaven').s, '3 3 3', rolls(10)).finds[0]).toMatchObject({ kind: 'gold', amount: 10 });
    const other = walk(merc().s, '3 3 3', rolls(8)).finds;
    expect(other[0]).toMatchObject({ kind: 'gold', amount: 8 });
    expect(other[1]!.text).toMatch(/Henchman/);
  });

  it('the Graveyard: loot D6×10 and the hatred of the Sisters and Witch Hunters – or, for them, D6 experience', () => {
    const loot = walk(merc().s, '5 5 5 5', rolls(3));
    expect(loot.finds[0]).toMatchObject({ kind: 'gold', amount: 30 });
    expect(loot.perks[0]!.id).toBe('graveyard-hate');
    for (const wb of ['sos', 'wh']) expect(walk(warband(wb).s, '5 5 5 5', rolls(4)).finds).toMatchObject([{ kind: 'exp', amount: 4 }]);
  });

  it('the Merchant’s House: 2D6×5 gc – but a double is the Freetraders’ symbol instead', () => {
    const { s } = merc();
    expect(core.resolveLocation(ctx(s), '4 4 4 4 4', {}).question).toMatchObject({ kind: 'roll', dice: true });
    expect(walk(s, '4 4 4 4 4', rolls([2, 5])).finds[0]).toMatchObject({ kind: 'gold', amount: 35 });
    const dbl = walk(s, '4 4 4 4 4', rolls([3, 3]));
    expect(dbl.finds.find((f) => f.kind === 'gold')).toBeUndefined();
    expect(dbl.perks).toMatchObject([{ id: 'freetrader' }]);
  });

  it('the Entrance to the Catacombs: one re-roll from now on, and only once', () => {
    expect(walk(merc().s, '6 6 6 6 6', rolls()).perks).toEqual([expect.objectContaining({ id: 'catacombs-entrance', unique: true, explore: { reroll: 1 } })]);
  });

  it('the Pit: a Hero may be sent; a 1 and he is never seen again, 2+ and he returns with D6+1 shards', () => {
    const { s, hero } = merc();
    const pick = (a: number, shards: number) => (q: core.Question): Answer => (q.kind === 'hero' ? hero : q.kind === 'roll' ? (q.expr === 'D6' && q.label === 'Roll a D6' ? a : shards) : true);
    expect(walk(s, '1 1 1 1 1 1', pick(1, 4)).finds).toMatchObject([{ act: 'lose', uid: hero }]);
    expect(walk(s, '1 1 1 1 1 1', pick(3, 5)).finds).toMatchObject([{ kind: 'wyrd', amount: 6 }]);
    expect(walk(s, '1 1 1 1 1 1', (q) => (q.kind === 'hero' ? 'none' : 1)).finds).toEqual([]);
  });

  it('Hidden Treasure: 5D6×5 gc sure, then each item on its own roll (4+ or 5+)', () => {
    const { s } = merc();
    // gold 15 → 75; wyrdstone 4 (D3: 2); relic 5; heavy armour 3 (no); gems 4 (D3: 3); cloak 2 (no); tome 5; artefact 1 (no)
    const r = walk(s, '2 2 2 2 2 2', rolls(15, 4, 2, 5, 3, 4, 3, 2, 5, 1));
    expect(r.finds.map((f) => [f.kind, f.amount ?? f.item, f.qty])).toEqual([['gold', 75, undefined], ['wyrd', 2, undefined], ['item', 'Holy (unholy) relic', 1], ['item', 'Gems', 3], ['item', 'Holy tome', 1]]);
    expect(r.finds.find((f) => f.gem)).toMatchObject({ worth: 10, gem: true }); // D3 gems of 10 gc each
    expect(r.problems).toEqual([]);
  });

  it('the Slaughtered Warband: gold and daggers sure, the rest on each roll', () => {
    const { s } = merc();
    const r = walk(s, '4 4 4 4 4 4', rolls(10, 3, ...[1, 1, 1, 1, 1, 1, 1, 1]));
    expect(r.finds.map((f) => [f.kind, f.amount ?? f.item, f.qty])).toEqual([['gold', 50, undefined], ['item', 'Dagger', 3]]);
  });

  it('the Fighting Arena: sell the manual for 100 gc, or a Hero reads it and gets the Combat skills', () => {
    const { s, hero } = merc();
    expect(walk(s, '5 5 5 5 5 5', (q) => (q.kind === 'choice' ? 'sell' : 0)).finds).toMatchObject([{ kind: 'gold', amount: 100 }]);
    const read = walk(s, '5 5 5 5 5 5', (q) => (q.kind === 'choice' ? 'read' : hero));
    expect(read.perks).toMatchObject([{ id: 'combat-manual', uid: hero }]);
  });

  it('the Noble’s Villa: gold, vials of Crimson Shade, or a magical artefact from the table', () => {
    const { s } = merc();
    expect(walk(s, '6 6 6 6 6 6', rolls(1, 4)).finds[0]).toMatchObject({ kind: 'gold', amount: 40 });
    expect(walk(s, '6 6 6 6 6 6', rolls(3, 5)).finds[0]).toMatchObject({ item: 'Crimson shade', qty: 5 });
    expect(walk(s, '6 6 6 6 6 6', rolls(6, 4)).finds[0]).toMatchObject({ item: 'Bow of Seeking' });
  });

  it('an answer that is not a roll of the dice is refused and asked again', () => {
    const { s } = merc();
    const r = core.resolveLocation(ctx(s), '2 2', { 's.0.d.0': 9 });
    expect(r.problems.length).toBeGreaterThan(0);
    expect(r.question).toMatchObject({ id: 's.0.d.0', kind: 'roll', min: 1, max: 6 });
  });
});

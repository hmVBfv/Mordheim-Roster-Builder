/* Cleaning saves before they become fixtures (core/src/format/sanitize.ts). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';
import { generateFixtures } from './support/fixtures.ts';

const data = loadGameData();
const clean = (x: unknown) => core.sanitizeSave(data, x) as Record<string, unknown>;

/* A save with every kind of text a player writes. */
const written = () => ({
  wb: 'sos', name: 'The Grey Penitents',
  story: { chapters: ['what the leader knows'] },
  house: { notes: 'we play the pits with a D6', startGold: '' },
  models: [
    { uid: 1, uid_def: 'matri', name: 'Mother Hildegard', profile: { text: 'born in Nuln, hates bats', title: 'Abbess' } },
    { uid: 2, uid_def: 'augur', name: 'Ottilie' },
  ],
  fallen: [{ kind: 'hero', m: { uid: 3, uid_def: 'super', name: 'Sister Agna', profile: { text: 'secretly a witch' } } }],
  campaign: {
    on: true, round: 2,
    log: [
      { id: 1, round: 1, type: 'note', text: 'Anna brought cake', auto: false },
      { id: 2, round: 1, type: 'battle', text: 'Battle 1: fought Clan Skrittle — Victory.', auto: true },
      { id: 3, round: 1, type: 'note', text: '', auto: false },
      { id: 9, round: 1, type: 'casualty', text: 'Sniv was put out of action — and Ben cheered', auto: true, edited: true },
    ],
    battles: [{ id: 4, round: 1, notes: 'rats everywhere' }, { id: 5, round: 2, notes: '' }],
    casualties: [
      { id: 6, round: 1, victim: { uid: 2, name: 'Ottilie' }, attacker: { name: 'Sniv' }, result: 'injured', detail: 'Blinded in one eye', note: 'fell off the ferry' },
      { id: 7, round: 1, victim: { name: 'Sniv' }, attacker: { uid: 1 }, result: 'dead', detail: 'drowned in the Stir', note: '' },
      { id: 8, round: 2, victim: { name: 'Gerd' }, attacker: {}, result: 'pending', detail: '' },
    ],
    snapshots: { 1: { models: [{ uid: 1, uid_def: 'matri', profile: { text: 'old background' } }], story: 'x' } },
  },
});

describe('sanitizeSave', () => {
  it('takes out the story and every background', () => {
    const s = clean(written());
    expect(s.story).toBeUndefined();
    const text = JSON.stringify(s);
    for (const secret of ['what the leader knows', 'born in Nuln', 'secretly a witch', 'old background']) expect(text).not.toContain(secret);
    // what else sits in the profile stays
    expect((s.models as { profile?: object }[])[0]!.profile).toEqual({ title: 'Abbess' });
  });

  it('replaces what players wrote with placeholders, and leaves empty texts empty', () => {
    const s = clean(written()) as unknown as ReturnType<typeof written>;
    expect(s.house.notes).toBe(core.SANITIZED.notes);
    // a generated entry stays unless a player corrected it
    expect(s.campaign.log.map((e) => e.text)).toEqual([core.SANITIZED.note, 'Battle 1: fought Clan Skrittle — Victory.', '', core.SANITIZED.note]);
    expect(s.campaign.battles.map((b) => b.notes)).toEqual([core.SANITIZED.notes, '']);
    expect(s.campaign.casualties.map((c) => [c.detail, c.note])).toEqual([
      ['Blinded in one eye', core.SANITIZED.note], // an injury result the app wrote stays
      [core.SANITIZED.detail, ''], // typed into the form: replaced
      ['', undefined],
    ]);
  });

  it('numbers the players of a campaign file, one number per person', () => {
    const cf = {
      type: core.CF_TYPE, version: 1, name: 'Autumn', round: 2, battles: [],
      log: [{ id: 1, round: 1, type: 'note', text: 'Ben is late again' }],
      warbands: [
        { id: 1, player: 'Rob', name: 'A', wb: 'merc', updated: '', roster: written() },
        { id: 2, player: ' Anna ', name: 'B', wb: 'sos', updated: '', roster: { wb: 'sos', models: [] } },
        { id: 3, player: 'Rob', name: 'C', wb: 'skaven', updated: '', roster: { wb: 'skaven', models: [] } },
        { id: 4, player: '', name: 'D', wb: 'skaven', updated: '', roster: { wb: 'skaven', models: [] } },
      ],
    };
    const s = clean(cf) as unknown as typeof cf;
    expect(s.warbands.map((w) => w.player)).toEqual(['Player 1', 'Player 2', 'Player 1', '']);
    expect(s.log[0]!.text).toBe(core.SANITIZED.note);
    expect(JSON.stringify(s)).not.toMatch(/Rob|Anna|Ben|born in Nuln|rats everywhere/);
  });

  it('is idempotent: a clean file comes back unchanged', () => {
    const once = clean(written());
    expect(clean(once)).toEqual(once);
  });

  it('changes nothing the rules read', () => {
    for (const f of generateFixtures(data, [1]).filter((_, i) => i % 4 === 0)) {
      const a = core.loadSave(data, f.state), b = core.loadSave(data, clean(f.state));
      if (!a.ok || !b.ok) throw new Error(`${f.label}: does not load`);
      const rules = (s: core.WarbandState) => {
        const c = core.ctxOf(data, s);
        return {
          warnings: core.warbandWarnings(c), units: core.unitSummary(c), gold: core.goldCurrent(c), spent: core.totalSpent(c),
          models: s.models.map((m) => [core.effProfile(c, m), core.modelTotalCost(c, m), core.advanceStatus(c, m)]),
        };
      };
      expect(rules(b.state), f.label).toEqual(rules(a.state));
    }
  });

  it('does not touch its input', () => {
    const w = written();
    const before = JSON.stringify(w);
    clean(w);
    expect(JSON.stringify(w)).toBe(before);
  });
});

/* Exports (phase 3e): the Tabletop Simulator cards, the readable text and
   the tool file, each worked out by core and each bringing the warband
   back where it should. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, sampleSave } from '../test/data.ts';
import { exportCtx, readableText, today, toolFile, ttsCards } from './exports.ts';

const sample = () => exportCtx(data, sampleSave());

describe('Tabletop Simulator cards', () => {
  it('one for each Hero and group, one for each man of a group, one for each hired', () => {
    let s = core.newWarband(data, 'merc');
    for (const id of ['capt', 'warr']) s = core.addUnit(core.ctxOf(data, s), id);
    s = core.setQty(core.ctxOf(data, s), s.models[1]!.uid, 2);
    s = core.setMemberName(core.ctxOf(data, s), s.models[1]!.uid, 0, 'Otto');
    s = core.hireHS(core.ctxOf(data, s), 'warlock');
    const ctx = exportCtx(data, s);
    const cards = ttsCards(ctx);
    expect(cards.map((c) => [c.label, c.group])).toEqual([
      ['Mercenary Captain', null], ['Warrior', null], ['Otto', 'Warrior'], ['Warrior 2', 'Warrior'], ['Warlock', null],
    ]);
    // the Heroes' darker gold, the rank and file's lighter one
    expect(cards[0]!.name).toBe('[B8860B]Mercenary Captain[-]');
    expect(cards[2]!.name).toBe('[E8C26B]Otto[-]');
    expect(cards[4]!.name).toBe('[B8860B]Warlock[-]');
    // a man carries his group's description
    expect(cards[2]!.text).toBe(cards[1]!.text);
    expect(cards[0]!.text).toContain('Special Rules:');
    expect(cards[4]!.text).toContain('Hired Sword');
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('match the Roster Builder’s texts (core ttsText)', () => {
    const ctx = sample();
    const m = ctx.s.models[0]!;
    expect(ttsCards(ctx).find((c) => c.id === `tts-${m.uid}`)!.text).toBe(core.ttsText(ctx, m));
  });
});

describe('the readable text and the tool file', () => {
  it('the text names the day and the stage, and imports back', () => {
    const ctx = sample();
    const r = readableText(ctx, new Date(2026, 9, 3, 12));
    expect(r.filename).toMatch(/_2026-10-03\.txt$/);
    expect(r.text).toContain('MORDHEIM-DATA:');
    const back = core.readSaveText(data, r.text);
    expect(back.ok && back.state.models.length).toBe(ctx.s.models.length);
  });

  it('the tool file carries the format and the gold in hand, and imports back', () => {
    const ctx = sample();
    const f = toolFile(ctx, 'test-version');
    expect(f.filename).toMatch(/\.json$/);
    const raw = JSON.parse(f.json) as Record<string, unknown>;
    expect(raw).toMatchObject({ format: core.FORMAT, appVersion: 'test-version', goldNow: core.goldCurrent(ctx) });
    const back = core.readSaveText(data, f.json);
    expect(back.ok && core.goldCurrent(core.ctxOf(data, back.state))).toBe(core.goldCurrent(ctx));
  });

  it('a day as file names write it', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

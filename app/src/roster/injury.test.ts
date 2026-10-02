/* What the injury sheet asks, and the roll its answers make (phase 3c, V1). */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { hatesDefault, questionOf, randomD66, rollFromDraft, saveQuestionOf, type InjuryEnv } from './injury.ts';
import { createWarband } from './view.ts';

const env = (over: Partial<InjuryEnv> = {}): InjuryEnv => ({
  districts: { morr: false, sigmar: false, gaol: false, amphitheatre: false },
  pegLeg: false, attacker: { name: 'Gorbag', wb: 'Orc Mob' }, oneEye: false, ...over,
});

describe('the roll from the answers', () => {
  it('a row without a question is complete with its dice', () => {
    expect(rollFromDraft({ dice: '22' }, env())).toEqual({ code: '22' });
    expect(rollFromDraft({ dice: '47' }, env())).toBe(null); // not a D66
    expect(rollFromDraft({ dice: '4' }, env())).toBe(null);
  });

  it('waits for the follow-up, then carries it', () => {
    expect(rollFromDraft({ dice: '23' }, env())).toBe(null);
    expect(rollFromDraft({ dice: '23', pick: '2-6' }, env())).toEqual({ code: '23', d6: 2 });
    expect(rollFromDraft({ dice: '35', pick: '3' }, env())).toEqual({ code: '35', games: 3 });
    expect(rollFromDraft({ dice: '61', pick: 'ransomed' }, env())).toBe(null);
    expect(rollFromDraft({ dice: '61', pick: 'ransomed', gold: '40' }, env())).toEqual({ code: '61', captured: { fate: 'ransomed', gold: 40 } });
  });

  it('Bitter Enmity names the attacker from the casualty record, and the player may change it', () => {
    expect(hatesDefault('1-3', env())).toBe('Gorbag');
    expect(hatesDefault('6', env())).toBe('every Orc Mob warband');
    expect(rollFromDraft({ dice: '56', pick: '5' }, env())).toEqual({ code: '56', d6: 5, hates: 'the Orc Mob' });
    expect(rollFromDraft({ dice: '56', pick: '1-3', hates: 'Gorbag the Bold' }, env())).toMatchObject({ hates: 'Gorbag the Bold' });
    expect(rollFromDraft({ dice: '56', pick: '1-3' }, env({ attacker: null }))).toBe(null);
  });

  it('Multiple Injuries: as many further results as the D6, none of them Dead, Captured or Multiple', () => {
    const d = { dice: '21', pick: '2', more: [{ dice: '22' }, { dice: '34' }] };
    expect(rollFromDraft(d, env())).toEqual({ code: '16-21', more: [{ code: '22' }, { code: '34' }] });
    expect(rollFromDraft({ ...d, more: [{ dice: '22' }] }, env())).toBe(null);
    expect(rollFromDraft({ ...d, more: [{ dice: '22' }, { dice: '61' }] }, env())).toBe(null);
  });

  it('a lost pit fight rolls again on 11–35', () => {
    expect(rollFromDraft({ dice: '65', pick: 'lost', then: { dice: '33' } }, env())).toEqual({ code: '65', pit: { won: false, then: { code: '33' } } });
    expect(rollFromDraft({ dice: '65', pick: 'lost', then: { dice: '35', pick: '1' } }, env())).toEqual({ code: '65', pit: { won: false, then: { code: '35', games: 1 } } });
    expect(rollFromDraft({ dice: '65', pick: 'lost', then: { dice: '36' } }, env())).toBe(null);
    expect(rollFromDraft({ dice: '65', pick: 'lost', then: { dice: '41' } }, env())).toBe(null);
  });

  it('districts ask their own D6 or decide by themselves', () => {
    const morr = env({ districts: { morr: true, sigmar: false, gaol: false, amphitheatre: false } });
    expect(saveQuestionOf('11-15', morr)?.saved).toBe('morr');
    expect(rollFromDraft({ dice: '12' }, morr)).toBe(null);
    expect(rollFromDraft({ dice: '12', save: 'save' }, morr)).toEqual({ code: '11-15', saved: 'morr' });
    expect(rollFromDraft({ dice: '12', save: 'stands' }, morr)).toEqual({ code: '11-15' });
    const gaol = env({ districts: { morr: false, sigmar: false, gaol: true, amphitheatre: false } });
    expect(questionOf('61', gaol)).toBe(null);
    expect(rollFromDraft({ dice: '61' }, gaol)).toEqual({ code: '61' });
    expect(saveQuestionOf('22', env({ pegLeg: true }))?.saved).toBe('peg');
    expect(saveQuestionOf('23', env({ pegLeg: true }))).toBe(null);
  });

  it('every row, answered, makes a roll core accepts', () => {
    let s = createWarband(data, 'merc', null, '');
    s = core.addUnit(core.ctxOf(data, s), 'champ');
    const ctx = core.ctxOf(data, s);
    for (const code of core.HERO_CODES) {
      for (const opt of questionOf(code, env())?.options ?? [{ key: undefined }]) {
        const r = rollFromDraft({ dice: code.slice(0, 2), pick: code === '16-21' ? '1' : opt.key, gold: '10', more: [{ dice: '22' }], then: { dice: '22' } }, env());
        expect(r, `${code} ${opt.key}`).not.toBe(null);
        expect(core.heroRollProblem(ctx, s.models[0]!, r!), `${code} ${opt.key}`).toBe(null);
      }
    }
  });
});

it('rolls two dice, tens first', () => {
  let i = 0;
  const seq = [0, 0.99];
  expect(randomD66(() => seq[i++]!)).toBe('16');
});

/* The experience bar of a row: one segment per step of the track, filled from
   the left up to where he stands. Rob, 19.10.2026: a Hero who started with
   experience (a Captain at 20) showed dashed segments first and turned green
   only in the middle; the bar now fills from the left whatever he started with. */
import * as core from '@mordheim/core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { XpBar } from './Bits.tsx';
import styles from './Board.module.css';
import { createWarband, rosterView } from './view.ts';

afterEach(() => cleanup());

function captainAt(exp: number, advances = 0) {
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(core.ctxOf(data, s), 'capt');
  s = structuredClone(s);
  s.models[0]!.exp = exp;
  if (advances) s.models[0]!.advCount = advances;
  return rosterView(data, s).heroes[0]!.xp!;
}

const segments = (xp: ReturnType<typeof captainAt>) => {
  const { container } = render(<XpBar xp={xp} />);
  return [...container.querySelectorAll('i')].map((i) => (i.className === styles.on ? 'on' : i.className === styles.due ? 'due' : i.className === styles.next ? 'next' : '·'));
};

describe('the experience bar', () => {
  it('fills from the left for a Hero who started with experience', () => {
    const s = segments(captainAt(26)).map((x) => (x === 'due' ? 'on' : x));
    // 2 … 24 reached (eight of them below his starting 20), 28 the next, the rest open
    expect(s.slice(0, 10)).toEqual(['on', 'on', 'on', 'on', 'on', 'on', 'on', 'on', 'on', 'next']);
    expect(s.slice(10).every((x) => x === '·')).toBe(true);
  });

  it('marks in gold the steps whose advance is still to be taken', () => {
    const xp = captainAt(26);
    expect(xp.owed).toBe(1);
    const s = segments(xp);
    expect(s[8]).toBe('due');
    expect(s.slice(0, 8).every((x) => x === 'on')).toBe(true);
  });
});

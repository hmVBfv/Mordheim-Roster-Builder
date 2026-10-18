/* The Fallen under the list: totals in the line that opens it, the dead by unit with experience, equipment and gold. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { FallenList } from './Fallen.tsx';
import { createWarband, rosterView } from './view.ts';

afterEach(() => cleanup());

const c = (s: core.WarbandState) => core.ctxOf(data, s);

describe('the Fallen', () => {
  it('is not there while nobody has fallen', () => {
    const s = core.addUnit(c(createWarband(data, 'merc', null, 'The Grey Company')), 'capt');
    const { container } = render(<FallenList f={rosterView(data, s).fallen} />);
    expect(container.childElementCount).toBe(0);
  });

  it('shows the gold and the experience lost, and each dead with what he carried', () => {
    let s = createWarband(data, 'merc', null, 'The Grey Company');
    s = core.addUnit(c(s), 'champ');
    s = structuredClone(s);
    s.models[0]!.name = 'Magda';
    s.models[0]!.exp = 11;
    s = core.killHero(c(s), s.models[0]!.uid);
    const f = rosterView(data, s).fallen;
    render(<FallenList f={f} />);
    expect(screen.getByText('Fallen (1)')).toBeTruthy();
    expect(screen.getByText(`${f.goldLost} gc lost · 3 Exp earned in play lost`)).toBeTruthy();
    const group = screen.getByRole('region', { name: '1× Champion' });
    expect(within(group).getByText('Magda')).toBeTruthy();
    expect(within(group).getByText(`11 Exp · ${f.groups[0]!.entries[0]!.worth} gc`)).toBeTruthy();
    expect(group.textContent).toMatch(/Dagger/);
  });
});

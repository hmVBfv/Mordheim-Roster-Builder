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
    const summary = screen.getByText('Fallen (1)').closest('summary')!;
    expect(within(summary).getByText(`${f.goldLost} gc lost`)).toBeTruthy();
    expect(within(summary).getByText('3 Exp lost')).toBeTruthy();
    const group = screen.getByRole('region', { name: '1× Champion' });
    expect(within(group).getByText('Magda')).toBeTruthy();
    const models = within(group).getByRole('list', { name: 'Fallen models of Champion' });
    expect(within(models).getByText('11 Exp (3 earned in play)')).toBeTruthy();
    expect(within(models).getByText(`${f.groups[0]!.entries[0]!.worth} gc lost`)).toBeTruthy();
    expect(group.textContent).toMatch(/Dagger/);
  });

  /* Wishes #159, #160, #161 (Rob, 30.10.2026): what the Fallen say about each one, what is the unit and what are its models, the
     experience lost beside the gold. */
  function dead() {
    let s = createWarband(data, 'merc', null, 'The Grey Company');
    s = core.addUnit(c(s), 'champ');
    s = structuredClone(s);
    s.models[0]!.name = 'Magda';
    s.models[0]!.exp = 11;
    s.campaign = { ...s.campaign, on: true, round: 3, districts: {} };
    s = core.addCasualty(c(s), { victim: { uid: s.models[0]!.uid, name: '' }, attacker: { name: 'Gorbag' } });
    s = core.resolveCasualtyRoll(c(s), (s.campaign!.casualties as core.Casualty[]).at(-1)!.id, '11-15');
    return s;
  }

  it('#159: says when and by whom each one fell, from the casualty it belongs to', () => {
    const f = rosterView(data, dead()).fallen;
    expect(f.groups[0]!.entries[0]!.fell).toMatch(/round 3/i);
    expect(f.groups[0]!.entries[0]!.fell).toMatch(/Gorbag/);
    render(<FallenList f={f} />);
    expect(within(screen.getByRole('region', { name: '1× Champion' })).getByText(/Fell in round 3/)).toBeTruthy();
  });

  it('#160: names the unit as the heading and lists the models under it, each as a model of that unit', () => {
    render(<FallenList f={rosterView(data, dead()).fallen} />);
    const group = screen.getByRole('region', { name: '1× Champion' });
    expect(within(group).getByRole('heading', { level: 3 }).textContent).toMatch(/^Champion/);
    expect(within(group).getByText('Hero unit')).toBeTruthy();
    const models = within(group).getByRole('list', { name: 'Fallen models of Champion' });
    expect(within(models).getAllByRole('listitem')).toHaveLength(1);
    expect(within(models).getByText('Magda')).toBeTruthy();
  });

  it('#161: the experience lost stands beside the gold, in the summary and on each line, in parts that do not break apart', () => {
    const f = rosterView(data, dead()).fallen;
    render(<FallenList f={f} />);
    const summary = screen.getByText('Fallen (1)').closest('summary')!;
    expect(within(summary).getByText(`${f.goldLost} gc lost`)).toBeTruthy();
    expect(within(summary).getByText('3 Exp lost')).toBeTruthy();
    const models = within(screen.getByRole('region', { name: '1× Champion' })).getByRole('list', { name: 'Fallen models of Champion' });
    expect(within(models).getByText('11 Exp (3 earned in play)')).toBeTruthy();
  });
});

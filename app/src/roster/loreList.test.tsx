/* Wish #149 (Rob, 29.10.2026): in a caster's spell list the spells he has learned stand out, and so does their casting value. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { Board } from './Board.tsx';
import type { UnitActs } from './Detail.tsx';
import { createWarband, rosterView } from './view.ts';

const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
const acts = (): UnitActs => ({
  xp: vi.fn(), setXp: vi.fn(), advance: vi.fn(), injury: vi.fn(), captive: vi.fn(), addMan: vi.fn(), man: vi.fn(), lead: vi.fn(),
  equipSheet: vi.fn(), rename: vi.fn(), nameLabel: 'Name', nameValue: '', story: '/story', card: '/card',
  taken: null, chaos: [], leave: { label: 'Remove', run: vi.fn() },
} as unknown as UnitActs); // cast: the test names only what it needs, so a new action does not touch it

beforeEach(() => { Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 }); });
afterEach(cleanup);

describe('the spell list marks what the caster has learned (#149)', () => {
  it('flags the known spell and its casting value, and no other', () => {
    let s = createWarband(data, 'caravans', null, 'The Grey Company');
    s = core.addUnit(ctx(s), 'magician');
    s = structuredClone(s);
    const wiz = s.models[0]!;
    const school = core.casterLore(ctx(s), wiz)!;
    const name = data.SPELLS[school]!.spells.find(([n]) => /\(\d+\)\s*$/.test(String(n)))![0];
    wiz.spells = [{ name, red: 1 }];
    render(<MemoryRouter><Board v={rosterView(data, s)} acts={acts} /></MemoryRouter>);
    const list = screen.getByRole('list', { name: /^Spell list:/ });
    const rows = within(list).getAllByRole('listitem');
    const known = rows.filter((r) => r.getAttribute('data-known') === 'true');
    expect(known).toHaveLength(1);
    const cast = known[0]!.querySelector('[data-cast]')!;
    expect(cast.getAttribute('data-known')).toBe('true');
    expect(cast.textContent).toMatch(/cast on \d\(−1\)\+/);
    expect(rows.filter((r) => r.querySelector('[data-cast][data-known="true"]'))).toHaveLength(1);
  });
});

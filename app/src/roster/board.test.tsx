/* The roster board (docs/ui.md §3): a row each, opening in place with tabs on
   a phone, a pane beside the list on a desktop, the same read-only for
   another player's warband. The workspace's width is stubbed: jsdom has none. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { Board } from './Board.tsx';
import type { UnitActs } from './Detail.tsx';
import { layoutFor, SPLIT_AT, TRIPLE_AT } from './useLayout.ts';
import { createWarband, rosterView, type HireView, type WarriorView } from './view.ts';

const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

/** A Captain with a name of his own, a group of two Warriors and a Hired Sword. */
function band() {
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'warr');
  s = core.setQty(ctx(s), s.models[1]!.uid, 2);
  s = core.hireHS(ctx(s), 'ogre');
  s = core.setModelName(ctx(s), s.models[0]!.uid, 'Ulrich the Grey');
  return rosterView(data, s);
}

function acts(over: Partial<UnitActs> = {}): UnitActs {
  return {
    xp: vi.fn(), setXp: vi.fn(), advance: vi.fn(), injury: vi.fn(), captive: vi.fn(), addMan: vi.fn(), man: vi.fn(), lead: vi.fn(),
    equipSheet: vi.fn(), rename: vi.fn(), editName: vi.fn(), nameLabel: 'Name of this Mercenary Captain', nameValue: '', story: '/story', card: '/card',
    taken: null, chaos: [], leave: { label: 'Remove from the roster', run: vi.fn() }, ...over,
  };
}

let width = 0;
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
});
afterEach(() => { cleanup(); width = 0; });

const show = (props: Partial<React.ComponentProps<typeof Board>> = {}, v = band()) =>
  render(<MemoryRouter><Board v={v} acts={() => acts()} {...props} /></MemoryRouter>);

describe('the layout follows the width of the workspace', () => {
  it('stacks under 860 px, splits to a pane, and adds a third column from 1560 px', () => {
    expect([0, SPLIT_AT - 1].map(layoutFor)).toEqual(['stack', 'stack']);
    expect([SPLIT_AT, TRIPLE_AT - 1].map(layoutFor)).toEqual(['split', 'split']);
    expect([TRIPLE_AT, 2400].map(layoutFor)).toEqual(['triple', 'triple']);
    for (const [w, layout] of [[400, 'stack'], [1000, 'split'], [1700, 'triple']] as const) {
      width = w;
      const { container, unmount } = show();
      expect(container.querySelector('[data-layout]')!.getAttribute('data-layout')).toBe(layout);
      unmount();
    }
  });
});

describe('on a phone: a row each, opening under it with tabs', () => {
  it('groups the rows, one button each, with the whole profile in a line and nothing open', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Heroes', 'Henchmen', 'Hired Swords & Dramatis Personae']);
    expect(screen.getByText('1 of 6')).toBeTruthy();
    expect(screen.getByText('2 men')).toBeTruthy();
    const rows = within(screen.getByRole('region', { name: 'Heroes' })).getAllByRole('button');
    expect(rows.map((b) => b.getAttribute('aria-label'))).toEqual(['Ulrich the Grey, Mercenary Captain']);
    expect(rows[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Warrior, 2 men, Henchman group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ogre Bodyguard, Hired Sword' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /^M \S+, WS \S+, BS \S+, S \S+, T \S+, W \S+, I \S+, A \S+, Ld \S+/ })).toHaveLength(3);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('says in words what the eyes read off a row: experience, profile, chips, equipment', () => {
    show();
    const row = screen.getByRole('button', { name: 'Ulrich the Grey, Mercenary Captain' });
    const words = document.getElementById(row.getAttribute('aria-describedby')!)!.textContent!;
    expect(words).toMatch(/^Experience 20, next advance at 24\. M 4, WS \d, BS \d, S \d, T \d, W \d, I \d, A \d, Ld \d, Sv .+\. Leader\. Carries /);
  });

  it('opens one warrior at a time, with four tabs; the same tap closes him', async () => {
    const user = userEvent.setup();
    show();
    const hero = screen.getByRole('button', { name: /^Ulrich/ });
    await user.click(hero);
    expect(hero.getAttribute('aria-expanded')).toBe('true');
    const card = screen.getByRole('article', { name: 'Ulrich the Grey' });
    expect(within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Gear', 'Skills & injuries', 'Story & more']);
    expect(within(card).getByRole('heading', { level: 3, name: 'Profile' })).toBeTruthy();
    expect(within(card).getByRole('heading', { level: 3, name: /^Experience/ })).toBeTruthy();
    expect(within(card).queryByText('Equipment')).toBeNull();
    // another one: the first closes
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(hero.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Warrior' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('the tabs show the sections the old menu hid, with the arrow keys between them', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /^Ulrich/ }));
    await user.click(screen.getByRole('tab', { name: 'Gear' }));
    expect(screen.getByRole('tab', { name: 'Gear' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: /^Equipment/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Equipment & rare items' })).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Skills & injuries' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: 'Injuries' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /^Advances taken/ })).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    // #152: the name is no longer a field at the bottom of the last tab
    expect(screen.queryByRole('textbox', { name: 'Name of this Mercenary Captain' })).toBeNull();
    expect(screen.getByRole('link', { name: /^Story so far & profile/ }).getAttribute('href')).toBe('/story');
    expect(screen.getByRole('link', { name: /^Tabletop Simulator card/ }).getAttribute('href')).toBe('/card');
    expect(screen.queryByRole('button', { name: 'Out of action for good…' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove from the roster' })).toBeTruthy();
  });

  it('a hired one has no gear tab of his own', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /^Ogre Bodyguard/ }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Skills & injuries', 'Story & more']);
  });
});

describe('on a desktop: the list and the selected warrior beside it', () => {
  it('shows the first warrior at once, every section in the pane, no tabs', () => {
    width = 1000;
    show();
    const pane = screen.getByRole('complementary', { name: 'Selected warrior' });
    const card = within(pane).getByRole('article', { name: 'Ulrich the Grey' });
    expect(within(card).getAllByRole('heading', { level: 3 }).map((h) => h.textContent!.replace(/(Equipment|Experience|Advances taken).*/, '$1'))).toEqual([
      'Profile', 'Experience', 'Special rules', 'Equipment', 'Skills', 'Injuries', 'Advances taken', 'Story and table', 'Leaving the warband',
    ]);
    expect(screen.queryByRole('tablist')).toBeNull();
    const first = screen.getByRole('button', { name: /^Ulrich/ });
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(first.getAttribute('aria-expanded')).toBeNull();
    expect(first.closest('li')!.getAttribute('aria-current')).toBe('true');
  });

  it('a tap selects another and never closes the pane', async () => {
    width = 1000;
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(screen.getByRole('article', { name: 'Warrior' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Ulrich the Grey' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Warrior,/ }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(screen.getByRole('article', { name: 'Warrior' })).toBeTruthy();
    // a group lists its men, each to name or dismiss
    expect(within(screen.getByRole('list', { name: 'Men of Warrior' })).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('same for the whole group')).toBeTruthy();
  });

  it('puts the warband’s own functions below the list, and in a third column when there is room', () => {
    for (const w of [1000, 1700]) {
      width = w;
      const { unmount } = show({ panel: <p>Functions of the warband</p> });
      expect(screen.getByText('Functions of the warband')).toBeTruthy();
      unmount();
    }
  });

  it('the stepper, Advance and the other buttons act on the selected warrior', async () => {
    width = 1000;
    const user = userEvent.setup();
    const a = acts();
    show({ acts: () => a });
    await user.click(screen.getByRole('button', { name: /One experience more for Ulrich the Grey/ }));
    expect(a.xp).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: /One experience less for Ulrich the Grey/ })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Experience of Ulrich the Grey: 20. Set it' }));
    expect(a.setXp).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Advance' }));
    expect(a.advance).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Injury for Ulrich the Grey' }));
    expect(a.injury).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Equipment & rare items' }));
    expect(a.equipSheet).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Remove from the roster' }));
    expect(a.leave.run).toHaveBeenCalledOnce();
  });

  it('a group: another man at his price, or why not; a captive: how it ended', async () => {
    width = 1000;
    const user = userEvent.setup();
    const v = band();
    const group = v.henchmen[0]!;
    const a = acts();
    const { unmount } = show({ acts: () => a }, { ...v, henchmen: [{ ...group, addMan: { cost: 25 } }] });
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    await user.click(screen.getByRole('button', { name: '+ Man · 25 gc' }));
    expect(a.addMan).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: `${group.men[0]!.name}: name or dismiss` }));
    expect(a.man).toHaveBeenCalledWith(0);
    unmount();
    show({ acts: () => a }, { ...v, henchmen: [{ ...group, addMan: { why: 'the group is full with 5 men' } }] });
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(screen.getByRole('button', { name: '+ Man' })).toHaveProperty('disabled', true);
    expect(screen.getByText('No more men: the group is full with 5 men.')).toBeTruthy();
    cleanup();
    const hero = v.heroes[0]!;
    show({ acts: () => a }, { ...v, heroes: [{ ...hero, captive: 'Anna' }] });
    expect(screen.queryByRole('button', { name: /^Injury for / })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Captivity of Ulrich the Grey: how it ended' }));
    expect(a.captive).toHaveBeenCalledOnce();
  });

  it('#153: a pencil beside his name renames him – at the top of the first tab on a phone, in the head of the pane on a desktop', async () => {
    const user = userEvent.setup();
    const a = acts({ nameValue: 'Ulrich the Grey' });
    show({ acts: () => a });
    await user.click(screen.getByRole('button', { name: /^Ulrich/ }));
    const phone = screen.getByRole('button', { name: 'Rename Ulrich the Grey' });
    // #152: above his profile, not below the gear
    const profile = screen.getByRole('heading', { level: 3, name: 'Profile' });
    expect(phone.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(phone);
    expect(a.editName).toHaveBeenCalledOnce();
    cleanup();
    width = 1000;
    show({ acts: () => a });
    const pencils = screen.getAllByRole('button', { name: 'Rename Ulrich the Grey' });
    expect(pencils).toHaveLength(1);
    const head = screen.getByRole('heading', { level: 2, name: 'Ulrich the Grey' });
    expect(head.parentElement!.contains(pencils[0]!)).toBe(true);
    await user.click(pencils[0]!);
    expect(a.editName).toHaveBeenCalledTimes(2);
  });

  it('what is taken and what is corrected stand in the skills section', async () => {
    width = 1000;
    const user = userEvent.setup();
    const a = acts({ taken: { advances: [{ stat: 'WS', n: 1 }, { stat: 'I', n: 2 }], skills: [], spells: [] }, correctTaken: vi.fn(), correctInjuries: vi.fn(), chaos: [{ label: 'Mutations…', run: vi.fn() }] });
    show({ acts: () => a });
    expect(screen.getByText('+1 WS')).toBeTruthy();
    expect(screen.getByText('+2 I')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Advances taken – correct' }));
    expect(a.correctTaken).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Injuries – correct' }));
    expect(a.correctInjuries).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Mutations…' }));
    expect(a.chaos[0]!.run).toHaveBeenCalledOnce();
  });
});

describe('read-only: another player’s warband', () => {
  it('shows the same rows and sections, with nothing to press or write', async () => {
    width = 1000;
    const user = userEvent.setup();
    render(<MemoryRouter><Board v={band()} /></MemoryRouter>);
    const card = screen.getByRole('article', { name: 'Ulrich the Grey' });
    expect(within(card).getAllByRole('columnheader').length).toBeGreaterThan(8);
    expect(card.textContent).toMatch(/Exp 20/);
    expect(within(card).queryByRole('textbox')).toBeNull();
    expect(within(card).queryByRole('link')).toBeNull();
    for (const b of within(card).queryAllByRole('button')) expect(b.hasAttribute('data-tip')).toBe(true);
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    expect(within(screen.getByRole('list', { name: 'Men of Warrior' })).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('on paper', () => {
  it('has every warrior in full, and only then; the list is for the screen', () => {
    const v = band();
    const { rerender } = render(<MemoryRouter><Board v={v} acts={() => acts()} /></MemoryRouter>);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    rerender(<MemoryRouter><Board v={v} acts={() => acts()} printing /></MemoryRouter>);
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['Ulrich the Grey', 'Warrior', 'Ogre Bodyguard']);
    for (const card of screen.getAllByRole('article')) {
      expect(within(card).queryByRole('textbox')).toBeNull();
      expect(within(card).queryByRole('link')).toBeNull();
      expect(within(card).getAllByRole('columnheader').length).toBeGreaterThan(8);
    }
  });
});

describe('the opened warrior keeps what he is when the list changes', () => {
  it('a warrior who leaves does not leave an empty pane', () => {
    width = 1000;
    const v = band();
    const { rerender } = render(<MemoryRouter><Board v={v} acts={() => acts()} /></MemoryRouter>);
    expect(screen.getByRole('article', { name: 'Ulrich the Grey' })).toBeTruthy();
    const gone: { heroes: WarriorView[]; hires: HireView[] } = { heroes: [], hires: v.hires };
    rerender(<MemoryRouter><Board v={{ ...v, ...gone, heroCount: 0 }} acts={() => acts()} /></MemoryRouter>);
    expect(screen.getByRole('article', { name: 'Warrior' })).toBeTruthy();
  });
});

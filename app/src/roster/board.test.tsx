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
    taken: null, chaos: [], participation: vi.fn(), leave: { label: 'Remove from the roster', run: vi.fn() }, ...over,
  };
}

let width = 0;
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
});
afterEach(() => { cleanup(); width = 0; });

/** A fold-out of the warband screen by its name: the unit choice, the warband rules, the spells and prayers. */
const box = (name: string) => document.querySelector(`details[aria-label="${name}"]`) as HTMLElement;

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

describe('one man is "1 man", not "1 men"', () => {
  it('in the heading of the Henchmen and in the row of a group of one', () => {
    const v = band();
    const group = v.henchmen[0]!;
    show({}, { ...v, henchmen: [{ ...group, count: 1 }] });
    expect(screen.getByText('1 man')).toBeTruthy();
    expect(screen.queryByText('1 men')).toBeNull();
    expect(screen.getByRole('button', { name: 'Warrior, 1 man, Henchman group' })).toBeTruthy();
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

  it('a group of henchmen offers "Out of action for good…" among the ways to leave, as a Hero does', async () => {
    const user = userEvent.setup();
    const a = acts({ outOfAction: vi.fn() });
    show({ acts: () => a });
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    await user.click(screen.getByRole('tab', { name: 'Story & more' }));
    await user.click(screen.getByRole('button', { name: 'Out of action for good…' }));
    expect(a.outOfAction).toHaveBeenCalledOnce();
  });

  it('a Prospect who can take a fallen Hero\'s place has a button for it on his card, which opens the advance sheet', async () => {
    const user = userEvent.setup();
    const a = acts();
    const v = band();
    const group = v.henchmen[0]!;
    show({ acts: () => a }, { ...v, henchmen: [{ ...group, takePlace: true }] });
    await user.click(screen.getByRole('button', { name: /^Warrior,/ }));
    await user.click(screen.getByRole('button', { name: 'Take a fallen Hero\'s place' }));
    expect(a.advance).toHaveBeenCalledOnce();
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
      'Profile', 'Experience', 'Special rules', 'Next battles', 'Equipment', 'Skills', 'Injuries', 'Advances taken', 'Story and table', 'Leaving the warband',
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

  it('#153, #156: a pencil beside his name renames him – in his row on a phone, no row of its own; in the head of the pane on a desktop', async () => {
    const user = userEvent.setup();
    const a = acts({ nameValue: 'Ulrich the Grey' });
    show({ acts: () => a });
    // a closed row has no pencil: it is there once he is opened
    expect(screen.queryByRole('button', { name: 'Rename Ulrich the Grey' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Ulrich/ }));
    const phone = screen.getByRole('button', { name: 'Rename Ulrich the Grey' });
    // beside the name in his row, above the tabs – and not a line in the first tab
    const row = phone.closest('li')!;
    expect(row.querySelector('[role="tablist"]')).toBeTruthy();
    expect(phone.compareDocumentPosition(row.querySelector('[role="tablist"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).queryByRole('button', { name: 'Rename Ulrich the Grey' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Rename Ulrich the Grey' })).toHaveLength(1);
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

describe('the battles a warrior has fought (#166)', () => {
  it('stand in his Experience section with a stepper to put right a count that began late, where a campaign counts them', async () => {
    width = 1000;
    const user = userEvent.setup();
    const v = band();
    const hero = { ...v.heroes[0]!, battles: 3 };
    const a = acts({ battles: vi.fn() });
    show({ acts: () => a }, { ...v, heroes: [hero] });
    const line = screen.getByText('Battles fought').closest('div')!;
    expect(within(line).getByText('3')).toBeTruthy();
    await user.click(within(line).getByRole('button', { name: `One battle more for ${hero.name}` }));
    expect(a.battles).toHaveBeenLastCalledWith(1);
    await user.click(within(line).getByRole('button', { name: `One battle less for ${hero.name}` }));
    expect(a.battles).toHaveBeenLastCalledWith(-1);
  });

  it('are a plain figure for whoever cannot change them, and absent while none is counted and nobody counts', () => {
    width = 1000;
    const v = band();
    show({ acts: undefined }, { ...v, heroes: [{ ...v.heroes[0]!, battles: 2 }] });
    expect(screen.getByText('Battles fought').closest('div')!.textContent).toMatch(/2/);
    expect(screen.queryByRole('button', { name: /One battle/ })).toBeNull();
    cleanup();
    show({ acts: () => acts() }, { ...v, heroes: [{ ...v.heroes[0]!, battles: 0 }] });
    expect(screen.queryByText('Battles fought')).toBeNull();
  });
});

/* Report of 6.11.2026: the rules of the Chaos Dwarfs hold for the whole warband or most of it; on every unit they drown the card. The warband's
   own rules get a section above the units. They are text, each rule with its name and what it says, not words to tap (a "Dwarf rules" bubble
   that held six rules did not fit); the unit choice of the warband stands in a section of its own, as it is no rule a warrior has. */
describe('the rules of the warband', () => {
  const view = (wb: string, unit: string) => rosterView(data, core.addUnit(ctx(createWarband(data, wb, null, 'The Band')), unit));
  const hashut = () => view('sonsofhashut', 'cdwarf');

  it('are listed one by one with their texts, for every warband that has some', () => {
    const v = hashut();
    expect(v.warbandRules.map((r) => r.name)).toEqual(['Hard Head', 'Armour', 'Hard to Kill', 'Slavers', 'Uncommon', 'Indentured Servants', 'Hired Swords']);
    expect(v.warbandRules.find((r) => r.name === 'Armour')!.text).toMatch(/never suffer movement penalties for wearing armour/);
    for (const wb of Object.keys(data.WARBANDS)) {
      const w = rosterView(data, createWarband(data, wb, null, 'x'));
      expect(w.warbandRules.length + (w.unitChoice ? 1 : 0), wb).toBeGreaterThan(0);
      for (const r of w.warbandRules) expect(r.text.length, `${wb}: ${r.name}`).toBeGreaterThan(10);
    }
  });

  it('give the Dwarfs each of their rules on its own, not one "Dwarf rules"', () => {
    const ranger = view('dwarfrangers', 'clansman').warbandRules.map((r) => r.name);
    expect(ranger).toEqual(['Hard to Kill', 'Hard Head', 'Armour', 'Hate Orcs and Goblins', 'Grudgebearers', 'Incomparable Miners', 'Don’t Trust ‘Em', 'Gromril']);
    // the page's whole text (mordheimer.net, Dwarf Rangers): what it means for the march and for All Alone tests as well
    expect(view('dwarfrangers', 'clansman').warbandRules.find((r) => r.name === 'Don’t Trust ‘Em')!.text).toMatch(/stop members of the other from Marching.*All Alone tests.*not friends/);
    expect(view('dwarfrangers', 'clansman').warbandRules.find((r) => r.name === 'Gromril')!.text).toBe(view('dwarftreasure', 'clansman').warbandRules.find((r) => r.name === 'Gromril')!.text);
    const hunters = view('dwarftreasure', 'clansman').warbandRules.map((r) => r.name);
    expect(hunters).toEqual(['Hard to Kill', 'Hard Head', 'Armour', 'Hate Orcs and Goblins', 'Incomparable Miners', 'Grudgebearers', 'Gromril']);
  });

  it('stand as text in a section above the first group of units, on a phone and on a desktop', () => {
    for (const w of [400, 1000]) {
      width = w;
      show({}, hashut());
      const rules = box('Warband rules');
      const henchmen = screen.getByRole('heading', { name: 'Henchmen' });
      expect(rules.compareDocumentPosition(henchmen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(rules).getByText('Armour')).toBeTruthy();
      expect(within(rules).getByText(/never suffer movement penalties for wearing armour/)).toBeTruthy();
      expect(within(rules).queryAllByRole('button')).toHaveLength(0);
      cleanup();
    }
  });
});

/* Wish of 6.11.2026: the unit choice ("Exactly 1 Noble. Max. 2 Slayers …") is no ability; it was among the warband's rules and read like a skill. */
describe('the unit choice of the warband', () => {
  const view = (wb: string, unit: string) => rosterView(data, core.addUnit(ctx(createWarband(data, wb, null, 'The Band')), unit));

  it('is not one of the rules, but a text of its own', () => {
    const v = view('dwarftreasure', 'clansman');
    expect(v.unitChoice!.text).toMatch(/^Exactly 1 Noble\./);
    expect(v.unitChoice!.rows![0]).toEqual({ name: 'Noble', limit: 'exactly 1', note: null, kind: 'hero' });
    expect(v.warbandRules.map((r) => r.name)).not.toContain('Choice');
    for (const wb of Object.keys(data.WARBANDS)) expect(rosterView(data, createWarband(data, wb, null, 'x')).warbandRules.map((r) => r.name), wb).not.toContain('Choice');
  });

  it('stands in its own section above the rules, which keep their own', () => {
    width = 400;
    show({}, view('dwarftreasure', 'clansman'));
    const choice = box('Unit choice');
    const rules = box('Warband rules');
    expect(within(choice).getByText('Noble')).toBeTruthy();
    expect(within(rules).queryByText('Noble')).toBeNull();
    expect(choice.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/* Rob, 7.11.2026: an action of the card that waits for something is greyed out, with what it asks for beside it. */
describe('an action of the card that is not yet allowed', () => {
  it('is greyed out, says why, and has the rule to read', () => {
    width = 1000;
    show({ acts: () => acts({ chaos: [{ label: 'Black Orc Blood · +10 gc', run: vi.fn(), disabled: true, why: 'Needs 25 experience (he has 0).', tips: [{ name: 'Proven Warrior', line: 'Skill', text: 'May only be taken with 25 experience.' }] }] }) });
    const card = screen.getByRole('complementary', { name: 'Selected warrior' });
    const button = within(card).getByRole('button', { name: 'Black Orc Blood · +10 gc' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(within(card).getByText('Needs 25 experience (he has 0).')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Proven Warrior' })).toBeTruthy();
  });
});

/* Report of 7.11.2026: "Max. 2 Black Orcs, 2 Young'uns" can be read as "2 Young'uns are needed". Each unit is a line, with its limit in the same words everywhere. */
describe('the unit choice as lines', () => {
  it('gives each unit its limit at the end of its line, 0–2 where a text said "max."', () => {
    width = 400;
    show({}, rosterView(data, core.addUnit(ctx(createWarband(data, 'blackorcs', null, 'The Band')), 'bboss')));
    const choice = box('Unit choice');
    const lines = within(choice).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual(['Black Orc Boss' + 'exactly 1', 'Black Orcs' + '0–2', 'Young\'uns' + '0–2', 'Boyz' + 'any number', 'Shootaz · never more than Boyz' + 'any number', 'Nuttaz' + '0–4', 'Troll' + '0–1']);
  });
});

/* Wish of 7.11.2026: the unit choice is divided into Heroes and Henchmen, and stays as plain as it was. */
describe('the unit choice, divided', () => {
  it('has a list of Heroes and a list of Henchmen, each unit in the one it belongs to', () => {
    width = 400;
    show({}, rosterView(data, core.addUnit(ctx(createWarband(data, 'blackorcs', null, 'The Band')), 'bboss')));
    const choice = box('Unit choice');
    expect(within(choice).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Heroes', 'Henchmen']);
    const [heroes, hench] = within(choice).getAllByRole('list');
    expect(within(heroes!).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Black Orc Boss' + 'exactly 1', 'Black Orcs' + '0–2', 'Young\'uns' + '0–2']);
    expect(within(hench!).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Boyz' + 'any number', 'Shootaz · never more than Boyz' + 'any number', 'Nuttaz' + '0–4', 'Troll' + '0–1']);
  });
});

/* Wish of 8.11.2026: next to the unit choice and the warband rules, a box that folds out lists the spells and prayers the warband can learn,
   each with the lore line of its page; a Hired Sword's school stands there only while he is hired. */
describe('the box of spells and prayers', () => {
  const view = (wb: string, unit: string) => rosterView(data, core.addUnit(ctx(createWarband(data, wb, null, 'The Band')), unit));

  it('is a fold-out with its own heading, closed, after the unit choice and the warband rules', () => {
    width = 400;
    show({}, view('nightgoblins', 'nightgob'));
    const spellBox = box('Spells and prayers') as HTMLDetailsElement;
    expect(spellBox).not.toBeNull();
    expect(spellBox.open).toBe(false);
    expect(within(spellBox).getByText('Spells and prayers').tagName).toBe('SUMMARY');
    const rules = box('Warband rules');
    expect(rules.compareDocumentPosition(spellBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names the school, each spell with its difficulty, its effect and its lore line', () => {
    width = 400;
    show({}, view('nightgoblins', 'nightgob'));
    const spellBox = box('Spells and prayers');
    expect(within(spellBox).getByText('Waaagh! Magic')).toBeTruthy();
    const ledz = within(spellBox).getByText("Led'z go").closest('li')!;
    // the difficulty has a line of its own, without a dot in front of it
    const difficulty = within(ledz).getByText('Difficulty 9');
    expect(difficulty.tagName).toBe('SMALL');
    expect(ledz.textContent).not.toMatch(/·/);
    expect(within(ledz).getByText('The Shaman’s howling invigorates the ladz to fight even harder for Gork and Mork.')).toBeTruthy();
    expect(ledz.textContent).toMatch(/strike first in hand-to-hand combat/);
  });

  it('is not there for a warband whose units cast nothing, and shows a Hired Sword\'s school only while he is hired', () => {
    width = 400;
    show({}, view('merc', 'capt'));
    expect(document.querySelector('details[aria-label="Spells and prayers"]')).toBeNull();
    cleanup();
    const hired = { ...core.addUnit(ctx(createWarband(data, 'merc', null, 'The Band')), 'capt'), hired: [{ key: 'warlock', uid: 'h1' }] };
    show({}, rosterView(data, hired));
    const spellBox = box('Spells and prayers');
    expect(within(spellBox).getByText('Warlock · Hired Sword')).toBeTruthy();
    expect(within(spellBox).getByText('Lesser Magic')).toBeTruthy();
  });
});

/* Wish of 9.11.2026: the unit choice and the warband rules fold like the box of spells and prayers, closed to begin with and visibly so. */
describe('the fold-outs of the warband screen', () => {
  it('are three, all closed to begin with, each with a summary that has the chevron', () => {
    width = 400;
    show({}, rosterView(data, core.addUnit(ctx(createWarband(data, 'orcmob', null, 'The Band')), 'shaman')));
    for (const name of ['Unit choice', 'Warband rules', 'Spells and prayers']) {
      const d = box(name) as HTMLDetailsElement;
      expect(d, name).not.toBeNull();
      expect(d.open, name).toBe(false);
      const summary = d.querySelector(':scope > summary')!;
      expect(summary.textContent).toBe(name);
      expect(summary.className).toMatch(/fold/);
    }
  });

  it('open to the same lists as before', async () => {
    width = 400;
    const user = userEvent.setup();
    show({}, rosterView(data, core.addUnit(ctx(createWarband(data, 'blackorcs', null, 'The Band')), 'bboss')));
    await user.click(within(box('Unit choice')).getByText('Unit choice'));
    expect((box('Unit choice') as HTMLDetailsElement).open).toBe(true);
    expect(within(box('Unit choice')).getAllByRole('listitem').length).toBeGreaterThan(5);
  });
});

/* Wish of 9.11.2026: a unit can be marked as missing the next battle, the next N, or staying out until switched back; it is greyed out, and the card
   says so and has the controls – small enough for a phone. */
describe('missing a battle', () => {
  const darkBand = (miss = 0) => {
    let s = createWarband(data, 'darkelves', null, 'The Black Ark');
    for (const u of ['highborn', 'beastmaster', 'coldone']) s = core.addUnit(ctx(s), u);
    const beastmaster = s.models.find((m) => m.uid_def === 'beastmaster')!.uid;
    if (miss) s = core.setParticipation(ctx(s), beastmaster, { miss });
    return rosterView(data, s);
  };
  const card = () => screen.getByRole('complementary', { name: 'Selected warrior' });

  it('greys out the row of a unit that is away, and of the unit that stays behind with it', () => {
    width = 400;
    show({}, darkBand(1));
    const rows = [...document.querySelectorAll('li[data-away="true"]')];
    expect(rows.map((r) => r.querySelector('button')!.getAttribute('aria-label')?.split(',')[0]).sort()).toEqual(['Beastmaster', 'Cold One Beasthound']);
    expect(within(rows[0] as HTMLElement).getAllByText(/Misses next battle|Stays behind/).length).toBeGreaterThan(0);
  });

  it('has the controls in the card: takes part, misses, until switched back', async () => {
    width = 1000;
    const act = vi.fn();
    const user = userEvent.setup();
    show({ acts: () => acts({ participation: act }) }, darkBand(0));
    await user.click(screen.getByRole('button', { name: /^Beastmaster/ }));
    const group = within(card()).getByRole('group', { name: 'Next battles' });
    expect(within(card()).getByText('Takes part in the next battle')).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Takes part' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(group).getByRole('button', { name: 'Misses next battle' }));
    expect(act).toHaveBeenLastCalledWith({ miss: 1, sitsOut: false });
    await user.click(within(group).getByRole('button', { name: 'Until switched back' }));
    expect(act).toHaveBeenLastCalledWith({ miss: 0, sitsOut: true });
  });

  it('counts the battles with a stepper while he misses them', async () => {
    width = 1000;
    const act = vi.fn();
    const user = userEvent.setup();
    show({ acts: () => acts({ participation: act }) }, darkBand(2));
    await user.click(screen.getByRole('button', { name: /^Beastmaster/ }));
    const group = within(card()).getByRole('group', { name: 'Next battles' });
    expect(within(card()).getAllByText('Misses next 2 battles').length).toBeGreaterThan(0);
    expect(within(group).getByRole('button', { name: 'Misses next 2 battles' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(group).getByRole('button', { name: 'One battle more' }));
    expect(act).toHaveBeenLastCalledWith({ miss: 3, sitsOut: false });
    await user.click(within(group).getByRole('button', { name: 'One battle less' }));
    expect(act).toHaveBeenLastCalledWith({ miss: 1, sitsOut: false });
  });

  it('tells a unit that stays behind why, and that it follows its master', async () => {
    width = 1000;
    const user = userEvent.setup();
    show({ acts: () => acts({ participation: vi.fn() }) }, darkBand(1));
    await user.click(screen.getByRole('button', { name: /^Cold One Beasthound/ }));
    expect(within(card()).getAllByText('Stays behind: the Beastmaster misses the battle').length).toBeGreaterThan(0);
    expect(within(card()).getByText(/He follows the Beastmaster/)).toBeTruthy();
  });
});

/* Report of 9.11.2026: opening a unit on a phone moved the page – the row one had tapped was no longer where it was. The row stays where the finger
   is: the page is only scrolled by as much as the row moved (another open row closing above it). */
describe('opening a row on a phone', () => {
  it('does not jump to the row, and scrolls by what the row moved so that it stays under the finger', async () => {
    width = 400;
    const scrollIntoView = vi.fn();
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    // an open row sits 180 px higher than it was: the row that was open above it has closed
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.tagName === 'LI' && this.dataset.open === 'true' ? 120 : 300;
      return { top, bottom: top + 80, left: 0, right: 400, width: 400, height: 80, x: 0, y: top, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Ulrich the Grey, Mercenary Captain' }));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollBy).toHaveBeenCalledWith(0, -180);
    rect.mockRestore();
  });

  it('leaves the page alone where the row did not move', async () => {
    width = 400;
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { top: 300, bottom: 380, left: 0, right: 400, width: 400, height: 80, x: 0, y: 300, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Ulrich the Grey, Mercenary Captain' }));
    expect(scrollBy).not.toHaveBeenCalled();
    rect.mockRestore();
  });
});


/* Changing a roster on the screen (phase 3a): every change is saved on this
   device at once and can be taken back from its notice. Sheets (native
   <dialog>) are left to the end-to-end tests in a real browser. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { nextStamp, savedFields } from './useEditor.ts';
import { createWarband } from './view.ts';

const NOW = '2026-10-02T10:00:00.000Z';

beforeAll(loadScreens, SCREENS_MS);

beforeAll(polyfillDialog);

/** Opens a warrior under his row (jsdom has no width, so the board stacks as on a phone) and gives his card. */
async function open(user: ReturnType<typeof userEvent.setup>, row: RegExp, card: string) {
  await user.click(await screen.findByRole('button', { name: row }));
  return screen.findByRole('article', { name: card });
}

/** Adds `n` men through the "More men" sheet. */
async function moreMen(user: ReturnType<typeof userEvent.setup>, group: HTMLElement, n = 1) {
  await user.click(within(group).getByRole('button', { name: /\+ Man/ }));
  const sheet = await screen.findByRole('dialog', { name: /More men/ });
  for (let i = 1; i < n; i++) await user.click(within(sheet).getByRole('button', { name: 'One man more' }));
  await user.click(within(sheet).getByRole('button', { name: 'Recruit' }));
}

async function seed(s: core.WarbandState) {
  await db.warbands.add({ id: 'w1', name: s.name ?? '', wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: core.FORMAT, createdAt: NOW, updatedAt: NOW });
}
const stored = async () => (await db.warbands.get('w1'))!;
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

/** A Reikland warband with a Captain and a group of two Warriors. */
function band(): core.WarbandState {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(c(s), 'capt');
  s = core.addUnit(c(s), 'warr');
  return core.setQty(c(s), s.models[1]!.uid, 2);
}

beforeEach(async () => { await db.warbands.clear(); });
afterEach(() => cleanup());

describe('save stamps', () => {
  it('always move forward, even within one millisecond', () => {
    const t = new Date(NOW);
    expect(nextStamp('2026-10-02T09:00:00.000Z', t)).toBe(NOW);
    expect(nextStamp(NOW, t)).toBe('2026-10-02T10:00:00.001Z');
    expect(nextStamp('2026-10-02T10:00:05.000Z', t)).toBe('2026-10-02T10:00:05.001Z');
  });

  it('the list shows the warband by its name, or its type without one', () => {
    const s = band();
    expect(savedFields(data, s, NOW)).toEqual({ state: s, name: 'The Grey Company', updatedAt: NOW });
    expect(savedFields(data, { ...s, name: '' }, NOW).name).toBe(data.WARBANDS.merc!.name);
  });
});

describe('the roster', () => {
  it('a step of experience is saved at once, without a notice', async () => {
    await seed(band());
    at('/warbands/w1');
    const user = userEvent.setup();
    const captain = await open(user, /^Mercenary Captain/, 'Mercenary Captain');
    expect(within(captain).getByRole('button', { name: /One experience less/ })).toHaveProperty('disabled', true);
    await user.click(within(captain).getByRole('button', { name: /One experience more/ }));
    await user.click(within(captain).getByRole('button', { name: /One experience more/ }));
    await waitFor(async () => expect((await stored()).state.models[0]!.exp).toBe(22));
    expect(within(captain).getByText('22')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('+ Man adds a man at his price through its sheet; Undo takes him away again', async () => {
    await seed(band());
    at('/warbands/w1');
    const user = userEvent.setup();
    const group = await open(user, /^Warrior,/, 'Warrior');
    const gold = (await stored()).state;
    const before = core.goldCurrent(core.ctxOf(data, gold));
    await moreMen(user, group);
    await waitFor(async () => expect((await stored()).state.models[1]!.qty).toBe(3));
    expect(core.goldCurrent(core.ctxOf(data, (await stored()).state))).toBeLessThan(before);
    expect(within(within(group).getByRole('list', { name: 'Men of Warrior' })).getAllByRole('listitem')).toHaveLength(3);
    const notice = (await screen.findByText(/Warrior 3 joins Warrior/)).closest<HTMLElement>('[role=status]')!;
    await user.click(within(notice).getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await stored()).state.models[1]!.qty).toBe(2));
    expect(screen.queryByText(/joins Warrior/)).toBeNull();
  });

  it('a later change takes the notice away, so Undo never reverts more than its own change', async () => {
    await seed(band());
    at('/warbands/w1');
    const user = userEvent.setup();
    const group = await open(user, /^Warrior,/, 'Warrior');
    await moreMen(user, group);
    expect(await screen.findByText(/joins Warrior/)).toBeTruthy();
    await user.click(within(group).getByRole('button', { name: /One experience more/ }));
    expect(screen.queryByText(/joins Warrior/)).toBeNull();
    await waitFor(async () => expect((await stored()).state.models[1]).toMatchObject({ qty: 3, exp: 1 }));
  });

  /* Bug #128: the warband's panel offered "All warbands" although the navigation already leads there. */
  it('has the warband\u2019s functions in its panel, but no second way to All warbands', async () => {
    await seed(band());
    at('/warbands/w1');
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Warband' })).closest('section')!;
    expect(within(panel).getByRole('link', { name: 'House rules' })).toBeTruthy();
    expect(within(panel).queryByRole('link', { name: 'All warbands' })).toBeNull();
  });

  /* Wish #131: the Recruit sheet shows the characteristics of each unit. */
  it('shows the characteristics of a unit in the Recruit sheet before it is added (#131)', async () => {
    await seed(core.newWarband(data, 'merc'));
    at('/warbands/w1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Recruit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Recruit' });
    const capt = within(sheet).getByRole('button', { name: /^Mercenary Captain/ });
    const stats = within(capt).getByRole('group', { name: 'Characteristics' });
    expect(stats.textContent).toBe('M4WS4BS4S3T3W1I4A1Ld8');
  });

  it('shows what a warband without warriors may do', async () => {
    await seed(createWarband(data, 'merc', null, ''));
    at('/warbands/w1');
    expect(await screen.findByText(/No warriors yet/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(data.WARBANDS.merc!.name);
    expect(screen.getByRole('button', { name: '+ Recruit' })).toBeTruthy();
  });
});

describe('a new warband', () => {
  it('is chosen by warband, variant and name, and opens empty with its gold', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    const pick = await screen.findByRole('radio', { name: 'Tileans' });
    expect(screen.getByRole('button', { name: 'Start the warband' })).toHaveProperty('disabled', true);
    await user.click(pick);
    await user.selectOptions(screen.getByRole('combobox', { name: 'City' }), 'trantio');
    const trantio = data.WARBANDS.tileans!.subtypes!.find((x) => x.key === 'trantio')!;
    expect(screen.getByText(`Starting gold: ${trantio.gold} gc.`)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Sons of Trantio');
    await user.click(screen.getByRole('button', { name: 'Start the warband' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sons of Trantio' })).toBeTruthy();
    const all = await db.warbands.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Sons of Trantio', wb: 'tileans', wbName: data.WARBANDS.tileans!.name, format: core.FORMAT });
    expect(all[0]!.state.subtype).toBe('trantio');
  });

  /* The options of the chosen warband (its variant, the name, what it starts with) unfold right under its row in the list, so that
     choosing one never means scrolling elsewhere, and the figures change with the variant. */
  it('unfolds the variant, the name and the starting figures under the row of the chosen warband', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    const pick = await screen.findByRole('radio', { name: 'Tileans' });
    expect(screen.queryByRole('combobox', { name: 'City' })).toBeNull();
    await user.click(pick);
    const row = pick.closest('tr')!;
    const panel = row.nextElementSibling as HTMLElement;
    expect(within(panel).getByRole('combobox', { name: 'City' })).toBeTruthy();
    expect(within(panel).getByRole('textbox', { name: 'Name' })).toBeTruthy();
    const trantio = data.WARBANDS.tileans!.subtypes!.find((x) => x.key === 'trantio')!;
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'City' }), 'trantio');
    expect(within(panel).getByText(`Starting gold: ${trantio.gold} gc.`)).toBeTruthy();
    expect(within(panel).getByText(/^Heroes at the start: up to \d/)).toBeTruthy();
    // choosing another folds the first one up
    await user.click(screen.getByRole('radio', { name: 'Mercenaries' }));
    expect(screen.getAllByRole('textbox', { name: 'Name' })).toHaveLength(1);
  });

  /* Wish of 8.11.2026: a second tap on the chosen warband folds its options up and deselects it. */
  it('is deselected by a second tap on the chosen warband, which folds its options up', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    const pick = await screen.findByRole('radio', { name: 'Tileans' });
    await user.click(pick);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start the warband' })).toHaveProperty('disabled', false);
    await user.click(pick);
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect((pick as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Start the warband' })).toHaveProperty('disabled', true);
    // the name of the row, and a cell beside it, do the same
    await user.click(screen.getByText('Tileans'));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    await user.click(screen.getByText('Tileans'));
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    // and a keyboard can do it
    pick.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    await user.keyboard(' ');
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  /* Wish of 8.11.2026: the list of warbands shows the spell school of each, filters by it, says "None" where there is no caster, and a tap on
     a school names its spells and what they do (no lore). */
  it('shows the spell school of each warband, "None" where it has no caster, and filters by it', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    await screen.findByRole('radio', { name: 'Night Goblins' });
    const rowOf = (name: string) => screen.getByRole('radio', { name }).closest('tr')!;
    expect(within(rowOf('Night Goblins')).getByText('Waaagh! Magic')).toBeTruthy();
    expect(within(rowOf('Mercenaries')).getByText('None')).toBeTruthy();
    expect(screen.getAllByRole('columnheader', { name: 'Magic' }).length).toBe(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Magic' }), 'waaagh');
    const names = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
    expect(names.sort()).toEqual(['Night Goblins', 'Orc Mob']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Magic' }), 'none');
    expect(screen.queryByRole('radio', { name: 'Night Goblins' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Mercenaries' })).toBeTruthy();
  });

  it('opens the spells of a school on a tap, with their effects and without lore, and does not choose the warband', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    await screen.findByRole('radio', { name: 'Night Goblins' });
    await user.click(within(screen.getByRole('radio', { name: 'Night Goblins' }).closest('tr')!).getByRole('button', { name: 'Waaagh! Magic' }));
    const bubble = await screen.findByRole('tooltip');
    expect(bubble.textContent).toMatch(/Led'z go/);
    expect(bubble.textContent).toMatch(/Difficulty 9/);
    expect(bubble.textContent).toMatch(/strikes first in close combat/);
    expect(bubble.textContent).not.toMatch(/howling invigorates/);
    expect((screen.getByRole('radio', { name: 'Night Goblins' }) as HTMLInputElement).checked).toBe(false);
  });

  /* Wish #77: a planner is started from the same form, and says so everywhere it differs. */
  it('can be a planner: no gold limit, its value instead of gold, the experience its advances need', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Mercenaries' }));
    await user.click(screen.getByRole('checkbox', { name: /A planner/ }));
    expect(screen.queryByText(/Starting gold/)).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'The Late Company');
    await user.click(screen.getByRole('button', { name: 'Start the warband' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Late Company' })).toBeTruthy();
    expect((await db.warbands.toArray())[0]!.state.planner).toBe(true);
    expect(screen.getByText(/· Planner/)).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
    expect(screen.queryByText('Gold')).toBeNull();
    expect(screen.getByText(/A planner: no gold limit, and advances without experience/)).toBeTruthy();
  });

  it('is an ordinary warband unless asked', async () => {
    at('/warbands/new');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Mercenaries' }));
    expect((screen.getByRole('checkbox', { name: /A planner/ }) as HTMLInputElement).checked).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Plain');
    await user.click(screen.getByRole('button', { name: 'Start the warband' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Plain' })).toBeTruthy();
    expect((await db.warbands.toArray())[0]!.state.planner).toBeUndefined();
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('is offered on Home and on the list of warbands', async () => {
    at('/');
    expect((await screen.findByRole('link', { name: 'New warband' })).getAttribute('href')).toBe('/warbands/new');
    cleanup();
    at('/warbands');
    expect((await screen.findByRole('link', { name: 'New warband' })).getAttribute('href')).toBe('/warbands/new');
  });
});

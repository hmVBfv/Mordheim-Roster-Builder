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
import { nextStamp, savedFields } from './useEditor.ts';
import { createWarband } from './view.ts';

const NOW = '2026-10-02T10:00:00.000Z';

/* jsdom has no showModal(): just enough of a modal <dialog> for a sheet to
   open and to report its closing, as useSheet expects. */
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (typeof proto.showModal === 'function') return;
  proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

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
    const captain = await screen.findByRole('article', { name: 'Mercenary Captain' });
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
    const group = await screen.findByRole('article', { name: 'Warrior' });
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
    const group = await screen.findByRole('article', { name: 'Warrior' });
    await moreMen(user, group);
    expect(await screen.findByText(/joins Warrior/)).toBeTruthy();
    await user.click(within(group).getByRole('button', { name: /One experience more/ }));
    expect(screen.queryByText(/joins Warrior/)).toBeNull();
    await waitFor(async () => expect((await stored()).state.models[1]).toMatchObject({ qty: 3, exp: 1 }));
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
    const pick = await screen.findByRole('combobox', { name: 'Warband' });
    expect(screen.getByRole('button', { name: 'Start the warband' })).toHaveProperty('disabled', true);
    await user.selectOptions(pick, 'tileans');
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

  it('is offered on Home and on the list of warbands', async () => {
    at('/');
    expect((await screen.findByRole('link', { name: 'New warband' })).getAttribute('href')).toBe('/warbands/new');
    cleanup();
    at('/warbands');
    expect((await screen.findByRole('link', { name: 'New warband' })).getAttribute('href')).toBe('/warbands/new');
  });
});

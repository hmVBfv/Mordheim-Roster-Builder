/* The Tabletop Simulator cards on the Export screen: each card opens and
   closes again, and "Copy" puts the text on the clipboard – or, where the
   browser keeps the clipboard from the page, still copies it by the older way. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createWarband } from '../roster/view.ts';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { copyText } from '../ui/files.ts';

const NOW = '2026-10-02T10:00:00.000Z';

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);

function band(): core.WarbandState {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(c(s), 'capt');
  s = core.addUnit(c(s), 'warr');
  return core.setQty(c(s), s.models[1]!.uid, 2);
}

async function seed(s: core.WarbandState) {
  await db.warbands.add({ id: 'w1', name: s.name ?? '', wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: core.FORMAT, createdAt: NOW, updatedAt: NOW });
}
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const cards = () => [...document.querySelectorAll<HTMLDetailsElement>('details[id^="tts-"]')];

beforeEach(async () => { await db.warbands.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the cards', () => {
  it('open with a click on the name and close with another', async () => {
    await seed(band());
    const user = userEvent.setup();
    at('/warbands/w1/export');
    await screen.findByRole('heading', { name: 'Tabletop Simulator' });
    const first = cards()[0]!;
    expect(first.open).toBe(false);
    await user.click(first.querySelector('summary')!);
    expect(first.open).toBe(true);
    await user.click(first.querySelector('summary')!);
    expect(first.open).toBe(false);
  });

  it('a card that opened from the address closes again, and stays closed after a copy', async () => {
    await seed(band());
    const user = userEvent.setup();
    const view = at('/warbands/w1/export');
    await screen.findByRole('heading', { name: 'Tabletop Simulator' });
    const id = cards()[0]!.id;
    view.unmount();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
    at(`/warbands/w1/export#${id}`);
    await screen.findByRole('heading', { name: 'Tabletop Simulator' });
    const card = document.getElementById(id) as HTMLDetailsElement;
    expect(card.open).toBe(true);
    await user.click(card.querySelector('summary')!);
    expect(card.open).toBe(false);
    // another card is opened and copied from: the notice re-draws the page, the first stays closed
    const other = cards()[1]!;
    await user.click(other.querySelector('summary')!);
    await user.click(within(other).getByRole('button', { name: 'Copy name' }));
    await screen.findByText('Name copied.');
    expect(document.getElementById(id) as HTMLDetailsElement).toHaveProperty('open', false);
    expect(other.open).toBe(true);
  });
});

describe('all cards at once', () => {
  it('"Expand all" opens every card, "Collapse all" closes them, and one can still be toggled on its own', async () => {
    await seed(band());
    const user = userEvent.setup();
    at('/warbands/w1/export');
    await screen.findByRole('heading', { name: 'Tabletop Simulator' });
    expect(cards().length).toBeGreaterThan(2);
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(cards().every((c) => c.open)).toBe(true);
    await user.click(cards()[1]!.querySelector('summary')!);
    expect(cards().map((c) => c.open)).toEqual(cards().map((_, i) => i !== 1));
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(cards().some((c) => c.open)).toBe(false);
  });
});

describe('copying', () => {
  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText('Captain')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Captain');
  });

  it('falls back to the older command where the page has no clipboard (an address without https)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    let copied = '';
    document.execCommand = vi.fn((cmd: string) => {
      if (cmd === 'copy') copied = (document.activeElement as HTMLTextAreaElement | null)?.value ?? '';
      return true;
    });
    expect(await copyText('Captain\nSword')).toBe(true);
    expect(copied).toBe('Captain\nSword');
    // nothing is left behind in the page
    expect(document.querySelectorAll('textarea[data-copy-helper]').length).toBe(0);
  });

  it('says it failed when neither way works, so the field is selected for the player', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn(() => false);
    expect(await copyText('Captain')).toBe(false);
  });
});


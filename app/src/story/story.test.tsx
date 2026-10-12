/* The Story of a warband (phase 4b2): what its player writes – prologue,
   interludes, the names in both languages, a profile for each warrior – kept
   in the warband's own save, and a warrior's life read from it. A warband
   outside a campaign, so no server is needed; the campaign side (marks,
   notes) is the life test of core and the end-to-end run. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createWarband } from '../roster/view.ts';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const NOW = '2026-10-02T10:00:00.000Z';
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const stored = async () => (await db.warbands.get('w1'))!.state;

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
// the page is a lazy chunk: load it before the first test, which would pay for it on a slow runner
beforeAll(async () => { await import('./Story.tsx'); }, SCREENS_MS);

/** The Grey Company after its first battle: a Captain and two Warriors, the campaign at round 1. */
function band(): core.WarbandState {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  // the campaign is on from the start, so the recruiting is written in the chronicle
  let s: core.WarbandState = { ...createWarband(data, 'merc', null, 'The Grey Company'), campaign: { on: true, districts: {} } };
  s = core.addUnit(c(s), 'capt');
  s = core.addUnit(c(s), 'warr');
  s = core.setQty(c(s), s.models[1]!.uid, 2);
  return { ...s, campaign: { ...s.campaign!, round: 1 } };
}
const seed = (s: core.WarbandState) =>
  db.warbands.add({ id: 'w1', name: s.name ?? '', wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: core.FORMAT, createdAt: NOW, updatedAt: NOW });

beforeEach(async () => { await db.warbands.clear(); });
afterEach(() => cleanup());

describe('the story page', () => {
  it('the prologue is written into the save', async () => {
    await seed(band());
    const user = userEvent.setup();
    at('/warbands/w1/story');
    expect(await screen.findByRole('heading', { level: 1, name: 'Story' })).toBeTruthy();
    // a warband outside a campaign: the save is all there is, and it goes with every export
    expect(screen.getByText(/it goes with every export/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Write the prologue' }));
    const sheet = await screen.findByRole('dialog', { name: 'The prologue' });
    await user.click(within(sheet).getByLabelText('Prologue'));
    await user.paste('They came up the river with the last barge.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('They came up the river with the last barge.')).toBeTruthy();
    await waitFor(async () => expect(core.storyOf(await stored()).prologue).toBe('They came up the river with the last barge.'));
  });

  it('an interlude after the first battle, and none for a round not yet fought', async () => {
    await seed(band());
    const user = userEvent.setup();
    at('/warbands/w1/story');
    const card = await screen.findByRole('article', { name: 'Interlude 1' });
    expect(screen.queryByRole('article', { name: 'Interlude 2' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Write' }));
    const inter = await screen.findByRole('dialog', { name: 'Interlude 1' });
    await user.click(within(inter).getByLabelText('What happened'));
    await user.paste('Rain for three days; the captain drank alone.');
    await user.click(within(inter).getByRole('button', { name: 'Save' }));
    expect(await within(card).findByText('Rain for three days; the captain drank alone.')).toBeTruthy();
    await waitFor(async () => expect(core.storyOf(await stored()).interludes).toEqual({ '1': 'Rain for three days; the captain drank alone.' }));
  });

  it('names in both languages, and an emptied text leaves no trace', async () => {
    await seed({ ...band(), story: { prologue: 'Old words.', interludes: {}, explain: {} } } as core.WarbandState);
    const user = userEvent.setup();
    at('/warbands/w1/story');
    await user.click(await screen.findByRole('button', { name: 'Edit the names' }));
    const names = await screen.findByRole('dialog', { name: 'The warband’s names' });
    await user.click(within(names).getByLabelText('Name (German)'));
    await user.paste('Die Graue Kompanie');
    await user.click(within(names).getByLabelText('Name (English)'));
    await user.paste('The Grey Company');
    await user.click(within(names).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('German: Die Graue Kompanie · English: The Grey Company')).toBeTruthy();
    await waitFor(async () => expect(core.canonOf(await stored())).toEqual({ name_de: 'Die Graue Kompanie', name_en: 'The Grey Company' }));

    // the prologue emptied: no story key is left in the save
    await user.click(screen.getByRole('button', { name: 'Edit the prologue' }));
    const sheet = await screen.findByRole('dialog', { name: 'The prologue' });
    await user.clear(within(sheet).getByLabelText('Prologue'));
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await stored()).story).toBeUndefined());
  });
});

describe('a warrior’s life', () => {
  it('opens from the roster’s menu link, shows what the save tells, and the profile is edited from there', async () => {
    const s = band();
    const capt = s.models[0]!;
    await seed(core.setProfile(core.ctxOf(data, s), capt.uid, { title_en: 'the Grey', voice: 'Few words, all of them orders.' }));
    const user = userEvent.setup();
    at(`/warbands/w1/story?who=${capt.uid}`);
    const life = await screen.findByRole('dialog', { name: /Mercenary Captain/ });
    expect(within(life).getByText('Few words, all of them orders.')).toBeTruthy();
    // no mark on this device: the save's own chronicle stands in
    expect(within(await within(life).findByRole('list', { name: 'Life' })).getAllByRole('listitem')[0]!.textContent).toMatch(/Founding.*Recruited/);

    await user.click(within(life).getByRole('button', { name: 'Edit the profile' }));
    const sheet = await screen.findByRole('dialog', { name: /Mercenary Captain: names, voice, story/ });
    await user.click(within(sheet).getByLabelText('Name (English)'));
    await user.paste('Aldric Voss');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(core.profileOf((await stored()).models[0]).name_en).toBe('Aldric Voss'));
    expect(core.profileOf((await stored()).models[0])).toMatchObject({ title_en: 'the Grey', voice: 'Few words, all of them orders.' });
  });

  it('every kind of people is listed, a group without a profile', async () => {
    await seed(band());
    at('/warbands/w1/story');
    const heroes = await screen.findByRole('group', { name: 'Heroes' });
    expect(within(heroes).getByRole('button', { name: /Mercenary Captain/ })).toBeTruthy();
    const men = screen.getByRole('group', { name: 'Henchmen' });
    expect(within(men).getByRole('button', { name: /2 × Warrior/ })).toBeTruthy();
  });
});

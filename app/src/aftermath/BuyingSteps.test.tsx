/* Steps 6 to 9 of the aftermath: what this round's bookings and the roster say, and where to go to do it. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { DramatisStep, EquipmentStep, RareStep, RecruitsStep } from './BuyingSteps.tsx';
import { takeOverBattle } from './takeover.ts';
import { aftermathView } from './view.ts';

beforeAll(polyfillDialog);
afterEach(() => cleanup());
const ME = 'w-me', T = '2026-10-05T20:00:00.000Z';
const battle = (): BattleView => ({
  battle: { id: 'b-1', campaignId: 'c-1', round: 1, title: 'Ferry', scenario: '', district: '', status: 'closed', turn: 3, createdAt: T, updatedAt: T, closedAt: T },
  seq: 1, entries: [], proposals: [],
  participants: [{ warbandId: ME, name: 'Us', wbType: 'merc', wbName: 'Mercenaries', playerId: 'u1', player: 'Kai', outcome: 'victory', revBefore: 1 }],
}) as BattleView;
const base = () => core.openLedger(core.ctxOf(data, takeOverBattle(data, sampleSave(), battle(), ME, '2026-10-05')));
const ctxOf = (s: WarbandState) => core.ctxOf(data, s);
const view = (s: WarbandState) => aftermathView(data, s, 'b-1')!;
const wrap = (el: React.ReactNode) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('step 6: rare items', () => {
  it('one line for each Hero: may search, searched, found – from the round’s bookings', () => {
    let s = base();
    const hero = s.models.find((m) => core.isHeroModel(ctxOf(s), m))!;
    wrap(<RareStep a={view(s)} ctx={ctxOf(s)} tradeLink="/t" edit={() => undefined} />);
    const table = screen.getByRole('table', { name: 'Searches this round' });
    expect(within(table).getAllByRole('row').slice(1).every((r) => /may search|cannot search/.test(r.textContent ?? ''))).toBe(true);
    cleanup();
    s = (() => { const t = core.recordSearch(ctxOf(s), hero.uid, 'Mordheim-Karte', { found: false }); expect(t.reason).toBe(''); return t.state; })();
    wrap(<RareStep a={view(s)} ctx={ctxOf(s)} tradeLink="/t" edit={() => undefined} />);
    expect(within(screen.getByRole('table', { name: 'Searches this round' })).getByText('searched, not found')).toBeTruthy();
    expect(screen.getByText('1 search so far, 0 found.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trading Post' }).getAttribute('href')).toBe('/t');
  });
});

describe('step 7: Dramatis Personae', () => {
  it('lists who the warband may hire and who it has', () => {
    const s = { ...base(), dp: [{ key: 'marianna', uid: 'dp0' }] } as WarbandState;
    wrap(<DramatisStep ctx={ctxOf(s)} hireLink="/h" />);
    expect(screen.getByText(/In the warband:/).textContent).toMatch(/Marianna/i);
    expect(screen.getByRole('table', { name: 'May be hired' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hire' }).getAttribute('href')).toBe('/h');
  });
});

describe('step 8: recruits and common items', () => {
  it('lists what was bought this round and the gold in hand, with the way to do more', () => {
    const s = base();
    const bought = core.bookGold(ctxOf(s), -12, { text: 'Bought a sword' }, 'buy');
    wrap(<RecruitsStep a={view(bought)} ctx={ctxOf(bought)} rosterLink="/r" tradeLink="/t" />);
    const table = screen.getByRole('table', { name: 'Hired, bought and sold this round' });
    expect(within(table).getByText('Bought a sword')).toBeTruthy();
    expect(within(table).getByText('-12 gc')).toBeTruthy();
    expect(screen.getByText('Together -12 gc.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+ Recruit on the roster' }).getAttribute('href')).toBe('/r');
  });
  it('says so when nothing happened yet', () => {
    const s = base();
    wrap(<RecruitsStep a={view(s)} ctx={ctxOf(s)} rosterLink="/r" tradeLink="/t" />);
    expect(screen.getByText(/Nothing hired or bought yet/)).toBeTruthy();
  });
});

describe('step 9: reallocate the equipment', () => {
  it('shows the stash with where the things came from', () => {
    const s = { ...base(), stash: { wyrd: 0, gold: null, items: [{ name: 'Dolch', qty: 2, source: 'location:3 3' }] } } as WarbandState;
    wrap(<EquipmentStep ctx={ctxOf(s)} rosterLink="/r" tradeLink="/t" />);
    const row = within(screen.getByRole('table', { name: 'In the stash' })).getAllByRole('row')[1]!;
    expect(row.textContent).toMatch(/Dagger.*2.*place 3 3/);
    expect(screen.getByRole('link', { name: 'Give from the stash' }).getAttribute('href')).toBe('/t#give');
  });
  it('says so when the stash is empty', () => {
    wrap(<EquipmentStep ctx={ctxOf(base())} rosterLink="/r" tradeLink="/t" />);
    expect(screen.getByText('The stash holds no items.')).toBeTruthy();
  });
});

describe('step 6: searching on this page', () => {
  function Harness({ s0 }: { s0: WarbandState }) {
    const [s, setS] = useState(s0);
    const ctx = ctxOf(s);
    return <MemoryRouter><RareStep a={view(s)} ctx={ctx} tradeLink="/t" edit={(f) => setS(f(ctx))} /><output data-testid="searches">{(s.ledger ?? []).filter((e) => e.kind === 'search').length}</output></MemoryRouter>;
  }

  it('opens the search here with nobody chosen: he is picked from the list, and the search is recorded', async () => {
    const user = userEvent.setup();
    const s = base();
    render(<Harness s0={s} />);
    await user.click(screen.getByRole('button', { name: 'Search for a rare item' }));
    const dlg = screen.getByRole('dialog', { hidden: true });
    const select = within(dlg).getByLabelText('Who searches', { selector: 'select' }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(within(dlg).getByText('Choose who searches.')).toBeTruthy();
    const hero = ctxOf(s).s.models.find((m) => core.isHeroModel(ctxOf(s), m))!;
    await user.selectOptions(select, String(hero.uid));
    expect(select.value).toBe(String(hero.uid));
    await user.click(within(dlg).getAllByRole('button', { hidden: true }).find((b) => b.className.includes('rareRow'))!);
    await user.click(within(dlg).getByRole('button', { name: 'Not found', hidden: true }));
    await waitFor(() => expect(screen.getByTestId('searches').textContent).toBe('1'));
    expect(screen.getByText('1 search so far, 0 found.')).toBeTruthy();
  });

  it('a Hero taken out of action in the battle stays home: the table says so', () => {
    const s0 = base();
    const hero = s0.models.find((m) => core.isHeroModel(ctxOf(s0), m))!;
    const s = { ...s0, campaign: { ...s0.campaign, casualties: [...(s0.campaign?.casualties ?? []), { id: 901, round: s0.campaign?.round ?? 1, battleId: 1, victim: { uid: hero.uid, name: 'x', wb: '', grade: '', value: null }, attacker: { uid: null, name: 'y', wb: '', grade: '', value: null }, result: 'injured', detail: '', fallenId: null, note: '' }] } } as WarbandState;
    wrap(<RareStep a={view(s)} ctx={ctxOf(s)} tradeLink="/t" edit={() => undefined} />);
    expect(within(screen.getByRole('table', { name: 'Searches this round' })).getByText('taken out of action in the last battle')).toBeTruthy();
  });
});

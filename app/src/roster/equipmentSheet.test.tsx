/* Wish #135 (Rob, 29.10.2026): in the equipment sheet "Carried" comes first and is set apart from the lists the buying is done in.
   Wish #136: an item in those lists, the common ones too, opens its type, strength and special rules on a tap. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { EquipmentSheet, type EquipmentActions } from './EquipmentSheet.tsx';
import { equipmentView } from './equipment.ts';
import { createWarband } from './view.ts';

beforeAll(polyfillDialog);
afterEach(cleanup);

const act: EquipmentActions = { qty: vi.fn(), addRare: vi.fn(), rareQty: vi.fn(), upgrade: vi.fn(), paid: vi.fn(), sellStart: vi.fn(), addBeast: vi.fn(), dropBeast: vi.fn() };

function sheet(wb = 'merc', unit = 'capt', round = 0) {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, wb, null, 'The Grey Company');
  s = core.addUnit(c(s), unit);
  if (round) { s = structuredClone(s); s.campaign = { ...s.campaign, on: true, round }; }
  const uid = s.models[0]!.uid;
  const view = equipmentView(c(s), uid)!;
  const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
  render(<EquipmentSheet dialogRef={ref} close={() => {}} view={view} act={act} />);
  return document.querySelector('dialog')!;
}

describe('the equipment sheet puts what is carried first (#135)', () => {
  it('has Carried before every list the buying is done in, and a heading over the lists', () => {
    const d = sheet();
    const carried = d.querySelector('section[aria-label="Carried"]')!;
    const lists = d.querySelector('table caption')!.closest('table')!;
    expect(carried.compareDocumentPosition(lists) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const buy = within(d).getByRole('heading', { name: /Buy from the list/i, hidden: true });
    expect(carried.compareDocumentPosition(buy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buy.compareDocumentPosition(lists) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Nothing carried yet.')).toBeNull();
  });
});

describe('an item of the buy lists tells what it is on a tap (#136)', () => {
  it('opens the type and strength line and the special rules of a weapon, in the sheet', async () => {
    const d = sheet();
    const user = userEvent.setup();
    const sword = within(d).getByRole('button', { name: 'Sword', hidden: true });
    await user.click(sword);
    const bubble = await within(d).findByRole('tooltip', { hidden: true });
    expect(bubble.textContent).toMatch(/Close combat/);
    expect(bubble.textContent).toMatch(/Strength/);
  });

  it('does so for every item of every list that has a rule text, and never for the plain stepper rows without one', () => {
    const d = sheet();
    const rows = [...d.querySelectorAll('table[class*="eqListTable"] tbody th')];
    expect(rows.length).toBeGreaterThan(5);
    const plain = rows.filter((r) => !r.querySelector('button[data-tip]'));
    expect(plain.map((r) => r.textContent)).toEqual([]);
  });
});

/* Bug #162 (Rob, 30.10.2026): a rare item had no description to tap – its name in "Rare and trading-post items" carried only a `title`,
   which a phone never shows – and the text itself was not the rule's. */
describe('a rare item names its rules on a tap (#162)', () => {
  it('opens the rules of the Magic Gourd from its name in the rare list, in the sheet', async () => {
    const c = (s: core.WarbandState) => core.ctxOf(data, s);
    let s = createWarband(data, 'merc', null, 'The Grey Company');
    s = core.addUnit(c(s), 'capt');
    const uid = s.models[0]!.uid;
    s = core.addRare(c(s), uid, 'Magischer Kürbis');
    const view = equipmentView(c(s), uid)!;
    const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
    render(<EquipmentSheet dialogRef={ref} close={() => {}} view={view} act={act} />);
    const d = document.querySelector('dialog')!;
    const rare = d.querySelector('section[aria-label="Rare and trading-post items"]')! as HTMLElement;
    const user = userEvent.setup();
    await user.click(within(rare).getByRole('button', { name: 'Magic gourd', hidden: true }));
    const bubble = await within(d).findByRole('tooltip', { hidden: true });
    expect(bubble.textContent).toMatch(/1D3 units of water/);
    expect(bubble.textContent).toMatch(/shatters/);
  });
});

/* Report of 2.11.2026: a Hero who "starts with" equipment (the Conqueror of the Lustrian Reavers) carries it from the start; its cost is in
   his price, so it has none of its own and cannot be sold or given away. */
describe('what a Hero starts with (#181)', () => {
  it('is among what he carries, free and staying with him, next to what he buys', () => {
    const d = sheet('reavers', 'conqueror');
    const carried = d.querySelector('section[aria-label="Carried"]')!;
    const rows = [...carried.querySelectorAll('tbody tr')].map((tr) => [tr.querySelector('th')!.textContent, tr.children[1]!.textContent, tr.textContent!.includes('stays')]);
    for (const name of ['Masterwork Heavy Armour', 'Bec de Corbin', 'Helmet']) {
      const row = rows.find((r) => (r[0] as string).startsWith(name))!;
      expect(row, `${name} is carried`).toBeTruthy();
      expect(row[1], name).toBe('in his price');
      expect(row[2], `${name} stays`).toBe(true);
    }
    expect(within(carried as HTMLElement).queryByRole('button', { name: /Take .*Masterwork/i, hidden: true })).toBeNull();
  });

  it('can be sold for half its price once the warband has fought, and not before', async () => {
    const before = sheet('reavers', 'conqueror');
    expect(within(before).queryByRole('button', { name: /Sell Masterwork/i, hidden: true })).toBeNull();
    cleanup();
    const d = sheet('reavers', 'conqueror', 1);
    const user = userEvent.setup();
    const sell = within(d).getByRole('button', { name: 'Sell Masterwork Heavy Armour for 25 gc', hidden: true });
    await user.click(sell);
    expect(act.sellStart).toHaveBeenCalledWith('Masterwork Heavy Armour');
    // a piece the catalogue has no price for is not offered here
    cleanup();
    const t = sheet('reavers', 'trapmaster', 1);
    expect(within(t).getByRole('button', { name: /Sell Heavy Armour for/, hidden: true })).toBeTruthy();
    expect(within(t).queryByRole('button', { name: /Sell Firepots/, hidden: true })).toBeNull();
  });
});

describe('the War Beasts section of the Beastmaster', () => {
  it('has its own section with each beast\'s stats and abilities, and buttons to take one on and let one go', async () => {
    const d = sheet('reavers', 'beastmaster');
    const sec = d.querySelector('section[aria-label="War Beasts"]')!;
    expect(sec).toBeTruthy();
    expect(within(sec as HTMLElement).getAllByRole('listitem', { hidden: true })).toHaveLength(3);
    const hound = within(sec as HTMLElement).getByRole('listitem', { name: 'Estalian Warhound', hidden: true });
    expect(hound.textContent).toMatch(/25 gc/);
    expect(hound.textContent).toMatch(/0 of 2/);
    expect(within(hound).getByRole('img', { name: /^M 6, WS 4, BS 0, S 4, T 3, W 1, I 4, A 1, Ld 5/, hidden: true })).toBeTruthy();
    expect(hound.textContent).toMatch(/Animal/);
    const user = userEvent.setup();
    await user.click(within(hound).getByRole('button', { name: 'Add Estalian Warhound', hidden: true }));
    expect(act.addBeast).toHaveBeenCalledWith('warhound');
    expect((within(hound).getByRole('button', { name: 'Let Estalian Warhound go', hidden: true }) as HTMLButtonElement).disabled).toBe(true); // none to let go yet
  });

  it('is not there for a warrior with no beasts', () => {
    const d = sheet('reavers', 'conqueror');
    expect(d.querySelector('section[aria-label="War Beasts"]')).toBeNull();
  });
});


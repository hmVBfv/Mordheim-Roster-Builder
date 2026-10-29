/* Wish #135 (Rob, 29.10.2026): in the equipment sheet "Carried" comes first and is set apart from the lists the buying is done in. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { EquipmentSheet, type EquipmentActions } from './EquipmentSheet.tsx';
import { equipmentView } from './equipment.ts';
import { createWarband } from './view.ts';

beforeAll(polyfillDialog);
afterEach(cleanup);

const act: EquipmentActions = { qty: vi.fn(), addRare: vi.fn(), rareQty: vi.fn(), upgrade: vi.fn(), paid: vi.fn() };

function sheet() {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(c(s), 'capt');
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

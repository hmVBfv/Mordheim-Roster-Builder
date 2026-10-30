/* Bug #151 (Rob, 29.10.2026): a known spell made easier to cast twice is two entries, each with its own "Remove". */
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { polyfillDialog } from '../test/dialog.ts';
import { TakenSheet } from './AdvanceSheet.tsx';

beforeAll(polyfillDialog);
afterEach(cleanup);

function sheet(red: number) {
  const onRemove = vi.fn();
  const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
  const taken = { advances: [], skills: [], spells: [{ i: 0, name: 'Hammer of Sigmar', red }] };
  render(<TakenSheet dialogRef={ref} close={(after) => after?.()} name="Brother Anselm" taken={taken} onRemove={onRemove} />);
  return { d: document.querySelector('dialog')!, onRemove };
}

describe('the taken advances of a spell made easier to cast (#151)', () => {
  it('lists one entry per step, each with its own Remove, and never "2 easier to cast"', async () => {
    const { d, onRemove } = sheet(2);
    const rows = within(d).getAllByRole('listitem', { hidden: true });
    expect(rows.map((r) => r.textContent)).toEqual(['Hammer of Sigmar1 easier to castRemove', 'Hammer of Sigmar1 easier to castRemove']);
    await userEvent.setup().click(within(rows[1]!).getByRole('button', { name: 'Remove', hidden: true }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0]![0]).toEqual({ kind: 'unreduce', index: 0 });
  });

  it('a spell without a step is one entry, as before', () => {
    const { d } = sheet(0);
    expect(within(d).getAllByRole('listitem', { hidden: true }).map((r) => r.textContent)).toEqual(['Hammer of Sigmarspell' + 'Remove']);
  });
});

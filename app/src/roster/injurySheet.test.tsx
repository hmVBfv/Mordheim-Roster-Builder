/* A henchman can be written off as dead without a roll: "Out of action for good" (report of 4.11.2026). The Heroes had it; the D6 sheet is the
   henchmen's way, with the die already on 1 and the man to pick. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { polyfillDialog } from '../test/dialog.ts';
import { InjurySheet, type InjuryFor } from './InjurySheet.tsx';

beforeAll(polyfillDialog);
afterEach(cleanup);

const men = [{ i: 0, name: 'Otto' }, { i: 1, name: 'Warrior 2' }];

function open(who: InjuryFor) {
  const onApply = vi.fn();
  const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
  render(<InjurySheet dialogRef={ref} close={(after) => after?.()} who={{ ...who, key: 1 }} onApply={onApply} />);
  return { d: within(document.querySelector('dialog')!), onApply };
}

describe('a henchman out of action for good', () => {
  it('has the die on 1, names the heading, asks who, and writes the man off as dead', async () => {
    const { d, onApply } = open({ kind: 'hench', uid: 7, name: 'Warriors', men, dice: '1' });
    expect(d.getByRole('heading', { name: 'Out of action for good · Warriors', hidden: true })).toBeTruthy();
    expect((d.getByRole('textbox', { name: 'D6 as rolled', hidden: true }) as HTMLInputElement).value).toBe('1');
    const user = userEvent.setup();
    await user.click(d.getByRole('button', { name: 'Warrior 2', hidden: true }));
    await user.click(d.getByRole('button', { name: 'Apply', hidden: true }));
    expect(onApply).toHaveBeenCalledWith({ d6: 1, member: 1 }, expect.stringMatching(/Warrior 2 is dead/));
  });

  it('is the ordinary roll without the preset: empty die, "Out of action" heading', () => {
    const { d } = open({ kind: 'hench', uid: 7, name: 'Warriors', men });
    expect(d.getByRole('heading', { name: 'Out of action · Warriors', hidden: true })).toBeTruthy();
    expect((d.getByRole('textbox', { name: 'D6 as rolled', hidden: true }) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/mistake/)).toBeNull();
  });
});

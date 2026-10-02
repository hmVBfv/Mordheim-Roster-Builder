/* The bubble behind a word on a card (Rob, 02.10.2026: "essential"): a tap
   opens it, a tap anywhere, Esc or another word closes it, one at a time; a
   mouse resting on the word opens it too. */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TipWord } from './Tip.tsx';

const SWORD = [{ name: 'Sword', line: 'Close combat', text: 'Parry: when hit, roll a D6.' }];
const FEAR = [{ name: 'Fear', line: 'Psychology', text: 'Causes fear.' }];

function card() {
  return render(
    <p>
      <TipWord label="Sword" tips={SWORD} />, <TipWord label="Fear" tips={FEAR} />, <TipWord label="Lost his hat" tips={[]} />
      <button type="button">Advance</button>
    </p>,
  );
}

afterEach(cleanup);

describe('a word with its rules', () => {
  it('opens on a tap, with name, kind and text', async () => {
    const user = userEvent.setup();
    card();
    const sword = screen.getByRole('button', { name: 'Sword' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.click(sword);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('SwordClose combatParry: when hit, roll a D6.');
    expect(sword.getAttribute('aria-expanded')).toBe('true');
    expect(sword.getAttribute('aria-describedby')).toBe(tip.id);
    // a second tap closes it
    await user.click(sword);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('one at a time; a tap elsewhere or Esc closes it, and that tap still counts', async () => {
    const user = userEvent.setup();
    let advanced = 0;
    card();
    screen.getByRole('button', { name: 'Advance' }).addEventListener('click', () => { advanced++; });
    await user.click(screen.getByRole('button', { name: 'Sword' }));
    await user.click(screen.getByRole('button', { name: 'Fear' }));
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip').textContent).toContain('Causes fear.');
    await user.click(screen.getByRole('button', { name: 'Advance' }));
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(advanced).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Fear' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('with a mouse it opens while the pointer rests on the word; a click keeps it', async () => {
    const user = userEvent.setup();
    card();
    const fear = screen.getByRole('button', { name: 'Fear' });
    await user.hover(fear);
    expect(screen.getByRole('tooltip').textContent).toContain('Causes fear.');
    await user.unhover(fear);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.hover(fear);
    await user.click(fear);
    await user.unhover(fear);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('a word without rules is just a word', () => {
    card();
    expect(screen.queryByRole('button', { name: 'Lost his hat' })).toBeNull();
    expect(screen.getByText(/Lost his hat/)).toBeTruthy();
  });
});

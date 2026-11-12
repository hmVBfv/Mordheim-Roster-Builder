/* The bubble behind a word on a card (Rob, 02.10.2026: "essential"): a tap
   opens it, a tap anywhere, Esc or another word closes it, one at a time; a
   mouse resting on the word opens it too. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  /* #259: a long list of spells is taller than the screen. A swipe on the bubble must scroll it, not close it; a tap beside it still closes. */
  describe('a bubble taller than the room it has (#259)', () => {
    const tall = [{ name: 'Spells', line: 'List', text: 'Many spells.' }];

    it('stays open when the bubble itself is touched, and a tap beside it closes it', async () => {
      const user = userEvent.setup();
      card();
      await user.click(screen.getByRole('button', { name: 'Sword' }));
      fireEvent.pointerDown(screen.getByRole('tooltip'));
      expect(screen.getByRole('tooltip')).toBeTruthy();
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Advance' }));
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('is placed again when the window resizes or the page scrolls, and not when the bubble scrolls', async () => {
      const user = userEvent.setup();
      card();
      await user.click(screen.getByRole('button', { name: 'Sword' }));
      const tip = screen.getByRole('tooltip');
      tip.style.top = '1px';
      fireEvent(tip, new Event('scroll'));
      expect(tip.style.top).toBe('1px');
      fireEvent(window, new Event('resize'));
      expect(tip.style.top).not.toBe('1px');
    });

    it('takes touches only when it has something to scroll, so a short bubble still lets taps through', async () => {
      const user = userEvent.setup();
      const heights = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900);
      const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
      render(<TipWord label="Lore" tips={tall} />);
      await user.click(screen.getByRole('button', { name: 'Lore' }));
      expect(screen.getByRole('tooltip').style.pointerEvents).toBe('auto');
      cleanup();
      heights.mockReturnValue(400);
      render(<TipWord label="Lore" tips={tall} />);
      await user.click(screen.getByRole('button', { name: 'Lore' }));
      expect(screen.getByRole('tooltip').style.pointerEvents).toBe('');
      heights.mockRestore();
      client.mockRestore();
    });
  });

  it('a word without rules is just a word', () => {
    card();
    expect(screen.queryByRole('button', { name: 'Lost his hat' })).toBeNull();
    expect(screen.getByText(/Lost his hat/)).toBeTruthy();
  });

  /* #78: the bubble of a word inside an open sheet was drawn into <body>, under the sheet's top layer – a tap showed
     nothing on a phone. Inside a dialog the bubble is drawn inside that dialog. */
  it('inside a sheet the bubble is drawn inside the sheet, not behind it (#78)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <dialog open aria-label="Sheet"><p><TipWord label="Sword" tips={SWORD} /></p></dialog>
        <p><TipWord label="Fear" tips={FEAR} /></p>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Sword' }));
    expect(screen.getByRole('dialog', { name: 'Sheet' }).contains(screen.getByRole('tooltip'))).toBe(true);
    // a word on the page itself keeps drawing into the body
    await user.click(screen.getByRole('button', { name: 'Fear' }));
    expect(document.querySelector('dialog')!.contains(screen.getByRole('tooltip'))).toBe(false);
  });
});

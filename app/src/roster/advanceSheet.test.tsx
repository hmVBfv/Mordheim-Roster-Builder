/* Bug #144 (Rob, 29.10.2026): a row of the Heroes' table that says "roll a D6" (6, 8, 9) is not a free choice; the sheet asks for the die.
   Bug #145: when both characteristics of such a row are at their maximum, the sheet says plainly to roll the 2D6 again. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { AdvanceSheet } from './AdvanceSheet.tsx';
import { advanceView } from './advance.ts';
import { createWarband } from './view.ts';

beforeAll(polyfillDialog);
afterEach(cleanup);

/** A Youngblood who has already taken `adv` (a huge number puts a characteristic past its maximum). */
function sheet(adv: Partial<Record<core.StatKey, number>> = {}) {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(c(s), 'young');
  const uid = s.models[0]!.uid;
  s = { ...s, models: s.models.map((m) => ({ ...m, adv: { ...m.adv, ...adv } })) };
  const view = { ...advanceView(c(s), uid)!, key: 1 };
  const onApply = vi.fn();
  const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
  render(<AdvanceSheet dialogRef={ref} close={(after) => after?.()} view={view} onApply={onApply} />);
  return { d: document.querySelector('dialog')!, onApply };
}

const q = (d: HTMLElement) => within(d);

describe('a row that says "roll a D6" asks for the die (#144)', () => {
  it('gives Strength on 1-3 and Attack on 4-6, and offers no free choice between them', async () => {
    const { d, onApply } = sheet();
    const user = userEvent.setup();
    await user.type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '6');
    expect(q(d).queryByRole('button', { name: /^\+1 Strength/, hidden: true })).toBeNull();
    const apply = q(d).getByRole('button', { name: 'Apply', hidden: true }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    const die = q(d).getByRole('textbox', { name: 'D6 as rolled', hidden: true });
    await user.type(die, '3');
    expect(q(d).getByText('+1 Strength', { hidden: true } as never)).toBeTruthy();
    await user.click(apply);
    expect(onApply).toHaveBeenLastCalledWith({ kind: 'stat', stat: 'S' }, expect.any(String));
    await user.clear(die);
    await user.type(die, '4');
    await user.click(apply);
    expect(onApply).toHaveBeenLastCalledWith({ kind: 'stat', stat: 'A' }, expect.any(String));
  });

  it('keeps the free choice where the table says "choose one" (7)', async () => {
    const { d } = sheet();
    const user = userEvent.setup();
    await user.type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '7');
    expect(q(d).getByRole('button', { name: /^\+1 Weapon Skill/, hidden: true })).toBeTruthy();
    expect(q(d).queryByRole('textbox', { name: 'D6 as rolled', hidden: true })).toBeNull();
  });

  it('takes the other characteristic when the one the die names is at its maximum', async () => {
    const { d, onApply } = sheet({ S: 9 });
    const user = userEvent.setup();
    await user.type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '6');
    await user.type(q(d).getByRole('textbox', { name: 'D6 as rolled', hidden: true }), '1');
    expect(d.textContent).toMatch(/Strength is at his maximum: he takes Attack/);
    await user.click(q(d).getByRole('button', { name: 'Apply', hidden: true }));
    expect(onApply).toHaveBeenLastCalledWith({ kind: 'stat', stat: 'A' }, expect.any(String));
  });
});

describe('both at their maximum: roll again (#145)', () => {
  it('says so in a notice, asks for no die, cannot be applied, and clears the 2D6 on "Roll again"', async () => {
    const { d } = sheet({ S: 9, A: 9 });
    const user = userEvent.setup();
    const roll = q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }) as HTMLInputElement;
    await user.type(roll, '6');
    const notice = q(d).getByRole('alert', { hidden: true });
    expect(notice.textContent).toMatch(/Roll the 2D6 again/);
    expect(q(d).queryByRole('textbox', { name: 'D6 as rolled', hidden: true })).toBeNull();
    expect((q(d).getByRole('button', { name: 'Apply', hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(notice).getByRole('button', { name: 'Roll again', hidden: true }));
    expect(roll.value).toBe('');
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull();
  });
});

/** A Wizard of the Merchant Caravans, who can learn a spell instead of a skill. */
function caster() {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s = createWarband(data, 'caravans', null, 'The Grey Company');
  s = core.addUnit(c(s), 'magician');
  const view = { ...advanceView(c(s), s.models[0]!.uid)!, key: 1 };
  const onApply = vi.fn();
  const ref = { current: null } as React.RefObject<HTMLDialogElement | null>;
  render(<AdvanceSheet dialogRef={ref} close={(after) => after?.()} view={view} onApply={onApply} />);
  return { d: document.querySelector('dialog')!, onApply, lore: view.spells!.lore };
}

describe('a new skill or a spell is one choice between two equal kinds (#147)', () => {
  it('shows "New skill" and "Spell" side by side, the skills first, and swaps the list under them', async () => {
    const { d, lore } = caster();
    const user = userEvent.setup();
    await user.type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '3');
    const kinds = q(d).getByRole('group', { name: 'What he learns', hidden: true });
    const [skill, spell] = within(kinds).getAllByRole('button', { hidden: true });
    expect(skill!.textContent).toBe('New skill');
    expect(spell!.textContent).toBe(`Spell · ${lore}`);
    expect(skill!.getAttribute('aria-pressed')).toBe('true');
    expect(q(d).queryByRole('group', { name: lore, hidden: true })).toBeNull();
    await user.click(spell!);
    expect(spell!.getAttribute('aria-pressed')).toBe('true');
    expect(q(d).getByRole('group', { name: lore, hidden: true })).toBeTruthy();
    expect(q(d).queryByRole('group', { name: 'Combat', hidden: true })).toBeNull();
  });

  it('a Hero who casts nothing sees no such choice', async () => {
    const { d } = sheet();
    await userEvent.setup().type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '3');
    expect(q(d).queryByRole('group', { name: 'What he learns', hidden: true })).toBeNull();
  });
});

describe('the skills and the spells are lists in columns, not a heap of buttons (#146, #148)', () => {
  it('sets each list as list items, a spell with its casting value beside its name', async () => {
    const { d, lore } = caster();
    const user = userEvent.setup();
    await user.type(q(d).getByRole('textbox', { name: '2D6 as rolled', hidden: true }), '3');
    const skills = q(d).getAllByRole('list', { hidden: true }).filter((l) => l.closest('[role=group]'));
    expect(skills.length).toBeGreaterThan(0);
    for (const l of skills) for (const li of within(l).getAllByRole('listitem', { hidden: true })) expect(within(li).getAllByRole('button', { hidden: true })).toHaveLength(1);
    await user.click(within(q(d).getByRole('group', { name: 'What he learns', hidden: true })).getByRole('button', { name: /^Spell/, hidden: true }));
    const items = within(q(d).getByRole('group', { name: lore, hidden: true })).getAllByRole('listitem', { hidden: true });
    expect(items.length).toBeGreaterThan(2);
    for (const li of items) expect(li.textContent).toMatch(/cast on (\d+|auto)\+?/);
  });
});

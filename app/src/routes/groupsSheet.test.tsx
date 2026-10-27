/* Report #105: in the groups sheet a group's name field and its Rename and Remove buttons were bare children of the list item, so
   on a phone the field and the buttons ran into each other. Each group is a row that wraps: the field on a line of its own, the
   buttons under it. jsdom lays nothing out, so this reads the markup and the style sheet. */
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LibraryWarbandGroup } from '../library/api.ts';
import { GroupsSheet } from './GroupsSheet.tsx';

afterEach(cleanup);

const group = { id: 'g1', kind: 'warband_group', name: 'Reikland bands', body: { warbands: [] }, createdAt: '', updatedAt: '', deletedAt: null, seq: 1 } as LibraryWarbandGroup;
const api = { groups: [group], ready: true, error: null, groupOf: () => '', create: vi.fn(), rename: vi.fn(), remove: vi.fn(), assign: vi.fn() } as never;
const css = readFileSync('src/ui/ui.module.css', 'utf8');
const rule = (sel: string) => new RegExp(`(?:^|\\n)\\.${sel}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('the groups sheet', () => {
  it('lays each group out as a row that wraps, the name field on a line of its own over the buttons', () => {
    render(<GroupsSheet api={api} close={() => undefined} titleId="t" />);
    const li = screen.getByLabelText('Name of Reikland bands').closest('li')!;
    expect(li.className).toMatch(/groupRow/);
    expect(li.contains(screen.getByRole('button', { name: 'Remove Reikland bands' }))).toBe(true);
    const r = rule('groupRow');
    expect(r).toMatch(/display:\s*flex/);
    expect(r).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('groupRow \\.input')).toMatch(/flex:\s*1 1 100%/);
  });
});
